import { readdir, stat, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import {
  CHARACTERS_DIR,
  characterDir,
  characterIndex,
  characterLog,
  characterBasePrompt,
  characterOutputsDir,
  characterReferencesDir,
  REPO_ROOT,
} from "./paths.ts";
import { readFrontmatter } from "./markdown.ts";

export interface CharacterFrontmatter {
  id?: string;
  name?: string;
  role?: string;
  status?: "draft" | "experimental" | "stable";
  base_version?: string;
  created?: string;
  updated?: string;
  source_entities?: string[];
  world_refs?: string[];
  relations?: Array<Record<string, unknown>>;
  tags?: string[];
}

export interface CharacterInfo {
  id: string;
  dir: string;
  hasIndex: boolean;
  hasBase: boolean;
  hasLog: boolean;
  frontmatter: CharacterFrontmatter | null;
  frontmatterError: string | null;
}

export async function listCharacterIds(): Promise<string[]> {
  try {
    const entries = await readdir(CHARACTERS_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((n) => !n.startsWith("."))
      .sort();
  } catch {
    return [];
  }
}

export async function readCharacter(id: string): Promise<CharacterInfo> {
  const info: CharacterInfo = {
    id,
    dir: characterDir(id),
    hasIndex: await pathExists(characterIndex(id)),
    hasBase: await pathExists(characterBasePrompt(id)),
    hasLog: await pathExists(characterLog(id)),
    frontmatter: null,
    frontmatterError: null,
  };
  if (info.hasIndex) {
    try {
      const { data } = await readFrontmatter<CharacterFrontmatter>(characterIndex(id));
      info.frontmatter = data;
    } catch (err) {
      info.frontmatterError = err instanceof Error ? err.message : String(err);
    }
  }
  return info;
}

export async function listRuns(id: string): Promise<string[]> {
  const dir = characterOutputsDir(id);
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((n) => !n.startsWith("."))
      .sort();
  } catch {
    return [];
  }
}

export async function listReferences(id: string): Promise<string[]> {
  const dir = resolve(characterReferencesDir(id), "images");
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((n) => !n.startsWith("."))
      .sort();
  } catch {
    return [];
  }
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export function relToRepo(p: string): string {
  return relative(REPO_ROOT, p);
}

/**
 * log.md の「##」で始まる最新エントリのタイトル行と、直後の箇条書きからフィールド抽出。
 * DESCENDING 前提。
 */
export interface LogEntry {
  heading: string;
  tried: string | null;
  nextAction: string | null;
  evaluation: string | null;
}

export async function readLatestLogEntry(id: string): Promise<LogEntry | null> {
  const path = characterLog(id);
  if (!(await pathExists(path))) return null;
  const raw = await readFile(path, "utf8");
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !/^##\s+\d{4}/.test(lines[i])) i++;
  if (i >= lines.length) return null;
  const heading = lines[i].replace(/^##\s+/, "").trim();
  i++;
  let tried: string | null = null;
  let nextAction: string | null = null;
  let evaluation: string | null = null;
  for (; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    const line = lines[i];
    const tryMatch = line.match(/^-\s+\*\*試行\*\*\s*[:：]\s*(.+)$/);
    if (tryMatch && !tried) tried = tryMatch[1];
    const nextMatch = line.match(/^-\s+\*\*次の改善\*\*\s*[:：]\s*(.+)$/);
    if (nextMatch && !nextAction) nextAction = nextMatch[1];
    const evalMatch = line.match(/^-\s+\*\*評価\*\*\s*[:：]\s*(.+)$/);
    if (evalMatch && !evaluation) evaluation = evalMatch[1];
  }
  return { heading, tried, nextAction, evaluation };
}
