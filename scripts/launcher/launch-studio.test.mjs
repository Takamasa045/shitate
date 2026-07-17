import assert from "node:assert/strict";
import test from "node:test";

import {
  browserCommand,
  isStudioHealthResponse,
  packageManagerCommand,
  shouldInstallDependencies,
  studioHealthUrl,
  studioUrl,
  waitUntilReachable,
} from "./lib.mjs";

test("Studio URL は既定ポート 5180 を使う", () => {
  assert.equal(studioUrl({}), "http://127.0.0.1:5180");
});

test("Studio URL は環境変数で変更できる", () => {
  assert.equal(
    studioUrl({ STUDIO_CLIENT_PORT: "6201" }),
    "http://127.0.0.1:6201",
  );
});

test("Studio のポートは 1〜65535 の数字だけを受け付ける", () => {
  for (const port of ["0", "65536", "abc", "5180&open"]) {
    assert.throws(
      () => studioUrl({ STUDIO_CLIENT_PORT: port }),
      /1〜65535/,
    );
  }
});

test("起動確認は Studio の health API を使う", () => {
  assert.equal(
    studioHealthUrl({ STUDIO_CLIENT_PORT: "6201" }),
    "http://127.0.0.1:6201/api/health",
  );
});

test("health API の正しい応答だけを Studio と判定する", async () => {
  assert.equal(
    await isStudioHealthResponse({
      ok: true,
      json: async () => ({ ok: true }),
    }),
    true,
  );
  assert.equal(
    await isStudioHealthResponse({
      ok: true,
      json: async () => {
        throw new Error("HTML response");
      },
    }),
    false,
  );
  assert.equal(
    await isStudioHealthResponse({ ok: false, json: async () => ({ ok: true }) }),
    false,
  );
});

test("pnpm があれば直接使う", () => {
  assert.deepEqual(
    packageManagerCommand((command) => command === "pnpm"),
    { command: "pnpm", prefixArgs: [] },
  );
});

test("pnpm がなくても corepack 経由で起動できる", () => {
  assert.deepEqual(
    packageManagerCommand((command) => command === "corepack"),
    { command: "corepack", prefixArgs: ["pnpm"] },
  );
});

test("pnpm と corepack がなくても npm 経由で初回起動できる", () => {
  assert.deepEqual(
    packageManagerCommand((command) => command === "npm"),
    {
      command: "npm",
      prefixArgs: ["exec", "--yes", "pnpm@10.32.1", "--"],
    },
  );
});

test("パッケージ管理ツールがなければ分かりやすく停止する", () => {
  assert.throws(
    () => packageManagerCommand(() => false),
    /pnpm.*Corepack.*npm.*見つかりません/s,
  );
});

test("必要な実行ファイルが揃っていると再インストールしない", () => {
  const existing = new Set([
    "/repo/node_modules/.bin/concurrently",
    "/repo/node_modules/.bin/vite",
    "/repo/node_modules/.bin/tsx",
  ]);

  assert.equal(
    shouldInstallDependencies("/repo", (path) => existing.has(path)),
    false,
  );
});

test("依存関係が欠けていると初回セットアップを行う", () => {
  assert.equal(shouldInstallDependencies("/repo", () => false), true);
});

test("OS ごとのブラウザ起動コマンドを返す", () => {
  const url = "http://127.0.0.1:5180";

  assert.deepEqual(browserCommand("darwin", url), {
    command: "open",
    args: [url],
  });
  assert.deepEqual(browserCommand("linux", url), {
    command: "xdg-open",
    args: [url],
  });
  assert.deepEqual(browserCommand("win32", url), {
    command: "cmd",
    args: ["/c", "start", "", url],
  });
});

test("Studio が応答するまで再試行する", async () => {
  let attempts = 0;
  const result = await waitUntilReachable("http://example.test", {
    attempts: 3,
    delayMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("not ready");
      return { ok: true };
    },
    sleepImpl: async () => {},
  });

  assert.equal(result, true);
  assert.equal(attempts, 3);
});

test("Studio が応答しなければタイムアウトする", async () => {
  const result = await waitUntilReachable("http://example.test", {
    attempts: 2,
    delayMs: 0,
    fetchImpl: async () => {
      throw new Error("not ready");
    },
    sleepImpl: async () => {},
  });

  assert.equal(result, false);
});
