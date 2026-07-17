# Integration: chatgpt-image

**ランタイム: Codex / ChatGPT**

Codex / ChatGPT のチャット内 built-in image generation (`image_gen`) を使った
画像生成・編集の手順。

静止画ルートは **ランタイム別** であり、グローバルな「唯一の標準」はない
（[AGENTS.md](../AGENTS.md) §8.1）:

| ランタイム | 手順書 |
|---|---|
| **Codex / ChatGPT（このファイル）** | `integrations/chatgpt-image.md` |
| Claude Code | `integrations/nano-banana.md` |

OpenAI API や `OPENAI_API_KEY` は不要。ローカル CLI から自動実行する仕組みではなく、
Codex が会話内の画像生成ツールを呼ぶ運用である。

> **重要**: この手順は **ユーザーが明示的に画像生成を指示したときのみ** 実行する。
> 通常の新規キャラ作成・改善作業では `pnpm forge compile` までで止める。
> 曖昧な「進めて」「続けて」ではこの手順に入らない。

主な用途:
- 候補画像を複数生成し、ユーザーが選んだものだけをキャラ登録する
- アンカー画像の生成（顔・衣装・ポーズの同一性固定用）
- バリアントの単発静止画生成
- 既存画像のチャット内編集（ユーザーが画像を添付、または直前に生成済みの場合）

---

## 前提条件

- ランタイムが Codex / ChatGPT であること
- Codex / ChatGPT の built-in image generation が利用できること
- 対象キャラの `characters/<id>/prompts/base.md` または参考プロンプトが存在
- 生成後に保存する場合は、保存先（`references/images/` または `outputs/<run-id>/`）を決める
- バリアント生成では、先に `pnpm forge compile` で `prompt.txt` / `negative.txt` を作る

---

## 入力仕様

- `outputs/<run-id>/prompt.txt` — compile 済みポジティブプロンプト（正本）
- `outputs/<run-id>/negative.txt` — compile 済みネガティブプロンプト（正本）
- 任意の参照画像（ユーザー添付画像、または `references/images/*anchor*`）

`prompt.txt` を正本として使う。会話内で再結合し直さない。
必要なら `negative.txt` の内容を `Avoid:` / `Constraints:` として画像生成プロンプトへ併記する。

---

## 出力仕様

- **プレビューのみ**: チャットに表示された画像をそのままユーザーに提示する
- **ピックアップ登録**: ユーザーが選んだ画像だけを `references/images/` または `outputs/<run-id>/` にコピーする
  - 未採用画像はリポに登録しない
  - 新規キャラの起点にする場合は `references/images/<name>-anchor.png` として保存する
  - 既存キャラの改善素材なら `references/images/<role>-anchor.v<N>.png` または `outputs/<run-id>/<n>.png` に保存する
- **アンカー生成**: `characters/<id>/references/images/<role>-anchor.png`
  - ファイル名に `anchor` を含める
  - `references/sources.yaml` に `role: anchor` で登録
- **バリアント生成**: `characters/<id>/outputs/<run-id>/`
  - 生成画像を `1.png`, `2.png` などで保存
  - `manifest.json` に `tool: "chatgpt-image"` を記録
  - `tool_version` は判明している場合はモデル名、不明なら `"built-in-image-generation"`

チャット内の生成画像は既定では Codex の生成画像保存領域に置かれる。
プロジェクト成果物として残す場合だけ、選んだ画像を workspace 配下へコピーする。
元の生成画像は削除しない。

---

## 実行手順

### A. 候補画像を生成し、ユーザーに選んでもらうとき

1. ユーザーの依頼を元に、3案程度の候補画像を `image_gen` で生成する
2. 生成結果をチャット上で提示し、採用する画像をユーザーに選んでもらう
3. この時点では Shitate 配下へコピーしない
4. ユーザーが「これ」「1枚目」「全部」など採用対象を明示したら、次のどちらかに進む:
   - 新規キャラとして育てる → B
   - 既存キャラの anchor / run として残す → C または D
5. 未採用画像は `$CODEX_HOME/generated_images/...` に残っていても、リポの正本とはみなさない

### B. ピックアップ画像から新規キャラを登録するとき

1. キャラ ID を決める（ASCII kebab-case）
2. `pnpm forge new <id>` または手動で `characters/<id>/` の骨組みを作る
3. 採用画像だけを `references/images/<name>-anchor.png` にコピーする
4. `references/sources.yaml` に `role: anchor` で登録する
5. 画像を観察して `prompts/base.md` を書き起こす（[image-to-character.md](./image-to-character.md) も可）
6. `log.md` に作成エントリを書く

### C. 既存キャラの anchor を作る / 差し替えるとき

1. compile 済み prompt または base の視覚コアを確認する
2. `image_gen` で生成（またはユーザー採用画像を使う）
3. 採用画像だけを `references/images/<role>-anchor.png`（差し替えなら `.v<N>`）に保存
4. `sources.yaml` を更新し、旧 anchor は archive 方針に従う（[anchor-lifecycle.md](../docs/workflows/anchor-lifecycle.md)）
5. `log.md` に記録

### D. バリアント静止画を run として残すとき

1. `pnpm forge compile <char> <variant> --with-image`（または既存 compile run を利用）
2. `prompt.txt` / `negative.txt` を正本として `image_gen` に渡す
3. 採用画像だけを `outputs/<run-id>/` に保存
4. `manifest.json` の `tool` / `outputs` を更新
5. `log.md` に評価を追記

---

## 失敗時

| 症状 | 原因の目安 | 対処 |
|---|---|---|
| 生成ツールが呼べない | ランタイムが Claude Code | `integrations/nano-banana.md` に切り替える |
| 顔がブレる | anchor 未使用 / プロンプト不一致 | anchor を添付し、compile 済み prompt を正本にする |
| 未採用画像がコミットされた | pick 運用漏れ | リポから外し、採用分だけ残す |
