import { expect, type Page } from "@playwright/test";

export class StudioPage {
  constructor(readonly page: Page) {}

  async openCharacters() {
    await this.page.goto("/characters");
    await expect(this.page.getByRole("heading", { name: "キャラクター" })).toBeVisible();
  }

  async createCharacter(input: { id: string; name: string; role: string }) {
    await this.page.getByRole("link", { name: "新しいキャラクター" }).click();
    await expect(this.page).toHaveURL(/\/characters\/new$/);
    await expect(
      this.page.getByRole("heading", { name: "新しいキャラクター" }),
    ).toBeVisible();
    await this.page.getByLabel("ID").fill(input.id);
    await this.page.getByLabel("表示名").fill(input.name);
    await this.page.getByLabel("役割").fill(input.role);

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/characters") &&
        response.status() === 201,
    );
    await this.page.getByRole("button", { name: "作成する" }).click();
    await responsePromise;
    await expect(this.page).toHaveURL(new RegExp(`/characters/${input.id}(?:/|$)`));
    await expect(this.page.getByRole("heading", { name: input.name })).toBeVisible();
  }

  async updateBase(raw: string) {
    await this.page.getByRole("link", { name: /詞書/ }).click();
    await this.page.getByRole("button", { name: "base を編集" }).click();
    await expect(this.page.getByRole("heading", { name: "base を編集" })).toBeVisible();
    await this.page.getByLabel("Markdown").fill(raw);
    await this.page.getByRole("radio", { name: "同じ version で保存" }).check();

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/characters\/[^/]+\/prompts\/base$/.test(response.url()) &&
        response.status() === 200,
    );
    await this.page.getByRole("button", { name: "保存する" }).click();
    await responsePromise;
    await expect(this.page.getByText("e2e-base-identity", { exact: true })).toBeVisible();
  }

  async registerAnchor(input: {
    anchorId: string;
    notes: string;
    nextAction: string;
    file: { name: string; mimeType: string; buffer: Buffer };
  }) {
    await this.page.getByRole("link", { name: /手本/ }).click();
    await this.page.getByRole("button", { name: "アンカーを登録" }).click();
    const dialog = this.page.getByRole("dialog", { name: "アンカーを登録" });
    await expect(dialog).toBeVisible();
    const anchorIdInput = dialog.getByLabel("anchor ID");
    await expect(anchorIdInput).toBeFocused();
    await anchorIdInput.fill(input.anchorId);
    await dialog.getByLabel("画像ファイル").setInputFiles(input.file);
    await dialog.getByLabel("用途メモ").fill(input.notes);
    await dialog.getByLabel("次の改善").fill(input.nextAction);

    await this.page.route(
      "**/api/characters/*/references/anchors",
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await route.continue();
      },
      { times: 1 },
    );
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/characters\/[^/]+\/references\/anchors$/.test(response.url()) &&
        response.status() === 201,
    );
    await dialog.getByRole("button", { name: "登録する" }).click();
    await expect(dialog.getByRole("button", { name: "閉じる" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    await this.page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await responsePromise;
    await expect(dialog).not.toBeVisible();
    const extension = input.mimeType === "image/jpeg"
      ? "jpg"
      : input.mimeType === "image/webp"
        ? "webp"
        : "png";
    const savedName = `${input.anchorId}-anchor.${extension}`;
    await expect(this.page.getByRole("status")).toContainText(`${savedName} を登録`);
    await expect(this.page.getByText(savedName, { exact: true })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "アンカーを登録" })).toBeFocused();
  }

  async createVariant(variantId: string, raw: string) {
    await this.page.getByRole("button", { name: "variant を追加" }).click();
    await expect(this.page.getByRole("heading", { name: "variant を追加" })).toBeVisible();
    await this.page.getByLabel("variant ID").fill(variantId);
    await this.page.getByLabel("Markdown").fill(raw);

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().includes("/prompts/variants/") &&
        response.status() === 201,
    );
    await this.page.getByRole("button", { name: "variant を保存" }).click();
    await responsePromise;
    await expect(this.page.getByRole("link", { name: new RegExp(variantId) })).toBeVisible();
  }

  async appendLog(input: {
    variant: string;
    tried: string;
    promptDiff: string;
    artifact: string;
    evaluation: string;
    nextAction: string;
  }) {
    await this.page.getByRole("link", { name: /日録/ }).click();
    await this.page.getByRole("button", { name: "記録を追加" }).click();
    await expect(this.page.getByRole("heading", { name: "日録に追記" })).toBeVisible();
    await this.page.getByLabel("variant").fill(input.variant);
    await this.page.getByLabel("試行").fill(input.tried);
    await this.page.getByLabel("プロンプト差分").fill(input.promptDiff);
    await this.page.getByLabel("生成物").fill(input.artifact);
    await this.page.getByLabel("評価").selectOption(input.evaluation);
    await this.page.getByLabel("次の改善").fill(input.nextAction);

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/characters\/[^/]+\/logs$/.test(response.url()) &&
        response.status() === 201,
    );
    await this.page.getByRole("button", { name: "日録に追記" }).click();
    await responsePromise;
    await expect(this.page.getByText(input.nextAction, { exact: true })).toBeVisible();
  }

  async dryRunAndSave(variantId: string): Promise<string> {
    await this.page.getByRole("link", { name: /調合/ }).click();
    await this.page.getByLabel("variant").selectOption(variantId);

    const dryRunResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/dry-run?") &&
        response.status() === 200,
    );
    await this.page.getByRole("button", { name: "調合する" }).click();
    const dryRun = await dryRunResponse;
    const preview = (await dryRun.json()) as { ok: boolean; runId: string };
    expect(preview.ok).toBe(true);
    await expect(this.page.getByText("e2e-variant-three-view")).toBeVisible();

    const writeResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/compile\/[^/]+\/write$/.test(response.url()) &&
        response.status() === 201,
    );
    await this.page.getByRole("button", { name: "compile を保存" }).click();
    const written = (await (await writeResponse).json()) as {
      run: { runId: string };
    };
    await this.page.getByRole("link", { name: "巻物で確認" }).click();
    await expect(this.page).toHaveURL(new RegExp(`/runs/${written.run.runId}$`));
    await expect(this.page.getByRole("heading", { name: written.run.runId })).toBeVisible();
    return written.run.runId;
  }
}
