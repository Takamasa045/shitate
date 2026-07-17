# CLAUDE.md — Claude Code 向け差分

Shitate の操作規約の **正本は [AGENTS.md](./AGENTS.md)** である。
Claude Code は **まず AGENTS.md を読むこと**。このファイルは Claude Code 固有の差分だけを書く。

> 設計思想: [REQUIREMENTS.md](./REQUIREMENTS.md) ／ 利用者向け: [README.md](./README.md)

---

## 1. 正本と読み順

1. [AGENTS.md](./AGENTS.md)（共通規約・スキーマ要約・CLI・入り口・log ルール）
2. 対象キャラの `characters/<id>/index.md` と `log.md` 直近3エントリ（AGENTS.md §1）
3. 必要になったときだけ `docs/` と `integrations/`（AGENTS.md §11）

**本文の重複メンテはしない。** 共通ルールを変えたいときは AGENTS.md を直し、ここに書かない。

---

## 2. Claude Code 固有: 静止画は Nano Banana

静止画生成がユーザー明示で必要になったとき:

| 用途 | 手順書 |
|---|---|
| 静止画生成・編集 | [integrations/nano-banana.md](./integrations/nano-banana.md) |
| 動画 | [integrations/pixverse-pipeline.md](./integrations/pixverse-pipeline.md) |

- Codex / ChatGPT 向けの [integrations/chatgpt-image.md](./integrations/chatgpt-image.md) は **このランタイムでは使わない**
- Nano Banana MCP（`nano-banana-2` 等）が有効であること
- いずれも **user-gated**（AGENTS.md §0.2 / §8.1）。曖昧な「進めて」では呼ばない
- 候補を複数出したら、ユーザーが選んだ画像だけ登録する（AGENTS.md §3）

---

## 3. Claude Code 固有: 使えるツール感度

- Nano Banana MCP で画像生成・編集ができる（上記 §2）
- このリポ内の正本操作は `pnpm forge` / `./bin/forge` を優先する
- `pnpm` が非 TTY で modules purge を聞いて止まる場合は `./bin/forge` を使うか、リポの `.npmrc`（`confirm-modules-purge=false`）を確認する

---

## 4. 更新方針

- 共通規約の変更 → **AGENTS.md のみ**
- Claude Code だけに効く差分（MCP 名、利用可能ツール、このランタイムの画像ルート）→ このファイル
- CLAUDE.md を AGENTS.md の全文コピーに戻さない（drift の原因）
