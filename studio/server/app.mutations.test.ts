import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { after, before, describe, test } from "node:test";

type StudioApp = {
  request: (
    input: string | Request,
    init?: RequestInit,
  ) => Response | Promise<Response>;
};

let root = "";
let app: StudioApp;

const mutationHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Shitate-Studio": "1",
};

before(async () => {
  root = await mkdtemp(resolve(tmpdir(), "shitate-studio-"));
  await mkdir(resolve(root, "characters"), { recursive: true });
  await mkdir(resolve(root, "lexicon"), { recursive: true });
  await writeFile(
    resolve(root, "INDEX.md"),
    [
      "# Shitate Index",
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
  process.env.SHITATE_ROOT = root;
  ({ app } = await import("./app.ts"));
});

after(async () => {
  delete process.env.SHITATE_ROOT;
  if (root) await rm(root, { recursive: true, force: true });
});

describe("Studio v0.3 mutation API", { concurrency: false }, () => {
  test("mutations require the Studio header and JSON content type, and CORS is not wildcard", async () => {
    const missingStudioHeader = await app.request("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "guard-probe", name: "Guard Probe" }),
    });
    assert.equal(missingStudioHeader.status, 403);

    const wrongContentType = await app.request("/api/characters", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-Shitate-Studio": "1",
      },
      body: JSON.stringify({ id: "guard-probe", name: "Guard Probe" }),
    });
    assert.equal(wrongContentType.status, 415);
    assert.equal(
      await fileExists(resolve(root, "characters", "guard-probe")),
      false,
    );

    const legacyHeader = await app.request("/api/characters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Character-Forge-Studio": "1",
      },
      body: JSON.stringify({ id: "../legacy-probe", name: "Legacy Probe" }),
    });
    assert.equal(legacyHeader.status, 400);

    const health = await app.request("/api/health", {
      headers: { Origin: "https://attacker.invalid" },
    });
    assert.equal(health.headers.get("access-control-allow-origin"), null);
  });

  test("POST /api/characters scaffolds safely, syncs INDEX, and rejects duplicates/traversal", async () => {
    const traversal = await mutate("/api/characters", {
      id: "../outside",
      name: "Outside",
    });
    assert.equal(traversal.status, 400);

    const oversized = await mutate("/api/characters", {
      id: "too-large",
      name: "x".repeat(121),
    });
    assert.equal(oversized.status, 400);

    const created = await mutate("/api/characters", {
      id: "api-hero",
      name: "API ヒーロー",
      role: "Studio 編集の検証役",
    });
    assert.equal(created.status, 201);
    const createdJson = (await created.json()) as {
      ok: boolean;
      character: { id: string; name: string };
    };
    assert.equal(createdJson.ok, true);
    assert.equal(createdJson.character.id, "api-hero");
    assert.equal(createdJson.character.name, "API ヒーロー");

    const expectedFiles = [
      "index.md",
      "log.md",
      "prompts/base.md",
      "prompts/history/base.v1.md",
      "references/sources.yaml",
    ];
    for (const path of expectedFiles) {
      assert.equal(
        await fileExists(resolve(root, "characters", "api-hero", path)),
        true,
        path,
      );
    }
    const newSources = await readFile(
      resolve(root, "characters/api-hero/references/sources.yaml"),
      "utf8",
    );
    assert.match(newSources, /^references: \[\]$/m);
    assert.doesNotMatch(newSources, /^sources:/m);
    const index = await readFile(resolve(root, "INDEX.md"), "utf8");
    assert.match(index, /characters\/api-hero\/index\.md/);

    const duplicate = await mutate("/api/characters", {
      id: "api-hero",
      name: "Duplicate",
    });
    assert.equal(duplicate.status, 409);
  });

  test("concurrent character creation keeps every entry in INDEX", async () => {
    const [first, second] = await Promise.all([
      mutate("/api/characters", { id: "parallel-aka", name: "並行・赤" }),
      mutate("/api/characters", { id: "parallel-ao", name: "並行・青" }),
    ]);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const index = await readFile(resolve(root, "INDEX.md"), "utf8");
    assert.match(index, /characters\/parallel-aka\/index\.md/);
    assert.match(index, /characters\/parallel-ao\/index\.md/);
  });

  test("mutation body validation rejects malformed, non-object, oversized, and unsafe scalar input", async () => {
    const malformed = await rawMutation("/api/characters", "{");
    assert.equal(malformed.status, 400);

    const arrayBody = await rawMutation("/api/characters", "[]");
    assert.equal(arrayBody.status, 400);

    const declaredTooLarge = await rawMutation(
      "/api/characters",
      "{}",
      { "Content-Length": String(17 * 1024) },
    );
    assert.equal(declaredTooLarge.status, 413);

    const actualTooLarge = await rawMutation(
      "/api/characters",
      JSON.stringify({ id: "large-body", name: "x".repeat(17 * 1024) }),
    );
    assert.equal(actualTooLarge.status, 413);

    const nonString = await mutate("/api/characters", { id: 42, name: "number id" });
    assert.equal(nonString.status, 400);
    const empty = await mutate("/api/characters", { id: "", name: "empty id" });
    assert.equal(empty.status, 400);
    const multiline = await mutate("/api/characters", {
      id: "multi-line",
      name: "line one\nline two",
    });
    assert.equal(multiline.status, 400);
    const nulRole = await mutate("/api/characters", {
      id: "nul-role",
      name: "Nul Role",
      role: "bad\0role",
    });
    assert.equal(nulRole.status, 400);
  });

  test("character creation rolls the scaffold back when INDEX sync throws", async () => {
    const indexPath = resolve(root, "INDEX.md");
    const indexRaw = await readFile(indexPath, "utf8");
    await rm(indexPath, { force: true });
    await mkdir(indexPath);
    let response: Response;
    try {
      response = await mutate("/api/characters", {
        id: "index-failure",
        name: "Index Failure",
      });
    } finally {
      await rm(indexPath, { recursive: true, force: true });
      await writeFile(indexPath, indexRaw, "utf8");
    }
    assert.equal(response!.status, 500);
    assert.equal(
      await fileExists(resolve(root, "characters/index-failure")),
      false,
    );
  });

  test("PUT base uses optimistic locking and rejects an invalid prompt without changing the file", async () => {
    const before = await app.request("/api/characters/api-hero/prompts/base");
    assert.equal(before.status, 200);
    const beforeJson = (await before.json()) as { raw: string; revision: string };
    assert.match(beforeJson.revision, /^[a-f0-9]{64}$/);

    const stale = await mutate(
      "/api/characters/api-hero/prompts/base",
      {
        raw: validPrompt("API ヒーロー", "v1", "same version edit"),
        expectedRevision: "0".repeat(64),
        revisionMode: "same-version",
      },
      "PUT",
    );
    assert.equal(stale.status, 409);
    const staleJson = (await stale.json()) as { currentRevision: string };
    assert.equal(staleJson.currentRevision, beforeJson.revision);

    const invalid = await mutate(
      "/api/characters/api-hero/prompts/base",
      {
        raw: "# broken\n\n## 用途\nmissing required sections\n",
        expectedRevision: beforeJson.revision,
        revisionMode: "same-version",
      },
      "PUT",
    );
    assert.equal(invalid.status, 422);
    assert.equal(
      await readFile(resolve(root, "characters/api-hero/prompts/base.md"), "utf8"),
      beforeJson.raw,
    );

    const updated = await mutate(
      "/api/characters/api-hero/prompts/base",
      {
        raw: validPrompt("API ヒーロー", "v1", "same version edit"),
        expectedRevision: beforeJson.revision,
        revisionMode: "same-version",
      },
      "PUT",
    );
    assert.equal(updated.status, 200);
    const updatedJson = (await updated.json()) as {
      ok: boolean;
      prompt: { raw: string; revision: string; baseVersionDep: string };
    };
    assert.equal(updatedJson.ok, true);
    assert.equal(updatedJson.prompt.baseVersionDep, "v1");
    assert.notEqual(updatedJson.prompt.revision, beforeJson.revision);
  });

  test("prompt writes reject unsafe raw values, invalid revisions/modes, and dependency drift", async () => {
    const currentResponse = await app.request("/api/characters/api-hero/prompts/base");
    const current = (await currentResponse.json()) as { raw: string; revision: string };
    const cases: Array<[unknown, number]> = [
      [
        {
          raw: 42,
          expectedRevision: current.revision,
          revisionMode: "same-version",
        },
        400,
      ],
      [
        {
          raw: "bad\0prompt",
          expectedRevision: current.revision,
          revisionMode: "same-version",
        },
        400,
      ],
      [
        {
          raw: "x".repeat(200_001),
          expectedRevision: current.revision,
          revisionMode: "same-version",
        },
        413,
      ],
      [
        {
          raw: current.raw,
          expectedRevision: "not-a-revision",
          revisionMode: "same-version",
        },
        400,
      ],
      [
        {
          raw: current.raw,
          expectedRevision: current.revision,
          revisionMode: "unknown",
        },
        400,
      ],
      [
        {
          raw: validPrompt("wrong dependency", "v2", "drift"),
          expectedRevision: current.revision,
          revisionMode: "same-version",
        },
        422,
      ],
      [
        {
          raw: "# missing dependency\n\n## 用途\ntest\n",
          expectedRevision: current.revision,
          revisionMode: "new-version",
        },
        422,
      ],
    ];
    for (const [body, status] of cases) {
      const response = await mutate(
        "/api/characters/api-hero/prompts/base",
        body,
        "PUT",
      );
      assert.equal(response.status, status);
    }
    const missingCharacter = await mutate(
      "/api/characters/missing-character/prompts/base",
      {
        raw: validPrompt("missing", "v1", "missing"),
        expectedRevision: "0".repeat(64),
        revisionMode: "same-version",
      },
      "PUT",
    );
    assert.equal(missingCharacter.status, 404);
  });

  test("PUT base new-version normalizes vNext and updates base/history/index together", async () => {
    const currentResponse = await app.request("/api/characters/api-hero/prompts/base");
    const current = (await currentResponse.json()) as { revision: string };
    const nextRawStillDeclaresV1 = validPrompt(
      "API ヒーロー — ベース v2",
      "v1",
      "major revision",
    );

    const updated = await mutate(
      "/api/characters/api-hero/prompts/base",
      {
        raw: nextRawStillDeclaresV1,
        expectedRevision: current.revision,
        revisionMode: "new-version",
      },
      "PUT",
    );
    assert.equal(updated.status, 200);
    const json = (await updated.json()) as {
      prompt: { raw: string; baseVersionDep: string };
      baseVersion: string;
    };
    assert.equal(json.baseVersion, "v2");
    assert.equal(json.prompt.baseVersionDep, "v2");
    assert.match(json.prompt.raw, /## 依存ベースバージョン\nv2/);

    const history = await readFile(
      resolve(root, "characters/api-hero/prompts/history/base.v2.md"),
      "utf8",
    );
    assert.equal(history, json.prompt.raw);
    const characterIndex = await readFile(
      resolve(root, "characters/api-hero/index.md"),
      "utf8",
    );
    assert.match(characterIndex, /^base_version: v2$/m);
    assert.match(characterIndex, /^updated: \d{4}-\d{2}-\d{2}$/m);

    const duplicateHistory = await mutate(
      "/api/characters/api-hero/prompts/base",
      {
        raw: validPrompt("API ヒーロー — ベース v3", "v2", "must not overwrite"),
        expectedRevision: revisionOf(json.prompt.raw),
        revisionMode: "new-version",
      },
      "PUT",
    );
    // v3 は通常作れるので、予約済み history を先に作って競合を再現する。
    assert.equal(duplicateHistory.status, 200);
    await writeFile(
      resolve(root, "characters/api-hero/prompts/history/base.v4.md"),
      "reserved\n",
      "utf8",
    );
    const nowV3Response = await app.request("/api/characters/api-hero/prompts/base");
    const nowV3 = (await nowV3Response.json()) as { raw: string; revision: string };
    const conflict = await mutate(
      "/api/characters/api-hero/prompts/base",
      {
        raw: validPrompt("API ヒーロー — ベース v4", "v3", "reserved history"),
        expectedRevision: nowV3.revision,
        revisionMode: "new-version",
      },
      "PUT",
    );
    assert.equal(conflict.status, 409);
    const afterConflict = await readFile(
      resolve(root, "characters/api-hero/prompts/base.md"),
      "utf8",
    );
    assert.equal(afterConflict, nowV3.raw);
  });

  test("PUT variant creates nested variants, updates with revision, and blocks traversal/conflicts", async () => {
    const traversal = await mutate(
      "/api/characters/api-hero/prompts/variants/%2e%2e%2foutside",
      { raw: validPrompt("Outside", "v3", "outside") },
      "PUT",
    );
    assert.ok([400, 404].includes(traversal.status));
    assert.equal(
      await fileExists(resolve(root, "characters/api-hero/prompts/outside.md")),
      false,
    );

    const created = await mutate(
      "/api/characters/api-hero/prompts/variants/scenes/hero-shot",
      { raw: validPrompt("Hero shot", "v3", "wide shot") },
      "PUT",
    );
    assert.equal(created.status, 201);
    const createdJson = (await created.json()) as {
      prompt: { revision: string; id: string };
    };
    assert.equal(createdJson.prompt.id, "scenes/hero-shot");

    const conflict = await mutate(
      "/api/characters/api-hero/prompts/variants/scenes/hero-shot",
      {
        raw: validPrompt("Hero shot", "v3", "conflicting edit"),
        expectedRevision: "f".repeat(64),
      },
      "PUT",
    );
    assert.equal(conflict.status, 409);

    const updated = await mutate(
      "/api/characters/api-hero/prompts/variants/scenes/hero-shot",
      {
        raw: validPrompt("Hero shot", "v3", "updated wide shot"),
        expectedRevision: createdJson.prompt.revision,
      },
      "PUT",
    );
    assert.equal(updated.status, 200);
  });

  test("variant writes require revisions for updates and reject unsafe create conflicts", async () => {
    const missingCharacter = await mutate(
      "/api/characters/missing-character/prompts/variants/shot",
      { raw: validPrompt("missing", "v1", "missing") },
      "PUT",
    );
    assert.equal(missingCharacter.status, 404);

    const createWithRevision = await mutate(
      "/api/characters/api-hero/prompts/variants/new-with-revision",
      {
        raw: validPrompt("new", "v3", "new"),
        expectedRevision: "0".repeat(64),
      },
      "PUT",
    );
    assert.equal(createWithRevision.status, 409);
    const conflictJson = (await createWithRevision.json()) as {
      currentRevision: string | null;
    };
    assert.equal(conflictJson.currentRevision, null);

    const dependencyDrift = await mutate(
      "/api/characters/api-hero/prompts/variants/wrong-version",
      { raw: validPrompt("wrong", "v2", "wrong") },
      "PUT",
    );
    assert.equal(dependencyDrift.status, 422);

    const updateWithoutRevision = await mutate(
      "/api/characters/api-hero/prompts/variants/scenes/hero-shot",
      { raw: validPrompt("Hero shot", "v3", "last write without revision") },
      "PUT",
    );
    assert.equal(updateWithoutRevision.status, 409);
    const updateConflict = (await updateWithoutRevision.json()) as {
      currentRevision: string | null;
    };
    assert.match(updateConflict.currentRevision ?? "", /^[a-f0-9]{64}$/);
  });

  test("POST logs uses server JST/base version, inserts DESCENDING, and normalizes structural newlines", async () => {
    const before = await readFile(resolve(root, "characters/api-hero/log.md"), "utf8");
    const missingNext = await mutate("/api/characters/api-hero/logs", {
      variant: "scenes/hero-shot",
      tried: "test",
      promptDiff: "variant edit",
      artifact: "none",
      evaluation: "○",
      nextAction: "  ",
    });
    assert.equal(missingNext.status, 400);
    assert.equal(
      await readFile(resolve(root, "characters/api-hero/log.md"), "utf8"),
      before,
    );

    const added = await mutate("/api/characters/api-hero/logs", {
      variant: "scenes/hero-shot",
      tried: "構図を調整\n## injected heading",
      promptDiff: "[variant](prompts/variants/scenes/hero-shot.md)",
      artifact: "（compile 前）",
      evaluation: "○",
      nextAction: "顔の一貫性を確認\n次の行",
    });
    assert.equal(added.status, 201);
    const addedJson = (await added.json()) as {
      entry: { heading: string; tried: string; nextAction: string };
    };
    assert.match(
      addedJson.entry.heading,
      /^\d{4}-\d{2}-\d{2} \/ base v3 \/ scenes\/hero-shot$/,
    );
    assert.equal(addedJson.entry.tried.includes("\n"), false);
    assert.equal(addedJson.entry.nextAction.includes("\n"), false);

    const log = await readFile(resolve(root, "characters/api-hero/log.md"), "utf8");
    const firstEntry = log.indexOf(`## ${addedJson.entry.heading}`);
    const scaffoldEntry = log.indexOf("/ base v1 / scaffold");
    assert.ok(firstEntry > 0 && firstEntry < scaffoldEntry);
    assert.equal((log.match(/^## injected heading$/gm) ?? []).length, 0);

    const tooLong = await mutate("/api/characters/api-hero/logs", {
      variant: "scenes/hero-shot",
      tried: "x".repeat(4001),
      promptDiff: "variant edit",
      artifact: "none",
      evaluation: "○",
      nextAction: "next",
    });
    assert.equal(tooLong.status, 400);
  });

  test("log writes reject invalid fields and handle empty logs/missing or invalid characters", async () => {
    const validBody = {
      variant: "scenes/hero-shot",
      tried: "test",
      promptDiff: "variant edit",
      artifact: "none",
      evaluation: "◯",
      nextAction: "next",
    };
    const invalidVariant = await mutate("/api/characters/api-hero/logs", {
      ...validBody,
      variant: "../outside",
    });
    assert.equal(invalidVariant.status, 400);
    const nonString = await mutate("/api/characters/api-hero/logs", {
      ...validBody,
      tried: null,
    });
    assert.equal(nonString.status, 400);
    const invalidEvaluation = await mutate("/api/characters/api-hero/logs", {
      ...validBody,
      evaluation: "great",
    });
    assert.equal(invalidEvaluation.status, 400);
    const nul = await mutate("/api/characters/api-hero/logs", {
      ...validBody,
      tried: "bad\0value",
    });
    assert.equal(nul.status, 400);
    const missing = await mutate("/api/characters/missing-character/logs", validBody);
    assert.equal(missing.status, 404);

    const created = await mutate("/api/characters", {
      id: "empty-log",
      name: "Empty Log",
    });
    assert.equal(created.status, 201);
    await writeFile(
      resolve(root, "characters/empty-log/log.md"),
      "# 育成ログ\n\n新しい順で追記。\n",
      "utf8",
    );
    const firstEntry = await mutate("/api/characters/empty-log/logs", {
      ...validBody,
      variant: "base",
    });
    assert.equal(firstEntry.status, 201);
    const emptyLogRaw = await readFile(
      resolve(root, "characters/empty-log/log.md"),
      "utf8",
    );
    assert.match(emptyLogRaw, /^## \d{4}-\d{2}-\d{2} \/ base v1 \/ base$/m);

    const emptyIndexPath = resolve(root, "characters/empty-log/index.md");
    const emptyIndex = await readFile(emptyIndexPath, "utf8");
    await writeFile(
      emptyIndexPath,
      emptyIndex.replace("base_version: v1", "base_version: invalid"),
      "utf8",
    );
    const invalidBase = await mutate("/api/characters/empty-log/logs", {
      ...validBody,
      variant: "base",
    });
    assert.equal(invalidBase.status, 422);
  });

  test("new-version rolls base/history back when the index write fails", async () => {
    const created = await mutate("/api/characters", {
      id: "rollback-hero",
      name: "Rollback Hero",
    });
    assert.equal(created.status, 201);
    const baseResponse = await app.request(
      "/api/characters/rollback-hero/prompts/base",
    );
    const base = (await baseResponse.json()) as { raw: string; revision: string };
    const characterPath = resolve(root, "characters/rollback-hero");
    let response: Response;
    await chmod(characterPath, 0o500);
    try {
      response = await mutate(
        "/api/characters/rollback-hero/prompts/base",
        {
          raw: validPrompt("Rollback Hero v2", "v1", "major revision"),
          expectedRevision: base.revision,
          revisionMode: "new-version",
        },
        "PUT",
      );
    } finally {
      await chmod(characterPath, 0o700);
    }
    assert.equal(response!.status, 500);
    assert.equal(
      await readFile(resolve(characterPath, "prompts/base.md"), "utf8"),
      base.raw,
    );
    assert.equal(
      await fileExists(resolve(characterPath, "prompts/history/base.v2.md")),
      false,
    );
  });

  test("POST compile/write writes three immutable artifacts and preserves dry-run without absolute paths", async () => {
    const dryRun = await app.request(
      "/api/compile/api-hero/dry-run?variant=scenes%2Fhero-shot",
    );
    assert.equal(dryRun.status, 200);
    const dryJson = (await dryRun.json()) as { ok: boolean; runDir: string };
    assert.equal(dryJson.ok, true);
    assert.equal(dryJson.runDir.startsWith("/"), false);
    assert.equal(dryJson.runDir.includes(root), false);

    const first = await mutate("/api/compile/api-hero/write", {
      variant: "scenes/hero-shot",
    });
    assert.equal(first.status, 201);
    const firstJson = (await first.json()) as {
      run: { runId: string; manifest: { run_id: string } };
    };
    assert.equal(firstJson.run.runId, firstJson.run.manifest.run_id);
    const firstDir = resolve(
      root,
      "characters/api-hero/outputs",
      firstJson.run.runId,
    );
    assert.deepEqual((await readdir(firstDir)).sort(), [
      "manifest.json",
      "negative.txt",
      "prompt.txt",
    ]);
    const firstPrompt = await readFile(resolve(firstDir, "prompt.txt"), "utf8");

    const second = await mutate("/api/compile/api-hero/write", {
      variant: "scenes/hero-shot",
    });
    assert.equal(second.status, 201);
    const secondJson = (await second.json()) as { run: { runId: string } };
    assert.notEqual(secondJson.run.runId, firstJson.run.runId);
    assert.match(secondJson.run.runId, /_r2$/);
    assert.equal(await readFile(resolve(firstDir, "prompt.txt"), "utf8"), firstPrompt);
  });

  test("unexpected errors return a generic response without stack or filesystem paths", async () => {
    const missing = await mutate("/api/compile/api-hero/write", {
      variant: "missing-variant",
    });
    assert.ok([404, 422].includes(missing.status));
    const raw = await missing.text();
    assert.equal(raw.includes(root), false);
    assert.equal(raw.includes("/Users/"), false);
    assert.equal(raw.toLowerCase().includes("stack"), false);
  });

  test("POST references/anchors registers a selected image and synchronizes sources, log, and INDEX", async () => {
    const response = await uploadAnchor("api-hero", {
      anchorId: "face",
      notes: "正面の顔と耳の形を固定する選定済み画像",
      nextAction: "three-view で顔と耳の再現性を確認する",
      file: new File([tinyPng()], "../../untrusted-original-name.png", {
        type: "image/png",
      }),
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as {
      ok: boolean;
      anchor: { name: string; path: string; sizeBytes: number };
    };
    assert.equal(body.ok, true);
    assert.equal(body.anchor.name, "face-anchor.png");
    assert.equal(body.anchor.path, "references/images/face-anchor.png");
    assert.equal(body.anchor.sizeBytes, tinyPng().byteLength);
    assert.equal("character" in body, false);
    const refreshed = await app.request("/api/characters/api-hero");
    assert.equal(refreshed.status, 200);
    assert.deepEqual(((await refreshed.json()) as { anchors: string[] }).anchors, ["face"]);

    const imagePath = resolve(
      root,
      "characters/api-hero/references/images/face-anchor.png",
    );
    assert.deepEqual(await readFile(imagePath), tinyPng());
    assert.equal(
      await fileExists(
        resolve(root, "characters/api-hero/references/images/untrusted-original-name.png"),
      ),
      false,
    );

    const sources = await readFile(
      resolve(root, "characters/api-hero/references/sources.yaml"),
      "utf8",
    );
    assert.match(sources, /references:/);
    assert.match(sources, /path: images\/face-anchor\.png/);
    assert.match(sources, /role: anchor/);
    assert.match(sources, /url: null/);
    assert.match(sources, /notes: 正面の顔と耳の形を固定する選定済み画像/);
    assert.match(sources, /added: \d{4}-\d{2}-\d{2}/);

    const log = await readFile(resolve(root, "characters/api-hero/log.md"), "utf8");
    assert.match(log, /^## \d{4}-\d{2}-\d{2} \/ base v\d+ \/ anchor$/m);
    assert.match(log, /face-anchor\.png を anchor として登録/);
    assert.match(log, /three-view で顔と耳の再現性を確認する/);
    const index = await readFile(resolve(root, "INDEX.md"), "utf8");
    assert.match(index, /\| face \|/);
  });

  test("anchor upload requires its mutation boundary and rejects traversal, spoofing, oversize, and duplicates", async () => {
    const fields = {
      anchorId: "outfit",
      notes: "衣装固定用",
      nextAction: "衣装の一貫性を確認する",
      file: new File([tinyPng()], "outfit.png", { type: "image/png" }),
    };
    const missingHeader = await uploadAnchor("api-hero", fields, false);
    assert.equal(missingHeader.status, 403);

    const wrongContentType = await app.request(
      "/api/characters/api-hero/references/anchors",
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ anchorId: "outfit" }),
      },
    );
    assert.equal(wrongContentType.status, 415);

    const traversal = await uploadAnchor("api-hero", {
      ...fields,
      anchorId: "../outside",
    });
    assert.equal(traversal.status, 400);

    const unsupported = await uploadAnchor("api-hero", {
      ...fields,
      anchorId: "vector",
      file: new File(["<svg></svg>"], "vector.svg", { type: "image/svg+xml" }),
    });
    assert.equal(unsupported.status, 415);

    const spoofed = await uploadAnchor("api-hero", {
      ...fields,
      anchorId: "spoofed",
      file: new File(["not a png"], "spoofed.png", { type: "image/png" }),
    });
    assert.equal(spoofed.status, 422);

    const empty = await uploadAnchor("api-hero", {
      ...fields,
      anchorId: "empty",
      file: new File([], "empty.png", { type: "image/png" }),
    });
    assert.equal(empty.status, 400);

    const oversized = await uploadAnchor("api-hero", {
      ...fields,
      anchorId: "oversized",
      file: new File([Buffer.alloc(5 * 1024 * 1024 + 1)], "oversized.png", {
        type: "image/png",
      }),
    });
    assert.equal(oversized.status, 413);

    const before = await readFile(
      resolve(root, "characters/api-hero/references/images/face-anchor.png"),
    );
    const duplicate = await uploadAnchor("api-hero", {
      ...fields,
      anchorId: "face",
    });
    assert.equal(duplicate.status, 409);
    const duplicateOtherFormat = await uploadAnchor("api-hero", {
      ...fields,
      anchorId: "face",
      file: new File([tinyJpeg()], "face.jpg", { type: "image/jpeg" }),
    });
    assert.equal(duplicateOtherFormat.status, 409);
    assert.deepEqual(
      await readFile(
        resolve(root, "characters/api-hero/references/images/face-anchor.png"),
      ),
      before,
    );
    assert.equal(
      await fileExists(resolve(root, "characters/api-hero/references/images/outside-anchor.png")),
      false,
    );
  });

  test("anchor upload protects malformed catalogs and can create a missing sources.yaml", async () => {
    const missingCharacter = await uploadAnchor("missing-anchor-character", {
      anchorId: "face",
      notes: "存在しないキャラ",
      nextAction: "作成後に再試行する",
      file: new File([tinyPng()], "face.png", { type: "image/png" }),
    });
    assert.equal(missingCharacter.status, 404);

    const created = await mutate("/api/characters", {
      id: "anchor-catalog-guard",
      name: "Anchor Catalog Guard",
    });
    assert.equal(created.status, 201);
    const characterRoot = resolve(root, "characters/anchor-catalog-guard");
    const sourcesPath = resolve(characterRoot, "references/sources.yaml");
    const logPath = resolve(characterRoot, "log.md");
    const logBefore = await readFile(logPath, "utf8");

    await writeFile(sourcesPath, "references: [\n", "utf8");
    const malformed = await uploadAnchor("anchor-catalog-guard", {
      anchorId: "face",
      notes: "不正 YAML を拒否",
      nextAction: "YAML を修正する",
      file: new File([tinyPng()], "face.png", { type: "image/png" }),
    });
    assert.equal(malformed.status, 422);
    assert.equal(await readFile(logPath, "utf8"), logBefore);
    assert.equal(
      await fileExists(resolve(characterRoot, "references/images/face-anchor.png")),
      false,
    );

    await writeFile(
      sourcesPath,
      "references:\n  - path: images/face-anchor.jpg\n    role: anchor\n",
      "utf8",
    );
    const catalogDuplicate = await uploadAnchor("anchor-catalog-guard", {
      anchorId: "face",
      notes: "カタログ上の重複",
      nextAction: "既存記録を確認する",
      file: new File([tinyPng()], "face.png", { type: "image/png" }),
    });
    assert.equal(catalogDuplicate.status, 409);

    await writeFile(sourcesPath, "references: invalid\n", "utf8");
    const invalidList = await uploadAnchor("anchor-catalog-guard", {
      anchorId: "mark",
      notes: "配列でない references を拒否",
      nextAction: "YAML を修正する",
      file: new File([tinyPng()], "mark.png", { type: "image/png" }),
    });
    assert.equal(invalidList.status, 422);

    await rm(sourcesPath, { force: true });
    const recreated = await uploadAnchor("anchor-catalog-guard", {
      anchorId: "mark",
      notes: "sources.yaml の新規作成",
      nextAction: "mark の再現性を確認する",
      file: new File([tinyWebp()], "mark.webp", { type: "image/webp" }),
    });
    assert.equal(recreated.status, 201);
    assert.match(await readFile(sourcesPath, "utf8"), /images\/mark-anchor\.webp/);
  });

  test("concurrent anchor registrations serialize the shared INDEX update", async () => {
    const [firstCharacter, secondCharacter] = await Promise.all([
      mutate("/api/characters", { id: "anchor-parallel-a", name: "Anchor A" }),
      mutate("/api/characters", { id: "anchor-parallel-b", name: "Anchor B" }),
    ]);
    assert.equal(firstCharacter.status, 201);
    assert.equal(secondCharacter.status, 201);

    const [first, second] = await Promise.all([
      uploadAnchor("anchor-parallel-a", {
        anchorId: "face",
        notes: "並行登録 A",
        nextAction: "A を確認する",
        file: new File([tinyPng()], "a.png", { type: "image/png" }),
      }),
      uploadAnchor("anchor-parallel-b", {
        anchorId: "outfit",
        notes: "並行登録 B",
        nextAction: "B を確認する",
        file: new File([tinyPng()], "b.png", { type: "image/png" }),
      }),
    ]);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const index = await readFile(resolve(root, "INDEX.md"), "utf8");
    assert.match(index, /anchor-parallel-a[^\n]*\| face \|/);
    assert.match(index, /anchor-parallel-b[^\n]*\| outfit \|/);
  });

  test("anchor upload rejects a symlinked images directory without writing outside the workspace", async () => {
    const created = await mutate("/api/characters", {
      id: "anchor-symlink-guard",
      name: "Anchor Symlink Guard",
    });
    assert.equal(created.status, 201);
    const imagesDir = resolve(
      root,
      "characters/anchor-symlink-guard/references/images",
    );
    const outside = await mkdtemp(resolve(tmpdir(), "shitate-anchor-outside-"));
    try {
      await rm(imagesDir, { recursive: true, force: true });
      await symlink(outside, imagesDir, "dir");
      const response = await uploadAnchor("anchor-symlink-guard", {
        anchorId: "face",
        notes: "symlink を拒否",
        nextAction: "安全なディレクトリへ戻す",
        file: new File([tinyPng()], "face.png", { type: "image/png" }),
      });
      assert.equal(response.status, 422);
      assert.equal(await fileExists(resolve(outside, "face-anchor.png")), false);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  test("anchor upload rolls back image, sources, and log when INDEX synchronization fails", async () => {
    const created = await mutate("/api/characters", {
      id: "anchor-rollback",
      name: "Anchor Rollback",
    });
    assert.equal(created.status, 201);
    const characterRoot = resolve(root, "characters/anchor-rollback");
    const sourcesPath = resolve(characterRoot, "references/sources.yaml");
    const logPath = resolve(characterRoot, "log.md");
    const sourcesBefore = await readFile(sourcesPath, "utf8");
    const logBefore = await readFile(logPath, "utf8");

    let response: Response;
    await chmod(root, 0o500);
    try {
      response = await uploadAnchor("anchor-rollback", {
        anchorId: "face",
        notes: "ロールバック確認",
        nextAction: "登録を再試行する",
        file: new File([tinyPng()], "face.png", { type: "image/png" }),
      });
    } finally {
      await chmod(root, 0o700);
    }
    assert.equal(response!.status, 500);
    assert.equal(await readFile(sourcesPath, "utf8"), sourcesBefore);
    assert.equal(await readFile(logPath, "utf8"), logBefore);
    assert.equal(
      await fileExists(resolve(characterRoot, "references/images/face-anchor.png")),
      false,
    );
  });

  test("reference files disable MIME sniffing and do not execute SVG as a document", async () => {
    const imagesDir = resolve(root, "characters/api-hero/references/images");
    await mkdir(imagesDir, { recursive: true });
    await writeFile(
      resolve(imagesDir, "untrusted.svg"),
      "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>",
      "utf8",
    );
    const response = await app.request(
      "/api/characters/api-hero/references/images/untrusted.svg",
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/octet-stream");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy") ?? "", /sandbox/);
  });
});

async function mutate(
  path: string,
  body: unknown,
  method: "POST" | "PUT" = "POST",
): Promise<Response> {
  return app.request(path, {
    method,
    headers: mutationHeaders,
    body: JSON.stringify(body),
  });
}

async function rawMutation(
  path: string,
  body: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { ...mutationHeaders, ...extraHeaders },
    body,
  });
}

async function uploadAnchor(
  characterId: string,
  input: {
    anchorId: string;
    notes: string;
    nextAction: string;
    file: File;
  },
  includeStudioHeader: boolean = true,
): Promise<Response> {
  const body = new FormData();
  body.set("anchorId", input.anchorId);
  body.set("notes", input.notes);
  body.set("nextAction", input.nextAction);
  body.set("file", input.file);
  return app.request(
    `/api/characters/${encodeURIComponent(characterId)}/references/anchors`,
    {
      method: "POST",
      headers: includeStudioHeader
        ? { "X-Shitate-Studio": "1" }
        : undefined,
      body,
    },
  );
}

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
}

function tinyJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

function tinyWebp(): Buffer {
  return Buffer.from("RIFF0000WEBP", "ascii");
}

function validPrompt(title: string, version: string, positive: string): string {
  return `# ${title}

## 用途
テスト生成に使う。

## 依存ベースバージョン
${version}

## 本文プロンプト
\`\`\`
${positive}
\`\`\`

## ネガティブプロンプト
\`\`\`
text, watermark
\`\`\`

## Lexicon 参照

## メモ
テスト。
`;
}

function revisionOf(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    try {
      await readdir(path);
      return true;
    } catch {
      return false;
    }
  }
}
