import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import {
  characterBasePrompt,
  characterVariantPrompt,
  characterOutputsDir,
  REPO_ROOT,
} from "./paths.ts";
import { readPrompt, type PromptSections } from "./markdown.ts";
import { pathExists } from "./character.ts";
import {
  parseLexiconRef,
  isNegativesRef,
  lexiconFileExists,
  resolveLexiconFragment,
  type LexiconRef,
} from "./lexicon.ts";
import type { Manifest } from "./manifest.ts";

export class CompileError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = "CompileError";
  }
}

export interface CompileInput {
  characterId: string;
  variantId: string; // "three-view" or "scenes/mountain-ambush"
  standalone: boolean; // true → run_id に _compile を付ける
  now?: Date;
}

export interface CompileArtifacts {
  runId: string;
  runDir: string;
  prompt: string;
  negative: string;
  manifest: Manifest;
  lexiconUsed: string[];
  warnings: string[];
}

const compileWriteLocks = new Map<string, Promise<void>>();

export async function compile(input: CompileInput): Promise<CompileArtifacts> {
  const warnings: string[] = [];
  const basePath = characterBasePrompt(input.characterId);
  const variantPath = characterVariantPrompt(input.characterId, input.variantId);

  if (!(await pathExists(basePath))) {
    throw new CompileError(`base.md not found: ${basePath}`, 1);
  }
  if (!(await pathExists(variantPath))) {
    throw new CompileError(`variant not found: ${variantPath}`, 1);
  }

  const base = await readPrompt(basePath);
  const variant = await readPrompt(variantPath);

  validateSections(base, "base.md");
  validateSections(variant, `variants/${input.variantId}.md`);

  if (base.baseVersionDep !== variant.baseVersionDep) {
    throw new CompileError(
      `dep version mismatch: base.md declares '${base.baseVersionDep ?? "?"}' but variant declares '${variant.baseVersionDep ?? "?"}'`,
      3,
    );
  }
  const baseVersion = base.baseVersionDep;
  if (!baseVersion) {
    throw new CompileError("base.md / variant.md both missing '## 依存ベースバージョン'", 2);
  }

  // Lexicon 参照の解決（variant 側のみ、base は authoring reference）
  const { fragments, lexiconUsed, refWarnings } = await resolveVariantLexicon(
    variant.lexiconRefs,
    input.variantId,
  );
  warnings.push(...refWarnings);

  const prompt = joinPositive(base.positive!, variant.positive!, fragments);
  const negative = joinNegative(base.negative ?? "", variant.negative ?? "");

  const now = input.now ?? new Date();
  const dateStr = formatJstDate(now);
  const variantBasename = input.variantId.split("/").pop()!;
  const baseRunId = buildRunId(dateStr, variantBasename, baseVersion, input.standalone);
  const { runId, runDir } = await allocateRunId(input.characterId, baseRunId);

  const manifest: Manifest = {
    run_id: runId,
    character: input.characterId,
    variant_id: input.variantId,
    base_version: baseVersion,
    base_sha: safeGitHashObject(basePath) ?? undefined,
    tool: input.standalone ? "prompt-compile" : "prompt-compile",
    tool_version: safeRepoShortSha() ?? "unknown",
    prompt_file: `prompts/variants/${input.variantId}.md`,
    lexicon_used: lexiconUsed,
    references: [],
    source_entities: [],
    seed: null,
    compiled_prompt: prompt,
    compiled_negative: negative,
    outputs: [],
    thumbnails: [],
    created_at: isoStringWithJst(now),
    created_by: `forge-cli@0.1.0`,
  };

  return {
    runId,
    runDir,
    prompt,
    negative,
    manifest,
    lexiconUsed,
    warnings,
  };
}

/** compile と immutable run 書き出しを1つの直列化境界で行う。 */
export async function compileToDisk(input: CompileInput): Promise<CompileArtifacts> {
  const lockKey = characterOutputsDir(input.characterId);
  return withCompileWriteLock(lockKey, async () => {
    const artifacts = await compile(input);
    await writeCompileArtifacts(artifacts);
    return artifacts;
  });
}

/** CLI / Studio 共通の3成果物書き出し。既存 run は決して上書きしない。 */
export async function writeCompileArtifacts(
  artifacts: CompileArtifacts,
): Promise<void> {
  const parent = dirname(artifacts.runDir);
  await mkdir(parent, { recursive: true });
  if (await pathExists(artifacts.runDir)) {
    throw new CompileError(`run_id collision: '${artifacts.runId}' already exists`, 6);
  }
  const staging = await mkdtemp(resolve(parent, ".compile-staging-"));
  let committed = false;
  try {
    await Promise.all([
      writeFile(resolve(staging, "prompt.txt"), artifacts.prompt, "utf8"),
      writeFile(resolve(staging, "negative.txt"), artifacts.negative, "utf8"),
      writeFile(
        resolve(staging, "manifest.json"),
        JSON.stringify(artifacts.manifest, null, 2) + "\n",
        "utf8",
      ),
    ]);
    if (await pathExists(artifacts.runDir)) {
      throw new CompileError(`run_id collision: '${artifacts.runId}' already exists`, 6);
    }
    await rename(staging, artifacts.runDir);
    committed = true;
  } catch (error) {
    if (error instanceof CompileError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "ENOTEMPTY") {
      throw new CompileError(`run_id collision: '${artifacts.runId}' already exists`, 6);
    }
    throw error;
  } finally {
    if (!committed) await rm(staging, { recursive: true, force: true });
  }
}

function validateSections(p: PromptSections, label: string): void {
  if (p.positive === null) {
    throw new CompileError(
      `'${label}' is missing required section '## 本文プロンプト' (or its code block)`,
      2,
    );
  }
  // variant は §3.2 で `## Lexicon 参照` セクション自体が必須。readPrompt は常に配列を返すので
  // セクション欠落は lexiconRefs=[] と区別できない。raw を確認する。
  if (!/^##\s+Lexicon\s+参照\s*$/m.test(p.raw) && label.includes("variants/")) {
    throw new CompileError(
      `variant '${label}' is missing required section '## Lexicon 参照'`,
      2,
    );
  }
}

async function resolveVariantLexicon(
  rawRefs: string[],
  variantId: string,
): Promise<{ fragments: string[]; lexiconUsed: string[]; refWarnings: string[] }> {
  const seen = new Set<string>();
  const refs: LexiconRef[] = [];
  const refWarnings: string[] = [];

  for (const raw of rawRefs) {
    const ref = parseLexiconRef(raw);
    if (!ref) {
      throw new CompileError(
        `variant '${variantId}' has malformed Lexicon ref '${raw}' (expected 'lexicon/<cat>.md#<slug>')`,
        4,
      );
    }
    if (isNegativesRef(ref)) {
      throw new CompileError(
        `variant '${variantId}' references '${ref.raw}' in '## Lexicon 参照'; negatives must be pasted manually into '## ネガティブプロンプト' block (see AGENTS.md §4.5)`,
        5,
      );
    }
    if (seen.has(ref.raw)) {
      refWarnings.push(`duplicate Lexicon ref '${ref.raw}' in variant — later occurrences dropped`);
      continue;
    }
    seen.add(ref.raw);
    refs.push(ref);
  }

  const fragments: string[] = [];
  const used: string[] = [];
  for (const ref of refs) {
    if (!(await lexiconFileExists(ref))) {
      throw new CompileError(`Lexicon file not found: ${ref.file}`, 4);
    }
    const frag = await resolveLexiconFragment(ref);
    if (frag === null) {
      throw new CompileError(
        `Lexicon entry or '**プロンプト断片**:' not found for '${ref.raw}'`,
        4,
      );
    }
    fragments.push(frag);
    used.push(ref.raw);
  }
  return { fragments, lexiconUsed: used, refWarnings };
}

/** base → variant → lexicon の順で空行結合（仕様の心臓部） */
export function joinPositive(
  basePositive: string,
  variantPositive: string,
  fragments: string[],
): string {
  const blocks = [basePositive.trim(), variantPositive.trim(), ...fragments.map((f) => f.trim())];
  return blocks.filter((b) => b.length > 0).join("\n\n") + "\n";
}

/** case-insensitive exact match で dedup（先出し保持） */
export function joinNegative(baseNegative: string, variantNegative: string): string {
  const combined = [baseNegative, variantNegative]
    .filter((s) => s.trim().length > 0)
    .join(", ");
  const normalized = combined.replace(/[\r\n]+/g, ", ").replace(/,\s*,+/g, ",");
  const tokens = normalized
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.join(", ") + "\n";
}

/** run_id のベース部分（_rN 採番前） */
export function buildRunId(
  date: string,
  variantBasename: string,
  baseVersion: string,
  standalone: boolean,
): string {
  const suffix = standalone ? "_compile" : "";
  return `${date}_${variantBasename}_${baseVersion}${suffix}`;
}

/**
 * 既存 run と衝突しない run_id を採番する。
 * base が空いていればそのまま、埋まっていれば `_r2` から。
 */
export async function allocateRunId(
  characterId: string,
  baseRunId: string,
  exists: (dir: string) => Promise<boolean> = pathExists,
  outputsDir: string = characterOutputsDir(characterId),
): Promise<{ runId: string; runDir: string }> {
  let runId = baseRunId;
  let runDir = resolve(outputsDir, runId);
  if (!(await exists(runDir))) return { runId, runDir };
  for (let n = 2; n < 100; n++) {
    runId = `${baseRunId}_r${n}`;
    runDir = resolve(outputsDir, runId);
    if (!(await exists(runDir))) return { runId, runDir };
  }
  throw new CompileError(`run_id collision: '${baseRunId}' exhausted up to _r99`, 6);
}

function formatJstDate(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function isoStringWithJst(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  const ss = String(jst.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}+09:00`;
}

function safeRepoShortSha(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function safeGitHashObject(path: string): string | null {
  try {
    const full = execFileSync("git", ["hash-object", path], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return full.slice(0, 7);
  } catch {
    return null;
  }
}

async function withCompileWriteLock<T>(
  key: string,
  action: () => Promise<T>,
): Promise<T> {
  const previous = compileWriteLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  const tail = previous.then(() => gate);
  compileWriteLocks.set(key, tail);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (compileWriteLocks.get(key) === tail) compileWriteLocks.delete(key);
  }
}
