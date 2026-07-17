# Integration: source-to-character（資料 → キャラクター化の一気通貫フロー）

「いろんな資料を巻物に投げて wiki 化したものを、視覚的キャラクターに翻訳する」という
**歴史・知識系キャラの本流ワークフロー** を end-to-end で記述する手順書。

マスコット・オリジナル系は [AGENTS.md](../AGENTS.md) §2 **(a) 素テキストルート** が第一級。
entity を経ない。この手順書は (c) 向け。

Shitate 単体の手順書ではなく、**上流（makimono）と下流（画像生成）を含めた
全体パイプラインのナビゲーション** として機能する。各ステージの具体手順は別の
integration に委譲する。

---

## 前提条件

- `~/makimono/` が存在すること
- 対象キャラのネタ元となる資料がある（YouTube / PDF / 講義 / インタビュー / Drive / NotebookLM / 書籍 / 手元のメモ 等）
- makimono 側の intake ルールを読んでいること
- Shitate 側の [AGENTS.md](../AGENTS.md) §0.1（レイヤー構造）と §0.2（prompt factory 既定）を読んでいること

---

## 入力仕様

以下のいずれか 1 つ以上が手元にある状態:

- NotebookLM のノートブック URL / ID
- Google Drive の文書 URL / ID
- YouTube 動画の URL
- PDF ファイルパス
- 書籍名・章番号・ページ
- 講義動画・トランスクリプト
- 手書き・手入力の資料メモ
- **既に makimono に entity がある場合はこの手順の Step 1〜2 をスキップして Step 3 から**

---

## 出力仕様

このフロー全体の成果物:

1. `~/makimono/entities/<slug>.md`（または `concepts/`）— wiki 化された正本
2. `characters/<id>/` 一式（index / world / base / variant / log / references スケルトン）
3. `characters/<id>/outputs/<run-id>_compile/prompt.txt` — compile 済みプロンプト（画像生成なし）
4. ユーザーへの提示: 「このような翻訳になりました、次は？」

**このフローは compile までで止まる**（§0.2 prompt factory 既定）。画像生成はユーザーの
明示指示後、静止画は **ランタイム別**（Codex → `chatgpt-image.md`、Claude Code → `nano-banana.md`）、
動画は `pixverse-pipeline.md` で実行する（AGENTS.md §8.1）。

---

## 実行手順（全体像）

```
Step 1: 資料を makimono に投入            → makimono 側の責務
Step 2: makimono で wiki 化                → makimono 側の責務
Step 3: entity の存在確認                   → Shitate 側
Step 4: entity を読み視覚情報を抽出         → Shitate 側
Step 5: キャラ骨組みを書く                  → Shitate 側
Step 6: compile                             → Shitate 側
Step 7: ユーザーに提示、判断を待つ          → Shitate 側
Step 8: (明示指示後) 画像生成                → ランタイム別静止画 / PixVerse
```

---

### Step 1: 資料を makimono に投入（makimono 側）

Shitate はこの Step に関与しない。makimono 側の手順書と運用方針に従ってユーザーが投入する。

投入経路の例:

- **NotebookLM**: `notebooklm-mcp` の `source_add` / `notebook_create` 等で取り込み、そこから entity を抽出
- **Google Drive**: makimono の drive 連携機能で sync
- **PDF / YouTube**: `~/makimono/50_raw/` 配下に一旦保存、LLM 処理 or 手動要約
- **手動記述**: makimono の editor で直接 markdown を書く

**重要**: この Step は **Shitate が走らせてはいけない**。レイヤー違反になる（AGENTS.md §0.1 参照）。
Shitate は「makimono に資料が入っていること」を前提にする。

### Step 2: makimono で wiki 化（makimono 側）

投入した資料が `~/makimono/entities/<slug>.md` または `~/makimono/concepts/<slug>.md` として
wiki 化されることを確認する。

- frontmatter（type / tags / sources 等）が埋まっている
- 相互リンクが張られている（`[[entities/...]]` 記法）
- 関連する `concepts/` や `sources/` への参照が含まれている

これも Shitate の仕事ではない。makimono 側の責務。

### Step 3: entity の存在確認（Shitate 側）

ここから Shitate の責務が始まる。

1. 対象 entity のスラッグを決める（ユーザーと相談）
2. `~/makimono/entities/<slug>.md` が存在するか Read で確認
3. **存在しない場合**: `integrations/makimono.md` の「entity 欠落時の対処」に従って
   Step 1 に戻る（Shitate を先行させない）
4. 関連する concepts / sources があれば併せて存在確認

### Step 4: entity を読み視覚情報を抽出（Shitate 側）

1. entity を Read で読む（ヒット数が多ければ head 読みから始める）
2. 以下の観点で情報を拾う:
   - **時代・地域・文化圏**: 「江戸末期の関西」「古代出雲」等
   - **身分・役割・職能**: 「武将」「巫女王」「山伏」等
   - **身体的特徴**: 年齢・体格・髪型・顔の特徴
   - **装束・装備・象徴的な道具**: 具体的な服装・武器・持ち物
   - **性格・口調・所作**: 「静寂の爆発」「急がない」等
   - **絵になる場面**: 逸話の中で視覚化したいシーン
   - **色・物質の手がかり**: 「鈍金」「漆黒」「白絹」等
3. 読み取れない情報はこの Step で **脚色候補** としてメモする（次 Step で使う）
4. 関連 concepts も同様に読み、世界観の土台を拾う

### Step 5: キャラ骨組みを書く（Shitate 側）

AGENTS.md §2 (c) の手順に従う。具体的には:

1. キャラ ID を決める（ASCII kebab-case。脚色がある場合は entity スラッグと別 ID 推奨）
2. `characters/<id>/` のディレクトリ構造を作る:
   - `prompts/history/`
   - `prompts/variants/`
   - `references/images/`
   - `outputs/`
3. `characters/<id>/index.md` を書く:
   - frontmatter: `status: draft`, `base_version: v1`, `source_entities` に該当 entity 必須
   - 概要欄に「**どの entity のどの側面を採用したか**」を明記
   - 脚色した点を「脚色ノート」セクションに残す
4. `characters/<id>/world.md`（任意）: キャラ固有の世界観があれば書く
5. `characters/<id>/prompts/base.md` を書く:
   - Step 4 で抽出した視覚情報を英語プロンプトに翻訳
   - `## 本文プロンプト` / `## ネガティブプロンプト` / `## Lexicon 参照` / `## メモ` のスキーマ厳守（FR-PROMPT-04）
   - `lexicon/negatives.md` の共通ネガを参考に組み立てる
6. `characters/<id>/prompts/history/base.v1.md` に `base.md` を **物理コピー**
7. `characters/<id>/prompts/variants/three-view.md` を `templates/three-view.md` ベースで作る
8. `characters/<id>/references/sources.yaml` を空スケルトンで作る（画像が無い段階）
9. `characters/<id>/log.md` の初回エントリを書く:
   - 試行: 「`[[entities/<slug>]]` からの逆翻訳、source-to-character フロー」
   - 脚色: entity からの変更点とその理由
   - 次の改善: ユーザーに見せて反応を待つ

### Step 6: compile（Shitate 側）

1. `integrations/prompt-compile.md` の手順で `outputs/<YYYYMMDD>_three-view_v1_compile/` に
   `prompt.txt` / `negative.txt` / `manifest.json` を書き出す
2. `manifest.json` の `source_entities` に entity を必ず記録
3. `tool: "prompt-compile"`, `outputs: []` で single-compile run として登録

### Step 7: ユーザーに提示（Shitate 側）

1. 次のものを提示する:
   - entity のどの側面を採用したか
   - 脚色ノート（何を変えたか、なぜか）
   - `characters/<id>/index.md` の概要
   - `prompts/base.md` の本文プロンプト
   - compile 済み `prompt.txt`
2. ユーザーの判断を待つ:
   - 「いいね、この方向で進める」→ 次のバリアント or シーンへ
   - 「ここを変えて」→ base.md / variant を修正 → re-compile
   - 「やっぱり別の entity ベースにしたい」→ Step 3 に戻る
   - 「画像で見たい」→ Step 8 に進む

**このフローは Step 7 で一旦完了する**。compile までが Shitate の既定領分。

### Step 8: 画像生成（ユーザー明示指示後）

ユーザーが「生成して」「画像で見たい」等と明示した場合のみ:

1. 静止画はランタイム別（Codex → `chatgpt-image.md`、Claude Code → `nano-banana.md`）。動画は `pixverse-pipeline.md`
2. `outputs/<run-id>/` を新規作成（`_compile` サフィックスは付けない、実生成の証）
3. compile 済み prompt.txt をそのまま画像生成に使う（会話内で再結合しない）
4. 生成物を `outputs/<run-id>/` に保存し manifest を作成（採用画像のみ）
5. `log.md` に評価を追記

---

## 失敗時のリカバリ

| 症状 | 原因 | 対処 |
|---|---|---|
| Step 3 で entity が見つからない | 上流の wiki 化が未着手 | `integrations/makimono.md` 「entity 欠落時の対処」に従い、Step 1〜2 に戻る |
| Step 4 で entity の記述が薄く視覚情報を拾えない | makimono 側の entity が未成熟 | makimono 側に情報追加を依頼、or 脚色として明示しつつ補う（log.md に明記） |
| 複数の entity が競合する設定を持つ | 上流の整合性問題 | makimono 側で entity 間の調整を依頼。Shitate 側で勝手に決めない |
| Step 5 以降で Shitate 側が entity の内容を上書きしたい衝動が出る | レイヤー違反の誘惑 | 必ず脚色として log.md に残し、entity 自体は変更しない。必要なら makimono 側に修正依頼 |
| Step 7 で提示前に画像を生成してしまった | prompt factory 既定違反（AGENTS.md §0.2） | 生成物は残してよいが、以降はユーザー明示指示を待ってから生成する |
| Step 8 の画像生成をユーザーが望まない | そもそも prompt factory 運用 | Step 7 で止めて問題なし。compile 単独 run は完結した成果物 |
| NotebookLM / Drive に Shitate から直接アクセスした | 上流の責務を奪った | そのルートで得た情報を makimono に転記してから改めて Shitate から参照 |

---

## 配布サンプルとの違い

同梱の `washi-fox` はオリジナルの操作サンプルなので、makimono entity を使わない §2 (a) のルートで作られている。
この文書の source-to-character ルートを試す場合は、自分が利用できる資料と entity を用意し、
出典と脚色の境界を `index.md` と `log.md` に記録する。
