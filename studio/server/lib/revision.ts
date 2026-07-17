import { createHash } from "node:crypto";

export function contentRevision(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
