import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(here, "..", "..", "..");

interface RootEnvironment {
  SHITATE_ROOT?: string;
  CHARACTER_FORGE_ROOT?: string;
}

export function resolveRepoRoot(
  environment: RootEnvironment,
  defaultRoot: string,
): string {
  return resolve(
    environment.SHITATE_ROOT?.trim() ||
      environment.CHARACTER_FORGE_ROOT?.trim() ||
      defaultRoot,
  );
}

/**
 * Studio/E2E からは temp root を差し替えられる。
 * 未設定時は従来どおりこのリポを正本とする。
 */
export const REPO_ROOT = resolveRepoRoot(process.env, DEFAULT_REPO_ROOT);

export const CHARACTERS_DIR = resolve(REPO_ROOT, "characters");
export const LEXICON_DIR = resolve(REPO_ROOT, "lexicon");
export const INDEX_MD = resolve(REPO_ROOT, "INDEX.md");

export function characterDir(id: string): string {
  return resolve(CHARACTERS_DIR, id);
}

export function characterIndex(id: string): string {
  return resolve(characterDir(id), "index.md");
}

export function characterLog(id: string): string {
  return resolve(characterDir(id), "log.md");
}

export function characterBasePrompt(id: string): string {
  return resolve(characterDir(id), "prompts", "base.md");
}

export function characterVariantPrompt(id: string, variantPath: string): string {
  return resolve(characterDir(id), "prompts", "variants", `${variantPath}.md`);
}

export function characterOutputsDir(id: string): string {
  return resolve(characterDir(id), "outputs");
}

export function characterReferencesDir(id: string): string {
  return resolve(characterDir(id), "references");
}
