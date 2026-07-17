# Integration: image-to-character（画像 → キャラクター逆変換）

参照画像 1 枚から **Shitate の骨組み一式（index.md / world.md / base.md / variant / log）** を
逆方向に書き起こす手順。通常フロー（prompt → 画像）とは逆向きで、
「既にある画像を起点にそのキャラクターを forge に取り込む」用途。

> **重要**: この手順は **画像生成を一切行わない**。既存画像を **観察** して
> 世界観・キャラ設定・プロンプトを **提案** するところまでが役割。
> 提案後の画像生成はユーザー明示指示があってから、ランタイム別手順（AGENTS.md §8.1）で行う。
> Shitate の既定モード（AGENTS.md §0.2 の prompt factory）に従う。

主な使用場面:

- 既存のコンセプトアート・写真・他ツールで生成した画像を新規キャラ化する
- 気に入った 1 枚が手元にあり、そこから同一性を保って再生成したい（提案まで）
- 既存キャラに新しいリファレンス画像を追加し、プロンプトの微調整提案を得る

---

## 前提条件

- 解析する画像の **絶対パス** が分かっていること（`inbox/` のような固定ドロップ先は作らない設計）
- Claude Code が画像を Read できる環境（multimodal）
- AGENTS.md §4 のプロンプトスキーマ、§4.5 のコンパイルルールを読み込んでいること
- 新規キャラの場合: 仮のキャラ ID 案（kebab-case, ASCII）
- 既存キャラに追加する場合: 対象キャラ ID が決まっていること

---

## 入力仕様

- **画像ファイル 1 枚**（.png / .jpg / .webp 等、絶対パスで指定）
- 任意のコンテキスト情報（時代設定、役割、ユーザーが設定したい要素）
- 任意の「モード」指定:
  - **new-character モード**: この画像から新規キャラを作る
  - **reference-addition モード**: この画像を既存キャラの新しい参照として追加
  - **variant-seed モード**: 既存キャラの新しいバリアントの起点にする

---

## 出力仕様

### new-character モード

`characters/<new-id>/` に以下を **書き起こす**（画像生成は行わない）:

- `index.md` — frontmatter + Visual Core + 概要（画像から読み取った情報で埋める）
- `prompts/base.md` + `prompts/history/base.v1.md`（物理コピー、FR-PROMPT-04 スキーマ準拠）
- `prompts/variants/three-view.md`（画像から観察した構図で初期化）
- `references/sources.yaml`（入力画像を `role: seed` として登録）
- `references/images/<seed-filename>`（元画像をコピー）
- `log.md`（初回エントリに「画像からの逆書き起こし」と明記）
- `outputs/.gitkeep`

続けて `integrations/prompt-compile.md` の手順で `outputs/<run-id>_compile/prompt.txt` を出し、
ユーザーに提案内容を見せる。画像の **再生成** はユーザーの明示指示があってから。

### reference-addition モード

- 画像を `characters/<id>/references/images/<descriptive-name>.<ext>` にコピー
- `references/sources.yaml` に追記（`role: style | pose | outfit | mood` のどれか、anchor ではない）
- 画像から読み取れる「現行プロンプトに追加すべき要素」を提案（変更は適用しない、ユーザー承認待ち）
- `log.md` に「リファレンス追加 + 分析」エントリ

### variant-seed モード

- `prompts/variants/<new-variant>.md` を新規作成（FR-PROMPT-04 スキーマ準拠）
- 画像から推測した構図・ポーズ・雰囲気を `## メモ` に記録
- 画像を `references/images/<variant>-seed.<ext>` にコピーし sources.yaml に `role: seed` で登録
- 必要なら compile し `outputs/<run-id>_compile/prompt.txt` まで出す

---

## 実行手順

### 0. 画像の読み込みと観察

1. 入力画像の絶対パスを受け取る
2. **Read ツールで画像を読み込む**（Claude の multimodal で視覚的に見る）
3. 以下を観察しメモする:
   - 被写体の性別・推定年齢・表情・姿勢
   - 服装・装備・小物・色の対比
   - 髪型・顔の特徴（痣・傷・印など）
   - 時代・文化圏の手がかり
   - 背景・光源・構図
   - アートスタイル（ukiyo-e / watercolor / 写実 / アニメ等）
4. 画像から読み取れない情報は推測しない（例: 名前・性格・物語背景は画像に現れない）

### 1. モードの決定

ユーザー指示から以下を判定:

- 「新しいキャラ」「このキャラを forge に入れて」→ **new-character**
- 「このキャラにこの画像を参照として追加」「この雰囲気のバリアントを作って」→ **reference-addition** or **variant-seed**
- 指示が曖昧なら **new-character** を既定にして確認

### 2a. new-character モードの出力手順

1. キャラ ID を決定（ユーザー提示 or 画像から推測、ASCII kebab-case）
2. 既存 `characters/<id>/` が無いことを確認（NFR-IDEMPOTENT: 上書き禁止）
3. ディレクトリ構造を作成:
   - `characters/<id>/prompts/history/`
   - `characters/<id>/prompts/variants/`
   - `characters/<id>/references/images/`
   - `characters/<id>/outputs/`
4. 元画像を `characters/<id>/references/images/seed.<ext>` にコピー
5. `index.md` を作成:
   - frontmatter: `status: draft`, `base_version: v1`, `created: <today>`, `tags: [seed-from-image, ...]`
   - 本文: 画像から読み取れた Visual Core を埋める
   - `source_entities` は不明な場合は空配列（後で手動追加推奨）
   - `## 概要` には「この index は画像 `references/images/seed.<ext>` からの逆書き起こしである」旨を明記
6. `prompts/base.md` を作成:
   - `## 本文プロンプト` コードブロックに画像観察から組み立てた英語プロンプトを書く
   - スタイル・服装・顔の特徴・持ち物を具体的に
   - `## ネガティブプロンプト` は一般的な土台（`text, watermark, signature, multiple characters`）+ 画像のスタイルに合わせた禁止事項。`lexicon/negatives.md` の既存エントリも参考に
   - `## Lexicon 参照` は既存 lexicon から近いエントリを選んで列挙
7. `prompts/history/base.v1.md` に `base.md` を物理コピー
8. `prompts/variants/three-view.md` を `templates/three-view.md` から展開して具体化
9. `references/sources.yaml` に seed 画像を登録:
   ```yaml
   references:
     - path: images/seed.<ext>
       role: seed
       url: null
       notes: 逆書き起こしの起点となった入力画像。<絶対パス> からコピー。
       added: <YYYY-MM-DD>
   ```
10. `log.md` の初回エントリを作成:
    - 試行: 「画像 `<入力パス>` からの逆書き起こし」
    - 観察: 画像から読み取れた要素
    - 脚色: 画像に無いが設定として追加した要素（あれば）
    - 次の改善: ユーザーと一緒に base.md と compile 済み prompt.txt を吟味。精度検証のための画像生成は **ユーザーの明示指示があってから**
11. `integrations/prompt-compile.md` の手順で `outputs/<run-id>_compile/prompt.txt` まで出し、ユーザーに提示
12. **ここで一旦止まる**。画像生成はユーザーが指示してから

### 2b. reference-addition モードの出力手順

1. 対象キャラ `<id>` の `index.md` と `log.md` 直近3エントリを先に読む
2. 元画像を `characters/<id>/references/images/<descriptive-name>.<ext>` にコピー
3. `references/sources.yaml` に追記:
   - `role` は anchor ではなく `style | pose | outfit | mood | seed` のどれか
   - anchor は既存の同一性固定用のみ。新規画像が anchor を置き換える場合は log.md で明記してから
4. 画像から現行 base.md との差分を抽出（画像に含まれるがプロンプトに無い要素、その逆）
5. 差分をまとめた「現行プロンプトへの追加提案」を log.md に記録（**ファイル変更は適用しない**、ユーザー承認を待つ）
6. 承認後、base v<N+1> or variant として反映

### 2c. variant-seed モードの出力手順

1. 対象キャラ `<id>` の index / log / base.md を先に読む
2. 新しい variant 名を決定（例: `poses-combat.md`, `scenes/shrine-ritual.md`）
3. 既存 variant と衝突しないことを確認
4. `prompts/variants/<new-variant>.md` を作成:
   - 本文プロンプトは画像観察 + base.md との差分で構成
   - ネガは既存 variant を参考に
   - Lexicon 参照は画像の雰囲気に合うものを選ぶ
   - `## メモ` に「この variant は画像 `<path>` からの逆生成」と明記
5. 元画像を `references/images/<variant>-seed.<ext>` にコピー、sources.yaml に `role: seed` で登録
6. 必要なら compile → 生成 → 評価の通常フローへ

### 3. 共通: 最終確認

1. 生成した index / base / variant をユーザーに提示
2. 脚色部分（画像に明示的でない推測）を明示
3. 承認後、必要なら `integrations/prompt-compile.md` で prompt.txt まで進める

---

## 失敗時のリカバリ

| 症状 | 原因 | 対処 |
|---|---|---|
| 画像から読み取れる情報が少なすぎる（小さすぎ/ボケ/遠景） | 画像の情報量不足 | ユーザーに別画像 or より近接な画像を要求。推測で埋めない |
| スタイルが既存 lexicon と合わない | 新しい美術スタイル | `lexicon/styles.md` に新エントリを追加してから使う |
| 推測した設定がユーザーの意図と違う | 情報不足 | 脚色ノートとして log.md に残し、ユーザーと合意のうえ修正 |
| 既存キャラに似た画像を new-character で取り込みそうになった | ID 衝突チェック漏れ | 先に `characters/` を ls して重複確認、近い場合は reference-addition モードを提案 |
| anchor と seed の区別を誤って上書き | 役割（role）管理不足 | seed 画像は anchor として扱わない。`role: seed` で登録、必要なら後で別 run から anchor を派生生成 |
| 複数キャラが 1 枚に写っている | 想定外の入力 | 主要人物 1 名を指定させるか、画像を事前にクロップしてもらう |
| 画像のスタイルが現行キャラ群と不整合（例: 写実写真 vs ukiyo-e） | キャラ横断の美術統一性 | new-character モードで新規キャラとして独立させる。既存キャラへの reference-addition はスタイル衝突で避ける |
