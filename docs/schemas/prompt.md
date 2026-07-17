# Prompt File Schema

`prompts/base.md` と `prompts/variants/<variant>.md` に共通のスキーマ。
compile（[compile.md](compile.md)）と `forge doctor` がこのスキーマ前提でパースする。

## 必須セクション

見出しレベル固定。順序は自由（ただし以下の並びを推奨）。

1. `# <プロンプト名>` — H1
2. `## 用途` — このプロンプトがどの生成物を作るためか（1-3行）
3. `## 依存ベースバージョン` — `v3` のような行1つ
4. `## 本文プロンプト` — 直後に triple backtick コードブロックで本文
5. `## ネガティブプロンプト` — 直後に triple backtick コードブロックでネガティブ
6. `## Lexicon 参照` — 箇条書きで `lexicon/<cat>.md#<id>` 形式
7. `## メモ` — 任意、意図や試行履歴の補足

## 書式ルール

- 本文プロンプトとネガティブプロンプトは **必ず triple backtick のコードブロック**に入れる
- Lexicon 参照はアンカー付きリンク（`#<id>`）で書く。リンク記法 `- [title](lexicon/styles.md#slug)` も可
- 本文プロンプトが PixVerse V6 向けなら 1〜2文の簡潔形、カメラワーク明示

## 実例

- [characters/washi-fox/prompts/base.md](../../characters/washi-fox/prompts/base.md)
- [characters/washi-fox/prompts/variants/three-view.md](../../characters/washi-fox/prompts/variants/three-view.md)

## よくある違反

| 症状 | 原因 |
|---|---|
| `forge compile` が `missing required section '## 本文プロンプト'` で停止 | 見出し名が違う（全角コロン、半角スペース違い）またはコードブロック無し |
| lexicon 参照が解決できない | リンク記法でなく `- #ukiyo-e-edo` のように書いている（`lexicon/<cat>.md#<slug>` 形式必須） |
| variant に `## Lexicon 参照` セクションがない | セクション自体が必須。参照ゼロなら「箇条書き無し」で残す |

## Lexicon / Negatives（執筆ガイド）

`lexicon/negatives.md` は **positive lexicon とは別種**。compile 時に自動組み込みされない。

- `lexicon/negatives.md#<slug>` の `**ネガティブ断片**:` 直後のコードブロックを手動でコピー
- variant の `## ネガティブプロンプト` コードブロックに追記
- variant の `## Lexicon 参照` には **書かない**（書くと `forge compile` が停止する）
- 既存エントリ: `#clean-image`, `#no-anime-contamination`, `#no-modern-contamination`, `#no-multi-character-contamination`, `#regalia-orientation-lock`
