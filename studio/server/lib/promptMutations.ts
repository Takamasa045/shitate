import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { atomicWriteFile } from "../../../scripts/forge/lib/atomic.ts";
import { pathExists, readCharacter } from "../../../scripts/forge/lib/character.ts";
import { parsePrompt, type PromptSections } from "../../../scripts/forge/lib/markdown.ts";
import {
  characterBasePrompt,
  characterDir,
  characterIndex,
  characterVariantPrompt,
} from "../../../scripts/forge/lib/paths.ts";
import type { RevisionMode } from "../../shared/types.ts";
import { ApiError, withStudioMutationLock } from "./mutation.ts";
import { contentRevision } from "./revision.ts";

const PROMPT_MAX_CHARS = 200_000;
const REVISION_RE = /^[a-f0-9]{64}$/;

export interface PromptWriteInput {
  raw: string;
  expectedRevision?: string;
}

export interface BasePromptWriteInput extends PromptWriteInput {
  expectedRevision: string;
  revisionMode: RevisionMode;
}

export interface PromptWriteResult {
  raw: string;
  revision: string;
  sections: PromptSections;
  created: boolean;
  baseVersion: string;
}

export async function updateBasePrompt(
  characterId: string,
  input: BasePromptWriteInput,
): Promise<PromptWriteResult> {
  const basePath = characterBasePrompt(characterId);
  return withStudioMutationLock(`character:${characterId}`, async () => {
    const currentRaw = await readRequiredFile(basePath, "base prompt not found");
    assertExpectedRevision(input.expectedRevision, currentRaw);
    const info = await readCharacter(characterId);
    const currentVersion = info.frontmatter?.base_version;
    if (!/^v\d+$/.test(currentVersion ?? "")) {
      throw new ApiError(422, "character base version is invalid");
    }

    if (input.revisionMode === "same-version") {
      const sections = validatePromptRaw(input.raw);
      if (sections.baseVersionDep !== currentVersion) {
        throw new ApiError(422, "base dependency version must match current version");
      }
      await atomicWriteFile(basePath, input.raw);
      return resultFor(input.raw, sections, false, currentVersion!);
    }

    const currentNumber = Number(currentVersion!.slice(1));
    const nextVersion = `v${currentNumber + 1}`;
    const normalizedRaw = normalizeDependencyVersion(input.raw, nextVersion);
    const sections = validatePromptRaw(normalizedRaw);
    const historyPath = resolve(
      characterDir(characterId),
      "prompts",
      "history",
      `base.${nextVersion}.md`,
    );
    if (await pathExists(historyPath)) {
      throw new ApiError(409, "base history version already exists");
    }
    const indexPath = characterIndex(characterId);
    const currentIndex = await readRequiredFile(indexPath, "character index not found");
    const nextIndex = updateIndexVersion(currentIndex, nextVersion, jstDate(new Date()));

    // 複数正本は事前に全検証し、失敗時は既存内容へ戻す。
    let historyCreated = false;
    let baseChanged = false;
    try {
      await atomicCreateFile(historyPath, normalizedRaw);
      historyCreated = true;
      await atomicWriteFile(basePath, normalizedRaw);
      baseChanged = true;
      await atomicWriteFile(indexPath, nextIndex);
    } catch (error) {
      if (baseChanged) await atomicWriteFile(basePath, currentRaw).catch(() => undefined);
      if (historyCreated) await rm(historyPath, { force: true }).catch(() => undefined);
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new ApiError(409, "base history version already exists");
      }
      throw error;
    }
    return resultFor(normalizedRaw, sections, false, nextVersion);
  });
}

export async function upsertVariantPrompt(
  characterId: string,
  variantId: string,
  input: PromptWriteInput,
): Promise<PromptWriteResult> {
  const variantPath = characterVariantPrompt(characterId, variantId);
  return withStudioMutationLock(`character:${characterId}`, async () => {
    const info = await readCharacter(characterId);
    if (!info.hasIndex) throw new ApiError(404, "character not found");
    const baseVersion = info.frontmatter?.base_version;
    if (!/^v\d+$/.test(baseVersion ?? "")) {
      throw new ApiError(422, "character base version is invalid");
    }
    const sections = validatePromptRaw(input.raw);
    if (sections.baseVersionDep !== baseVersion) {
      throw new ApiError(422, "variant dependency version must match current base");
    }

    const exists = await pathExists(variantPath);
    if (exists) {
      const currentRaw = await readFile(variantPath, "utf8");
      if (input.expectedRevision === undefined) {
        throw new ApiError(409, "revision conflict", {
          currentRevision: contentRevision(currentRaw),
        });
      }
      assertExpectedRevision(input.expectedRevision, currentRaw);
      await atomicWriteFile(variantPath, input.raw);
    } else {
      if (input.expectedRevision !== undefined) {
        throw new ApiError(409, "revision conflict", { currentRevision: null });
      }
      try {
        await atomicCreateFile(variantPath, input.raw);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          throw new ApiError(409, "variant already exists");
        }
        throw error;
      }
    }
    return resultFor(input.raw, sections, !exists, baseVersion!);
  });
}

export function parsePromptWriteBody(
  body: Record<string, unknown>,
): PromptWriteInput {
  const raw = validateRawField(body.raw);
  const expectedRevision = parseOptionalRevision(body.expectedRevision);
  return { raw, expectedRevision };
}

export function parseBasePromptWriteBody(
  body: Record<string, unknown>,
): BasePromptWriteInput {
  const raw = validateRawField(body.raw);
  const expectedRevision = parseRequiredRevision(body.expectedRevision);
  const revisionMode = body.revisionMode;
  if (revisionMode !== "same-version" && revisionMode !== "new-version") {
    throw new ApiError(400, "invalid revisionMode");
  }
  return { raw, expectedRevision, revisionMode };
}

function validateRawField(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "raw is required");
  }
  if (value.length > PROMPT_MAX_CHARS) {
    throw new ApiError(413, "prompt is too large");
  }
  if (value.includes("\0")) throw new ApiError(400, "prompt contains invalid data");
  return value;
}

function validatePromptRaw(raw: string): PromptSections {
  const sections = parsePrompt(raw);
  const missing: string[] = [];
  if (!/^#\s+\S.*$/m.test(raw)) missing.push("H1");
  if (!sectionHasContent(raw, "用途")) missing.push("用途");
  if (!hasHeading(raw, "依存ベースバージョン") || !sections.baseVersionDep) {
    missing.push("依存ベースバージョン");
  }
  if (!hasHeading(raw, "本文プロンプト") || sections.positive === null) {
    missing.push("本文プロンプト");
  }
  if (!hasHeading(raw, "ネガティブプロンプト") || sections.negative === null) {
    missing.push("ネガティブプロンプト");
  }
  if (!hasHeading(raw, "Lexicon 参照")) missing.push("Lexicon 参照");
  if (missing.length > 0) {
    throw new ApiError(422, `prompt is missing required sections: ${missing.join(", ")}`);
  }
  return sections;
}

function hasHeading(raw: string, heading: string): boolean {
  return new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`, "m").test(raw);
}

function sectionHasContent(raw: string, heading: string): boolean {
  const lines = raw.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) return false;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^##\s+/.test(lines[index])) return false;
    if (lines[index].trim()) return true;
  }
  return false;
}

function normalizeDependencyVersion(raw: string, version: string): string {
  const pattern = /(^##\s+依存ベースバージョン\s*\r?\n)([^\r\n]*)/m;
  if (!pattern.test(raw)) {
    throw new ApiError(422, "prompt is missing required sections: 依存ベースバージョン");
  }
  return raw.replace(pattern, `$1${version}`);
}

function updateIndexVersion(raw: string, version: string, today: string): string {
  const end = raw.indexOf("\n---", 3);
  if (!raw.startsWith("---") || end < 0) {
    throw new ApiError(422, "character index frontmatter is invalid");
  }
  const frontmatter = raw.slice(0, end + 1);
  if (!/^base_version:\s*.+$/m.test(frontmatter) || !/^updated:\s*.+$/m.test(frontmatter)) {
    throw new ApiError(422, "character index frontmatter is invalid");
  }
  const nextFrontmatter = frontmatter
    .replace(/^base_version:\s*.+$/m, `base_version: ${version}`)
    .replace(/^updated:\s*.+$/m, `updated: ${today}`);
  return nextFrontmatter + raw.slice(end + 1);
}

async function atomicCreateFile(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const temp = resolve(dir, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    // hard link は既存 target を上書きせず、完成済み inode だけを公開する。
    await link(temp, path);
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}

function assertExpectedRevision(expected: string, currentRaw: string): void {
  const currentRevision = contentRevision(currentRaw);
  if (expected !== currentRevision) {
    throw new ApiError(409, "revision conflict", { currentRevision });
  }
}

function parseRequiredRevision(value: unknown): string {
  if (typeof value !== "string" || !REVISION_RE.test(value)) {
    throw new ApiError(400, "expectedRevision must be a SHA-256 revision");
  }
  return value;
}

function parseOptionalRevision(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return parseRequiredRevision(value);
}

function resultFor(
  raw: string,
  sections: PromptSections,
  created: boolean,
  baseVersion: string,
): PromptWriteResult {
  return {
    raw,
    revision: contentRevision(raw),
    sections,
    created,
    baseVersion,
  };
}

async function readRequiredFile(path: string, message: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    throw new ApiError(404, message);
  }
}

function jstDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
