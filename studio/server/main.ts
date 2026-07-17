import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { STUDIO_NAME } from "../../scripts/forge/lib/brand.ts";

const port = Number(process.env.STUDIO_PORT ?? 5179);
const hostname = process.env.STUDIO_HOST?.trim() || "127.0.0.1";
serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`${STUDIO_NAME} API listening on http://${hostname}:${info.port}`);
});
