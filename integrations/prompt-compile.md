# Integration: prompt-compile（CLI fallback）

> **標準手段は CLI である。**
>
> ```
> pnpm forge compile <char> <variant> [--dry-run] [--with-image]
> ```
>
> 仕様の正本: [docs/schemas/compile.md](../docs/schemas/compile.md)
> CLI 実装: `scripts/forge/lib/compile.ts`（参照実装）
>
> **この手順書は CLI が動かないとき・実装差分を追うときの fallback 手動手順** に降格する。
> 日常運用で手動結合しない。二重運用を避ける。

Shitate の分割されたプロンプトソース（base.md + variant + lexicon）を
**完全展開済みの1つのテキスト**に結合する。
画像生成ツールを使わない **プロンプト単体ワークフロー** として成立する。

compile 結果はランタイム別の画像手順（[AGENTS.md](../AGENTS.md) §8.1）や外部 generator に渡せる。

---

## いつこの手順書を使うか

1. `pnpm forge` / `./bin/forge` が環境的に動かない
2. CLI の出力と仕様の食い違いをデバッグする
3. 仕様変更の設計レビューで結合アルゴリズムを目視確認する

通常は:

```
pnpm forge compile washi-fox three-view --dry-run
pnpm forge compile washi-fox three-view
```

---

## 前提条件

- 対象キャラに以下が揃っていること:
  - `characters/<id>/prompts/base.md`（prompt スキーマ準拠）
  - 対象バリアント `prompts/variants/<variant>.md`
  - variant の `## Lexicon 参照` で指定されたすべての Lexicon エントリが存在
- [docs/schemas/compile.md](../docs/schemas/compile.md) と [AGENTS.md](../AGENTS.md) §4.5 を読んでいること
- 外部ツールは **不要**

---

## 入力仕様

| ファイル | 役割 |
|---|---|
| `characters/<id>/prompts/base.md` | キャラの視覚的同一性を決める共通基盤。先頭に置く |
| `characters/<id>/prompts/variants/<variant>.md` | 当該カット用の差分。base の直後に置く |
| `lexicon/<cat>.md#<slug>` (複数) | variant の `Lexicon 参照` に列挙されたエントリ。末尾に順序通り追加 |

各ファイルから抽出する箇所:

- `## 本文プロンプト` の直後の triple backtick コードブロック内のみ（見出しは含めない）
- `## ネガティブプロンプト` の直後の triple backtick コードブロック内のみ
- Lexicon の `**プロンプト断片**:` の直後のコードブロック内のみ

**注意**: base.md の `## Lexicon 参照` は compile に使わない（authoring reference のみ）。

---

## 出力仕様

run 単位で `characters/<id>/outputs/<run-id>/` に以下を配置:

| ファイル | 内容 | コミット |
|---|---|---|
| `prompt.txt` | 完全展開されたポジティブプロンプト | ◯ |
| `negative.txt` | 完全展開されたネガティブプロンプト | ◯ |
| `manifest.json` | メタ情報 + `compiled_prompt` / `compiled_negative` | ◯ |

**画像を伴わない単独 compile** の run_id 命名:

```
YYYYMMDD_<variant>_<base-version>_compile[_rN]
```

manifest の主要フィールド:
- `tool`: `"prompt-compile"`
- `tool_version`: このリポの `git rev-parse --short HEAD`
- `outputs`: `[]`
- `thumbnails`: `[]`

---

## 手動実行手順（fallback）

### 1. 対象の決定

1. 対象キャラ `<id>` と variant 名を決める
2. `characters/<id>/log.md` の直近3エントリを読む（FR-LOG-04）
3. 現行の base / variant を読む
4. base と variant の `## 依存ベースバージョン` が一致することを確認

### 2. ソースの抽出

1. base / variant から本文・ネガティブのコードブロックを抽出
2. variant の `## Lexicon 参照` から参照リストを抽出（順序維持）
3. `lexicon/negatives.md#...` が混ざっていたら **エラー**（手動でネガブロックへ貼る運用）

### 3. Lexicon 断片の解決

各 `lexicon/<cat>.md#<slug>` について:

1. ファイルを読む
2. `## #<slug>` 見出しを探す
3. `**プロンプト断片**:` 直後のコードブロックを抽出

### 4. 結合（仕様厳守）

**ポジティブ** (`prompt.txt`): base → variant → lexicon（空行区切り、lexicon は参照順）

**ネガティブ** (`negative.txt`): base + variant をカンマ連結し、case-insensitive exact match で dedup（先出し保持）

### 5. run_id 決定と出力配置

1. 日付は JST の `YYYYMMDD`
2. 単独 compile は `_compile` サフィックス
3. 既存 run_id は上書き禁止 → `_r2`, `_r3` ...
4. `prompt.txt` / `negative.txt` / `manifest.json` を書き出す

### 6. 画像生成への受け渡し

compile 後の静止画は **ランタイム別**（AGENTS.md §8.1）:

- Codex / ChatGPT → [chatgpt-image.md](./chatgpt-image.md)
- Claude Code → [nano-banana.md](./nano-banana.md)
- 動画 → [pixverse-pipeline.md](./pixverse-pipeline.md)

---

## 失敗時のリカバリ

| 症状 | 原因 | 対処 |
|---|---|---|
| CLI が動くのに手動で結合した | 二重運用 | CLI を使う。この手順書は fallback のみ |
| base と variant の依存バージョンが不一致 | どちらかが未更新 | 揃えてから再 compile |
| Lexicon 参照が解決できない | リネーム・削除 | variant の参照を修正 or Lexicon 追加 |
| 同じ run_id が既存 | 冪等性違反 | `_r2` で新 run |
| CLI と手動結果が食い違う | 手順ドリフト | **CLI / docs/schemas/compile.md を正** として手動手順を直す |
