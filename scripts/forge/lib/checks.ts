import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { INDEX_MD, REPO_ROOT, characterOutputsDir } from "./paths.ts";
import {
  listCharacterIds,
  listRuns,
  readCharacter,
  pathExists,
  relToRepo,
  readLatestLogEntry,
  type CharacterInfo,
} from "./character.ts";
import { readManifest, missingRequiredFields } from "./manifest.ts";
import { readPrompt } from "./markdown.ts";
import {
  parseLexiconRef,
  isNegativesRef,
  lexiconFileExists,
  resolveLexiconFragment,
} from "./lexicon.ts";
import type { Finding } from "./output.ts";

export interface CheckOptions {
  characterIds?: string[]; // null/undefined = all
  includePromotionGate?: boolean; // lint 用の追加チェック
}

export async function runChecks(opts: CheckOptions = {}): Promise<Finding[]> {
  const findings: Finding[] = [];
  const ids = opts.characterIds ?? (await listCharacterIds());

  if (!opts.characterIds) {
    findings.push(...(await checkIndexDrift(ids)));
  }

  for (const id of ids) {
    findings.push(...(await checkCharacter(id, opts.includePromotionGate ?? false)));
  }

  return findings;
}

async function checkIndexDrift(characterIds: string[]): Promise<Finding[]> {
  const out: Finding[] = [];
  if (!(await pathExists(INDEX_MD))) {
    out.push({ severity: "warn", scope: "INDEX.md", message: "INDEX.md が存在しない" });
    return out;
  }
  const raw = await readFile(INDEX_MD, "utf8");
  const listed = new Set<string>();
  for (const m of raw.matchAll(/\[([a-z0-9-]+)\]\(characters\/\1\/index\.md\)/g)) {
    listed.add(m[1]);
  }
  for (const id of characterIds) {
    if (!listed.has(id)) {
      out.push({
        severity: "warn",
        scope: "INDEX.md",
        message: `characters/${id} が INDEX.md の Characters 表に未記載`,
        hint: "`pnpm forge index --write` で自動反映できる",
      });
    }
  }
  for (const id of listed) {
    if (!characterIds.includes(id)) {
      out.push({
        severity: "warn",
        scope: "INDEX.md",
        message: `INDEX.md が存在しないキャラ '${id}' を参照している`,
      });
    }
  }
  return out;
}

async function checkCharacter(
  id: string,
  promotion: boolean,
): Promise<Finding[]> {
  const out: Finding[] = [];
  const info = await readCharacter(id);
  const scope = `characters/${id}`;

  if (!info.hasIndex) {
    out.push({ severity: "error", scope, message: "index.md が無い" });
    return out;
  }
  if (info.frontmatterError) {
    out.push({
      severity: "error",
      scope,
      message: `index.md の frontmatter が壊れている: ${info.frontmatterError}`,
    });
  }
  if (info.frontmatter) {
    const fm = info.frontmatter;
    const missing: string[] = [];
    for (const f of ["id", "name", "status", "base_version"] as const) {
      if (!fm[f]) missing.push(f);
    }
    if (missing.length) {
      out.push({
        severity: "error",
        scope,
        message: `frontmatter の必須フィールド欠落: ${missing.join(", ")}`,
      });
    }
    if (fm.id && fm.id !== id) {
      out.push({
        severity: "error",
        scope,
        message: `frontmatter の id (${fm.id}) がディレクトリ名 (${id}) と不一致`,
      });
    }
  }

  if (!info.hasBase) {
    out.push({ severity: "error", scope, message: "prompts/base.md が無い" });
  } else {
    const base = await readPrompt(resolve(info.dir, "prompts", "base.md"));
    if (!base.positive) {
      out.push({
        severity: "error",
        scope,
        message: "prompts/base.md に '## 本文プロンプト' のコードブロックが見つからない",
      });
    }
    if (!base.baseVersionDep) {
      out.push({
        severity: "warn",
        scope,
        message: "prompts/base.md に '## 依存ベースバージョン' が無い",
      });
    }
    if (info.frontmatter?.base_version && base.baseVersionDep) {
      if (info.frontmatter.base_version !== base.baseVersionDep) {
        out.push({
          severity: "warn",
          scope,
          message: `index.md base_version (${info.frontmatter.base_version}) と base.md 依存バージョン (${base.baseVersionDep}) が不一致`,
        });
      }
    }
  }

  if (!info.hasLog) {
    out.push({ severity: "warn", scope, message: "log.md が無い" });
  }

  out.push(...(await checkVariants(id)));
  out.push(...(await checkHistoryConsistency(id, info)));
  out.push(...(await checkRuns(id, promotion)));
  out.push(...(await checkReferencesConsistency(id)));

  if (promotion) {
    out.push(...(await checkPromotionGate(id, info)));
  }

  return out;
}

async function checkVariants(id: string): Promise<Finding[]> {
  const out: Finding[] = [];
  const variantsDir = resolve(REPO_ROOT, "characters", id, "prompts", "variants");
  if (!(await pathExists(variantsDir))) return out;

  const paths = await walkMarkdownFiles(variantsDir);
  for (const absPath of paths) {
    const scope = relToRepo(absPath);
    const prompt = await readPrompt(absPath);
    if (!prompt.positive) {
      out.push({
        severity: "error",
        scope,
        message: "'## 本文プロンプト' コードブロックが無い",
      });
    }
    if (!prompt.negative) {
      out.push({
        severity: "warn",
        scope,
        message: "'## ネガティブプロンプト' コードブロックが無い",
      });
    }
    if (!prompt.baseVersionDep) {
      out.push({ severity: "warn", scope, message: "'## 依存ベースバージョン' が無い" });
    }

    for (const raw of prompt.lexiconRefs) {
      const ref = parseLexiconRef(raw);
      if (!ref) {
        out.push({
          severity: "warn",
          scope,
          message: `'${raw}' は 'lexicon/<cat>.md#<slug>' 形式として解釈できない`,
        });
        continue;
      }
      if (isNegativesRef(ref)) {
        out.push({
          severity: "error",
          scope,
          message: `Lexicon 参照に '${ref.raw}' が含まれている (AGENTS.md §4.5 違反、negatives は手動コピー運用)`,
        });
        continue;
      }
      if (!(await lexiconFileExists(ref))) {
        out.push({
          severity: "error",
          scope,
          message: `参照先 '${ref.file}' が存在しない`,
        });
        continue;
      }
      const fragment = await resolveLexiconFragment(ref);
      if (fragment === null) {
        out.push({
          severity: "error",
          scope,
          message: `'${ref.raw}' のエントリまたは '**プロンプト断片**:' が解決できない`,
        });
      }
    }
  }
  return out;
}

async function checkHistoryConsistency(
  id: string,
  info: CharacterInfo,
): Promise<Finding[]> {
  const out: Finding[] = [];
  const historyDir = resolve(REPO_ROOT, "characters", id, "prompts", "history");
  if (!(await pathExists(historyDir))) {
    out.push({
      severity: "warn",
      scope: `characters/${id}`,
      message: "prompts/history/ が無い (base の履歴が保存されていない)",
    });
    return out;
  }
  const current = info.frontmatter?.base_version;
  if (!current) return out;
  const expected = `base.${current}.md`;
  if (!(await pathExists(resolve(historyDir, expected)))) {
    out.push({
      severity: "warn",
      scope: `characters/${id}`,
      message: `prompts/history/${expected} が無い (現行 base_version = ${current})`,
    });
  }
  return out;
}

async function checkRuns(id: string, promotion: boolean): Promise<Finding[]> {
  const out: Finding[] = [];
  const runs = await listRuns(id);
  for (const runId of runs) {
    const runDir = resolve(characterOutputsDir(id), runId);
    const scope = `characters/${id}/outputs/${runId}`;
    const hasPrompt = await pathExists(resolve(runDir, "prompt.txt"));
    const hasNegative = await pathExists(resolve(runDir, "negative.txt"));
    const manifest = await readManifest(id, runId);

    if (!manifest) {
      out.push({
        severity: "error",
        scope,
        message: "manifest.json が無い、または JSON として読めない",
      });
      continue;
    }
    const missing = missingRequiredFields(manifest);
    if (missing.length) {
      out.push({
        severity: "warn",
        scope,
        message: `manifest.json の推奨フィールド欠落: ${missing.join(", ")}`,
      });
    }
    if (manifest.run_id && manifest.run_id !== runId) {
      out.push({
        severity: "error",
        scope,
        message: `manifest.run_id (${manifest.run_id}) がディレクトリ名 (${runId}) と不一致`,
      });
    }
    if (manifest.character && manifest.character !== id) {
      out.push({
        severity: "error",
        scope,
        message: `manifest.character (${manifest.character}) がキャラ ID (${id}) と不一致`,
      });
    }
    if (manifest.tool === "prompt-compile") {
      if (!hasPrompt) {
        out.push({
          severity: "warn",
          scope,
          message: "prompt-compile run だが prompt.txt が無い",
        });
      }
      if (!hasNegative) {
        out.push({
          severity: "info",
          scope,
          message: "prompt-compile run に negative.txt が無い",
        });
      }
    }
    if (manifest.compiled_prompt && hasPrompt) {
      const onDisk = (await readFile(resolve(runDir, "prompt.txt"), "utf8")).trim();
      const manifestPrompt = manifest.compiled_prompt.trim();
      if (onDisk !== manifestPrompt) {
        // プレースホルダー判定
        if (/^\(see prompt\.txt\)$/i.test(manifestPrompt)) {
          out.push({
            severity: promotion ? "error" : "warn",
            scope,
            message: "manifest.compiled_prompt がプレースホルダー '(see prompt.txt)' のまま",
            hint: "再現のため prompt.txt の中身をそのまま compiled_prompt に入れる",
          });
        } else {
          out.push({
            severity: promotion ? "error" : "warn",
            scope,
            message: "prompt.txt と manifest.compiled_prompt が乖離している",
            hint: "prompt.txt を正として manifest を書き直すか、再 compile する",
          });
        }
      }
    }
  }
  return out;
}

async function checkReferencesConsistency(id: string): Promise<Finding[]> {
  const out: Finding[] = [];
  const refsDir = resolve(REPO_ROOT, "characters", id, "references");
  const imagesDir = resolve(refsDir, "images");
  const sourcesYaml = resolve(refsDir, "sources.yaml");
  if (!(await pathExists(imagesDir))) return out;
  const files = (await readdir(imagesDir)).filter((f) => !f.startsWith("."));
  const anchors = files.filter((f) => /anchor/i.test(f));
  if (anchors.length === 0 && files.length > 0) {
    out.push({
      severity: "info",
      scope: `characters/${id}/references`,
      message: "anchor 命名ファイルが無い (キャラの視覚的同一性を固定する石が未設置)",
    });
  }
  if (!(await pathExists(sourcesYaml)) && files.length > 0) {
    out.push({
      severity: "warn",
      scope: `characters/${id}/references`,
      message: "images/ にファイルがあるが sources.yaml が無い",
    });
  }
  return out;
}

async function checkPromotionGate(id: string, info: CharacterInfo): Promise<Finding[]> {
  // lint --promotion 時の追加チェック。status: stable 昇格前や外部 generator 投入前の品質ゲート。
  const out: Finding[] = [];
  const scope = `characters/${id}`;

  const latest = await readLatestLogEntry(id);
  if (latest && (latest.nextAction === null || latest.nextAction.trim() === "")) {
    out.push({
      severity: "error",
      scope,
      message: "log.md の最新エントリに '次の改善' が空 (ログスキーマ違反)",
    });
  }

  // stable 昇格候補なら anchor 最低1枚を必須化
  if (info.frontmatter?.status === "stable") {
    const images = resolve(info.dir, "references", "images");
    if (await pathExists(images)) {
      const files = (await readdir(images)).filter((f) => !f.startsWith("."));
      const anchors = files.filter((f) => /anchor/i.test(f));
      if (anchors.length === 0) {
        out.push({
          severity: "error",
          scope,
          message: "status: stable だが anchor が 1 枚も無い",
          hint: "face-anchor.* を少なくとも 1 枚配置する",
        });
      }
    } else {
      out.push({
        severity: "error",
        scope,
        message: "status: stable だが references/images/ が存在しない",
      });
    }
  }

  return out;
}

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkMarkdownFiles(p)));
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}
