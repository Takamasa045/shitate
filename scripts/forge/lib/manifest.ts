import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { characterOutputsDir } from "./paths.ts";

export interface Manifest {
  run_id?: string;
  character?: string;
  variant_id?: string;
  base_version?: string;
  base_sha?: string;
  tool?: string;
  tool_version?: string;
  prompt_file?: string;
  lexicon_used?: string[];
  references?: string[];
  source_entities?: string[];
  seed?: number | null;
  compiled_prompt?: string;
  compiled_negative?: string;
  outputs?: string[];
  thumbnails?: string[];
  evaluation?: Record<string, unknown>;
  created_at?: string;
  created_by?: string;
  [k: string]: unknown;
}

export async function readManifest(
  characterId: string,
  runId: string,
): Promise<Manifest | null> {
  const path = resolve(characterOutputsDir(characterId), runId, "manifest.json");
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

export const REQUIRED_MANIFEST_FIELDS: ReadonlyArray<keyof Manifest> = [
  "run_id",
  "character",
  "base_version",
  "tool",
  "tool_version",
  "created_at",
];

export function missingRequiredFields(m: Manifest): string[] {
  return REQUIRED_MANIFEST_FIELDS.filter((f) => {
    const v = m[f];
    return v === undefined || v === null || v === "";
  }).map(String);
}
