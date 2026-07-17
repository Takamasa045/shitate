import { randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { isSeq, parseDocument } from "yaml";
import { runIndex } from "../../../scripts/forge/commands/index.ts";
import { atomicWriteFile } from "../../../scripts/forge/lib/atomic.ts";
import {
  listReferences,
  pathExists,
  readCharacter,
} from "../../../scripts/forge/lib/character.ts";
import {
  CHARACTERS_DIR,
  INDEX_MD,
  REPO_ROOT,
  characterDir,
  characterIndex,
  characterLog,
} from "../../../scripts/forge/lib/paths.ts";
import { appendLogEntryUnlocked } from "./logMutations.ts";
import { ApiError, withStudioMutationLock } from "./mutation.ts";

export const ANCHOR_MAX_BYTES = 5 * 1024 * 1024;
export const ANCHOR_MULTIPART_LIMIT = ANCHOR_MAX_BYTES + 64 * 1024;

const ANCHOR_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MIME_TO_EXTENSION = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export interface AnchorUpload {
  anchorId: string;
  notes: string;
  nextAction: string;
  bytes: Buffer;
  extension: "jpg" | "png" | "webp";
}

export interface RegisteredAnchor {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
}

export async function parseAnchorUpload(
  form: Record<string, string | File>,
): Promise<AnchorUpload> {
  const anchorId = requiredText(form.anchorId, "anchorId", 48, true);
  if (!ANCHOR_ID_RE.test(anchorId)) throw new ApiError(400, "invalid anchor id");
  const notes = requiredText(form.notes, "notes", 1_000, false);
  const nextAction = requiredText(form.nextAction, "nextAction", 1_000, true);
  const file = form.file;
  if (!(file instanceof File)) throw new ApiError(400, "image file is required");
  if (file.size === 0) throw new ApiError(400, "image file is empty");
  if (file.size > ANCHOR_MAX_BYTES) throw new ApiError(413, "image file is too large");
  const extension = MIME_TO_EXTENSION.get(
    file.type.toLowerCase(),
  ) as AnchorUpload["extension"] | undefined;
  if (!extension) throw new ApiError(415, "JPEG, PNG, or WebP required");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesMagicBytes(bytes, extension)) {
    throw new ApiError(422, "image content does not match its media type");
  }
  return {
    anchorId,
    notes,
    nextAction,
    bytes,
    extension,
  };
}

export async function registerAnchor(
  characterId: string,
  input: AnchorUpload,
  now: Date = new Date(),
): Promise<RegisteredAnchor> {
  return withStudioMutationLock(`character:${characterId}`, async () => {
    const paths = await prepareSafeAnchorWorkspace(characterId);
    const info = await readCharacter(characterId);
    if (!info.hasIndex || !info.hasLog) throw new ApiError(404, "character not found");

    const { imagesDir, sourcesPath, logPath } = paths;
    const name = `${input.anchorId}-anchor.${input.extension}`;
    const catalogPath = `images/${name}`;
    const imagePath = resolve(imagesDir, name);
    const existingFiles = await listReferences(characterId);
    if (
      (await pathExists(imagePath)) ||
      existingFiles.some((file) => anchorIdFromPath(file) === input.anchorId)
    ) {
      throw new ApiError(409, "anchor already exists");
    }

    const [sourcesBefore, logBefore] = await Promise.all([
      readOptionalText(sourcesPath),
      readFile(logPath, "utf8"),
    ]);
    const sourcesAfter = appendSourceEntry(
      sourcesBefore,
      catalogPath,
      input.anchorId,
      input.notes,
      jstDate(now),
    );

    let imageCreated = false;
    let sourcesChanged = false;
    let logChanged = false;
    try {
      await writeExclusiveImage(imagePath, input.bytes);
      imageCreated = true;
      await atomicWriteFile(sourcesPath, sourcesAfter);
      sourcesChanged = true;
      await appendLogEntryUnlocked(
        characterId,
        {
          variant: "anchor",
          tried: `${name} を anchor として登録（画像生成なし）`,
          promptDiff: "変更なし（選定済み anchor の登録）",
          artifact: `[${name}](references/images/${name})`,
          evaluation: "◯",
          nextAction: input.nextAction,
        },
        now,
      );
      logChanged = true;
      const indexCode = await syncIndex();
      if (indexCode !== 0) throw new Error("index synchronization failed");
      return {
        id: input.anchorId,
        name,
        path: `references/images/${name}`,
        sizeBytes: input.bytes.byteLength,
      };
    } catch (error) {
      if (imageCreated) await rm(imagePath, { force: true }).catch(() => undefined);
      if (sourcesChanged) {
        if (sourcesBefore === null) {
          await rm(sourcesPath, { force: true }).catch(() => undefined);
        } else {
          await atomicWriteFile(sourcesPath, sourcesBefore).catch(() => undefined);
        }
      }
      if (logChanged) await atomicWriteFile(logPath, logBefore).catch(() => undefined);
      await syncIndex().catch(() => undefined);
      if (error instanceof ApiError) throw error;
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST") throw new ApiError(409, "anchor already exists");
      throw new ApiError(500, "anchor could not be registered");
    }
  });
}

function appendSourceEntry(
  current: string | null,
  path: string,
  anchorId: string,
  notes: string,
  added: string,
): string {
  const document = parseDocument(current ?? "references: []\n");
  if (document.errors.length > 0) {
    throw new ApiError(422, "references/sources.yaml is invalid");
  }
  const root = document.toJS();
  if (root === null || typeof root !== "object" || Array.isArray(root)) {
    throw new ApiError(422, "references/sources.yaml must be a mapping");
  }
  const existing = (root as Record<string, unknown>).references;
  if (existing !== undefined && !Array.isArray(existing)) {
    throw new ApiError(422, "references list is invalid");
  }
  if (
    Array.isArray(existing) &&
    existing.some(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        (entry as Record<string, unknown>).path === path,
    )
  ) {
    throw new ApiError(409, "anchor is already registered");
  }
  if (
    Array.isArray(existing) &&
    existing.some((entry) => {
      if (entry === null || typeof entry !== "object") return false;
      const entryPath = (entry as Record<string, unknown>).path;
      return typeof entryPath === "string" && anchorIdFromPath(entryPath) === anchorId;
    })
  ) {
    throw new ApiError(409, "anchor is already registered");
  }
  if (existing === undefined) {
    document.set("references", document.createNode([]));
  }
  const sequence = document.get("references", true);
  if (!isSeq(sequence)) throw new ApiError(422, "references list is invalid");
  sequence.add({ path, role: "anchor", url: null, notes, added });
  return document.toString({ lineWidth: 0 });
}

async function writeExclusiveImage(path: string, bytes: Buffer): Promise<void> {
  const dir = dirname(path);
  const temp = resolve(dir, `.${randomUUID()}.upload`);
  try {
    await writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
    await link(temp, path);
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}

async function syncIndex(): Promise<number> {
  return withStudioMutationLock("characters:index", () =>
    runIndex({ mode: "write" }),
  );
}

async function prepareSafeAnchorWorkspace(characterId: string): Promise<{
  imagesDir: string;
  sourcesPath: string;
  logPath: string;
}> {
  const repoReal = await safeRealpath(REPO_ROOT);
  const charactersReal = await safeDirectory(CHARACTERS_DIR, repoReal, false);
  const root = characterDir(characterId);
  const characterReal = await safeDirectory(root, charactersReal, false, 404);
  const indexPath = characterIndex(characterId);
  const logPath = characterLog(characterId);
  await safeRegularFile(indexPath, characterReal, false);
  await safeRegularFile(logPath, characterReal, false);
  await safeRegularFile(INDEX_MD, repoReal, false);

  const referencesDir = resolve(root, "references");
  const referencesReal = await safeDirectory(referencesDir, characterReal, true);
  const imagesDir = resolve(referencesDir, "images");
  await safeDirectory(imagesDir, referencesReal, true);

  const sourcesPath = resolve(referencesDir, "sources.yaml");
  await safeRegularFile(sourcesPath, referencesReal, true);

  const imageEntries = await readdir(imagesDir, { withFileTypes: true });
  if (imageEntries.some((entry) => entry.isSymbolicLink())) {
    throw new ApiError(422, "character reference path is unsafe");
  }
  return { imagesDir, sourcesPath, logPath };
}

async function safeDirectory(
  path: string,
  allowedReal: string,
  create: boolean,
  missingStatus: 404 | 422 = 422,
): Promise<string> {
  if (create) {
    try {
      await mkdir(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ApiError(
        missingStatus,
        missingStatus === 404
          ? "character not found"
          : "character reference path is unsafe",
      );
    }
    throw error;
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new ApiError(422, "character reference path is unsafe");
  }
  const actual = await safeRealpath(path);
  if (!isWithin(allowedReal, actual)) {
    throw new ApiError(422, "character reference path is unsafe");
  }
  return actual;
}

async function safeRegularFile(
  path: string,
  allowedReal: string,
  optional: boolean,
): Promise<void> {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") return;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ApiError(422, "character reference path is unsafe");
    }
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new ApiError(422, "character reference path is unsafe");
  }
  const actual = await safeRealpath(path);
  if (!isWithin(allowedReal, actual)) {
    throw new ApiError(422, "character reference path is unsafe");
  }
}

async function safeRealpath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    throw new ApiError(422, "character reference path is unsafe");
  }
}

function isWithin(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function matchesMagicBytes(
  bytes: Buffer,
  extension: AnchorUpload["extension"],
): boolean {
  if (extension === "jpg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (extension === "png") {
    return (
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )
    );
  }
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function requiredText(
  value: string | File | undefined,
  field: string,
  maxLength: number,
  singleLine: boolean,
): string {
  if (typeof value !== "string") throw new ApiError(400, `${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new ApiError(400, `${field} is required`);
  if (normalized.length > maxLength) throw new ApiError(400, `${field} is too long`);
  if (normalized.includes("\0")) throw new ApiError(400, `${field} contains invalid data`);
  if (singleLine && /[\r\n\u2028\u2029]/.test(normalized)) {
    throw new ApiError(400, `${field} must be one line`);
  }
  return normalized;
}

function anchorIdFromPath(path: string): string | null {
  const name = path.split("/").pop() ?? "";
  const match = name.match(/^(.+)-anchor\.[^.]+$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
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
