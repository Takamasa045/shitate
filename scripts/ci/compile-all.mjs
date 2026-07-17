#!/usr/bin/env node
// Smoke test: for every characters/<id>/prompts/variants/<v>.md,
// run `pnpm forge compile <id> <v> --dry-run` and collect results.
// Exits non-zero if any variant fails to compile.
//
// Intentionally no network, no writes to outputs/ — dry-run only.

import { readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const charactersDir = join(repoRoot, "characters");

function listDir(path) {
  try {
    return readdirSync(path).filter((n) => statSync(join(path, n)).isDirectory());
  } catch {
    return [];
  }
}

function listVariants(charDir) {
  const variantsDir = join(charDir, "prompts", "variants");
  try {
    return readdirSync(variantsDir)
      .filter((n) => n.endsWith(".md"))
      .map((n) => basename(n, ".md"));
  } catch {
    return [];
  }
}

const characters = listDir(charactersDir);
const pairs = [];
for (const id of characters) {
  for (const v of listVariants(join(charactersDir, id))) {
    pairs.push({ id, variant: v });
  }
}

if (pairs.length === 0) {
  console.error("no character/variant pairs found under characters/");
  process.exit(1);
}

console.log(`compile-all — ${pairs.length} variants across ${characters.length} characters\n`);

const failures = [];
for (const { id, variant } of pairs) {
  process.stdout.write(`  ${id} :: ${variant} ... `);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", join(repoRoot, "scripts/forge/cli.ts"), "compile", id, variant, "--dry-run"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status === 0) {
    console.log("ok");
  } else {
    console.log("FAIL");
    failures.push({ id, variant, stderr: (result.stderr || result.stdout || "").trim() });
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):\n`);
  for (const f of failures) {
    console.error(`  ✗ ${f.id} :: ${f.variant}`);
    for (const line of f.stderr.split("\n")) console.error(`      ${line}`);
  }
  process.exit(1);
}

console.log(`\n✓ all ${pairs.length} variants compiled`);
