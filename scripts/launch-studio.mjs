#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_NODE_MAJOR,
  browserCommand,
  isStudioHealthResponse,
  packageManagerCommand,
  shouldInstallDependencies,
  studioHealthUrl,
  studioUrl,
  waitUntilReachable,
} from "./launcher/lib.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function hasCommand(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
        resolve(code ?? 0);
      } else {
        reject(new Error(`${command} が終了しました (終了コード: ${code})`));
      }
    });
  });
}

function openBrowser(url) {
  const { command, args } = browserCommand(process.platform, url);
  const opener = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  opener.once("error", () => {
    console.error(`ブラウザを自動で開けませんでした。手動で ${url} を開いてください。`);
  });
  opener.unref();
}

async function main() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor < REQUIRED_NODE_MAJOR) {
    throw new Error(
      `Node.js ${REQUIRED_NODE_MAJOR} 以上が必要です（現在: ${process.versions.node}）。`,
    );
  }

  const url = studioUrl(process.env);
  const healthUrl = studioHealthUrl(process.env);
  if (
    await waitUntilReachable(healthUrl, {
      attempts: 1,
      delayMs: 0,
      validateResponse: isStudioHealthResponse,
    })
  ) {
    console.log(`Shitate Studio は起動済みです: ${url}`);
    openBrowser(url);
    return;
  }

  const manager = packageManagerCommand(hasCommand);
  if (shouldInstallDependencies(repoRoot, existsSync)) {
    console.log("\n初回セットアップを行います。数分かかることがあります…\n");
    await run(manager.command, [
      ...manager.prefixArgs,
      "install",
      "--frozen-lockfile",
    ]);
  }

  console.log("\nShitate Studio を起動しています…\n");
  const controller = new AbortController();
  const studioProcess = run(manager.command, [
    ...manager.prefixArgs,
    "studio",
  ], { signal: controller.signal });

  const startup = await Promise.race([
    waitUntilReachable(healthUrl, {
      validateResponse: isStudioHealthResponse,
    }).then((ready) => ({ kind: "ready", ready })),
    studioProcess.then(
      () => ({ kind: "exit" }),
      (error) => ({ kind: "error", error }),
    ),
  ]);

  if (startup.kind === "error") throw startup.error;
  if (startup.kind === "exit") {
    throw new Error("Studio が画面を開く前に終了しました。");
  }
  if (!startup.ready) {
    controller.abort();
    await studioProcess.catch(() => {});
    throw new Error(
      `Studio の起動を60秒待ちましたが、${url} に接続できませんでした。`,
    );
  }

  console.log(`\nブラウザで開きました: ${url}`);
  console.log("終了するには、このウインドウで Control + C を押します。\n");
  openBrowser(url);
  await studioProcess;
}

main().catch((error) => {
  console.error(`\n起動できませんでした: ${error.message}`);
  console.error("解決しない場合は QUICKSTART.md の「うまく起動しないとき」を確認してください。\n");
  process.exitCode = 1;
});
