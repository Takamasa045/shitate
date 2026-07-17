import { Hono } from "hono";
import { runChecks } from "../../../scripts/forge/lib/checks.ts";
import { summarize } from "../../../scripts/forge/lib/output.ts";
import { isSafeCharacterId } from "../lib/safePath.ts";

export const doctorRoute = new Hono();

doctorRoute.get("/", async (c) => {
  const characterParam = c.req.query("character");
  if (characterParam && !isSafeCharacterId(characterParam)) {
    return c.json({ error: "invalid character id" }, 400);
  }
  const findings = await runChecks({
    characterIds: characterParam ? [characterParam] : undefined,
    includePromotionGate: false,
  });
  const s = summarize(findings);
  return c.json({
    findings,
    summary: { errors: s.errors, warnings: s.warns, infos: s.infos, oks: s.oks },
  });
});
