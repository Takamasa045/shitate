import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureRoot = await mkdtemp(join(tmpdir(), "shitate-e2e-"));
const reservations = await Promise.all([reservePort(), reservePort()]);
const [apiPort, clientPort] = reservations.map(({ port }) => port);
await Promise.all(reservations.map(({ release }) => release()));

await Promise.all([
  mkdir(join(fixtureRoot, "characters"), { recursive: true }),
  mkdir(join(fixtureRoot, "lexicon"), { recursive: true }),
]);
await writeFile(
  join(fixtureRoot, "INDEX.md"),
  [
    "# E2E fixture",
    "",
    "## Characters",
    "",
    "<!-- forge:generated:characters:start -->",
    "",
    "<!-- forge:generated:characters:end -->",
    "",
  ].join("\n"),
  "utf8",
);

const inheritedEnv = { ...process.env };
// Playwright sets FORCE_COLOR for its web servers; carrying NO_COLOR too emits noise.
delete inheritedEnv.NO_COLOR;

const env = {
  ...inheritedEnv,
  SHITATE_ROOT: fixtureRoot,
  E2E_FIXTURE_ROOT: fixtureRoot,
  STUDIO_HOST: "127.0.0.1",
  STUDIO_PORT: String(apiPort),
  STUDIO_CLIENT_PORT: String(clientPort),
  STUDIO_API_ORIGIN: `http://127.0.0.1:${apiPort}`,
};

const args = ["exec", "playwright", "test", ...process.argv.slice(2)];
const child = spawn("pnpm", args, { cwd: process.cwd(), env, stdio: "inherit" });

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal) {
      reject(new Error(`Playwright terminated by ${signal}`));
      return;
    }
    resolve(code ?? 1);
  });
}).catch((error) => {
  console.error(error);
  return 1;
});

await rm(fixtureRoot, { recursive: true, force: true });
process.exitCode = exitCode;

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to reserve an E2E port"));
        return;
      }
      resolve({
        port: address.port,
        release: () =>
          new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}
