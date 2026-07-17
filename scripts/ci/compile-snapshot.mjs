#!/usr/bin/env node
// Produce a JSON snapshot of compile output for every (character, variant)
// pair. Includes content hashes but NOT the compiled prompt text itself —
// this snapshot is safe to attach to CI artifacts and diff across refs.
//
// Usage: node scripts/ci/compile-snapshot.mjs <out.json>

import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outPath = process.argv[2];
if (!outPath) {
  console.error("usage: compile-snapshot.mjs <out.json>");
  process.exit(2);
}

function listDirs(path) {
  try {
    return readdirSync(path).filter((n) => statSync(join(path, n)).isDirectory());
  } catch {
    return [];
  }
}
function listVariants(charDir) {
  const v = join(charDir, "prompts", "variants");
  try {
    return readdirSync(v).filter((n) => n.endsWith(".md")).map((n) => basename(n, ".md"));
  } catch {
    return [];
  }
}
function sha1(s) {
  return createHash("sha1").update(s, "utf8").digest("hex").slice(0, 12);
}

const charactersDir = join(repoRoot, "characters");
const entries = [];
const failures = [];

for (const id of listDirs(charactersDir)) {
  for (const variant of listVariants(join(charactersDir, id))) {
    const result = spawnSync(
      process.execPath,
      [
        "--import", "tsx",
        join(repoRoot, "scripts/forge/cli.ts"),
        "compile", id, variant,
        "--dry-run", "--json",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      failures.push({ id, variant, error: (result.stderr || "").trim().split("\n").slice(-3).join(" | ") });
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(result.stdout);
    } catch (e) {
      failures.push({ id, variant, error: `unparseable JSON: ${e.message}` });
      continue;
    }
    entries.push({
      character: id,
      variant,
      base_version: manifest.base_version ?? null,
      base_sha: manifest.base_sha ?? null,
      lexicon_used: manifest.lexicon_used ?? [],
      prompt_sha: sha1(manifest.compiled_prompt ?? ""),
      negative_sha: sha1(manifest.compiled_negative ?? ""),
      prompt_chars: (manifest.compiled_prompt ?? "").length,
      negative_chars: (manifest.compiled_negative ?? "").length,
    });
  }
}

const snapshot = {
  generated_at: new Date().toISOString(),
  entries: entries.sort((a, b) => (a.character + a.variant).localeCompare(b.character + b.variant)),
  failures,
};

writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`wrote ${entries.length} entries, ${failures.length} failures → ${outPath}`);
if (failures.length > 0) process.exit(1);
