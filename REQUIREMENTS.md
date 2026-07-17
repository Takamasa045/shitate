# Shitate 要件定義

**バージョン**: 1.3
**最終更新**: 2026-07-14
**ステータス**: v1.3 実装済み

## v1.3 での追加・変更（v1.2 からの差分）

- **Studio v0.3**: 選定済みの JPEG / PNG / WebP を anchor として登録するローカル導線を追加
- **一括記録**: anchor 実体、`sources.yaml`、`log.md`、`INDEX.md` を同じ操作で同期
- **安全な upload**: 5 MiB 上限、MIME と magic bytes の一致検証、サーバー側ファイル名生成、既存 anchor 非上書き
- **CI runtime 更新**: GitHub Actions を Node 24 対応 major へ更新

## v1.2 での追加・変更（v1.1 からの差分）

- **Studio v0.2**: 新規キャラ作成、base / variant 編集、log 追記、compile 保存をローカル Web UI に追加
- **安全な mutation**: JSON + Studio 専用ヘッダー、入力検証、atomic write、既存 run 非上書きを必須化
- **楽観ロック**: prompt の revision を比較し、同時更新は HTTP 409 で停止
- **回帰保証**: unit / API integration に加え、一時 `SHITATE_ROOT` 上で Chromium E2E を実行
- **依存監査**: Hono / React Router / js-yaml の既知脆弱性を解消し、production audit を CI に追加

## v1.1 での追加・変更（v1.0 からの差分）

- **正本の一本化**: 共通操作規約は [AGENTS.md](AGENTS.md)。[CLAUDE.md](CLAUDE.md) は Claude Code 固有差分のみ
- **静止画ルートはランタイム別**: Codex → `chatgpt-image.md`、Claude Code → `nano-banana.md`（いずれも user-gated）
- **Q5 クローズ**: `scripts/forge/`（TypeScript CLI）が compile の参照実装。手動 `prompt-compile.md` は fallback
- **スコープ拡大**: forge CLI / Studio / CI（compile snapshot・diff）を正式 in-scope に
- **入り口の再定義**: (a) 素テキスト = マスコット系第一級、(c) entity = 歴史・知識系の本流
- **スキャフォールド**: `forge new <id>` で骨組み + INDEX 反映
- **共有断片**: シリーズ共通衣装は lexicon エントリ化（例: `lexicon/clothing/sk8-crew.md`）

## v1.0 での追加・変更（v0.1 からの差分・要約）

v0.1 骨格に prompt factory / FR-COMPILE / FR-REVERSE / FR-SOURCE-TO-CHARACTER / FR-NEGATIVES-LEXICON / NFR-LAYERED 等を追加。
詳細は git 履歴を参照。以降の各節は **v1.3 としての最新内容**。

> 実装済みキャラ一覧は [INDEX.md](INDEX.md)、status 昇格ルールは [STABLE.md](STABLE.md)、
> 操作規約の正本は [AGENTS.md](AGENTS.md)。

---

## 1. 概要

`Shitate` は、**プロンプト主体でキャラクターを定義・育成するためのデータリポジトリ**である。
キャラクター1体 = 1ディレクトリの原則で、プロンプト・リファレンス・生成履歴・学習ログを一元管理し、Claude Code と既存スキル（`pixverse-character-pipeline` 等）および `~/makimono/`（Knowledge-LM）との連携によって、キャラクターを継続的に育てることを目的とする。

本リポジトリは **単体でも完結**して動作し、かつ**外部連携をプラグイン的に追加できる**構造を持つ。

---

## 2. 目的と背景

### 2.1 背景

- ChatGPT built-in image generation / PixVerse / Remotion を横断するワークフローで、同じキャラを繰り返し生成する場面が増えている。
- 現状は各プロジェクト（`pixverse-character-pipeline` の `inputs/`、個別の `makimono/entities/`、散在するプロンプトメモ）にキャラ情報が分散しており、**キャラの同一性を保った再生成と改善ループ**が回しにくい。
- `makimono` は知識の一次情報を持つが、**「見た目としてのキャラ」**を扱う層が存在しない。
- プロンプトの改善履歴（何を試して何が良かったか）が失われ、同じ失敗を繰り返している。

### 2.2 目的

以下を満たす「キャラクター同一性レイヤー」を構築する。

1. **同一性の担保**: ベースプロンプト + アンカーリファレンス + バージョン管理により、数週間後の再生成でも顔・衣装・雰囲気を保てる。
2. **育成の可視化**: 試行 → 評価 → 改善の履歴を構造化し、Claude Code が過去の学びを参照できる。
3. **知識との接続**: `makimono/entities/` の一次情報とリンクし、史実・概念に根ざしたキャラ設計を可能にする。
4. **実行層との疎結合**: ChatGPT built-in image generation / PixVerse / Remotion 等への受け渡しを adapter 化し、実行ツールの変更に耐える。
5. **単体完結**: 外部連携が無くても、このリポだけでキャラを定義・改善できる。

### 2.3 運用原則 (v1.3)

実装を進めるなかで、ワークフローの位置付けが明確になった。

1. **レイヤー構造**: `sources (YouTube/PDF/Drive/NotebookLM) → makimono → Shitate → image generation` の 4 層。
   Shitate は makimono の **下流の視覚化層** として位置付く。詳細は §6.7 NFR-LAYERED。
2. **既定モード = prompt factory**: Shitate 上の作業は **プロンプト提案とコンパイル**までが既定。
   画像生成はユーザーが明示指示したときのみ実行する（user-gated）。
   複数候補を生成した場合、ユーザーがピックアップした画像だけを Shitate に登録し、未採用画像は正本にしない。
   詳細は §5.9 FR-COMPILE および AGENTS.md §0.2。
3. **入り口は用途で選ぶ**:
   - **(a) 素テキスト**: マスコット・オリジナル系の **第一級ルート**（entity 不要）
   - **(c) makimono entity**: 歴史・知識系の **本流**（§5.11 FR-SOURCE-TO-CHARACTER）
   - **(b) 画像逆フロー**: 手元画像からの骨組み（§5.10 FR-REVERSE）
4. **静止画はランタイム別**: Codex / ChatGPT → `chatgpt-image.md`、Claude Code → `nano-banana.md`。
   「どちらかがグローバル標準」ではない（§5.8 / AGENTS.md §8.1）。
5. **compile の正本実行手段は CLI**: `pnpm forge compile`。手動手順は fallback。

---

## 3. スコープ

### 3.1 in scope (v1.3)

- キャラクターの定義（index.md / world.md / prompts/）
- プロンプトのバージョン管理と差分管理
- リファレンス画像の管理（URLリスト + 実ファイル）
- 生成結果の manifest 記録
- 育成ログ（log.md）の構造化
- Lexicon（再利用可能なプロンプト素材・シリーズ共通断片含む）
- Templates（新規キャラ作成用スケルトン）
- `makimono` との read-only リンク（source_entities）
- 画像生成・動画・編集ツールへの受け渡し仕様（`integrations/`）
- **forge CLI**（`scripts/forge/`: status / doctor / compile / new / index / lint）
- **Studio v0.3**（ローカル書き込み対応ブラウザ UI、CLI と lib 共有、選定済み anchor 登録）
- **CI**（unit / API integration / E2E / audit / compile snapshot / diff / lint ゲート）
- エージェント操作ガイドの正本（AGENTS.md）とランタイム差分（CLAUDE.md）

### 3.2 out of scope (v1.3)

- 画像・動画の自動生成実行本体（実行はランタイム / 外部ツールが担当。このリポは入力整備と記録）
- Studio からの画像生成、既存 anchor の差し替え・削除、キャラ削除・リネーム
- 複数キャラが登場するシーンの独立管理（単キャラの積み重ねで対応）
- キャラ同士の関係グラフの自動可視化
- リアルタイムコラボレーション
- 課金・クォータ管理
- `worlds/` 断片の compile 自動結合（将来。当面は lexicon 共有で代替）

### 3.3 将来（v2 以降）

- `worlds/` トップレベルディレクトリ（複数キャラで世界観を共有、compile 結合順に world 断片を追加）
- `scenes/` トップレベルディレクトリ（マルチキャラシーン定義）
- キャラの関係グラフ（relations）の可視化
- Studio のリアルタイム共同編集、関係グラフ編集
- A/B 評価の自動集計

---

## 4. 用語定義

| 用語 | 定義 |
|---|---|
| キャラクター | 視覚的同一性を持つ識別可能な存在。1ディレクトリで表現される。 |
| ベースプロンプト | 全生成カットの共通基盤となるプロンプト。`prompts/base.md` が正本。 |
| バリアント | ベースに対する差分（表情・ポーズ・シーン等）。`prompts/variants/` 配下。 |
| リファレンス | 視覚的整合性を保つための参照画像。URLとローカルファイルの両方を管理。 |
| アンカー画像 | 顔・体格の同一性を固定するための重要リファレンス。gitに必ずコミット。 |
| Lexicon | 再利用可能なプロンプト素材（スタイル・照明・カメラ等の語彙集）。 |
| Template | 新規キャラ作成時に展開するスケルトンファイル。 |
| Manifest | 生成1回ごとに記録される、再現に必要な全情報のJSON。 |
| Base version | ベースプロンプトの主要改訂単位。`base.v1.md`, `base.v2.md` のように明示。 |
| Source entity | `makimono/entities/` または `concepts/` 配下の参照先知識。 |
| Integration | 外部ツール・リポとの接続アダプタ。`integrations/` 配下。 |

---

## 5. 機能要件

### 5.1 キャラクター定義 (FR-CHAR)

- **FR-CHAR-01**: 1キャラ = 1ディレクトリ（`characters/<id>/`）で表現する。
- **FR-CHAR-02**: `index.md` は YAML frontmatter + 本文の構造を持ち、以下を含む:
  - id, name, role, age, status（draft/experimental/stable）
  - base_version（現行の base プロンプトバージョン）
  - source_entities（makimono 参照の配列、Obsidian `[[]]` 記法）
  - world_refs（世界観の参照）
  - relations（他キャラとの関係）
- **FR-CHAR-03**: `world.md` は任意。単キャラ固有の世界観を記述する。
- **FR-CHAR-04**: キャラ削除・リネーム時は `log.md` にその事実を記録する。
- **FR-CHAR-05**: キャラIDは kebab-case、ASCII英数のみ。表示名は日本語可。

### 5.2 プロンプト管理 (FR-PROMPT)

- **FR-PROMPT-01**: `prompts/base.md` が現行のベースプロンプト正本。
- **FR-PROMPT-02**: ベースの主要改訂時は `prompts/history/base.v<N>.md` として過去版を保存する。`base.md` は常に最新を指す（シンボリックリンクまたはコピー）。
- **FR-PROMPT-03**: バリアントは `prompts/variants/` 配下に整理する:
  - `variants/three-view.md`（三面図）
  - `variants/expressions.md`（表情差分）
  - `variants/poses.md`（ポーズ差分）
  - `variants/scenes/<scene-id>.md`（シーン別）
- **FR-PROMPT-04**: 各プロンプトファイルは以下のセクションを必須とする:
  - 用途（どの生成物を作るためのものか）
  - 依存するベースバージョン
  - 本文プロンプト
  - ネガティブプロンプト
  - Lexicon参照（どのlexiconファイルの何番を使ったか）
- **FR-PROMPT-05**: プロンプトは markdown コードブロック内に保持し、外部ツールがパースできる形式とする。

### 5.3 リファレンス管理 (FR-REF)

- **FR-REF-01**: `references/sources.yaml` にリファレンスのメタデータを記録する:
  - path（ローカルパス）
  - url（オリジナル出典、任意）
  - role（anchor / style / pose / outfit / mood）
  - notes
- **FR-REF-02**: `references/images/` に実ファイルを配置する。
- **FR-REF-03**: `role: anchor` のファイルは必ず git にコミットする。他は `.gitignore` 対象にできる。
- **FR-REF-04**: リファレンスの追加・削除は `log.md` に記録する。

### 5.4 生成結果の記録 (FR-OUTPUT)

- **FR-OUTPUT-01**: 生成1回 = 1ディレクトリ（`outputs/<run-id>/`）。
- **FR-OUTPUT-02**: `run-id` の命名規則: `YYYYMMDD_<variant>_<base-version>[_<suffix>]`（例: `20260411_three-view_v3`）。
- **FR-OUTPUT-03**: 各ランに `manifest.json` を配置し、以下を記録する（詳細は §7.3）:
  - run_id, character, base_version, base_sha
  - prompt_file, lexicon_used, references, source_entities
  - tool, tool_version, outputs（ファイル名配列）
  - evaluation, created_at
- **FR-OUTPUT-04**: 実ファイル（画像・動画本体）は `.gitignore` でコミットしない。ただしサムネイル（低解像度PNG）はコミット可能。
- **FR-OUTPUT-05**: manifest は git に必ずコミットする（サイズが小さく、履歴として重要）。

### 5.5 育成ログ (FR-LOG)

- **FR-LOG-01**: 各キャラに `log.md` を配置する。
- **FR-LOG-02**: ログエントリは以下のスキーマで記述する:
  - 日付 / ベースバージョン / バリアント
  - 試行内容（何を変えたか）
  - プロンプト差分の参照（history/ へのリンク）
  - 生成物の参照（outputs/ へのリンク）
  - 評価（◎/◯/△/✗）と理由
  - 次の改善案
- **FR-LOG-03**: エントリは新しい順（DESCENDING）で追記する。
- **FR-LOG-04**: エージェントは新しい生成を開始する前に直近3エントリを読む義務がある（AGENTS.md §1）。

### 5.6 Lexicon (FR-LEX)

- **FR-LEX-01**: `lexicon/` にプロンプトの再利用可能素材を置く。
- **FR-LEX-02**: 分類は以下:
  - `styles.md`（アートスタイル: 浮世絵、ジブリ調、写実等）
  - `lighting.md`（照明: golden hour、rim light等）
  - `camera.md`（アングル・レンズ: low angle、85mm等）
  - `clothing/`（衣装: 和装、鎧、現代服等）
  - `settings/`（舞台: 神社、戦場、街道等）
- **FR-LEX-03**: 各エントリは ID（例: `#ukiyo-e-edo`）を持ち、プロンプトからアンカー参照できる。
- **FR-LEX-04**: Lexicon はキャラを横断して共有される共通資産である。

### 5.7 Templates (FR-TPL)

- **FR-TPL-01**: `templates/` に新規キャラ作成用スケルトンを置く。
- **FR-TPL-02**: 最低限以下を含む:
  - `new-character.md`（index.md の雛形）
  - `three-view.md`（三面図プロンプト雛形）
  - `expression-sheet.md`（表情差分プロンプト雛形）
  - `world-building.md`（world.md の雛形）
  - `log-entry.md`（log.md の1エントリ雛形）
- **FR-TPL-03**: Template の展開は `forge new`（推奨）または手動コピー。

### 5.8 Integrations (FR-INT)

- **FR-INT-01**: 外部連携は `integrations/` 配下の markdown ドキュメントとして定義する。コードではなく**手順書**とする（エージェントが読んで実行する）。
- **FR-INT-02 (v1.1)**: v1.1 で定義する連携:
  - `integrations/source-to-character.md`（**歴史・知識系の本流**: source → makimono → Shitate → image generation）
  - `integrations/prompt-compile.md`（**CLI fallback** の手動コンパイル手順。標準は `pnpm forge compile`）
  - `integrations/image-to-character.md`（画像からの逆フロー）
  - `integrations/makimono.md`（知識層との接続）
  - `integrations/pixverse-pipeline.md`（PixVerse 生成スキルへの受け渡し）
  - `integrations/remotion.md`（Remotion へのアセット受け渡し）
  - `integrations/tsugite.md`（compile run・選定済みanchorをlock付きsnapshotとしてTsugiteへ受け渡し）
  - `integrations/chatgpt-image.md`（**Codex / ChatGPT 向け**静止画、user-gated）
  - `integrations/nano-banana.md`（**Claude Code 向け**静止画、user-gated）
- **FR-INT-03**: 各連携ドキュメントは以下のセクションを持つ:
  - 前提条件（必要なツール・パス・環境変数）
  - 入力仕様（Shitate 側で準備すべきファイル）
  - 出力仕様（連携先に渡される形・パス）
  - 実行手順（エージェントが追える粒度）
  - 失敗時のリカバリ
- **FR-INT-04 (v1.1)**: 静止画ルートはランタイム別。グローバルな「唯一の標準ルート」は定義しない。

### 5.9 Prompt Compile (FR-COMPILE) — v1.1 更新

Shitate は「プロンプトを考える場所」であり、分割管理しているプロンプトソース
（base.md + variant.md + lexicon 断片）を画像生成ツールに渡せる **完全展開済みテキスト** に
結合する機能を持つ。

- **FR-COMPILE-01**: compile 成果物は `outputs/<run-id>/prompt.txt` と `outputs/<run-id>/negative.txt`。
- **FR-COMPILE-02**: 結合順序は **base → variant → lexicon**。詳細は [docs/schemas/compile.md](docs/schemas/compile.md)。
- **FR-COMPILE-03**: `outputs/<run-id>/manifest.json` に `compiled_prompt` / `compiled_negative` フィールドを同梱し、
  prompt.txt / negative.txt と同内容を持つ（再現情報の冗長化）。
- **FR-COMPILE-04**: **画像生成を伴わない単独 compile** をサポートする。`run_id` 末尾に `_compile` サフィックスを付け、
  `tool: "prompt-compile"`, `outputs: []` として登録する。
- **FR-COMPILE-05 (v1.1)**: compile の **参照実装かつ標準実行手段** は `pnpm forge compile`
  （`scripts/forge/lib/compile.ts`）。`integrations/prompt-compile.md` は CLI 不能時の fallback。
- **FR-COMPILE-06**: compile 結果が正本で、会話内で再結合した即席プロンプトは正本とみなさない
  （drift の防止）。
- **FR-COMPILE-07 (v1.1)**: 結合順・negative dedup・run_id 採番は unit テストで固定する。

### 5.10 Image-to-Character (FR-REVERSE) — v1.0 追加

既存の参照画像 1 枚から Shitate の骨組みを逆方向に書き起こす機能。

- **FR-REVERSE-01**: 逆フローは `integrations/image-to-character.md` に定義する。
- **FR-REVERSE-02**: 3 モードをサポートする:
  - **new-character**: 画像から新規キャラ骨組み一式
  - **reference-addition**: 既存キャラへの参照画像追加 + プロンプト改善提案
  - **variant-seed**: 既存キャラの新バリアントの起点
- **FR-REVERSE-03**: 入力は任意の画像絶対パス（`inbox/` のような固定ドロップ先は作らない）。
- **FR-REVERSE-04**: 逆フローは **画像生成を伴わない**。既存画像の **観察** から骨組みを書き起こすところまでが役割。
- **FR-REVERSE-05**: `references/sources.yaml` に `role: seed` で入力画像を登録する（新 role 追加、§7.7）。
- **FR-REVERSE-06**: 画像から読み取れない情報（名前・背景・性格等）は推測せず、`log.md` に脚色として明記する。

### 5.11 Source-to-Character Workflow (FR-SOURCE-TO-CHARACTER) — v1.1 更新

「資料 → wiki → キャラクター化」のパイプラインを end-to-end のナビゲーションとして定義する。
**適用範囲は歴史・知識系キャラ**（マスコット・オリジナル系は (a) 素テキストルートが第一級）。

- **FR-S2C-01**: 本ワークフローは `integrations/source-to-character.md` に定義する。
- **FR-S2C-02**: ワークフローは 8 Step 構成:
  1. Step 1: 資料を makimono に投入（Shitate 関与せず）
  2. Step 2: makimono で wiki 化（Shitate 関与せず）
  3. Step 3: entity の存在確認
  4. Step 4: entity を読み視覚情報を抽出
  5. Step 5: キャラ骨組みを書く（`forge new` 可）
  6. Step 6: compile（FR-COMPILE）
  7. Step 7: ユーザーに提示、判断を待つ（ここで一旦停止）
  8. Step 8: ユーザー明示指示後、ランタイム別画像生成で実生成
- **FR-S2C-03**: Step 1-2（上流側）は Shitate の責務ではない。makimono に委譲する。
- **FR-S2C-04**: entity が makimono に存在しない場合、`integrations/makimono.md` の「entity 欠落時の対処」に従い、
  **Shitate を先行させない**（makimono 側で entity を追加してから Shitate 作業に進む）。
- **FR-S2C-05**: Step 7 で既定モード（prompt factory）による停止ポイントを設ける。Step 8 に進むにはユーザー明示指示が必要。

### 5.13 Forge CLI / Studio / CI (FR-TOOLING) — v1.3 更新

- **FR-TOOL-01**: `scripts/forge/` に CLI を置き、少なくとも status / doctor / compile / new / index / lint を提供する。
- **FR-TOOL-02 (v1.2)**: Studio v0.2（`pnpm studio`）は CLI と同じ lib を使い、新規キャラ作成、base / variant 編集、log 追記、compile dry-run / 保存を提供する。
- **FR-TOOL-03 (v1.2)**: CI は unit、API integration、Chromium E2E、production dependency audit、typecheck、lint、doctor、compile の決定性を検証する。
- **FR-TOOL-04**: `forge new <id>` は templates から骨組みを生成し、INDEX の Characters 表を同期できる。
- **FR-TOOL-05 (v1.3 更新)**: mutation は `SHITATE_ROOT` 内の許可されたテキスト成果物と選定済み anchor 画像だけを変更し、画像・動画生成を起動しない。旧 `CHARACTER_FORGE_ROOT` も移行互換として受理する。
- **FR-TOOL-06 (v1.2)**: prompt GET は内容由来の revision を返す。保存時に revision が一致しなければ HTTP 409 とし、既存内容を上書きしない。
- **FR-TOOL-07 (v1.2)**: prompt 保存は同一ディレクトリの一時ファイルから atomic rename し、compile 保存は既存 run ID を上書きせず `_r<N>` を採番する。
- **FR-TOOL-08 (v1.3 更新)**: mutation API は Studio 専用ヘッダーを要求する。通常 mutation は JSON、anchor 登録は multipart/form-data とし、character ID、variant / anchor ID、入力サイズ、schema / media type を検証する。
- **FR-TOOL-09 (v1.2)**: base の主要改訂では history と `base_version` を同期し、軽微な変更では同じ version を維持できる。
- **FR-TOOL-10 (v1.3)**: Studio はユーザーが選定した JPEG / PNG / WebP（5 MiB 以下）を新規 anchor として登録できる。画像生成は起動しない。
- **FR-TOOL-11 (v1.3)**: anchor upload は MIME と magic bytes を照合し、サーバー側で `<anchor-id>-anchor.<ext>` を生成する。既存 anchor ID・既存 path は HTTP 409 とし上書きしない。
- **FR-TOOL-12 (v1.3)**: anchor 登録は画像実体、`references/sources.yaml`、`log.md`、`INDEX.md` の同期を一操作として扱い、途中失敗時は元状態へ戻す。

### 5.12 Negatives Lexicon (FR-NEGATIVES-LEXICON) — v1.0 追加

再利用可能なネガティブプロンプト断片を辞書化し、variant 作成時の執筆ガイドとする。

- **FR-NEG-01**: `lexicon/negatives.md` に共通ネガティブプリセットを記述する。
- **FR-NEG-02**: エントリ形式は positive lexicon（§7.5）と似るが、`**プロンプト断片**:` の代わりに
  `**ネガティブ断片**:` を使う。
- **FR-NEG-03**: **compile には自動組み込みしない**（v1.0 時点）。variant 作成者が必要な断片を手動でコピーして
  variant の `## ネガティブプロンプト` コードブロックに貼る運用。
- **FR-NEG-04**: 新エントリ追加の条件: **2 キャラ以上 or 2 variant 以上で実績がある** パターンのみを昇格する
  （1 回限りの観察は variant 側に留める）。
- **FR-NEG-05**: 将来的に compile への自動組み込みを §4.5 ルール拡張で検討する（§14 Q7 新設）。

---

## 6. 非機能要件

### 6.1 単体完結性 (NFR-STANDALONE)

- 外部ツール・外部リポが存在しなくても、`characters/` と `lexicon/` と `templates/` だけでキャラを定義・改善できること。
- `integrations/` は任意機能として扱い、このディレクトリを削除しても本体は動作する。

### 6.2 可読性 (NFR-READABLE)

- すべての正本データはプレーンテキスト（markdown / yaml / json）とする。
- 人間と LLM の双方が直接読める構造を優先する。
- バイナリは references/ と outputs/ に限定する。

### 6.3 バージョン管理親和性 (NFR-VCS)

- 小さなテキストファイルを多数配置する設計とし、diff が読みやすい形を保つ。
- 生成物の実ファイルは `.gitignore` 対象とし、manifest + サムネイルで履歴を残す。
- ベースプロンプトの主要改訂は `history/` への物理コピーで保存し、Git 履歴に依存しない再現を可能にする。

### 6.4 拡張性 (NFR-EXT)

- キャラの追加・Lexicon エントリの追加は既存ファイルの変更を要さない（追記型）。
- Integration の追加は `integrations/` にファイル1枚追加するだけで完結する。
- 新しいバリアント種別（例: 四季差分）は `prompts/variants/` に新規ファイルを追加するだけで導入できる。

### 6.5 自己記述性 (NFR-SELF)

- リポルートの `AGENTS.md` を読めば、エージェントが**追加のコンテキスト無しに**このリポで作業を開始できる。CLAUDE.md は Claude Code 差分のみ。
- 各キャラの `index.md` を読めば、そのキャラの現状と次の一歩が分かる。

### 6.6 冪等性 (NFR-IDEMPOTENT)

- 同じ run_id での再実行は manifest を上書きしない（`_r2` 等で新 run とする）。
- Template 展開は既存ファイルを破壊しない（存在チェック必須）。

### 6.7 レイヤー構造 (NFR-LAYERED) — v1.0 追加

Shitate は単独完結するが、本来の運用では `~/makimono/` の下流の視覚化層として機能する。

```
raw sources (YouTube / PDF / 講義 / 書籍 / インタビュー / Drive)
    ↓   投入
NotebookLM / 手動収集 / その他
    ↓   wiki 化
~/makimono/            (knowledge wiki — entities / concepts / sources)
    ↓   read-only 参照
Shitate        (このリポ)
    ↓   compile → prompt.txt
ChatGPT built-in image generation / external generator
```

- **Shitate は makimono を read-only で参照する**（§5.11 FR-S2C-04）。
- **NotebookLM / Google Drive への接続は makimono の責務** であり、Shitate は直接触らない。
- 必要な entity が makimono に存在しない場合、**まず makimono 側に追加する**（Shitate を先行させない）。
- Shitate から画像生成への受け渡しは `integrations/` 配下の手順書を介する（§5.8）。
- 情報の逆方向流れ（Shitate → makimono）は任意の後方リンクとしてのみ存在し、必須ではない。

### 6.8 ローカル書き込み安全性 (NFR-LOCAL-MUTATION) — v1.2 追加

- Studio API は loopback host を既定とし、外部サービスへデータを送信しない。
- すべての書き込み先を `SHITATE_ROOT` 内へ限定し、path traversal を拒否する。旧 `CHARACTER_FORGE_ROOT` は互換入力としてのみ扱う。
- prompt 編集は revision による楽観ロックと atomic rename を使い、競合・途中書き込みで正本を壊さない。
- E2E は毎回一時 fixture workspace を初期化し、実リポジトリのキャラ・run・INDEX を変更しない。
- 自動バックアップファイルは作らない。履歴は prompt history、run の非上書き、Git で管理する。

---

## 7. データモデル

### 7.1 `characters/<id>/index.md` frontmatter

```yaml
---
id: washi-fox                     # 必須, kebab-case
name: 和紙狐                       # 必須, 表示名
role: 物語の案内役                 # 必須, 役割
status: draft                     # 必須, draft|experimental|stable
base_version: v1                  # 必須, 現行 base のバージョン
created: 2026-07-17               # 必須, 作成日
updated: 2026-07-17               # 必須, 最終更新日
source_entities: []               # 任意, makimono 参照
world_refs: []                    # 任意, 世界観参照
relations: []                     # 任意, 他キャラ
tags: [sample, mascot, washi, fox]
---
```

### 7.2 `characters/<id>/log.md` エントリ

```markdown
## 2026-07-17 / base v1 / three-view

- **試行**: 画像なしの操作サンプルとして三面図用 variant を追加。
- **プロンプト差分**: [three-view](prompts/variants/three-view.md)
- **生成物**: なし（compile のみ）
- **評価**: —
- **次の改善**: compile 結果を読み、初心者にも意図が伝わるか確認する。
```

### 7.3 `outputs/<run-id>/manifest.json`

```json
{
  "run_id": "20260717_three-view_v1_compile",
  "character": "washi-fox",
  "base_version": "v1",
  "base_sha": "a1b2c3d4",
  "prompt_file": "prompts/variants/three-view.md",
  "lexicon_used": [
    "lexicon/styles.md#ukiyo-e-edo",
    "lexicon/lighting.md#golden-hour",
    "lexicon/camera.md#three-quarter-orthographic"
  ],
  "references": [],
  "source_entities": [],
  "tool": "prompt-compile",
  "tool_version": "<repo version>",
  "seed": null,
  "compiled_prompt": "<§5.9 FR-COMPILE により展開された正本プロンプト。prompt.txt と同内容>",
  "compiled_negative": "<展開された正本ネガティブ。negative.txt と同内容>",
  "outputs": ["front.png", "side.png", "back.png"],
  "thumbnails": ["thumb_front.png", "thumb_side.png", "thumb_back.png"],
  "evaluation": {
    "overall": "◎",
    "face_consistency": "◎",
    "outfit": "◎",
    "pose": "△",
    "notes": "正面カットのみ剣の握りに破綻"
  },
  "created_at": "2026-04-11T12:30:00+09:00",
  "created_by": "claude-code"
}
```

**v1.0 追加フィールド**:
- `compiled_prompt` / `compiled_negative` (FR-COMPILE-03): compile 済みプロンプトを文字列で同梱（再現情報の冗長化）
- `prompt-compile` 単独 run では `tool: "prompt-compile"`, `outputs: []`, `thumbnails: []` となる（FR-COMPILE-04）

### 7.4 `references/sources.yaml`

```yaml
references:
  - path: images/face-anchor.png
    role: anchor
    url: null
    notes: 顔固定用。表情ニュートラル、正面、4/4アングル。
    added: 2026-04-08
  - path: images/armor-anchor.png
    role: anchor
    url: https://example.com/kusunoki-armor-ref.jpg
    notes: 南北朝期の大鎧リファレンス。鈍金色の再現に使用。
    added: 2026-04-09
  - path: images/pose-guerrilla.png
    role: pose
    url: null
    notes: 低姿勢ゲリラ戦ポーズ参考。
    added: 2026-04-10
  - path: images/reference-photo.jpg
    role: seed
    url: null
    notes: image-to-character 逆フローの起点画像（FR-REVERSE）。
    added: 2026-04-11
```

**role 一覧（v1.0）**:
- `anchor`: 同一性固定用。必ずコミット（FR-REF-03）
- `style` / `pose` / `outfit` / `mood`: 補助参照
- `seed` **（v1.0 追加）**: 逆フローの起点画像（FR-REVERSE-05）
- `anchor-archive` **（v1.0 追加）**: 差し替え後の旧 anchor（docs/workflows/anchor-lifecycle.md 参照）

### 7.5 `lexicon/styles.md` エントリ形式

```markdown
## #ukiyo-e-edo

**用途**: 江戸後期の浮世絵風スタイル。
**プロンプト断片**:
```
ukiyo-e woodblock print, edo period, limited color palette,
flat shading, fine line work, traditional Japanese composition
```
**相性の良い Lexicon**:
- `lighting.md#rim-light-soft`
- `camera.md#low-angle-heroic`
**NG**:
- リアルな陰影表現
- 写真的被写界深度
```

---

## 8. ディレクトリ構成（v1.2）

```
shitate/
├── AGENTS.md                      # 全エージェント共通の操作正本
├── CLAUDE.md                      # Claude Code 固有差分（薄い）
├── README.md                      # 人間向け概要
├── REQUIREMENTS.md                # このファイル（v1.2）
├── INDEX.md                       # キャラ一覧 + entity 対応表
├── STABLE.md                      # status 昇格ルール
├── .npmrc
├── .gitignore
│
├── characters/
│   └── <character-id>/
│       ├── index.md
│       ├── world.md               # 任意
│       ├── prompts/
│       │   ├── base.md
│       │   ├── history/
│       │   └── variants/
│       ├── references/
│       ├── outputs/
│       └── log.md
│
├── lexicon/
│   ├── styles.md / lighting.md / camera.md / negatives.md
│   ├── clothing/                  # sk8-crew.md 等シリーズ断片含む
│   └── settings/
│
├── templates/
├── integrations/
│   ├── source-to-character.md     # 歴史・知識系の本流
│   ├── prompt-compile.md          # CLI fallback
│   ├── chatgpt-image.md           # Codex 静止画
│   ├── nano-banana.md             # Claude Code 静止画
│   └── ...
├── scripts/
│   ├── forge/                     # CLI（compile 参照実装）
│   ├── ci/
│   └── e2e/                       # 一時 fixture で Playwright を起動
├── e2e/                           # Studio の主要ユーザージャーニー
├── playwright.config.ts
└── studio/                        # v0.3 ローカル Web UI
```

**v1.1 主要変更**:
- AGENTS.md 正本化、CLAUDE.md 薄型化
- 静止画ランタイム別、forge CLI / Studio / CI を正式スコープ
- Q5 クローズ（`pnpm forge compile` が正本実行手段）

**v1.2 主要変更**:
- Studio v0.2 の安全な書き込みと楽観ロック
- API integration + 一時 workspace の Chromium E2E
- production dependency audit の CI ゲート

**v1.3 主要変更**:
- Studio v0.3 の選定済み anchor 登録と複合更新ロールバック
- MIME / magic bytes / サイズ / 重複 ID の upload gate
- GitHub Actions の Node 24 runtime 対応

---

## 9. ワークフロー

### 9.1 新規キャラ作成

1. キャラ ID を決定（kebab-case, ASCII）。
2. `templates/new-character.md` をコピーして `characters/<id>/index.md` を作成。
3. frontmatter を埋める（name, role, status=draft, base_version=v1）。
4. 関連する `makimono/entities/` を探し、`source_entities` に列挙。
5. `prompts/base.md`（= `prompts/history/base.v1.md`）を記述。
6. アンカー画像を `references/images/` に配置し、`sources.yaml` に登録。
7. `log.md` に作成エントリを追記。
8. 最初の生成を `integrations/` のいずれかの手順で実行。
9. 結果を評価し、`log.md` に追記。

### 9.2 プロンプト改善ループ

1. Claude Code は `log.md` の直近3エントリを読む。
2. 前回の「次の改善案」を踏まえて新しいプロンプト案を提示する。
3. ユーザーと合意したら、以下のいずれかを実施:
   - 軽微な変更: `prompts/variants/<variant>.md` を更新。
   - ベースの主要改訂: `prompts/history/base.v<N+1>.md` を新規作成し、`base.md` を差し替え、index.md の base_version を更新。
4. 生成を実行（`integrations/` 経由）。
5. 結果を評価し、`log.md` に新エントリを追記。
6. Lexicon に還元できる学びがあれば `lexicon/` を更新。

### 9.3 生成実行（外部ツール連携）

1. Claude Code が `integrations/<tool>.md` を読む。
2. Shitate 側から必要な入力（プロンプト + リファレンス）を収集。
3. 連携先に受け渡し（コピー or シンボリックリンク or パス参照）。
4. 実行完了後、結果を `outputs/<run-id>/` に整理。
5. manifest.json を生成。
6. log.md に追記。

### 9.4 振り返り・整理

1. `status: stable` に昇格するタイミングで、`log.md` に「安定版認定」エントリを追加。
2. 不要なバリアントを削除（log.md に削除理由を記録）。
3. Lexicon に還元できる知見を反映。

---

## 10. 連携仕様

### 10.1 makimono 連携（read）

- **参照方向**: Shitate → makimono（read-only）
- **連携方法**: `index.md` の `source_entities` に Obsidian 形式のリンクを記述。
- **解決ルール**:
  - `[[entities/kusunoki-masashige]]` → `~/makimono/entities/kusunoki-masashige.md` を実ファイルとして解決。
  - リンク切れは Claude Code が検出し警告する（`integrations/makimono.md` に手順）。
- **Claude Code の義務**:
  - キャラ設定に史実情報を使う場合、必ず `source_entities` のファイルを読んでから記述する。
  - 記述が一次情報と矛盾する場合、log.md に「意図的な脚色」として記録する。

### 10.2 makimono 連携（逆参照・任意）

- makimono 側の entity に、後方リンクとして `used_by: [shitate/<id>]` を追記できる。
- 必須ではないが、双方向参照により知識と表現の対応が追跡しやすくなる。

### 10.3 pixverse-character-pipeline 連携

- **連携方法**: 環境変数 `CHARACTER_FORGE_ROOT` で Shitate のルートを指定し、pipeline 側は `$CHARACTER_FORGE_ROOT/characters/<id>/` を入力として読む。
- **入力仕様**（pipeline が期待するもの）:
  - `prompts/base.md`
  - 対象バリアント（例: `prompts/variants/three-view.md`）
  - `references/images/` のアンカー画像
- **出力仕様**（pipeline が書き戻すもの）:
  - `outputs/<run-id>/*.png`（生成物）
  - `outputs/<run-id>/manifest.json`（pipeline が生成）
  - `outputs/<run-id>/thumb_*.png`（サムネイル、pipeline が生成）
- **詳細**: `integrations/pixverse-pipeline.md` に定義。

### 10.4 静止画生成連携（ランタイム別）

静止画はグローバル標準を1つに決めない。**ランタイム別**（いずれも user-gated）:

| ランタイム | 手順 | 詳細 |
|---|---|---|
| Codex / ChatGPT | チャット内 built-in image generation | `integrations/chatgpt-image.md` |
| Claude Code | Nano Banana MCP | `integrations/nano-banana.md` |

共通:
- 候補を複数生成し、ユーザーが選んだ画像だけをキャラ登録・anchor 化する
- 未採用画像はリポ正本にしない
- 結果を保存する場合は `references/images/` または `outputs/<run-id>/` にコピーし、manifest を更新する

### 10.5 Remotion 連携

- キャラの生成アセットを動画編集に流し込む経路。
- `outputs/` 配下の画像・動画を Remotion プロジェクトの `public/` に集約する手順。
- 詳細: `integrations/remotion.md`。

### 10.5.1 Tsugite 連携

- **参照方向**: Tsugite → Shitate（import時のみread）
- **連携方法**: Tsugiteの `character-import` がcompile run、選定済みanchor、forge manifestを
  Tsugite project内へコピーし、SHA-256付き `character-lock.json` を作る。
- 外部pathの直接参照やsymlink共有は使わず、project内snapshotをmanifestの `images[]` / `speakers[]` と
  任意のI2V generation requestへ割り当てる。
- 同一snapshotはno-op、内容差分・ID衝突・checksum不一致は上書きせず停止する。
- `negative.txt` は保存するが、連携先adapterが明示対応しない限りrequestへ自動適用しない。
- 詳細: `integrations/tsugite.md`。

### 10.6 source-to-character ワークフロー (v1.1)

- **適用**: 歴史・知識系キャラの本流（マスコット系は (a) 素テキスト）。
- **流れ**: source → makimono → Shitate → image generation。
- **参照方向**: makimono への read-only 参照を前提。
- **Step 1-2**: Shitate 関与せず。makimono の責務。
- **Step 3-7**: Shitate 側（entity 確認 → 視覚情報抽出 → 骨組み → compile → 提示で停止）。
- **Step 8**: ユーザー明示指示後、静止画はランタイム別、動画は PixVerse。
- 詳細: `integrations/source-to-character.md`。

### 10.7 Prompt Compile (v1.1)

- **独立した手順**: 画像生成を伴わない compile 実行（FR-COMPILE-04）。
- **入力**: base.md + 対象 variant.md + lexicon 参照。
- **出力**: `outputs/<run-id>_compile/prompt.txt` + `negative.txt` + `manifest.json`。
- **結合順序**: base → variant → lexicon（docs/schemas/compile.md）。
- **標準実行**: `pnpm forge compile`。手動 fallback: `integrations/prompt-compile.md`。

### 10.8 Image-to-Character 逆フロー (v1.0)

- **参照方向**: 任意の画像絶対パスを入力。
- **3 モード**: new-character / reference-addition / variant-seed（FR-REVERSE-02）。
- **原則**: 画像生成を **行わない**。既存画像の観察から骨組みを書き起こすところまで。
- **出力**: character 骨組み + seed 画像コピー + log.md の脚色ノート。
- 詳細: `integrations/image-to-character.md`。

---

## 11. 制約とリスク

### 11.1 制約

| ID | 制約 | 理由 |
|---|---|---|
| C-01 | 生成実行はこのリポでは行わない | 単体完結と実行層の疎結合のため |
| C-02 | バイナリは outputs と references に限定 | Git リポサイズを抑えるため |
| C-03 | キャラID は ASCII kebab-case | ファイルシステム・スクリプト互換性 |
| C-04 | ベース改訂は物理コピーで history に保存 | Git履歴に依存しない再現性のため |

### 11.2 リスク

| ID | リスク | 影響 | 緩和策 |
|---|---|---|---|
| R-01 | 外部ツール（pixverse skill）の仕様変更 | 連携が壊れる | `integrations/` をアダプタ層として分離、tool_version を manifest に記録 |
| R-02 | log.md がフリーフォーム化し読めなくなる | 育成ループが機能しない | §7.2 のスキーマを AGENTS.md で強制、エージェントが書く際は必ずスキーマ準拠 |
| R-03 | base のバージョンが爆発的に増える | 管理不能 | 主要改訂のみ history 化、draft は base.md の Git 履歴で十分 |
| R-04 | makimono の entity がリネーム・削除される | source_entities がリンク切れ | Claude Code が定期的に解決性をチェック、log.md に警告 |
| R-05 | 大量のリファレンス画像で gitリポが肥大化 | clone が遅い | anchor 以外は gitignore、LFS は使わない |
| R-06 | Lexicon と Templates の区別が曖昧になる | 再利用性低下 | Lexicon = 素材、Template = スケルトンの定義を README で明記 |
| R-07 | Studio・エディタ・複数エージェントから同時書き込み | 更新消失 | prompt は revision 競合で停止し再読込・統合。log は追記、run は非上書き |
| R-08 | Studio をLANへ公開する | 意図しないローカルファイル変更 | loopback bind を既定とし、認証なしの公開運用は対象外 |

---

## 12. 受け入れ基準 (v1.2)

### v1.0 から継続

1. ✅ リポジトリ骨組みが作成され、REQUIREMENTS / INDEX / STABLE が存在する
2. ⚠ 最低1体のキャラクターが `status: stable`（継続課題。experimental キャラは複数）
3. ✅ 歴史系キャラの `source_entities` が makimono entity に解決可能
4. ✅ base.md とバリアントが記述されている
5. ✅ 主要キャラに anchor と sources.yaml がある（draft で anchor 未設置は許容し INDEX / index に明記）
6. ✅ 生成 / compile 結果が manifest に記録されている
7. ⚠ 安定化エントリ（stable 昇格）は未達キャラあり
8. ✅ エージェントが log を参照して改善提案できる運用になっている
9. ✅ PixVerse / 静止画 / Remotion の受け渡し手順書がある
10. ✅ lexicon に styles / lighting / camera がある
11. ✅ templates から新規キャラを作成できる

### v1.1 追加

12. ✅ **AGENTS.md が共通正本**、CLAUDE.md は薄いランタイム差分のみ
13. ✅ 静止画が **ランタイム別**（chatgpt-image / nano-banana）で文書化され、いずれも user-gated
14. ✅ `pnpm forge compile` が compile の参照実装であり、prompt-compile.md は fallback
15. ✅ forge CLI（status / doctor / compile / new / index / lint）が動作する
16. ✅ Studio v0.1（当時の read-only UI）が起動できる
17. ✅ CI が compile snapshot / diff を検証できる
18. ✅ compile lib の unit テスト（dedup・結合順・run_id）がある
19. ✅ マスコット系は (a) 素テキストを第一級ルートとして運用できる（例: SK8 芝犬クルー）
20. ✅ シリーズ共通衣装を lexicon で共有できる（例: `lexicon/clothing/sk8-crew.md`）

### v1.2 追加

21. ✅ Studio v0.2 で新規キャラ作成、base 編集、variant 作成・編集、log 追記を行える
22. ✅ compile の dry-run と保存を明確に分け、保存後の run をブラウザで確認できる
23. ✅ mutation は許可されたローカルパスだけを atomic に変更し、画像生成を起動しない
24. ✅ prompt の同時更新は revision 競合として検出し、既存変更を上書きしない
25. ✅ 一時 `SHITATE_ROOT` 上の Chromium E2E が主要ジャーニーを通し、実リポジトリを汚さない
26. ✅ unit / API integration / mutation coverage 80% / E2E / typecheck / lint / doctor / compile smoke が CI で実行される
27. ✅ `pnpm audit --prod` が既知脆弱性なしで完了し、CI は high severity を拒否する

### v1.3 追加

28. ✅ Studio v0.3 で選定済み anchor を安全に新規登録できる
29. ✅ anchor 登録が `sources.yaml`・`log.md`・`INDEX.md` を同期し、失敗時に部分更新を残さない
30. ✅ upload の形式・サイズ・magic bytes・重複を API integration と Chromium E2E で検証する
31. ✅ GitHub Actions が Node 24 対応 major で警告なく動作する

**未達項目の対応**: STABLE.md の criteria を参照し、段階的にキャラを stable 昇格させる。

---

## 13. 段階的な実装計画

### Phase 1: 骨組み（1日）

- リポジトリ初期化
- `CLAUDE.md`, `README.md`, `.gitignore` 作成
- ディレクトリ構造の空作成
- `templates/` 5ファイル作成
- `lexicon/` の最小エントリ（styles/lighting/camera 各1）

### Phase 2: 操作用サンプル（1日）

- `washi-fox` を画像なしのサンプルとして作成
- base.v1 と three-view variant を記述
- compile を実行してテキスト成果物を確認
- log.md に最初のエントリ

### Phase 3: 連携（1日）

- `integrations/makimono.md` 作成
- `integrations/pixverse-pipeline.md` 作成
- `integrations/chatgpt-image.md` 作成
- `integrations/nano-banana.md` 作成（fallback）
- 実際に1サイクル（改善ループ）を回して動作確認

### Phase 4: 定着（継続）

- 2体目以降のキャラを追加するたびに template / lexicon を改善
- log.md の書き方を洗練
- Remotion 連携を追加
- v2 機能（worlds, scenes, relations 可視化）を検討

---

## 14. 未決事項（要議論）

以下は実装前に決める必要がある:

1. **Q1**: `base.md` は `history/base.v<N>.md` のシンボリックリンクにするか、物理コピーにするか？
   - シンボリックリンク: diff が綺麗、履歴追跡が明確
   - 物理コピー: Git 管理が単純、link 解決の罠がない
   - **暫定案**: 物理コピー（Macのファイル操作の単純さ優先）

2. **Q2 — クローズ (v1.2、2026-07-14 改名追従)**: `SHITATE_ROOT` 環境変数の扱い
   - **決定**: 未指定時は実リポジトリルート、指定時はその絶対パスを CLI / Studio 共有ルートとして使う
   - 旧 `CHARACTER_FORGE_ROOT` は互換用fallbackとして受理し、両方ある場合は `SHITATE_ROOT` を優先する
   - E2E は必ず一時ディレクトリを指定し、実データへの副作用を防ぐ

3. **Q3**: リポジトリを Obsidian vault としても開けるようにするか？
   - `.obsidian/` を含めると makimono と同じ感覚で編集可能
   - ただし vault 化すると Obsidian 固有の挙動に引きずられる
   - **暫定案**: v1 では vault 化しない。markdown + Obsidian の `[[]]` 記法だけ借りる。

4. **Q4**: キャラ間の関係グラフ（relations）の格納位置
   - 各キャラの index.md に分散 vs トップレベルに `relations.yaml`
   - **暫定案**: v1 は index.md に分散。v2 で集約を検討。

5. **Q5 — クローズ (v1.1)**: compile 自動化を実装するか？
   - **決定**: TypeScript の `scripts/forge/`（`pnpm forge compile`）を参照実装・標準実行手段とする
   - 手動手順 `integrations/prompt-compile.md` は CLI 不能時の fallback
   - Python `scripts/compile.py` 案は採用しない（CLI が既に決定性を担保）

6. **Q6**: `outputs/` の保持期限
   - 無限に貯めると容量爆発、削除ルールが必要
   - **暫定案**: v1 は手動削除。30日以上古い実ファイルは log.md に記録の上削除可能（manifest は残す）。

7. **Q7 (v1.1 更新)**: `lexicon/negatives.md` を compile に自動組み込みするか？
   - **現状**: 執筆ガイドとして手動運用（FR-NEG-03）
   - **昇格の利点**: DRY、一括変更が容易
   - **昇格の欠点**: compile ルールの surface area 拡大
   - **暫定案**: 手動運用のまま。必要になったら docs/schemas/compile.md を先に拡張してから実装

---

## 15. 参考

- `~/makimono/CLAUDE.md`（Knowledge-LM の運用方針）
- `~/.claude/rules/common/agents.md`（Agent Orchestration）
- `~/Projects/Pixverse-Workflow/pixverse-character-pipeline/SKILL.md`
- `~/.claude/projects/-Users-takamasa/memory/MEMORY.md`
