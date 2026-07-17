import { resolve, sep } from "node:path";

/**
 * `<base>/<requested>` を resolve した結果が base 配下に収まることを確認する。
 * `..` や絶対パス、URL エンコード経由の path traversal を防ぐ。
 *
 * 不正な場合は null を返す。呼び出し側が 400 / 404 を返すこと。
 */
export function resolveWithinBase(base: string, requested: string): string | null {
  if (requested.includes("\0")) return null;
  if (/^[a-zA-Z]:[\\/]/.test(requested)) return null; // Windows 絶対パス
  if (requested.startsWith("/")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    return null;
  }
  if (decoded.includes("..")) return null;
  const baseResolved = resolve(base);
  const target = resolve(baseResolved, decoded);
  if (target !== baseResolved && !target.startsWith(baseResolved + sep)) return null;
  return target;
}

/**
 * variantId 用の検証。
 * 階層 ("scenes/mountain-ambush") を許容するが、`..` と先頭 `/` は拒否。
 */
export function isSafeVariantId(variantId: string): boolean {
  if (!variantId || variantId.length > 160) return false;
  if (variantId.includes("\0")) return false;
  if (variantId.startsWith("/") || variantId.startsWith("\\")) return false;
  if (variantId.includes("..")) return false;
  return /^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/i.test(
    variantId,
  );
}

/**
 * character ID 用の検証。kebab-case のみ。
 */
export function isSafeCharacterId(id: string): boolean {
  return (
    id.length <= 64 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)
  );
}
