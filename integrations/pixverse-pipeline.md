# Integration: pixverse-character-pipeline

`~/Projects/Pixverse-Workflow/pixverse-character-pipeline/` を使ってキャラを生成する手順。
動画・アニメーション系の生成は PixVerse を使う。
静止画はランタイム別（Codex → `chatgpt-image.md`、Claude Code → `nano-banana.md`。AGENTS.md §8.1）。

> **重要**: この手順は **ユーザーが明示的に動画生成を指示したときのみ** 実行する。
> Shitate の既定モードは prompt factory（AGENTS.md §0.2）なので、
> compile 済み prompt.txt までで止めるのが原則。
> 曖昧な「進めて」「続けて」ではこの手順に入らない。

---

## 前提条件

- `pixverse-character-pipeline` リポが `~/Projects/Pixverse-Workflow/` に存在する
- PixVerse CLI がセットアップ済み（`pixverse` コマンドが通る）
- 対象キャラが以下を満たしていること:
  - `characters/<id>/prompts/base.md` が存在
  - 対象バリアント `prompts/variants/<variant>.md` が存在
  - `references/images/` に最低1枚の anchor 画像がある（またはランタイム別手順で事前生成済み）
  - `index.md` の `status` が `draft` / `experimental` / `stable` のいずれか
- 外部pipeline互換の環境変数 `CHARACTER_FORGE_ROOT` が Shitate のルートを指す（例: `~/Projects/コンテンツ/shitate`）

---

## 入力仕様

Shitate 側で準備するもの:

- `characters/<id>/prompts/base.md` — 最新ベースプロンプト（§FR-PROMPT-04 スキーマ準拠）
- `characters/<id>/prompts/variants/<variant>.md` — 対象バリアント
- `characters/<id>/outputs/<run-id>/prompt.txt` — compile 済みプロンプト（`integrations/prompt-compile.md` で先に生成）
- `characters/<id>/outputs/<run-id>/negative.txt` — compile 済みネガティブ
- `characters/<id>/references/images/*-anchor.*` — 同一性固定用のアンカー画像
- `characters/<id>/references/sources.yaml` — リファレンスのメタ情報

pipeline 側の推奨読み順:
1. `$CHARACTER_FORGE_ROOT/characters/<id>/` をルートとして開く
2. **まず `outputs/<run-id>/prompt.txt` と `negative.txt` を読む**（compile 済みの正本）
3. prompt.txt が存在しない場合は `prompts/variants/<variant>.md` + `prompts/base.md` + Lexicon を pipeline 側でも compile する（§4.5.2 のルール準拠）
4. `references/images/*anchor*` をリファレンスとして読み込み
5. `lexicon_used` に列挙されたエントリは pipeline 側でも追跡

---

## 出力仕様

pipeline が Shitate に書き戻すもの:

- `outputs/<run-id>/` ディレクトリを作成
  - `run-id` 命名: `YYYYMMDD_<variant>_<base-version>[_<suffix>]`（FR-OUTPUT-02）
- `outputs/<run-id>/*.png` または `*.mp4` — 生成物本体（.gitignore 対象）
- `outputs/<run-id>/thumb_*.png` — サムネイル（git コミット対象）
- `outputs/<run-id>/manifest.json` — 再現情報（git コミット対象、§7.3 スキーマ準拠）

**冪等性**: 同じ run_id があれば上書きせず、`_r2` サフィックスの新 run を作る（NFR-IDEMPOTENT）。

---

## 実行手順

### 1. 事前チェック

1. `characters/<id>/log.md` の直近3エントリを読む（FR-LOG-04）
2. 対象バリアントの `prompts/variants/<variant>.md` を読む
3. `references/sources.yaml` を読み、anchor が揃っているか確認
4. 揃っていなければ先にランタイム別の静止画手順（AGENTS.md §8.1）で anchor を生成する

### 2. run_id の決定と compile

1. 今日の日付（JST）を `YYYYMMDD` 形式で取得
2. `run_id = <YYYYMMDD>_<variant>_<base-version>` を構築
3. `outputs/<run_id>/` が既存なら `_r2`, `_r3` ... のサフィックスを付ける
4. `integrations/prompt-compile.md` の手順で `outputs/<run_id>/prompt.txt` と `negative.txt` を生成
5. この時点で pipeline に渡す **正本プロンプト** が確定する

### 3. pipeline の起動

1. pipeline ディレクトリに移動するか、`CHARACTER_FORGE_ROOT` を export
2. pipeline の SKILL.md / README.md に従ってコマンドを実行
   - 典型例: `pixverse generate --character <id> --variant <variant>`
   - ただし pipeline 側の最新インターフェースは SKILL.md を都度確認すること
3. 生成中のログは `outputs/<run_id>/.log` に残す（任意）

### 4. 結果の整理

1. 生成物が `outputs/<run_id>/` に並んでいることを確認
2. サムネイル `thumb_*.png` を生成（pipeline が自動でやる想定、無ければ手動）
3. `manifest.json` を §7.3 スキーマで生成:
   - `base_sha` は `prompts/base.md` の `git hash-object` 結果
   - `lexicon_used` は variant ファイルの Lexicon 参照欄から転記
   - `tool` = `pixverse-character-pipeline`, `tool_version` は pipeline の commit hash か tag
4. git で `manifest.json` と `thumb_*.png` のみステージ（`.gitignore` で自動制御）

### 5. log.md への追記

1. `templates/log-entry.md` を参考に新エントリを先頭に追加
2. 試行内容・評価・次の改善を記入
3. 生成物リンクは `outputs/<run_id>/manifest.json` への相対パス

---

## 失敗時のリカバリ

| 症状 | 原因 | 対処 |
|---|---|---|
| pipeline がキャラディレクトリを認識しない | `CHARACTER_FORGE_ROOT` 未設定 or パス相違 | `export CHARACTER_FORGE_ROOT=~/Projects/コンテンツ/shitate` を確認。pipeline 側の期待する命名規則と `<id>` が一致しているか見る |
| anchor 画像がロードされない | ファイル名が `*anchor*` でない | `.gitignore` ホワイトリストが anchor 名に依存。ファイル名を `*-anchor.png` にリネームし `sources.yaml` も更新 |
| 顔が毎回変わる | anchor 画像の品質不足 or 参照設定漏れ | anchor を再生成、または複数 anchor を揃えて `references` に追加 |
| manifest に base_sha が記録できない | git 未コミット状態で生成した | 先に base.md をコミットしてから再生成。`_r2` 新 run で再実行 |
| 既存 run_id を上書きしてしまった | 冪等性違反 | git で元 manifest を復元し、新 run は `_r2` を付与 |
| pipeline のインターフェース変更で動かない | pipeline 側アップデート | `~/Projects/Pixverse-Workflow/pixverse-character-pipeline/SKILL.md` を再読し、この手順書を更新 |
