# Integration: nano-banana

**ランタイム: Claude Code**

Nano Banana（Gemini 系画像生成）MCP を使った画像生成・編集の手順。

静止画ルートは **ランタイム別** であり、グローバルな「唯一の標準」はない
（[AGENTS.md](../AGENTS.md) §8.1）:

| ランタイム | 手順書 |
|---|---|
| Codex / ChatGPT | `integrations/chatgpt-image.md` |
| **Claude Code（このファイル）** | `integrations/nano-banana.md` |

PixVerse の画像生成は Pixverse-Workflow リポでのみ例外的に使う。

> **重要**: この手順は **ユーザーが明示的に画像生成を指示したときのみ** 実行する。
> Shitate の既定モードは prompt factory（AGENTS.md §0.2）なので、
> 通常の新規キャラ作成・改善作業では `pnpm forge compile` までで止める。
> 曖昧な「進めて」「続けて」ではこの手順に入らない。

主な用途:
- アンカー画像の生成（顔・衣装・ポーズの同一性固定用）
- バリアントの単発静止画生成
- 既存画像の編集・バリエーション

---

## 前提条件

- ランタイムが Claude Code であること
- ユーザーが画像生成を明示していること
- Nano Banana MCP (`mcp__nano-banana-2__generate_image` 等) が有効
- 対象キャラの `characters/<id>/prompts/base.md` または参考プロンプトが存在
- 生成後の保存先（`characters/<id>/references/images/` または `outputs/<run-id>/`）が決まっている
- バリアント生成では、先に `pnpm forge compile` で `prompt.txt` / `negative.txt` を作る

---

## 入力仕様

- `outputs/<run-id>/prompt.txt` — compile 済みポジティブプロンプト（正本）
- `outputs/<run-id>/negative.txt` — compile 済みネガティブプロンプト（正本）
- 任意の参照画像（`references/images/*anchor*`）

`prompt.txt` を正本として使う。会話内で再結合し直さない。

---

## 出力仕様

- **アンカー生成**: `characters/<id>/references/images/<role>-anchor.png`
  - ファイル名に `anchor` を含める
  - `references/sources.yaml` に `role: anchor` で登録
- **バリアント生成**: `characters/<id>/outputs/<run-id>/`
  - 生成画像を保存
  - `manifest.json` に `tool: "nano-banana"` を記録
- 候補を複数出した場合、**ユーザーが選んだ画像だけ**を登録する（AGENTS.md §3）

---

## 実行手順

### 1. compile

```
pnpm forge compile <char> <variant> --with-image
# または既存の _compile run を使う
```

### 2. MCP 呼び出し

1. `prompt.txt` の中身をそのまま MCP に渡す
2. 必要なら `negative.txt` を constraints として併記
3. anchor が必要なら参照画像を MCP の仕様に従って添付

### 3. 保存と記録

1. 採用画像だけを保存先へコピー
2. `sources.yaml` / `manifest.json` を更新
3. `log.md` に評価を追記

---

## 失敗時

| 症状 | 原因の目安 | 対処 |
|---|---|---|
| MCP が無い / エラー | 認証・クォータ・未接続 | MCP 状態を確認。Codex ランタイムなら `chatgpt-image.md` を使う |
| リファレンスが反映されない | MCP の参照入力方式が不明 | 現行 MCP ドキュメントを確認し、プロンプト内で特徴を明示 |
| 生成物のスタイルがブレる | Lexicon 参照の優先順位が曖昧 | プロンプト冒頭にスタイルを置き、重複・矛盾する表現を削除 |
| anchor がコミットされない | ファイル名に `anchor` が含まれない | リネームして再追加。`.gitignore` ホワイトリストはファイル名依存 |
