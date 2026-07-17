#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { findDistributionIssues } from "./lib.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const issues = await findDistributionIssues(repoRoot, {
  allowedCharacterIds: ["washi-fox"],
});

if (issues.length > 0) {
  console.error(`distribution check failed: ${issues.length} issue(s)`);
  for (const issue of issues) {
    const location = issue.line ? `${issue.path}:${issue.line}` : issue.path;
    console.error(`- ${issue.kind}: ${location}`);
  }
  process.exitCode = 1;
} else {
  console.log("distribution check passed: no private character images, themes, or paths");
}
