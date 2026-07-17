# AGENTS.md — Shitate 操作ガイド

このファイルは **全エージェント共通の正本** である（Codex / Claude Code / その他）。
何か書き換える前にここを読むこと。ランタイム固有の差分だけを各エージェント用の薄いファイルに書く
（Claude Code は [CLAUDE.md](./CLAUDE.md)）。

> 設計思想と用語は [REQUIREMENTS.md](./REQUIREMENTS.md)、利用者向け概要は [README.md](./README.md) を参照。
> 詳細スキーマやワークフローは [docs/](./docs/) 配下に分割された（§11「いつ何を読むか」参照）。

---

## 0. 絶対原則

1. **1キャラ = 1ディレクトリ**（`characters/<id>/`）。他のキャラと混ざらない。
2. **正本はプレーンテキスト**（markdown / yaml / json）。バイナリは `references/` と `outputs/` のみ。
3. **育成ループは log.md に残る**。残っていなければ存在しないのと同じ。
4. **外部ツールは `integrations/` 経由**。直接呼び出しを避け、手順書を読んでから実行する。
5. **生成実行はこのリポではやらない**。このリポは「入力の整備」と「結果の記録」のみ。
6. **画像生成は明示指示があるまでやらない**。このリポの本体は「世界観・キャラ設定・プロンプト提案」で、
   画像生成はユーザーが「生成して」「画像で出して」等と明示するまで compile までで止める
   （§3 の単独 compile run を標準フローとする）。

### 0.1 レイヤー構造（上流: makimono、下流: image generation）

Shitate は `~/makimono/` の **下流の視覚化レイヤー**。

```
sources (YouTube / PDF / 講義 / Drive / NotebookLM)
    ↓
~/makimono/  (knowledge wiki)
    ↓  read-only
Shitate  (このリポ)
    ↓  prompt.txt
画像生成（ランタイム別: §8） / PixVerse 等
```

- Shitate は makimono を **read-only** で参照
- 必要な entity / concept が makimono に無ければ、**まず makimono 側に追加** してから Shitate 作業に進む
- NotebookLM / Google Drive との接続は **makimono の責務**
- 新規キャラの入り口は用途で選ぶ（§2）。マスコット系は (a)、歴史・知識系は (c)

### 0.2 既定モード: prompt factory

既定モードは「プロンプトファクトリー」:

- 世界観と外観を考える
- index.md / world.md / base.md / variant.md を書く
- Lexicon 参照を整理する
- `pnpm forge compile <char> <variant>` で `outputs/<run-id>_compile/prompt.txt` まで書き出す
- ユーザーに内容を見せて、次の判断を待つ

**画像生成ツールを呼ぶのはユーザーが明示したときだけ**。曖昧な「進めて」「続けて」は compile までで止める。迷ったら確認する。
候補を複数生成した場合は、ユーザーがピックアップした画像だけをキャラ登録・anchor 化する。未採用画像はリポ正本にしない。

静止画の手順書は **ランタイム別**（§8）。「どちらかがグローバル標準」ではない。

---

## 1. 作業開始時の手順

依頼が来たら、コードを触る前に **この順番で** 読むこと。

1. 対象キャラの `characters/<id>/index.md`（frontmatter と本文）
2. `characters/<id>/log.md` の **直近3エントリ**（FR-LOG-04 の義務）
3. 現行の `characters/<id>/prompts/base.md`
4. 依頼が特定バリアントに関するなら `prompts/variants/<variant>.md`
5. 必要に応じて `index.md` の `source_entities` が指す `~/makimono/entities/*.md`

省力版: `pnpm forge status` で全キャラの直近状態と「次の改善」を俯瞰できる。ただし判断前には必ず対象キャラの log 本体を読む。

これを飛ばして書き始めると、過去の失敗を繰り返すか、史実と矛盾する設定を混ぜ込む。

---

## 2. 新規キャラを作るとき

3 つの入り口がある。用途で選ぶ。

**(a) 素のテキスト情報から作る**（マスコット・オリジナル系の第一級ルート）:

1. キャラ ID を決める（ASCII kebab-case）
2. `pnpm forge new <id> --name "<表示名>"` で骨組みを作る（または templates を手動展開）
3. `source_entities` は空配列でよい（将来 entity 化してもよい）
4. `prompts/base.md` を [docs/schemas/prompt.md](./docs/schemas/prompt.md) に従って書く
5. `pnpm forge compile <id> <variant>` で compile → ユーザーに提示して次の判断を待つ

**(c) makimono entity からキャラを作る**（歴史・知識系の本流）:

1. `~/makimono/entities/<slug>.md` を確認。無ければ **まず makimono 側に追加** してから進む（[integrations/makimono.md](./integrations/makimono.md)）
2. entity から視覚化に関係する情報を抽出（時代・地域・身分・象徴的道具・逸話）
3. キャラ ID を決める（ASCII kebab-case。entity と別 ID を推奨）
4. `pnpm forge new <id>` または手動で `characters/<id>/` 骨組みを作る（frontmatter は [docs/schemas/character-index.md](./docs/schemas/character-index.md)）
   - `source_entities` に当該 entity を Obsidian 記法で列挙（必須）
   - `index.md` 本文に「どの entity のどの側面を採用・脚色したか」を明記
5. `prompts/base.md` は entity の記述に整合させる（矛盾させる場合は log.md に理由）
6. `pnpm forge compile <id> three-view --dry-run` で compile 確認 → 書き出し
7. ユーザーに「entity からこういう翻訳を提案します」と見せて次の判断を待つ

手順の詳細は [integrations/source-to-character.md](./integrations/source-to-character.md)。

**(b) 既に手元にある画像から作る**（逆フロー）: [integrations/image-to-character.md](./integrations/image-to-character.md) の **new-character モード**。画像を観察 → base.md を書き起こし → 骨組み一式。画像生成は行わない。

---

## 3. プロンプトを改善するとき

1. 直近3エントリの log を読んで、前回の「次の改善」を確認する
2. 変更の粒度を判断する:
   - **軽微**（語を足す・ネガを増やす・カメラ指定を変える）→ 既存 variant を上書き編集。base は触らない
   - **主要改訂**（骨格が変わる・キャラの印象が変わる）→ 新しい `prompts/history/base.v<N+1>.md` を作り、`base.md` を**物理コピーで差し替え**、`index.md` の `base_version` を更新
3. 変更した理由と意図を `log.md` に必ず書く。プロンプトの diff だけでは意図は読めない
4. **既定モードでは compile までで止める**:
   - `pnpm forge compile <char> <variant>` で `outputs/<run-id>_compile/` を書き出す
   - ユーザーに変更内容と compile 結果を提示、次の判断を待つ
5. **ユーザーが明示指示した場合のみ** §8 のランタイム別手順で実生成し `outputs/<run-id>/` に整理（`--with-image` で compile 時点から `_compile` サフィックスを外せる）
6. 候補生成の場合、ユーザーが選んだ画像だけ `references/images/*anchor*` または `outputs/<run-id>/` に保存する。未採用画像は登録しない
7. `log.md` に結果と評価を追記（§5 / [docs/schemas/log.md](./docs/schemas/log.md)）
8. 知見が Lexicon に還元できそうなら `lexicon/` を更新する（`lexicon/negatives.md` も候補）

---

## 4. プロンプトスキーマ（要約）

`prompts/base.md` も `prompts/variants/*.md` も、以下の必須セクション 7 種を全部含める:

1. `# <プロンプト名>` — H1
2. `## 用途`
3. `## 依存ベースバージョン` — `v<N>` 一行
4. `## 本文プロンプト` — 直後に triple backtick コードブロック
5. `## ネガティブプロンプト` — 同上
6. `## Lexicon 参照` — 箇条書き `lexicon/<cat>.md#<id>` 形式
7. `## メモ`（任意）

詳細・実例・書式ルールは [docs/schemas/prompt.md](./docs/schemas/prompt.md)。

## 4.5 プロンプト compile（要約）

compile は base + variant + lexicon 断片を結合して `outputs/<run-id>/prompt.txt` / `negative.txt` / `manifest.json` に書き出す工程。
エージェントも CLI (`pnpm forge compile`) も同仕様に従う。**正本の実行手段は CLI**。

- 結合順序: **base → variant → lexicon**（base は先頭、lexicon は variant の参照順で末尾）
- base.md の `## Lexicon 参照` は compile に **使わない**（authoring reference のみ。variant 側が正）
- `lexicon/negatives.md#...` は variant の `## Lexicon 参照` に **書かない**（手動で `## ネガティブプロンプト` に貼る）
- negative は case-insensitive exact match で dedup（先出し保持）
- run_id: `<YYYYMMDD-JST>_<variant-basename>_<base-version>[_compile][_r<N>]`
- 既存 run_id は上書き禁止、`_r2` 採番

**正式仕様は [docs/schemas/compile.md](./docs/schemas/compile.md)**。食い違いが出たら docs/schemas/compile.md を正とする。
手動手順は [integrations/prompt-compile.md](./integrations/prompt-compile.md)（**CLI が動かない時の fallback**）。

---

## 5. log.md エントリ（要約）

`log.md` は **新しい順（DESCENDING）** で追記。各エントリは「試行 / プロンプト差分 / 生成物 / 評価 / 次の改善」を固定書式で書く。評価記号は ◎ / ◯ / △ / ✗。「次の改善」欄は **空にしない**。

詳細テンプレートと実例は [docs/schemas/log.md](./docs/schemas/log.md)。

---

## 6. データモデル早見表

| データ | 正式仕様 |
|---|---|
| `characters/<id>/index.md` frontmatter | [docs/schemas/character-index.md](./docs/schemas/character-index.md) |
| `prompts/base.md` / `prompts/variants/*.md` | [docs/schemas/prompt.md](./docs/schemas/prompt.md) |
| `outputs/<run-id>/manifest.json` | [docs/schemas/compile.md#7-manifestjson-スキーマ](./docs/schemas/compile.md) |
| `references/sources.yaml` + anchor 命名 | [docs/schemas/references.md](./docs/schemas/references.md) |
| `log.md` エントリ | [docs/schemas/log.md](./docs/schemas/log.md) |

NFR-IDEMPOTENT: 既存 `run_id` のディレクトリに上書きしない。再実行は `_r2` 新 run を作る。

Anchor の作成・差し替え・バージョニング・古びるサインは [docs/workflows/anchor-lifecycle.md](./docs/workflows/anchor-lifecycle.md) に分離。

---

## 7. forge CLI と Studio

リポ固有のツールとして `scripts/forge/`（TypeScript、tsx で直実行）を備える。

```
pnpm forge status                              # 全キャラの現況と次の改善を俯瞰
pnpm forge doctor [--character <id>] [--strict]# 読み取り専用の整合チェック
pnpm forge compile <char> <variant> [--dry-run]# base + variant + lexicon を結合
pnpm forge new <id> [--name <表示名>]          # キャラ骨組みスキャフォールド + INDEX 反映
pnpm forge index --check | --write             # INDEX.md の Characters 表を実データと同期
pnpm forge lint [--promotion]                  # 合格判定 (error で exit 1、promotion で warning も)
```

詳細は [docs/workflows/forge-cli.md](./docs/workflows/forge-cli.md)。
compile の参照実装は CLI。手動 fallback は [integrations/prompt-compile.md](./integrations/prompt-compile.md)。

ブラウザ UI を立ち上げるなら:

```
pnpm studio   # API :5179 + UI :5180、ブラウザは 5180 を開く
```

v0.3。CLI と同じ `scripts/forge/lib/` を共有し、閲覧に加えて新規キャラ作成・prompt 編集・log 追記・
compile 成果物の保存・選定済み anchor 画像の登録を安全なローカル書き込みとして扱う。
anchor 登録は JPEG / PNG / WebP（5 MiB 以下）に限り、既存 anchor ID を上書きせず、
`references/sources.yaml`・`log.md`・`INDEX.md` を同時に同期する。画像生成は引き続き user-gated。
詳細は [docs/workflows/studio.md](./docs/workflows/studio.md)。

---

## 8. 連携の基本動線

画像生成・外部ツールへの受け渡しは `integrations/` 配下の手順書を **毎回読んで** から実行する。

| 用途 | 手順書 |
|---|---|
| **テキスト → キャラ（マスコット系・第一級）** | §2 (a) + `pnpm forge new` |
| **資料 → キャラクター化（歴史・知識系の本流）** | [integrations/source-to-character.md](./integrations/source-to-character.md) |
| **プロンプト compile（標準）** | `pnpm forge compile`（[docs/schemas/compile.md](./docs/schemas/compile.md)） |
| **プロンプト compile（CLI 不能時 fallback）** | [integrations/prompt-compile.md](./integrations/prompt-compile.md) |
| **画像 → キャラ骨組みの逆生成** | [integrations/image-to-character.md](./integrations/image-to-character.md) |
| 知識層（makimono）への参照 | [integrations/makimono.md](./integrations/makimono.md) |
| PixVerse でのキャラ生成（動画） | [integrations/pixverse-pipeline.md](./integrations/pixverse-pipeline.md) |
| **Tsugite へのキャラsnapshot受け渡し** | [integrations/tsugite.md](./integrations/tsugite.md) |
| **静止画（Codex / ChatGPT）** | [integrations/chatgpt-image.md](./integrations/chatgpt-image.md) |
| **静止画（Claude Code）** | [integrations/nano-banana.md](./integrations/nano-banana.md) |
| 動画編集（Remotion）への素材受け渡し | [integrations/remotion.md](./integrations/remotion.md) |

### 8.1 静止画ルートはランタイム別（いずれも user-gated）

「標準はどちらか」ではなく、**いま動いているエージェントが使えるルート**を使う。

| ランタイム | 静止画手順 | 備考 |
|---|---|---|
| Codex / ChatGPT | [chatgpt-image.md](./integrations/chatgpt-image.md) | チャット内 built-in image generation。API キー不要 |
| Claude Code | [nano-banana.md](./integrations/nano-banana.md) | Nano Banana MCP 経由 |
| ユーザー明示の別ツール | 指定された手順 | 明示がない限り上表に従う |

**共通ルール**:

- いずれも **ユーザー明示指示があるまで呼ばない**
- 複数候補を出した場合は、ユーザーが選んだ画像だけを保存・登録する
- Shitate は入力を揃え（compile）、必要に応じて結果の manifest を保存するだけ
- プロンプトだけ欲しい場合は `pnpm forge compile` を使う
- 動画は PixVerse、編集・素材受け渡しは用途に応じて画像生成 / Remotion を使う

---

## 9. ユーザーフィードバック（常時適用）

- **テーブル過剰禁止**。自然な日本語箇条書きで簡潔に応答
- **PixVerse プロンプトは V6 公式ベストプラクティス**（1-2文、カメラワーク明示、簡潔）
- **ズーム偏重禁止**。カメラワーク20種語彙と6ショット推奨シーケンスを使う
- **静止画はランタイム別**（§8.1）、動画は PixVerse、編集は用途に応じて
- **ベーステキストを渡されたらそのトーンを活かす**。ゼロから書き直さない

---

## 10. よくある失敗

サマリのみ。詳細と対処は [docs/workflows/troubleshooting.md](./docs/workflows/troubleshooting.md)。

- 過去に没にしたプロンプトに戻っている → §1 をやり直す
- キャラの顔が毎回違う → anchor 不在 or 未登録
- manifest を上書きしてしまった → `_r2` で新 run
- base.md と history/base.v\<N\>.md が食い違う → history への新規コピー忘れ
- source_entities がリンク切れ → makimono 側でリネームが起きた
- forge compile がセクション欠落で停止 → [docs/schemas/prompt.md](./docs/schemas/prompt.md) 準拠に
- CLAUDE.md と AGENTS.md が食い違う → **AGENTS.md が正**。CLAUDE.md は薄い差分のみ

---

## 11. いつ何を読むか

常時 context に載るのはこの AGENTS.md のみ。以下は **必要になった時だけ** docs を読めばよい。

| やること | まず読む |
|---|---|
| 新規キャラを作る | §2 + [docs/schemas/character-index.md](./docs/schemas/character-index.md) + [docs/schemas/prompt.md](./docs/schemas/prompt.md) |
| プロンプトを書く・直す | [docs/schemas/prompt.md](./docs/schemas/prompt.md) |
| compile 仕様を確認する | [docs/schemas/compile.md](./docs/schemas/compile.md) |
| CLI コマンドを使う | [docs/workflows/forge-cli.md](./docs/workflows/forge-cli.md) |
| log を書く | [docs/schemas/log.md](./docs/schemas/log.md) |
| anchor を作る・差し替える | [docs/workflows/anchor-lifecycle.md](./docs/workflows/anchor-lifecycle.md) |
| manifest フィールドを調べる | [docs/schemas/compile.md](./docs/schemas/compile.md) §7 |
| references / sources.yaml を書く | [docs/schemas/references.md](./docs/schemas/references.md) |
| 不具合を追う | [docs/workflows/troubleshooting.md](./docs/workflows/troubleshooting.md) |
| 外部ツールを呼ぶ | `integrations/<tool>.md`（§8 の表） |
| Codex で静止画生成 | [integrations/chatgpt-image.md](./integrations/chatgpt-image.md) |
| Claude Code で静止画生成 | [integrations/nano-banana.md](./integrations/nano-banana.md) |
| 候補画像からキャラ登録する | 各ランタイムの画像手順書 |

---

## 12. このガイドを更新するとき

- 規約が変わったらまず **AGENTS.md を直す**。コードを先に変えない
- CLAUDE.md は「AGENTS.md へのポインタ + Claude Code 固有差分」だけを維持する。本文の重複は書かない
- 詳細スキーマの変更は `docs/schemas/` で行い、AGENTS.md §4–§6 の要約だけ追従させる
- 新しい失敗パターンが出たら [docs/workflows/troubleshooting.md](./docs/workflows/troubleshooting.md) に追記
- 節番号は固定（外部から参照されるため安定させる）
