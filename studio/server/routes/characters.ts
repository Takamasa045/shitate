import { Hono } from "hono";
import type { Context } from "hono";
import { resolve } from "node:path";
import { stat, createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { characterDir } from "../../../scripts/forge/lib/paths.ts";
import {
  buildCharacterSummaries,
  buildCharacterDetail,
  buildVariantDetail,
  buildBasePrompt,
  buildRunDetail,
} from "../lib/buildCharacterDetail.ts";
import { isSafeCharacterId, isSafeVariantId } from "../lib/safePath.ts";
import {
  ApiError,
  optionalString,
  readMutationForm,
  readMutationJson,
  requiredString,
  withStudioMutationLock,
} from "../lib/mutation.ts";
import {
  scaffoldCharacter,
  ScaffoldError,
} from "../../../scripts/forge/lib/scaffold.ts";
import { runIndex } from "../../../scripts/forge/commands/index.ts";
import {
  parseBasePromptWriteBody,
  parsePromptWriteBody,
  updateBasePrompt,
  upsertVariantPrompt,
} from "../lib/promptMutations.ts";
import { appendLogEntry, parseLogEntryBody } from "../lib/logMutations.ts";
import {
  ANCHOR_MULTIPART_LIMIT,
  parseAnchorUpload,
  registerAnchor,
} from "../lib/anchorMutations.ts";

export const charactersRoute = new Hono();

charactersRoute.post("/", async (c) => {
  const body = await readMutationJson(c, 16 * 1024);
  const id = requiredString(body, "id", 64, { singleLine: true });
  const name = requiredString(body, "name", 120, { singleLine: true });
  const role = optionalString(body, "role", 240, { singleLine: true });
  if (!isSafeCharacterId(id)) throw new ApiError(400, "invalid character id");

  return withStudioMutationLock("characters:index", async () => {
    let scaffold;
    try {
      scaffold = await scaffoldCharacter({ id, name, role });
    } catch (error) {
      if (error instanceof ScaffoldError) {
        if (error.kind === "conflict") {
          throw new ApiError(409, "character already exists");
        }
        if (error.kind === "invalid-id") {
          throw new ApiError(400, "invalid character id");
        }
        throw new ApiError(500, "character could not be created");
      }
      throw error;
    }

    let indexCode: number;
    try {
      indexCode = await runIndex({ mode: "write" });
    } catch {
      await rm(scaffold.dir, { recursive: true, force: true });
      throw new ApiError(500, "character index could not be updated");
    }
    if (indexCode !== 0) {
      await rm(scaffold.dir, { recursive: true, force: true });
      throw new ApiError(500, "character index could not be updated");
    }
    const character = await buildCharacterDetail(id);
    if (!character) throw new ApiError(500, "character could not be loaded");
    return c.json({ ok: true, character }, 201);
  });
});

charactersRoute.get("/", async (c) => {
  const summaries = await buildCharacterSummaries();
  return c.json({ characters: summaries });
});

charactersRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isSafeCharacterId(id)) return c.json({ error: "invalid character id" }, 400);
  const detail = await buildCharacterDetail(id);
  if (!detail) return c.json({ error: "not found" }, 404);
  return c.json(detail);
});

charactersRoute.post("/:id/logs", async (c) => {
  const id = c.req.param("id");
  if (!isSafeCharacterId(id)) throw new ApiError(400, "invalid character id");
  const body = await readMutationJson(c, 32 * 1024);
  const entry = await appendLogEntry(id, parseLogEntryBody(body));
  return c.json({ ok: true, entry }, 201);
});

charactersRoute.get("/:id/prompts/base", async (c) => {
  const id = c.req.param("id");
  if (!isSafeCharacterId(id)) return c.json({ error: "invalid character id" }, 400);
  const detail = await buildBasePrompt(id);
  if (!detail) return c.json({ error: "not found" }, 404);
  return c.json(detail);
});

charactersRoute.put("/:id/prompts/base", async (c) => {
  const id = c.req.param("id");
  if (!isSafeCharacterId(id)) throw new ApiError(400, "invalid character id");
  const body = await readMutationJson(c);
  const result = await updateBasePrompt(id, parseBasePromptWriteBody(body));
  const prompt = await buildBasePrompt(id);
  if (!prompt) throw new ApiError(500, "base prompt could not be loaded");
  return c.json({ ok: true, prompt, baseVersion: result.baseVersion });
});

charactersRoute.get("/:id/prompts/variants/*", async (c) => {
  const id = c.req.param("id");
  if (!isSafeCharacterId(id)) return c.json({ error: "invalid character id" }, 400);
  const variantId = c.req.path.split(`/${id}/prompts/variants/`)[1] ?? "";
  if (!isSafeVariantId(variantId)) {
    return c.json({ error: "invalid variant id" }, 400);
  }
  const detail = await buildVariantDetail(id, variantId);
  if (!detail) return c.json({ error: "not found" }, 404);
  return c.json(detail);
});

charactersRoute.put("/:id/prompts/variants/*", async (c) => {
  const id = c.req.param("id");
  if (!isSafeCharacterId(id)) throw new ApiError(400, "invalid character id");
  const variantId = extractVariantId(c.req.path, id);
  if (!isSafeVariantId(variantId)) {
    throw new ApiError(400, "invalid variant id");
  }
  const body = await readMutationJson(c);
  const result = await upsertVariantPrompt(id, variantId, parsePromptWriteBody(body));
  const prompt = await buildVariantDetail(id, variantId);
  if (!prompt) throw new ApiError(500, "variant prompt could not be loaded");
  return c.json(
    { ok: true, prompt, baseVersion: result.baseVersion },
    result.created ? 201 : 200,
  );
});

function extractVariantId(requestPath: string, characterId: string): string {
  const marker = `/${characterId}/prompts/variants/`;
  const encoded = requestPath.split(marker)[1] ?? "";
  try {
    return decodeURIComponent(encoded);
  } catch {
    return "";
  }
}

charactersRoute.get("/:id/runs/:runId", async (c) => {
  const id = c.req.param("id");
  const runId = c.req.param("runId");
  if (!isSafeCharacterId(id)) return c.json({ error: "invalid character id" }, 400);
  if (!/^[a-z0-9_\-]+$/i.test(runId)) {
    return c.json({ error: "invalid run id" }, 400);
  }
  const detail = await buildRunDetail(id, runId);
  if (!detail) return c.json({ error: "not found" }, 404);
  return c.json(detail);
});

charactersRoute.post("/:id/references/anchors", async (c) => {
  const id = c.req.param("id");
  if (!isSafeCharacterId(id)) throw new ApiError(400, "invalid character id");
  const form = await readMutationForm(c, ANCHOR_MULTIPART_LIMIT);
  const anchor = await registerAnchor(id, await parseAnchorUpload(form));
  return c.json({ ok: true, anchor }, 201);
});

charactersRoute.get("/:id/references/images/:name", async (c) => {
  const id = c.req.param("id");
  const name = c.req.param("name");
  if (!isSafeCharacterId(id)) return c.json({ error: "invalid character id" }, 400);
  if (!/^[A-Za-z0-9._\-]+$/.test(name)) {
    return c.json({ error: "invalid file name" }, 400);
  }
  return serveFile(c, resolve(characterDir(id), "references", "images", name));
});

charactersRoute.get("/:id/runs/:runId/files/:name", async (c) => {
  const id = c.req.param("id");
  const runId = c.req.param("runId");
  const name = c.req.param("name");
  if (!isSafeCharacterId(id)) return c.json({ error: "invalid character id" }, 400);
  if (!/^[a-z0-9_\-]+$/i.test(runId)) {
    return c.json({ error: "invalid run id" }, 400);
  }
  if (!/^[A-Za-z0-9._\-]+$/.test(name)) {
    return c.json({ error: "invalid file name" }, 400);
  }
  return serveFile(c, resolve(characterDir(id), "outputs", runId, name));
});

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

async function serveFile(c: Context, filePath: string): Promise<Response> {
  return new Promise((resolveResponse) => {
    stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        resolveResponse(c.json({ error: "not found" }, 404));
        return;
      }
      const stream = createReadStream(filePath);
      const webStream = Readable.toWeb(stream) as ReadableStream;
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
      const mime = MIME[ext] ?? "application/octet-stream";
      resolveResponse(
        new Response(webStream, {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Content-Length": String(st.size),
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        }),
      );
    });
  });
}
