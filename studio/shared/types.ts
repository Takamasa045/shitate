// Hono server と Vite client で共有する API 型定義。
// Node / browser どちらからも import されるため、
// `node:fs` 等の Node-only import は絶対に書かないこと。

export type CharacterStatus = "draft" | "experimental" | "stable";

export interface CharacterSummary {
  id: string;
  name: string;
  status: CharacterStatus | null;
  baseVersion: string | null;
  updated: string | null;
  sourceEntities: string[];
  tags: string[];
  runCount: number;
  anchors: string[];
  primaryImageName: string | null;
  threeViewPreview: { runId: string; name: string } | null;
  latestLog: LogEntrySummary | null;
}

export interface LogEntrySummary {
  heading: string;
  tried: string | null;
  evaluation: string | null;
  nextAction: string | null;
}

export interface CharacterDetail extends CharacterSummary {
  worldRefs: string[];
  indexMarkdown: string;
  worldMarkdown: string | null;
  variants: VariantSummary[];
  runs: RunSummary[];
  references: ReferencesSummary;
  logEntries: LogEntrySummary[];
  frontmatterError: string | null;
}

export interface VariantSummary {
  id: string; // path without extension, e.g. "scenes/mountain-ambush"
  basename: string;
  purpose: string | null;
  baseVersionDep: string | null;
  lexiconRefCount: number;
  hasPositive: boolean;
  hasNegative: boolean;
}

export interface VariantDetail extends VariantSummary {
  raw: string;
  revision: string;
  positive: string | null;
  negative: string | null;
  lexiconRefs: string[];
  memo: string | null;
}

export interface RunSummary {
  runId: string;
  tool: string | null;
  toolVersion: string | null;
  createdAt: string | null;
  baseVersion: string | null;
  variantId: string | null;
  evaluationOverall: string | null;
  hasPrompt: boolean;
  hasNegative: boolean;
  outputCount: number;
  thumbnailCount: number;
}

export interface RunDetail extends RunSummary {
  manifest: Record<string, unknown>;
  prompt: string | null;
  negative: string | null;
  promptSource: "file" | "manifest" | null;
}

export interface ReferencesSummary {
  hasYaml: boolean;
  yamlRaw: string | null;
  images: Array<{
    name: string;
    isAnchor: boolean;
    sizeBytes: number;
  }>;
}

export interface DoctorReport {
  findings: Finding[];
  summary: { errors: number; warnings: number; infos: number; oks: number };
}

export interface Finding {
  severity: "ok" | "info" | "warn" | "error";
  scope: string;
  message: string;
  hint?: string;
}

export interface CompileDryRunResult {
  ok: true;
  runId: string;
  runDir: string;
  prompt: string;
  negative: string;
  manifest: Record<string, unknown>;
  lexiconUsed: string[];
  warnings: string[];
}

export interface CompileDryRunError {
  ok: false;
  message: string;
  exitCode: number;
}

export type CompileDryRunResponse = CompileDryRunResult | CompileDryRunError;

export type RevisionMode = "same-version" | "new-version";

export interface CreateCharacterRequest {
  id: string;
  name: string;
  role?: string;
}

export interface CreateCharacterResponse {
  ok: true;
  character: CharacterDetail;
}

export interface PromptWriteRequest {
  raw: string;
  expectedRevision?: string;
}

export interface BasePromptWriteRequest extends PromptWriteRequest {
  expectedRevision: string;
  revisionMode: RevisionMode;
}

export interface PromptWriteResponse {
  ok: true;
  prompt: VariantDetail;
  baseVersion: string;
}

export interface RevisionConflictResponse {
  error: "revision conflict";
  currentRevision: string | null;
}

export type LogEvaluation = "◎" | "◯" | "△" | "✗" | "—";

export interface CreateLogEntryRequest {
  variant: string;
  tried: string;
  promptDiff: string;
  artifact: string;
  evaluation: LogEvaluation;
  nextAction: string;
}

export interface CreateLogEntryResponse {
  ok: true;
  entry: LogEntrySummary;
}

export interface RegisterAnchorResponse {
  ok: true;
  anchor: {
    id: string;
    name: string;
    path: string;
    sizeBytes: number;
  };
}

export interface CompileWriteRequest {
  variant: string;
}

export interface CompileWriteResult {
  runId: string;
  prompt: string;
  negative: string;
  manifest: Record<string, unknown>;
  lexiconUsed: string[];
  warnings: string[];
}

export interface CompileWriteResponse {
  ok: true;
  run: CompileWriteResult;
}
