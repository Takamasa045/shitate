import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const STUDIO_MUTATION_HEADER = "X-Shitate-Studio";
export const LEGACY_STUDIO_MUTATION_HEADER = "X-Character-Forge-Studio";
export const DEFAULT_JSON_LIMIT = 256 * 1024;
const mutationLocks = new Map<string, Promise<void>>();

export class ApiError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly publicMessage: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(publicMessage);
    this.name = "ApiError";
  }
}

export async function readMutationJson(
  c: Context,
  maxBytes: number = DEFAULT_JSON_LIMIT,
): Promise<Record<string, unknown>> {
  if (!hasStudioMutationHeader(c)) {
    throw new ApiError(403, "studio mutation header required");
  }
  const contentType = c.req.header("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new ApiError(415, "application/json required");
  }
  const declaredLength = Number(c.req.header("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, "request body too large");
  }
  const raw = await c.req.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new ApiError(413, "request body too large");
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "invalid JSON body");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "JSON object required");
  }
  return value as Record<string, unknown>;
}

export async function readMutationForm(
  c: Context,
  maxBytes: number,
): Promise<Record<string, string | File>> {
  if (!hasStudioMutationHeader(c)) {
    throw new ApiError(403, "studio mutation header required");
  }
  const contentType = c.req.header("Content-Type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/\bboundary=/i.test(contentType)) {
    throw new ApiError(415, "multipart/form-data required");
  }
  const declaredLength = Number(c.req.header("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, "request body too large");
  }
  try {
    return await c.req.parseBody({ all: false, dot: false });
  } catch {
    throw new ApiError(400, "invalid multipart body");
  }
}

function hasStudioMutationHeader(c: Context): boolean {
  return (
    c.req.header(STUDIO_MUTATION_HEADER) === "1" ||
    c.req.header(LEGACY_STUDIO_MUTATION_HEADER) === "1"
  );
}

export function requiredString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
  options: { singleLine?: boolean } = {},
): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new ApiError(400, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) throw new ApiError(400, `${field} is required`);
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${field} is too long`);
  }
  if (options.singleLine && /[\r\n\u2028\u2029]/.test(trimmed)) {
    throw new ApiError(400, `${field} must be one line`);
  }
  if (/\0/.test(trimmed)) throw new ApiError(400, `${field} contains invalid data`);
  return trimmed;
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
  options: { singleLine?: boolean } = {},
): string | undefined {
  if (body[field] === undefined) return undefined;
  return requiredString(body, field, maxLength, options);
}

/** 同一の正本グループに対するStudio内の書き込みを直列化する。 */
export async function withStudioMutationLock<T>(
  key: string,
  action: () => Promise<T>,
): Promise<T> {
  const previous = mutationLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  const tail = previous.then(() => gate);
  mutationLocks.set(key, tail);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (mutationLocks.get(key) === tail) mutationLocks.delete(key);
  }
}
