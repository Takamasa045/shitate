import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { LEXICON_DIR, REPO_ROOT } from "./paths.ts";

export interface LexiconRef {
  raw: string;
  file: string;
  slug: string;
}

/**
 * `lexicon/styles.md#ukiyo-e-edo` 形式の参照を解析。
 * hash 無し / 他パスは null。
 */
export function parseLexiconRef(raw: string): LexiconRef | null {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(lexicon\/[^#]+\.md)#(.+)$/);
  if (!m) return null;
  return { raw: trimmed, file: m[1], slug: m[2] };
}

export function isNegativesRef(ref: LexiconRef): boolean {
  return ref.file === "lexicon/negatives.md";
}

export async function lexiconFileExists(ref: LexiconRef): Promise<boolean> {
  try {
    await stat(resolve(REPO_ROOT, ref.file));
    return true;
  } catch {
    return false;
  }
}

/**
 * lexicon ファイルから `## #<slug>` エントリの `**プロンプト断片**:` 直後のコードブロックを抽出。
 */
export async function resolveLexiconFragment(ref: LexiconRef): Promise<string | null> {
  const path = resolve(REPO_ROOT, ref.file);
  const raw = await readFile(path, "utf8");
  const lines = raw.split(/\r?\n/);
  const headingRe = new RegExp(`^##\\s+#${escapeRegex(ref.slug)}\\s*$`);

  let i = 0;
  while (i < lines.length && !headingRe.test(lines[i])) i++;
  if (i >= lines.length) return null;
  i++;

  // エントリ境界: 次の `## #<slug>` か EOF
  const end = findNextSlugHeading(lines, i);

  // エントリ内で `**プロンプト断片**:` を探す
  let j = i;
  while (j < end && !/^\*\*プロンプト断片\*\*\s*[:：]/.test(lines[j])) j++;
  if (j >= end) return null;
  j++;
  while (j < end && lines[j].trim() === "") j++;
  if (j >= end || !/^```/.test(lines[j])) return null;
  j++;
  const buf: string[] = [];
  while (j < end && !/^```/.test(lines[j])) {
    buf.push(lines[j]);
    j++;
  }
  return buf.join("\n").trim();
}

function findNextSlugHeading(lines: string[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    if (/^##\s+#[\w-]+/.test(lines[i])) return i;
  }
  return lines.length;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { LEXICON_DIR };
