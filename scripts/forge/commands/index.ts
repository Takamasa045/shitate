import { readFile } from "node:fs/promises";
import { INDEX_MD } from "../lib/paths.ts";
import { atomicWriteFile } from "../lib/atomic.ts";
import {
  listCharacterIds,
  readCharacter,
  listRuns,
  listReferences,
  pathExists,
} from "../lib/character.ts";
import { c } from "../lib/output.ts";

const BLOCK_START = "<!-- forge:generated:characters:start -->";
const BLOCK_END = "<!-- forge:generated:characters:end -->";

export interface IndexOptions {
  mode: "check" | "write";
}

export async function runIndex(opts: IndexOptions): Promise<number> {
  if (!(await pathExists(INDEX_MD))) {
    process.stderr.write(`${c.red("ERROR")} INDEX.md not found\n`);
    return 1;
  }
  const current = await readFile(INDEX_MD, "utf8");
  const block = await buildCharactersBlock();
  const updated = replaceOrInjectBlock(current, block);

  if (opts.mode === "check") {
    if (current === updated) {
      process.stdout.write(`${c.green("✓")} INDEX.md is in sync\n`);
      return 0;
    }
    process.stdout.write(`${c.yellow("✱")} INDEX.md would change:\n\n`);
    process.stdout.write(renderDiff(current, updated));
    process.stdout.write(`\n${c.dim("run `forge index --write` to apply.")}\n`);
    return 1;
  }

  if (current === updated) {
    process.stdout.write(`${c.green("✓")} INDEX.md already in sync\n`);
    return 0;
  }
  await atomicWriteFile(INDEX_MD, updated);
  process.stdout.write(`${c.green("✓")} INDEX.md Characters table updated\n`);
  return 0;
}

async function buildCharactersBlock(): Promise<string> {
  const ids = await listCharacterIds();
  const lines: string[] = [];
  lines.push(BLOCK_START);
  lines.push("");
  lines.push("| ID | 表示名 | status | base | 出典 entity | runs | anchors | 最終更新 |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const id of ids) {
    const info = await readCharacter(id);
    const fm = info.frontmatter ?? {};
    const runs = await listRuns(id);
    const refs = await listReferences(id);
    const anchors = refs
      .filter((f) => /anchor/i.test(f))
      .map((f) => f.replace(/\.[^.]+$/, "").replace(/-anchor$/i, ""))
      .filter((x) => x.length > 0);
    const anchorsStr = anchors.length > 0 ? anchors.join(", ") : "—";
    const variants = extractVariantsFromRuns(runs);
    const runsStr = runs.length > 0 ? `${runs.length} (${variants.join(", ")})` : "0";
    const sourceEntity = Array.isArray(fm.source_entities) && fm.source_entities.length > 0
      ? "`" + String(fm.source_entities[0]) + "`"
      : "—";
    const link = `[${id}](characters/${id}/index.md)`;
    const updated = formatDateField(fm.updated);
    lines.push(
      `| ${link} | ${fm.name ?? "?"} | ${fm.status ?? "?"} | ${fm.base_version ?? "?"} | ${sourceEntity} | ${runsStr} | ${anchorsStr} | ${updated} |`,
    );
  }
  lines.push("");
  lines.push(BLOCK_END);
  return lines.join("\n");
}

function extractVariantsFromRuns(runs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const runId of runs) {
    const m = runId.match(/^\d{8}_(.+?)_v\d+/);
    if (!m) continue;
    const variant = m[1];
    if (seen.has(variant)) continue;
    seen.add(variant);
    out.push(variant);
  }
  return out;
}

function replaceOrInjectBlock(md: string, newBlock: string): string {
  const startIdx = md.indexOf(BLOCK_START);
  const endIdx = md.indexOf(BLOCK_END);
  if (startIdx >= 0 && endIdx > startIdx) {
    const before = md.slice(0, startIdx);
    const after = md.slice(endIdx + BLOCK_END.length);
    return before + newBlock + after;
  }
  // マーカーが無ければ既存の手書き Characters 表を検出して置換
  return injectAfterCharactersHeading(md, newBlock);
}

function injectAfterCharactersHeading(md: string, newBlock: string): string {
  const lines = md.split(/\r?\n/);
  const headingIdx = lines.findIndex((l) => l.trim() === "## Characters");
  if (headingIdx < 0) {
    // 見つからなければファイル末尾に追記
    return md + "\n\n## Characters\n\n" + newBlock + "\n";
  }
  // heading の直後の既存 table (| ... |) を末尾空行まで取り除く
  let start = headingIdx + 1;
  while (start < lines.length && lines[start].trim() === "") start++;
  let end = start;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;
  const before = lines.slice(0, headingIdx + 1).join("\n");
  const after = lines.slice(end).join("\n");
  return before + "\n\n" + newBlock + "\n" + after;
}

function formatDateField(v: unknown): string {
  if (v === undefined || v === null) return "?";
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

function renderDiff(before: string, after: string): string {
  // 素朴な行単位 diff。外部 diff ライブラリ未導入なので + / - のみ表示。
  const b = before.split(/\r?\n/);
  const a = after.split(/\r?\n/);
  const out: string[] = [];
  const max = Math.max(b.length, a.length);
  for (let i = 0; i < max; i++) {
    if (b[i] !== a[i]) {
      if (b[i] !== undefined) out.push(c.red(`- ${b[i]}`));
      if (a[i] !== undefined) out.push(c.green(`+ ${a[i]}`));
    }
  }
  return out.join("\n") + "\n";
}
