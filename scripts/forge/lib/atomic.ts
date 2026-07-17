import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/** 同一ディレクトリ内の rename でファイル更新を原子化する。 */
export async function atomicWriteFile(
  target: string,
  content: string,
): Promise<void> {
  const dir = dirname(target);
  await mkdir(dir, { recursive: true });
  const temp = resolve(dir, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}
