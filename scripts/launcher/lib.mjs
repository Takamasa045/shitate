import path from "node:path";

export const REQUIRED_NODE_MAJOR = 22;
export const PNPM_VERSION = "10.32.1";

export function studioUrl(environment = process.env) {
  const portText = environment.STUDIO_CLIENT_PORT?.trim() || "5180";
  if (!/^\d+$/.test(portText)) {
    throw new Error("STUDIO_CLIENT_PORT は 1〜65535 の数字で指定してください。");
  }

  const port = Number(portText);
  if (port < 1 || port > 65535) {
    throw new Error("STUDIO_CLIENT_PORT は 1〜65535 の数字で指定してください。");
  }

  return `http://127.0.0.1:${port}`;
}

export function studioHealthUrl(environment = process.env) {
  return `${studioUrl(environment)}/api/health`;
}

export async function isStudioHealthResponse(response) {
  if (!response.ok) return false;

  try {
    const payload = await response.json();
    return payload?.ok === true;
  } catch {
    return false;
  }
}

export function packageManagerCommand(hasCommand) {
  if (hasCommand("pnpm")) {
    return { command: "pnpm", prefixArgs: [] };
  }

  if (hasCommand("corepack")) {
    return { command: "corepack", prefixArgs: ["pnpm"] };
  }

  if (hasCommand("npm")) {
    return {
      command: "npm",
      prefixArgs: ["exec", "--yes", `pnpm@${PNPM_VERSION}`, "--"],
    };
  }

  throw new Error(
    "pnpm、Corepack、npm のいずれも見つかりません。Node.js 22 以上をインストールしてから、もう一度ランチャーを開いてください。",
  );
}

export function shouldInstallDependencies(repoRoot, exists) {
  const requiredBins = ["concurrently", "vite", "tsx"];
  return requiredBins.some(
    (name) => !exists(path.join(repoRoot, "node_modules", ".bin", name)),
  );
}

export function browserCommand(platform, url) {
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}

export async function waitUntilReachable(
  url,
  {
    attempts = 120,
    delayMs = 500,
    fetchImpl = fetch,
    validateResponse = (response) => response.ok,
    sleepImpl = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url);
      if (await validateResponse(response)) return true;
    } catch {
      // 起動直後の接続失敗は正常。次の試行まで待つ。
    }

    if (attempt < attempts - 1) await sleepImpl(delayMs);
  }

  return false;
}
