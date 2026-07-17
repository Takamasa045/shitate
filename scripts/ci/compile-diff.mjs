#!/usr/bin/env node
// Diff two compile snapshots produced by compile-snapshot.mjs and
// emit a Markdown summary safe to post as a PR comment.
//
// Does NOT include the compiled prompt text itself — only hashes,
// lexicon refs, and character counts. This keeps the comment small
// and avoids leaking full generator prompts into public PR threads.
//
// Usage: node scripts/ci/compile-diff.mjs <base.json> <head.json> [out.md]

import { readFileSync, writeFileSync } from "node:fs";

const [, , basePath, headPath, outPath] = process.argv;
if (!basePath || !headPath) {
  console.error("usage: compile-diff.mjs <base.json> <head.json> [out.md]");
  process.exit(2);
}

const base = JSON.parse(readFileSync(basePath, "utf8"));
const head = JSON.parse(readFileSync(headPath, "utf8"));

const key = (e) => `${e.character}::${e.variant}`;
const baseMap = new Map(base.entries.map((e) => [key(e), e]));
const headMap = new Map(head.entries.map((e) => [key(e), e]));

const added = [];
const removed = [];
const changed = [];
const unchanged = [];

for (const [k, h] of headMap) {
  const b = baseMap.get(k);
  if (!b) {
    added.push(h);
    continue;
  }
  if (b.prompt_sha !== h.prompt_sha || b.negative_sha !== h.negative_sha) {
    changed.push({ base: b, head: h });
  } else {
    unchanged.push(h);
  }
}
for (const [k, b] of baseMap) {
  if (!headMap.has(k)) removed.push(b);
}

function lexDiff(baseList, headList) {
  const bs = new Set(baseList || []);
  const hs = new Set(headList || []);
  const plus = [...hs].filter((x) => !bs.has(x));
  const minus = [...bs].filter((x) => !hs.has(x));
  const parts = [];
  for (const p of plus) parts.push(`+\`${p}\``);
  for (const m of minus) parts.push(`-\`${m}\``);
  return parts.length === 0 ? "—" : parts.join(" ");
}

function sign(delta) {
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

const lines = [];
lines.push("## forge compile diff");
lines.push("");

const total = added.length + removed.length + changed.length;
if (total === 0) {
  lines.push(`✅ no compile changes across **${unchanged.length}** variants.`);
} else {
  lines.push(
    `🔁 **${changed.length}** changed · **${added.length}** added · **${removed.length}** removed · ${unchanged.length} unchanged`,
  );
}

const warnings = [];
if (base.generated_at === "missing") warnings.push("⚠️ base snapshot missing — diff below treats every entry as newly added.");
if (head.generated_at === "missing") warnings.push("⚠️ head snapshot missing — diff below treats every entry as removed.");
if (head.failures?.length) warnings.push(`⚠️ ${head.failures.length} compile failure(s) on head — see CI logs.`);
if (base.failures?.length) warnings.push(`⚠️ ${base.failures.length} compile failure(s) on base — see CI logs.`);
if (warnings.length) {
  lines.push("");
  for (const w of warnings) lines.push(`> ${w}`);
}

if (changed.length > 0) {
  lines.push("");
  lines.push("### Changed");
  lines.push("");
  lines.push("| character :: variant | prompt sha | negative sha | Δ chars (p / n) | lexicon diff |");
  lines.push("|---|---|---|---|---|");
  for (const { base: b, head: h } of changed) {
    const promptCell = b.prompt_sha === h.prompt_sha ? `\`${h.prompt_sha}\`` : `\`${b.prompt_sha}\` → \`${h.prompt_sha}\``;
    const negCell = b.negative_sha === h.negative_sha ? `\`${h.negative_sha}\`` : `\`${b.negative_sha}\` → \`${h.negative_sha}\``;
    const deltaP = sign(h.prompt_chars - b.prompt_chars);
    const deltaN = sign(h.negative_chars - b.negative_chars);
    lines.push(`| \`${h.character} :: ${h.variant}\` | ${promptCell} | ${negCell} | ${deltaP} / ${deltaN} | ${lexDiff(b.lexicon_used, h.lexicon_used)} |`);
  }
}

if (added.length > 0) {
  lines.push("");
  lines.push("### Added");
  lines.push("");
  for (const h of added) {
    lines.push(`- \`${h.character} :: ${h.variant}\` — prompt \`${h.prompt_sha}\` (${h.prompt_chars} chars), lexicon: ${(h.lexicon_used || []).length}`);
  }
}

if (removed.length > 0) {
  lines.push("");
  lines.push("### Removed");
  lines.push("");
  for (const b of removed) {
    lines.push(`- \`${b.character} :: ${b.variant}\` — was prompt \`${b.prompt_sha}\``);
  }
}

lines.push("");
lines.push(
  `<sub>base @ ${base.generated_at} · head @ ${head.generated_at} · ` +
    `both sides compiled with the **PR-head** forge CLI, swapping only \`characters/\` and \`lexicon/\` — so diffs reflect **content changes given the current tooling**, not tooling regressions. ` +
    `Hashes are sha1[0:12] of compiled prompt/negative text; full prompts intentionally omitted.</sub>`,
);

const md = lines.join("\n") + "\n";
if (outPath) {
  writeFileSync(outPath, md);
  console.log(`wrote diff → ${outPath}`);
} else {
  process.stdout.write(md);
}
