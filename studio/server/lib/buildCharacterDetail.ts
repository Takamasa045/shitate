import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { characterDir } from "../../../scripts/forge/lib/paths.ts";
import {
  listCharacterIds,
  readCharacter,
  listRuns,
  listReferences,
  readLatestLogEntry,
  pathExists,
} from "../../../scripts/forge/lib/character.ts";
import { readPrompt } from "../../../scripts/forge/lib/markdown.ts";
import { readManifest } from "../../../scripts/forge/lib/manifest.ts";
import { contentRevision } from "./revision.ts";
import type {
  CharacterSummary,
  CharacterDetail,
  CharacterStatus,
  LogEntrySummary,
  VariantSummary,
  VariantDetail,
  RunSummary,
  RunDetail,
  ReferencesSummary,
} from "../../shared/types.ts";

export async function buildCharacterSummaries(): Promise<CharacterSummary[]> {
  const ids = await listCharacterIds();
  return Promise.all(ids.map((id) => buildCharacterSummary(id)));
}

export async function buildCharacterSummary(id: string): Promise<CharacterSummary> {
  const info = await readCharacter(id);
  const fm = info.frontmatter ?? {};
  const runs = await listRuns(id);
  const refs = await listReferences(id);
  const anchors = refs
    .filter((f) => /anchor/i.test(f))
    .map((f) => f.replace(/\.[^.]+$/, "").replace(/-anchor$/i, ""))
    .filter((s) => s.length > 0);
  const anchorFiles = refs.filter((f) => /anchor/i.test(f));
  const primaryImageName =
    anchorFiles.find((f) => /^main-anchor\.(?:jpe?g|png|webp)$/i.test(f)) ??
    anchorFiles.find((f) => /^face-anchor\.(?:jpe?g|png|webp)$/i.test(f)) ??
    anchorFiles[0] ??
    null;
  let threeViewPreview: CharacterSummary["threeViewPreview"] = null;
  for (const runId of runs) {
    const manifest = await readManifest(id, runId);
    if (manifest?.variant_id !== "three-view") continue;
    const images = [
      ...(Array.isArray(manifest.thumbnails) ? manifest.thumbnails : []),
      ...(Array.isArray(manifest.outputs) ? manifest.outputs : []),
    ].filter((name): name is string =>
      typeof name === "string" && /\.(?:jpe?g|png|webp)$/i.test(name),
    );
    if (images[0]) {
      threeViewPreview = { runId, name: images[0] };
      break;
    }
  }
  const latest = await readLatestLogEntry(id);
  return {
    id,
    name: typeof fm.name === "string" ? fm.name : id,
    status: (fm.status ?? null) as CharacterStatus | null,
    baseVersion: typeof fm.base_version === "string" ? fm.base_version : null,
    updated: formatDate(fm.updated),
    sourceEntities: Array.isArray(fm.source_entities)
      ? fm.source_entities.map(String)
      : [],
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    runCount: runs.length,
    anchors,
    primaryImageName,
    threeViewPreview,
    latestLog: latest ? toLogSummary(latest) : null,
  };
}

export async function buildCharacterDetail(id: string): Promise<CharacterDetail | null> {
  const dir = characterDir(id);
  if (!(await pathExists(dir))) return null;
  const summary = await buildCharacterSummary(id);
  const info = await readCharacter(id);
  const fm = info.frontmatter ?? {};
  const indexMd = await readFileSafe(resolve(dir, "index.md"));
  const worldMd = await readFileSafe(resolve(dir, "world.md"));
  const variants = await buildVariantList(id);
  const runs = await buildRunList(id);
  const references = await buildReferencesSummary(id);
  const logEntries = await buildLogEntries(id, 20);
  return {
    ...summary,
    worldRefs: Array.isArray(fm.world_refs) ? fm.world_refs.map(String) : [],
    indexMarkdown: indexMd ?? "",
    worldMarkdown: worldMd,
    variants,
    runs,
    references,
    logEntries,
    frontmatterError: info.frontmatterError,
  };
}

async function buildVariantList(id: string): Promise<VariantSummary[]> {
  const variantsDir = resolve(characterDir(id), "prompts", "variants");
  if (!(await pathExists(variantsDir))) return [];
  const paths = await walkMarkdownFiles(variantsDir);
  return Promise.all(
    paths.map(async (abs) => {
      const variantId = relativePathWithoutExt(variantsDir, abs);
      const prompt = await readPrompt(abs);
      return {
        id: variantId,
        basename: variantId.split("/").pop()!,
        purpose: prompt.purpose,
        baseVersionDep: prompt.baseVersionDep,
        lexiconRefCount: prompt.lexiconRefs.length,
        hasPositive: prompt.positive !== null,
        hasNegative: prompt.negative !== null,
      };
    }),
  );
}

export async function buildVariantDetail(
  id: string,
  variantId: string,
): Promise<VariantDetail | null> {
  const path = resolve(characterDir(id), "prompts", "variants", `${variantId}.md`);
  if (!(await pathExists(path))) return null;
  const prompt = await readPrompt(path);
  return {
    id: variantId,
    basename: variantId.split("/").pop()!,
    purpose: prompt.purpose,
    baseVersionDep: prompt.baseVersionDep,
    lexiconRefCount: prompt.lexiconRefs.length,
    hasPositive: prompt.positive !== null,
    hasNegative: prompt.negative !== null,
    raw: prompt.raw,
    positive: prompt.positive,
    negative: prompt.negative,
    lexiconRefs: prompt.lexiconRefs,
    memo: prompt.memo,
    revision: contentRevision(prompt.raw),
  };
}

export async function buildBasePrompt(id: string): Promise<VariantDetail | null> {
  const path = resolve(characterDir(id), "prompts", "base.md");
  if (!(await pathExists(path))) return null;
  const prompt = await readPrompt(path);
  return {
    id: "base",
    basename: "base",
    purpose: prompt.purpose,
    baseVersionDep: prompt.baseVersionDep,
    lexiconRefCount: prompt.lexiconRefs.length,
    hasPositive: prompt.positive !== null,
    hasNegative: prompt.negative !== null,
    raw: prompt.raw,
    positive: prompt.positive,
    negative: prompt.negative,
    lexiconRefs: prompt.lexiconRefs,
    memo: prompt.memo,
    revision: contentRevision(prompt.raw),
  };
}

async function buildRunList(id: string): Promise<RunSummary[]> {
  const runs = await listRuns(id);
  return Promise.all(
    runs.map(async (runId) => {
      const manifest = await readManifest(id, runId);
      const runDir = resolve(characterDir(id), "outputs", runId);
      const hasPrompt = await pathExists(resolve(runDir, "prompt.txt"));
      const hasNegative = await pathExists(resolve(runDir, "negative.txt"));
      const evaluation = manifest?.evaluation as
        | { overall?: string }
        | undefined;
      return {
        runId,
        tool: manifest?.tool ?? null,
        toolVersion: manifest?.tool_version ?? null,
        createdAt: manifest?.created_at ?? null,
        baseVersion: manifest?.base_version ?? null,
        variantId: manifest?.variant_id ?? null,
        evaluationOverall: evaluation?.overall ?? null,
        hasPrompt,
        hasNegative,
        outputCount: Array.isArray(manifest?.outputs) ? manifest.outputs.length : 0,
        thumbnailCount: Array.isArray(manifest?.thumbnails)
          ? manifest.thumbnails.length
          : 0,
      };
    }),
  );
}

export async function buildRunDetail(
  id: string,
  runId: string,
): Promise<RunDetail | null> {
  const runDir = resolve(characterDir(id), "outputs", runId);
  if (!(await pathExists(runDir))) return null;
  const manifest = await readManifest(id, runId);
  if (!manifest) return null;
  const promptPath = resolve(runDir, "prompt.txt");
  const negPath = resolve(runDir, "negative.txt");
  const prompt = (await pathExists(promptPath))
    ? await readFile(promptPath, "utf8")
    : typeof manifest.compiled_prompt === "string"
      ? manifest.compiled_prompt
      : null;
  const negative = (await pathExists(negPath))
    ? await readFile(negPath, "utf8")
    : typeof manifest.compiled_negative === "string"
      ? manifest.compiled_negative
      : null;
  const promptSource: RunDetail["promptSource"] = (await pathExists(promptPath))
    ? "file"
    : prompt
      ? "manifest"
      : null;
  const evaluation = manifest.evaluation as { overall?: string } | undefined;
  return {
    runId,
    tool: manifest.tool ?? null,
    toolVersion: manifest.tool_version ?? null,
    createdAt: manifest.created_at ?? null,
    baseVersion: manifest.base_version ?? null,
    variantId: manifest.variant_id ?? null,
    evaluationOverall: evaluation?.overall ?? null,
    hasPrompt: await pathExists(promptPath),
    hasNegative: await pathExists(negPath),
    outputCount: Array.isArray(manifest.outputs) ? manifest.outputs.length : 0,
    thumbnailCount: Array.isArray(manifest.thumbnails)
      ? manifest.thumbnails.length
      : 0,
    manifest: manifest as Record<string, unknown>,
    prompt,
    negative,
    promptSource,
  };
}

async function buildReferencesSummary(id: string): Promise<ReferencesSummary> {
  const refsDir = resolve(characterDir(id), "references");
  const yamlPath = resolve(refsDir, "sources.yaml");
  const imagesDir = resolve(refsDir, "images");
  const yamlRaw = await readFileSafe(yamlPath);
  let images: ReferencesSummary["images"] = [];
  if (await pathExists(imagesDir)) {
    const files = (await readdir(imagesDir)).filter((f) => !f.startsWith("."));
    images = await Promise.all(
      files.map(async (name) => {
        const s = await stat(resolve(imagesDir, name));
        return {
          name,
          isAnchor: /anchor/i.test(name),
          sizeBytes: s.size,
        };
      }),
    );
  }
  return {
    hasYaml: yamlRaw !== null,
    yamlRaw,
    images,
  };
}

async function buildLogEntries(id: string, limit: number): Promise<LogEntrySummary[]> {
  const logPath = resolve(characterDir(id), "log.md");
  if (!(await pathExists(logPath))) return [];
  const raw = await readFile(logPath, "utf8");
  const lines = raw.split(/\r?\n/);
  const entries: LogEntrySummary[] = [];
  let i = 0;
  while (i < lines.length && entries.length < limit) {
    if (!/^##\s+\d{4}/.test(lines[i])) {
      i++;
      continue;
    }
    const heading = lines[i].replace(/^##\s+/, "").trim();
    i++;
    let tried: string | null = null;
    let nextAction: string | null = null;
    let evaluation: string | null = null;
    while (i < lines.length && !/^##\s+/.test(lines[i])) {
      const line = lines[i];
      const tryMatch = line.match(/^-\s+\*\*試行\*\*\s*[:：]\s*(.+)$/);
      if (tryMatch && !tried) tried = tryMatch[1];
      const nextMatch = line.match(/^-\s+\*\*次の改善\*\*\s*[:：]\s*(.+)$/);
      if (nextMatch && !nextAction) nextAction = nextMatch[1];
      const evalMatch = line.match(/^-\s+\*\*評価\*\*\s*[:：]\s*(.+)$/);
      if (evalMatch && !evaluation) evaluation = evalMatch[1];
      i++;
    }
    entries.push({ heading, tried, evaluation, nextAction });
  }
  return entries;
}

function toLogSummary(entry: {
  heading: string;
  tried: string | null;
  nextAction: string | null;
  evaluation: string | null;
}): LogEntrySummary {
  return {
    heading: entry.heading,
    tried: entry.tried,
    evaluation: entry.evaluation,
    nextAction: entry.nextAction,
  };
}

async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
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

function relativePathWithoutExt(baseDir: string, abs: string): string {
  const rel = abs.slice(baseDir.length + 1);
  return rel.replace(/\.md$/, "");
}

function formatDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "string") {
    const m = v.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return v;
  }
  return String(v);
}
