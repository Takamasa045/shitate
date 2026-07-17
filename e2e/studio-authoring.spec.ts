import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { StudioPage } from "./pages/StudioPage.ts";

const variantId = "three-view";

test("すべてのキャラクターを同じ一覧に表示する", async ({ page }) => {
  const characters = [
    characterSummary("washi-fox", "和紙狐", ["sample"]),
    characterSummary("paper-crane", "紙鶴", ["sample"]),
  ];

  await page.route("**/api/characters", async (route) => {
    await route.fulfill({ json: { characters } });
  });
  await page.goto("/characters");

  const list = page.getByRole("region", { name: "キャラクター一覧" });
  await expect(list).toBeVisible();
  await expect(list.getByRole("link")).toHaveCount(2);
  await expect(list).toContainText("和紙狐");
  await expect(list).toContainText("紙鶴");
});

test("新規キャラから compile run の確認までブラウザで完結する", async ({ page }, testInfo) => {
  const project = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const characterId = `e2e-washi-fox-${project}-${testInfo.repeatEachIndex}-${testInfo.retry}-${testInfo.workerIndex}`;
  const studio = new StudioPage(page);
  await studio.openCharacters();
  await studio.createCharacter({
    id: characterId,
    name: "和紙狐",
    role: "E2Eで育てる案内役",
  });
  await studio.registerAnchor({
    anchorId: "face",
    notes: "E2Eで選定した顔の基準画像",
    nextAction: "三面図で顔の輪郭を確認する",
    file: {
      name: "selected-source.png",
      mimeType: "image/png",
      buffer: tinyPng(),
    },
  });
  await expect(page.locator('img[alt="和紙狐"]')).toHaveAttribute(
    "src",
    /face-anchor\.png$/,
  );
  await studio.updateBase(basePrompt());
  await studio.createVariant(variantId, variantPrompt());
  await studio.appendLog({
    variant: variantId,
    tried: "三面図の輪郭を定義",
    promptDiff: "[three-view](prompts/variants/three-view.md)",
    artifact: "（compile 前）",
    evaluation: "◯",
    nextAction: "耳と尻尾の比率を確認する",
  });

  const runId = await studio.dryRunAndSave(variantId);
  await expect(page.locator("pre").filter({ hasText: "e2e-base-identity" }).first()).toBeVisible();
  await expect(page.locator("pre").filter({ hasText: "e2e-variant-three-view" }).first()).toBeVisible();

  const fixtureRoot = process.env.E2E_FIXTURE_ROOT;
  expect(fixtureRoot).toBeTruthy();
  const runDir = resolve(
    fixtureRoot!,
    "characters",
    characterId,
    "outputs",
    runId,
  );
  expect((await readdir(runDir)).sort()).toEqual([
    "manifest.json",
    "negative.txt",
    "prompt.txt",
  ]);
  expect(await readFile(resolve(runDir, "prompt.txt"), "utf8")).toContain(
    "e2e-variant-three-view",
  );
  const characterRoot = resolve(fixtureRoot!, "characters", characterId);
  expect(
    await readFile(resolve(characterRoot, "references/images/face-anchor.png")),
  ).toEqual(tinyPng());
  expect(
    await readFile(resolve(characterRoot, "references/sources.yaml"), "utf8"),
  ).toContain("path: images/face-anchor.png");
  expect(await readFile(resolve(characterRoot, "log.md"), "utf8")).toContain(
    "face-anchor.png を anchor として登録",
  );
  expect(await readFile(resolve(fixtureRoot!, "INDEX.md"), "utf8")).toMatch(
    /\| face \|/,
  );
});

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
}

function characterSummary(id: string, name: string, tags: string[]) {
  return {
    id,
    name,
    status: "draft",
    baseVersion: "v1",
    updated: "2026-07-14",
    sourceEntities: [],
    tags,
    runCount: 0,
    anchors: [],
    primaryImageName: null,
    threeViewPreview: null,
    latestLog: null,
  };
}

function basePrompt(): string {
  return `# 和紙狐 — ベースプロンプト v1

## 用途
全生成カットの視覚的同一性を定義する。

## 依存ベースバージョン
v1

## 本文プロンプト
\`\`\`
e2e-base-identity
\`\`\`

## ネガティブプロンプト
\`\`\`
text, watermark, extra limbs
\`\`\`

## Lexicon 参照

## メモ
E2E fixture only.
`;
}

function variantPrompt(): string {
  return `# 和紙狐 — 三面図

## 用途
正面・側面・背面の三面図を作る。

## 依存ベースバージョン
v1

## 本文プロンプト
\`\`\`
e2e-variant-three-view
\`\`\`

## ネガティブプロンプト
\`\`\`
cropped, inconsistent proportions
\`\`\`

## Lexicon 参照

## メモ
E2E fixture only.
`;
}
