import { readFile } from "node:fs/promises";
import { atomicWriteFile } from "../../../scripts/forge/lib/atomic.ts";
import { readCharacter } from "../../../scripts/forge/lib/character.ts";
import { characterLog } from "../../../scripts/forge/lib/paths.ts";
import type {
  CreateLogEntryRequest,
  LogEntrySummary,
  LogEvaluation,
} from "../../shared/types.ts";
import { ApiError, withStudioMutationLock } from "./mutation.ts";
import { isSafeVariantId } from "./safePath.ts";

const FIELD_MAX = 4_000;
const EVALUATIONS = new Set<LogEvaluation>(["◎", "◯", "△", "✗", "—"]);

export function parseLogEntryBody(
  body: Record<string, unknown>,
): CreateLogEntryRequest {
  const variant = parseSingleLine(body.variant, "variant", 160);
  if (!isSafeVariantId(variant)) throw new ApiError(400, "invalid variant id");
  const tried = parseSingleLine(body.tried, "tried", FIELD_MAX);
  const promptDiff = parseSingleLine(body.promptDiff, "promptDiff", FIELD_MAX);
  const artifact = parseSingleLine(body.artifact, "artifact", FIELD_MAX);
  const evaluationRaw = parseSingleLine(body.evaluation, "evaluation", 8);
  const evaluation = evaluationRaw === "○" ? "◯" : evaluationRaw;
  if (!EVALUATIONS.has(evaluation as LogEvaluation)) {
    throw new ApiError(400, "invalid evaluation");
  }
  const nextAction = parseSingleLine(body.nextAction, "nextAction", FIELD_MAX);
  return {
    variant,
    tried,
    promptDiff,
    artifact,
    evaluation: evaluation as LogEvaluation,
    nextAction,
  };
}

export async function appendLogEntry(
  characterId: string,
  input: CreateLogEntryRequest,
  now: Date = new Date(),
): Promise<LogEntrySummary> {
  return withStudioMutationLock(`character:${characterId}`, () =>
    appendLogEntryUnlocked(characterId, input, now),
  );
}

/** 呼び出し元が character lock を保持している複合 mutation 専用。 */
export async function appendLogEntryUnlocked(
  characterId: string,
  input: CreateLogEntryRequest,
  now: Date = new Date(),
): Promise<LogEntrySummary> {
  const path = characterLog(characterId);
  const info = await readCharacter(characterId);
  if (!info.hasIndex || !info.hasLog) throw new ApiError(404, "character not found");
  const baseVersion = info.frontmatter?.base_version;
  if (!/^v\d+$/.test(baseVersion ?? "")) {
    throw new ApiError(422, "character base version is invalid");
  }
  let current: string;
  try {
    current = await readFile(path, "utf8");
  } catch {
    throw new ApiError(404, "character log not found");
  }
  const heading = `${jstDate(now)} / base ${baseVersion} / ${input.variant}`;
  const entry = renderEntry(heading, input);
  const updated = insertDescending(current, entry);
  await atomicWriteFile(path, updated);
  return {
    heading,
    tried: input.tried,
    evaluation: input.evaluation,
    nextAction: input.nextAction,
  };
}

function parseSingleLine(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new ApiError(400, `${field} must be a string`);
  if (value.length > maxLength) throw new ApiError(400, `${field} is too long`);
  const normalized = value
    .replace(/[\r\n\u2028\u2029\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (!normalized) throw new ApiError(400, `${field} is required`);
  if (normalized.includes("\0")) {
    throw new ApiError(400, `${field} contains invalid data`);
  }
  return normalized;
}

function renderEntry(heading: string, input: CreateLogEntryRequest): string {
  return `## ${heading}

- **試行**: ${input.tried}
- **プロンプト差分**: ${input.promptDiff}
- **生成物**: ${input.artifact}
- **評価**: ${input.evaluation}
- **次の改善**: ${input.nextAction}
`;
}

function insertDescending(current: string, entry: string): string {
  const match = /^##\s+\d{4}-\d{2}-\d{2}\s+\//m.exec(current);
  if (!match || match.index === undefined) {
    return `${current.trimEnd()}\n\n${entry}`;
  }
  const before = current.slice(0, match.index).trimEnd();
  const after = current.slice(match.index).trimStart();
  return `${before}\n\n${entry}\n${after}`;
}

function jstDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
