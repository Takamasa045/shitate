import { cp, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const CHARACTER_IMAGE_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const TEXT_FILE_RE = /(?:^|\/)(?:[^/]+\.(?:command|css|html|js|json|jsx|md|mjs|ts|tsx|txt|ya?ml)|AGENTS\.md|CLAUDE\.md)$/i;
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const EXCLUDED_FILES = new Set([".DS_Store"]);
const EXCLUDED_LOCAL_PATHS = new Set([".claude/settings.local.json"]);
const PRIVATE_THEME_PATTERNS = [
  /田舎/u,
  /里山/u,
  /農道/u,
  /畦道/u,
  /rural/iu,
  /countryside/iu,
  /\bcountry-[a-z0-9-]+/iu,
  /\bskate-filmer\b/iu,
];
const PERSONAL_PATH_PATTERNS = [
  /\/Users\/[^/\s]+\//u,
  /\/home\/[^/\s]+\//u,
  /[A-Z]:\\Users\\[^\\\s]+\\/iu,
];

export async function findDistributionIssues(root, options = {}) {
  const allowedCharacterIds = new Set(options.allowedCharacterIds ?? []);
  const files = [];
  const issues = [];
  await walk(root, "", files, issues);

  const characterIds = new Set();
  for (const relativePath of files) {
    const segments = relativePath.split("/");
    if (segments[0] === "characters" && segments[1]) {
      characterIds.add(segments[1]);
    }

    if (relativePath.startsWith("characters/") && CHARACTER_IMAGE_RE.test(relativePath)) {
      issues.push({ kind: "character-image", path: relativePath });
      continue;
    }

    if (!TEXT_FILE_RE.test(relativePath)) continue;
    const raw = await readFile(path.join(root, relativePath), "utf8");
    scanText(relativePath, raw, issues);
  }

  if (allowedCharacterIds.size > 0) {
    for (const id of characterIds) {
      if (!allowedCharacterIds.has(id)) {
        issues.push({
          kind: "private-character",
          path: `characters/${id}`,
        });
      }
    }
  }

  return issues.sort(compareIssues);
}

export async function createDistributionSnapshot(source, destination, options = {}) {
  const sourceRoot = path.resolve(source);
  const destinationRoot = path.resolve(destination);
  const relativeDestination = path.relative(sourceRoot, destinationRoot);
  if (
    relativeDestination === "" ||
    (!relativeDestination.startsWith("..") && !path.isAbsolute(relativeDestination))
  ) {
    throw new Error("distribution destination must be outside the source directory");
  }

  const sourceInfo = await lstat(sourceRoot);
  if (!sourceInfo.isDirectory()) {
    throw new Error("distribution source must be a directory");
  }
  try {
    await lstat(destinationRoot);
    throw new Error("distribution destination already exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const issues = await findDistributionIssues(sourceRoot, options);
  if (issues.length > 0) {
    throw new Error(`distribution check failed with ${issues.length} issue(s)`);
  }

  await mkdir(path.dirname(destinationRoot), { recursive: true });
  await cp(sourceRoot, destinationRoot, {
    recursive: true,
    preserveTimestamps: true,
    filter: (sourcePath) => shouldCopy(sourceRoot, sourcePath),
  });

  const copiedIssues = await findDistributionIssues(destinationRoot, options);
  if (copiedIssues.length > 0) {
    throw new Error(`distribution snapshot validation failed with ${copiedIssues.length} issue(s)`);
  }

  return { destination: destinationRoot };
}

async function walk(root, relativeDir, files, issues) {
  const absoluteDir = path.join(root, relativeDir);
  let entries;
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (EXCLUDED_FILES.has(entry.name)) continue;
    const relativePath = relativeDir
      ? `${relativeDir}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (relativePath === "scripts/distribution") continue;
      await walk(root, relativePath, files, issues);
      continue;
    }
    if (entry.isSymbolicLink()) {
      issues.push({ kind: "symlink", path: relativePath });
      continue;
    }
    if (entry.isFile()) files.push(relativePath);
  }
}

function scanText(relativePath, raw, issues) {
  const lines = raw.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of PRIVATE_THEME_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          kind: "private-theme",
          path: relativePath,
          line: index + 1,
        });
        break;
      }
    }
    for (const pattern of PERSONAL_PATH_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          kind: "personal-path",
          path: relativePath,
          line: index + 1,
        });
        break;
      }
    }
  }
}

function compareIssues(a, b) {
  return a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind) || (a.line ?? 0) - (b.line ?? 0);
}

function shouldCopy(sourceRoot, sourcePath) {
  const relativePath = path.relative(sourceRoot, sourcePath).split(path.sep).join("/");
  if (relativePath === "") return true;
  if (EXCLUDED_LOCAL_PATHS.has(relativePath)) return false;
  const segments = relativePath.split("/");
  return !segments.some((segment) => EXCLUDED_DIRS.has(segment) || EXCLUDED_FILES.has(segment));
}
