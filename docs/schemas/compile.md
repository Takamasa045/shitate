# Compile Spec — prompt compile の正式仕様

**このファイルが compile の唯一の仕様書である**。
AGENTS.md §4.5 / `integrations/prompt-compile.md`（CLI fallback）は要約・手順であり、
**食い違いが出たらこのファイルを正**とする。

CLI (`forge compile`) および手動 compile はこの仕様に従うこと。

---

## 1. 入力

compile は以下の3種のソースを受け取る:

| ソース | パス | 役割 |
|---|---|---|
| base | `characters/<id>/prompts/base.md` | キャラの視覚的同一性（常に先頭） |
| variant | `characters/<id>/prompts/variants/<variant-path>.md` | 差分（base の直後） |
| lexicon fragments | `lexicon/<cat>.md#<slug>` (複数) | variant が参照する断片（末尾） |

### 1.1 variant path

variant は階層を許容する。例:

- `three-view` → `prompts/variants/three-view.md`
- `scenes/mountain-ambush` → `prompts/variants/scenes/mountain-ambush.md`

CLI 引数では `/` 区切りで渡す（例: `forge compile sample-character scenes/key-visual`）。
`.md` 拡張子は付けない。

---

## 2. セクション抽出ルール

base.md / variant.md / lexicon エントリの3種でセクション抽出規則は共通:

1. 対象見出しを探す（正確に一致、前後空白無視）
2. 見出しの**直後の** triple backtick コードブロック（```…```）を抽出
3. 言語指定（```text など）があっても無視して中身のみ
4. 前後の空白（\\s）を trim、**内部の改行は維持**

### 2.1 base.md / variant.md の抽出対象

| 見出し | 抽出結果 | 用途 |
|---|---|---|
| `## 本文プロンプト` | コードブロック中身 | positive 結合 |
| `## ネガティブプロンプト` | コードブロック中身 | negative 結合 |
| `## 依存ベースバージョン` | 直後の1行（`v3` など、`v\d+` 正規化） | version 整合確認 |
| `## Lexicon 参照` | 箇条書き項目を順序維持で配列化 | **variant のみ compile に使う**（§3 参照） |

### 2.2 lexicon エントリの抽出対象

- エントリ境界: `## #<slug>` から、次の `## #<slug2>` または EOF まで
- 補助境界: エントリ内に `---`（水平線）がある場合はエントリ内の構造区切りなので境界に**しない**。`---` で切るのは「次の `## #` が来る前の整理」のためだけで、compile は使用しない
- 抽出: `**プロンプト断片**:` の直後の triple backtick コードブロック
- trim: 前後空白のみ、内部改行維持

---

## 3. Lexicon 参照の取り扱い（重要）

### 3.1 base.md の Lexicon 参照は compile に使わない

- base.md が `## Lexicon 参照` を持っていても、compile 結合には**含めない**
- これは authoring reference（作者が参照した背景）であり、実行時には variant 側の列挙を正とする
- 理由: variant ごとに必要な断片が異なり、base の参照を全 variant で自動継承すると冗長・矛盾が出る
- **同梱実例**: `characters/washi-fox` の base.md と three-view.md の両方が Lexicon 参照セクションを持つが、compile が使うのは variant 側だけである

この仕様は AGENTS.md §4.5 にも要約されているが、本 docs を正とする。

### 3.2 variant が `## Lexicon 参照` セクションを持たない場合

- **エラー**（compile 停止）。AGENTS.md §4 / docs/schemas/prompt.md がセクション必須と定義している
- メッセージ例: `variant 'three-view' is missing required section '## Lexicon 参照'`
- 暫定対応: variant 側にセクションを追加（箇条書き空 = OK）

### 3.3 variant の `## Lexicon 参照` が空（箇条書きゼロ）

- 正常処理。`lexicon_used: []` として compile 通過
- positive 結合の末尾に lexicon 断片は追加されない

### 3.4 variant 内の重複参照

- 同じ `lexicon/<cat>.md#<slug>` が2回以上列挙された場合: **先出しを残し、以降を dedup**
- warning を出す（停止はしない）
- dedup 判定: 厳密文字列一致（大文字小文字区別、空白 trim 後）

### 3.5 variant の `## Lexicon 参照` に `lexicon/negatives.md#...` が書かれている場合

- **エラー**（compile 停止）
- AGENTS.md §4.5 が「negatives は手動コピー運用、positive lexicon とは別種」と明記
- メッセージ例: `variant references 'lexicon/negatives.md#clean-image' in '## Lexicon 参照'; negatives must be pasted manually into '## ネガティブプロンプト' block (see AGENTS.md §4.5)`

### 3.6 Lexicon エントリが実在しない / `**プロンプト断片**:` が無い

- **エラー**（compile 停止）
- variant の参照を修正するか、lexicon 側に新規エントリを追加してから再試行

---

## 4. 結合ルール

### 4.1 Positive（`prompt.txt`）

```
<base の 本文プロンプト>
\n
<variant の 本文プロンプト>
\n
<lexicon 断片 #1>
\n
<lexicon 断片 #2>
\n
...
```

- 順序は `base → variant → lexicon fragments`（base は先頭、variant はその直後、lexicon は variant の `## Lexicon 参照` に列挙された順）
- 各ブロック間は**空行1行**で区切る（= `\n\n`）
- 最後のブロック末尾に余分な空行は付けない（trailing newline 1 個のみ）
- lexicon 断片内の改行は維持
- variant の「先頭トークンが効きやすい」ので base を必ず先頭に置く

### 4.2 Negative（`negative.txt`）

1. `base_negative` と `variant_negative` をそれぞれ改行込みで取得
2. 以下の正規化を順に適用:
   - すべての改行を `, ` に置換（`\n` → `, `、連続する `, ` は1つにまとめる）
   - `,` で split
   - 各トークンを trim
   - 空トークンを除外
3. dedup: **case-insensitive exact match**、**先出しを残す**
   - 比較キー: `token.trim().toLowerCase()`
   - 例: `text` と `Text` と ` text ` は重複（後ろが消える）
   - 例: `photo realistic` と `photorealistic` は**別**（fuzzy マッチしない）
4. 残ったトークンを `, ` で結合
5. trailing newline 1 個のみ

**注**: ネガティブの fuzzy dedup は**禁止**。意図して重ねた禁止語が消える危険がある。

---

## 5. 依存バージョン整合

1. base.md の `## 依存ベースバージョン` は**自己宣言**（例: `v3`）
2. variant.md の `## 依存ベースバージョン` は**base への期待値**
3. 両者が一致しない場合は **compile 停止**、エラーメッセージに両方の値を含める
4. 一致する場合のみ §4 の結合に進む

※ `v` prefix の大小は正規化（`V3` も `v3` として比較）。前後空白は trim。

---

## 6. run_id 採番

### 6.1 命名規則

```
<YYYYMMDD>_<variant-basename>_<base-version>[_compile][_r<N>]
```

- `<YYYYMMDD>`: **JST 固定**（Asia/Tokyo）
- `<variant-basename>`: variant path の basename のみ（`scenes/mountain-ambush` → `mountain-ambush`）
- `<base-version>`: base.md の `## 依存ベースバージョン` の値（例: `v2`）
- `_compile`: 画像生成を伴わない単独 compile の場合のみ付与
- `_r<N>`: 衝突回避時のサフィックス（§6.3）

### 6.2 variant path と basename

basename が衝突する可能性があるため、**manifest.json には別途 `variant_id` フィールドで full path を記録**する:

- `variant_id`: `"scenes/mountain-ambush"`（full path、拡張子なし）
- run_id: `"20260418_mountain-ambush_v2_compile"`（basename）

### 6.3 衝突回避

- `characters/<id>/outputs/<run_id>/` が既存なら:
  - `_r2` サフィックスを追加 → まだ既存なら `_r3` → ...
- **既存 run_id のディレクトリは絶対に上書きしない**（NFR-IDEMPOTENT）
- `--force` フラグは**実装しない**（事故防止）

---

## 7. manifest.json スキーマ

必須フィールド:

```json
{
  "run_id": "20260418_mountain-ambush_v2_compile",
  "character": "washi-fox",
  "variant_id": "three-view",
  "base_version": "v2",
  "base_sha": "<base.md の内容ハッシュ short form>",
  "tool": "prompt-compile",
  "tool_version": "<repo commit short SHA>",
  "prompt_file": "prompts/variants/three-view.md",
  "lexicon_used": ["lexicon/camera.md#three-quarter-orthographic"],
  "references": [],
  "source_entities": [],
  "seed": null,
  "compiled_prompt": "<prompt.txt と同内容>",
  "compiled_negative": "<negative.txt と同内容>",
  "outputs": [],
  "thumbnails": [],
  "created_at": "2026-04-18T12:34:56+09:00",
  "created_by": "forge-cli@<version>"
}
```

### 7.1 `base_sha` と `tool_version` の意味を分ける

- `base_sha`: **base.md の内容ハッシュ**。`git hash-object characters/<id>/prompts/base.md` の short SHA（7文字）
  - 目的: 「この run が使った base.md の正確な内容」を特定するため
  - base.md を編集するたびに変わる
- `tool_version`: **repo commit short SHA**。`git rev-parse --short HEAD`
  - 目的: compile を実行した時点の Shitate / forge-cli のバージョン

### 7.2 画像生成を伴う run の場合

- `tool`: `"chatgpt-image"` / `"pixverse-v6"` など実生成器
- `tool_version`: 生成器のモデルバージョン（不明なら `"built-in-image-generation"`）
- `outputs`: 生成されたファイル名の配列
- `thumbnails`: サムネ画像の配列
- `evaluation`: 評価オブジェクト（docs/schemas/log.md）

### 7.3 compile 単独 run の場合

- `tool`: `"prompt-compile"`
- `tool_version`: repo commit short SHA
- `outputs`: `[]`
- `thumbnails`: `[]`
- `evaluation`: 省略可

---

## 8. 副作用ルール

`forge compile` のデフォルト挙動:

| 項目 | 挙動 |
|---|---|
| `outputs/<run_id>/` 作成 | **する** |
| `prompt.txt` / `negative.txt` / `manifest.json` 書き出し | **する** |
| `log.md` 追記 | **しない**（デフォルト） |
| `index.md` 更新 | **しない** |
| `INDEX.md` 更新 | **しない** |

### 8.1 log.md を更新しない理由

- compile は WIP で繰り返し走る可能性があり、log.md が汚れる
- log.md は「人間が意図を書く場所」であり、自動追記が混ざると読解性が落ちる
- 将来 `--update-log` オプションを追加することは可能だが、デフォルトでは安全側

### 8.2 `--dry-run` モード

- ファイルを一切書き出さない
- `prompt.txt` / `negative.txt` / `manifest.json` を **stdout に出力**
- 依存バージョン不一致・lexicon 欠落などのエラーチェックは通常と同じ
- 新規実装では `--dry-run` を必須サポートとする

---

## 9. エラー時の挙動

すべて非ゼロ終了コード + stderr へのメッセージ。

| エラー | exit code | メッセージに含めるべき情報 |
|---|---|---|
| キャラ / variant / lexicon ファイルが無い | 1 | パス |
| 必須セクション欠落 | 2 | セクション名・ファイルパス |
| 依存バージョン不一致 | 3 | base / variant 両方の値 |
| lexicon 参照解決失敗 | 4 | `<cat>.md#<slug>` |
| `lexicon/negatives.md#` が variant 参照に混入 | 5 | 該当参照・AGENTS.md §4.5 へのリンク |
| run_id 衝突 `_r99` まで使い切り | 6 | run_id |

exit code 7〜: 予約（将来の validator 用）。

---

## 10. 参考実装（CLI）

`scripts/forge` の compile サブコマンドはこの仕様の**参照実装**である。
手動 compile（Claude Code が Read/Write で行う場合）も同じ結果になるべき。

不一致が起きたら本 docs を更新して両方に反映する。

---

## 11. 変更履歴

- 2026-04-18: 初版。Codex レビューを受けて曖昧点を固定
  - base.md の Lexicon 参照を compile で使わないことを明記（AGENTS.md §4.5 と揃え、実装上の正とする）
  - negative dedup は case-insensitive exact match（fuzzy 禁止）
  - `base_sha`（base.md content hash）と `tool_version`（repo commit SHA）の分離
  - variant path 階層対応、run_id は basename、`variant_id` で full path
  - `lexicon/negatives.md#` が variant 参照にあれば停止
  - JST 固定
  - `forge compile` はデフォルト log.md を書き換えない、`--dry-run` 必須
