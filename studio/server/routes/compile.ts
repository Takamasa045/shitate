import { Hono } from "hono";
import {
  compile,
  compileToDisk,
  CompileError,
} from "../../../scripts/forge/lib/compile.ts";
import { relToRepo } from "../../../scripts/forge/lib/character.ts";
import { isSafeCharacterId, isSafeVariantId } from "../lib/safePath.ts";
import {
  ApiError,
  readMutationJson,
  requiredString,
  withStudioMutationLock,
} from "../lib/mutation.ts";

export const compileRoute = new Hono();

compileRoute.get("/:character/dry-run", async (c) => {
  const character = c.req.param("character");
  const variant = c.req.query("variant") ?? "";
  const standalone = c.req.query("standalone") !== "false";
  if (!isSafeCharacterId(character)) {
    return c.json({ ok: false, message: "invalid character id", exitCode: 1 }, 400);
  }
  if (!isSafeVariantId(variant)) {
    return c.json({ ok: false, message: "invalid variant id", exitCode: 1 }, 400);
  }
  try {
    const artifacts = await compile({
      characterId: character,
      variantId: variant,
      standalone,
    });
    return c.json({
      ok: true,
      runId: artifacts.runId,
      runDir: relToRepo(artifacts.runDir),
      prompt: artifacts.prompt,
      negative: artifacts.negative,
      manifest: artifacts.manifest,
      lexiconUsed: artifacts.lexiconUsed,
      warnings: artifacts.warnings,
    });
  } catch (err) {
    if (err instanceof CompileError) {
      return c.json(
        { ok: false, message: publicCompileMessage(err), exitCode: err.exitCode },
        200,
      );
    }
    throw err;
  }
});

compileRoute.post("/:character/write", async (c) => {
  const character = c.req.param("character");
  if (!isSafeCharacterId(character)) {
    throw new ApiError(400, "invalid character id");
  }
  const body = await readMutationJson(c, 16 * 1024);
  const variant = requiredString(body, "variant", 160, { singleLine: true });
  if (!isSafeVariantId(variant)) throw new ApiError(400, "invalid variant id");
  try {
    const artifacts = await withStudioMutationLock(`character:${character}`, () =>
      compileToDisk({
        characterId: character,
        variantId: variant,
        standalone: true,
      }),
    );
    return c.json(
      {
        ok: true,
        run: {
          runId: artifacts.runId,
          prompt: artifacts.prompt,
          negative: artifacts.negative,
          manifest: artifacts.manifest,
          lexiconUsed: artifacts.lexiconUsed,
          warnings: artifacts.warnings,
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof CompileError) {
      const status = error.exitCode === 1 ? 404 : error.exitCode === 6 ? 409 : 422;
      throw new ApiError(status, publicCompileMessage(error), {
        exitCode: error.exitCode,
      });
    }
    throw error;
  }
});

function publicCompileMessage(error: CompileError): string {
  if (error.exitCode === 1) return "compile input not found";
  if (error.exitCode === 6) return "compile run id conflict";
  return `compile validation failed (code ${error.exitCode})`;
}
