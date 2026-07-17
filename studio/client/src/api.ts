import type {
  CharacterSummary,
  CharacterDetail,
  VariantDetail,
  RunDetail,
  DoctorReport,
  CompileDryRunResponse,
  CreateCharacterRequest,
  CreateCharacterResponse,
  BasePromptWriteRequest,
  PromptWriteRequest,
  PromptWriteResponse,
  RegisterAnchorResponse,
} from "@studio/shared/types";

const headers = { Accept: "application/json" };
const mutationHeaders = {
  ...headers,
  "Content-Type": "application/json",
  "X-Shitate-Studio": "1",
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers });
  return parseJson<T>(res, url);
}

async function mutateJson<T>(
  url: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: mutationHeaders,
    body: JSON.stringify(body),
  });
  return parseJson<T>(res, url);
}

async function mutateForm<T>(url: string, body: FormData): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "X-Shitate-Studio": "1",
    },
    body,
  });
  return parseJson<T>(res, url);
}

async function parseJson<T>(res: Response, fallback: string): Promise<T> {
  const raw = await res.text().catch(() => "");
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `${res.status} ${res.statusText}: ${raw || fallback}`;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

export interface AppendLogRequest {
  variant: string;
  tried: string;
  promptDiff: string;
  artifact: string;
  evaluation: string;
  nextAction: string;
}

export interface AppendLogResponse {
  ok: true;
  entry: {
    heading: string;
    tried: string;
    evaluation: string;
    nextAction: string;
  };
}

export interface CompileWriteResponse {
  ok: true;
  run: {
    runId: string;
    prompt: string;
    negative: string;
    manifest: Record<string, unknown>;
  };
}

export const api = {
  characters(): Promise<{ characters: CharacterSummary[] }> {
    return getJson("/api/characters");
  },
  createCharacter(input: CreateCharacterRequest): Promise<CreateCharacterResponse> {
    return mutateJson("/api/characters", "POST", input);
  },
  character(id: string): Promise<CharacterDetail> {
    return getJson(`/api/characters/${encodeURIComponent(id)}`);
  },
  basePrompt(id: string): Promise<VariantDetail> {
    return getJson(`/api/characters/${encodeURIComponent(id)}/prompts/base`);
  },
  variant(id: string, variantId: string): Promise<VariantDetail> {
    const path = variantId.split("/").map(encodeURIComponent).join("/");
    return getJson(`/api/characters/${encodeURIComponent(id)}/prompts/variants/${path}`);
  },
  saveBase(id: string, input: BasePromptWriteRequest): Promise<PromptWriteResponse> {
    return mutateJson(
      `/api/characters/${encodeURIComponent(id)}/prompts/base`,
      "PUT",
      input,
    );
  },
  saveVariant(
    id: string,
    variantId: string,
    input: PromptWriteRequest,
  ): Promise<PromptWriteResponse> {
    const path = variantId.split("/").map(encodeURIComponent).join("/");
    return mutateJson(
      `/api/characters/${encodeURIComponent(id)}/prompts/variants/${path}`,
      "PUT",
      input,
    );
  },
  appendLog(id: string, input: AppendLogRequest): Promise<AppendLogResponse> {
    return mutateJson(
      `/api/characters/${encodeURIComponent(id)}/logs`,
      "POST",
      input,
    );
  },
  registerAnchor(
    id: string,
    input: { anchorId: string; notes: string; nextAction: string; file: File },
  ): Promise<RegisterAnchorResponse> {
    const body = new FormData();
    body.set("anchorId", input.anchorId);
    body.set("notes", input.notes);
    body.set("nextAction", input.nextAction);
    body.set("file", input.file);
    return mutateForm(
      `/api/characters/${encodeURIComponent(id)}/references/anchors`,
      body,
    );
  },
  run(id: string, runId: string): Promise<RunDetail> {
    return getJson(
      `/api/characters/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}`,
    );
  },
  doctor(character?: string): Promise<DoctorReport> {
    const q = character ? `?character=${encodeURIComponent(character)}` : "";
    return getJson(`/api/doctor${q}`);
  },
  compileDryRun(character: string, variant: string): Promise<CompileDryRunResponse> {
    const v = encodeURIComponent(variant);
    return getJson(
      `/api/compile/${encodeURIComponent(character)}/dry-run?variant=${v}`,
    );
  },
  compileWrite(character: string, variant: string): Promise<CompileWriteResponse> {
    return mutateJson(
      `/api/compile/${encodeURIComponent(character)}/write`,
      "POST",
      { variant },
    );
  },
  imageUrl(id: string, name: string): string {
    return `/api/characters/${encodeURIComponent(id)}/references/images/${encodeURIComponent(name)}`;
  },
  runFileUrl(id: string, runId: string, name: string): string {
    return `/api/characters/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(name)}`;
  },
};
