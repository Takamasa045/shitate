import { readFile } from "node:fs/promises";
import matter from "gray-matter";

export interface PromptSections {
  purpose: string | null;
  baseVersionDep: string | null;
  positive: string | null;
  negative: string | null;
  lexiconRefs: string[];
  memo: string | null;
  raw: string;
}

export interface FrontmatterResult<T> {
  data: T;
  body: string;
}

export async function readFrontmatter<T = Record<string, unknown>>(
  path: string,
): Promise<FrontmatterResult<T>> {
  const raw = await readFile(path, "utf8");
  const parsed = matter(raw);
  return { data: parsed.data as T, body: parsed.content };
}

/**
 * 指定見出し（`## <title>`）の直後にある triple-backtick コードブロックの中身を取り出す。
 * 言語指定は無視する。前後空白は trim、内部改行は維持。
 */
export function extractSectionCodeBlock(md: string, heading: string): string | null {
  const lines = md.split(/\r?\n/);
  const headingRe = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`);
  let i = 0;
  while (i < lines.length && !headingRe.test(lines[i])) i++;
  if (i >= lines.length) return null;
  i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length || !/^```/.test(lines[i])) return null;
  i++;
  const buf: string[] = [];
  while (i < lines.length && !/^```/.test(lines[i])) {
    buf.push(lines[i]);
    i++;
  }
  return buf.join("\n").trim();
}

/**
 * 指定見出し直後の直近1行を取り出す（`## 依存ベースバージョン` 用）。
 * コードブロックでなく平文であることを想定。
 */
export function extractSectionFirstLine(md: string, heading: string): string | null {
  const lines = md.split(/\r?\n/);
  const headingRe = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`);
  let i = 0;
  while (i < lines.length && !headingRe.test(lines[i])) i++;
  if (i >= lines.length) return null;
  i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return null;
  return lines[i].trim();
}

/**
 * 指定見出し直後の箇条書き（`- ...`）を配列で取得。項目順は維持。
 */
export function extractSectionListItems(md: string, heading: string): string[] {
  const lines = md.split(/\r?\n/);
  const headingRe = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`);
  let i = 0;
  while (i < lines.length && !headingRe.test(lines[i])) i++;
  if (i >= lines.length) return [];
  i++;
  const items: string[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break;
    const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (m) items.push(m[1]);
  }
  return items;
}

/**
 * base.md / variant.md を読んで必須セクションを構造化する。欠落は null のまま返す。
 * lint/doctor が null を検知してエラーメッセージを出す。
 */
export async function readPrompt(path: string): Promise<PromptSections> {
  const raw = await readFile(path, "utf8");
  return parsePrompt(raw);
}

/** ファイル書き込み前の Studio 入力も compile と同じ規則で解釈する。 */
export function parsePrompt(raw: string): PromptSections {
  return {
    purpose: extractSectionCodeBlock(raw, "用途") ?? extractSectionFirstLine(raw, "用途"),
    baseVersionDep: normalizeVersion(extractSectionFirstLine(raw, "依存ベースバージョン")),
    positive: extractSectionCodeBlock(raw, "本文プロンプト"),
    negative: extractSectionCodeBlock(raw, "ネガティブプロンプト"),
    lexiconRefs: extractSectionListItems(raw, "Lexicon 参照").map((s) =>
      extractLexiconRef(s),
    ),
    memo: extractSectionCodeBlock(raw, "メモ") ?? null,
    raw,
  };
}

function normalizeVersion(line: string | null): string | null {
  if (line === null) return null;
  const m = line.match(/v\s*(\d+)/i);
  return m ? `v${m[1]}` : null;
}

/**
 * `- [ukiyo-e](lexicon/styles.md#ukiyo-e-edo)` のような箇条書きから `lexicon/styles.md#ukiyo-e-edo` を抽出。
 * リンク記法でない場合はそのまま返す。
 */
function extractLexiconRef(item: string): string {
  const linkMatch = item.match(/\(([^)]+)\)/);
  if (linkMatch) return linkMatch[1].trim();
  return item.trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
