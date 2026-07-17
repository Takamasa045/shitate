import { Hono } from "hono";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
import { charactersRoute } from "./routes/characters.ts";
import { compileRoute } from "./routes/compile.ts";
import { doctorRoute } from "./routes/doctor.ts";
import { ApiError } from "./lib/mutation.ts";

export const app = new Hono();

app.use("*", logger());
app.use(
  "/api/*",
  bodyLimit({
    // JSON mutation は readMutationJson 側で 256 KiB 以下に制限する。
    // ここは Studio v0.3 の 5 MiB anchor upload に multipart overhead を足した上限。
    maxSize: 6 * 1024 * 1024,
    onError: (c) => c.json({ error: "request body too large" }, 413),
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/characters", charactersRoute);
app.route("/api/compile", compileRoute);
app.route("/api/doctor", doctorRoute);

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { error: err.publicMessage, ...(err.details ?? {}) },
      err.status,
    );
  }
  console.error("[studio api error]", err);
  return c.json({ error: "internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "not found", path: c.req.path }, 404));
