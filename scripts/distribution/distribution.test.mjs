import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createDistributionSnapshot, findDistributionIssues } from "./lib.mjs";

test("画像なしの汎用サンプルは配布できる", async (t) => {
  const root = await fixture(t);
  await put(root, "characters/washi-fox/index.md", "# 和紙狐\n\n物語の案内役。\n");
  await put(root, "README.md", "# Shitate\n\nローカルのキャラクター設計ツール。\n");

  assert.deepEqual(await findDistributionIssues(root), []);
});

test("キャラクターディレクトリ内の画像を拒否する", async (t) => {
  const root = await fixture(t);
  await put(root, "characters/washi-fox/references/images/face-anchor.png", "not-a-real-image");

  const issues = await findDistributionIssues(root);

  assert.equal(issues.some((issue) => issue.kind === "character-image"), true);
});

test("作品固有のシリーズ名とIDを拒否する", async (t) => {
  const root = await fixture(t);
  await put(root, "studio/client/src/example.ts", "export const label = '田舎シリーズ';\n");
  await put(root, "README.md", "country-skater\n");

  const issues = await findDistributionIssues(root);

  assert.equal(issues.filter((issue) => issue.kind === "private-theme").length, 2);
});

test("個人端末の絶対パスを拒否する", async (t) => {
  const root = await fixture(t);
  await put(root, "docs/example.md", "/Users/example/Downloads/private.png\n");

  const issues = await findDistributionIssues(root);

  assert.equal(issues.some((issue) => issue.kind === "personal-path"), true);
});

test("配布用サンプル以外のキャラクターディレクトリを拒否する", async (t) => {
  const root = await fixture(t);
  await put(root, "characters/private-hero/index.md", "# Private hero\n");

  const issues = await findDistributionIssues(root, {
    allowedCharacterIds: ["washi-fox"],
  });

  assert.equal(issues.some((issue) => issue.kind === "private-character"), true);
});

test("生成物や依存フォルダは検査対象から除外する", async (t) => {
  const root = await fixture(t);
  await put(root, "node_modules/package/image.png", "ignored");
  await put(root, ".git/objects/example", "田舎シリーズ");
  await put(root, "test-results/failure.png", "ignored");

  assert.deepEqual(await findDistributionIssues(root), []);
});

test("FinderのメタデータをキャラクターIDとして扱わない", async (t) => {
  const root = await fixture(t);
  await put(root, "characters/.DS_Store", "metadata");
  await put(root, "characters/washi-fox/index.md", "# 和紙狐\n");

  assert.deepEqual(
    await findDistributionIssues(root, { allowedCharacterIds: ["washi-fox"] }),
    [],
  );
});

test("Git履歴とローカル生成物を含めず配布スナップショットを作る", async (t) => {
  const workspace = await fixture(t);
  const source = path.join(workspace, "source");
  const destination = path.join(workspace, "snapshot");
  await put(source, "characters/washi-fox/index.md", "# 和紙狐\n");
  await put(source, "README.md", "# Shitate\n");
  await put(source, ".git/objects/private", "history");
  await put(source, "node_modules/pkg/index.js", "dependency");
  await put(source, ".claude/settings.local.json", "{}\n");

  const result = await createDistributionSnapshot(source, destination, {
    allowedCharacterIds: ["washi-fox"],
  });

  assert.equal(result.destination, destination);
  await access(path.join(destination, "README.md"));
  await assert.rejects(access(path.join(destination, ".git")));
  await assert.rejects(access(path.join(destination, "node_modules")));
  await assert.rejects(access(path.join(destination, ".claude/settings.local.json")));
  assert.deepEqual(
    await findDistributionIssues(destination, { allowedCharacterIds: ["washi-fox"] }),
    [],
  );
});

test("配布ゲートに違反するソースからはスナップショットを作らない", async (t) => {
  const workspace = await fixture(t);
  const source = path.join(workspace, "source");
  const destination = path.join(workspace, "snapshot");
  await put(source, "characters/washi-fox/references/images/private.png", "image");

  await assert.rejects(
    createDistributionSnapshot(source, destination, {
      allowedCharacterIds: ["washi-fox"],
    }),
    /distribution check failed/,
  );
  await assert.rejects(access(destination));
});

test("配布先に既存のsymlinkを指定したら拒否する", async (t) => {
  const workspace = await fixture(t);
  const source = path.join(workspace, "source");
  const destination = path.join(workspace, "snapshot");
  await put(source, "characters/washi-fox/index.md", "# 和紙狐\n");
  await symlink(path.join(workspace, "missing-target"), destination, "dir");

  await assert.rejects(
    createDistributionSnapshot(source, destination, {
      allowedCharacterIds: ["washi-fox"],
    }),
    /destination already exists/,
  );
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "shitate-distribution-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function put(root, relativePath, content) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}
