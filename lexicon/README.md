# Lexicon

再利用可能なプロンプト素材（スタイル・照明・カメラ・衣装・舞台の語彙集）。
キャラを横断して共有される共通資産（FR-LEX-04）。

## 分類

| ファイル | 内容 | 種類 |
|---|---|---|
| `styles.md` | アートスタイル（浮世絵、ジブリ調、写実等） | positive |
| `lighting.md` | 照明（golden hour, rim light 等） | positive |
| `camera.md` | アングル・レンズ（low angle, 85mm 等） | positive |
| `clothing/` | 衣装（和装、鎧、現代服、シリーズ共通衣装等） | positive |
| `settings/` | 舞台（神社、戦場、街道等） | positive |
| `negatives.md` | 共通ネガティブプリセット（clean-image / no-anime 等） | **negative**（執筆ガイド） |

**positive** エントリは compile 時に `## Lexicon 参照` 経由で自動組み込みされる。
**negative** エントリ（`negatives.md`）は執筆ガイドで、compile には自動組み込みされず、
variant 作成時に断片をコピーして貼る運用。

## エントリ形式（§7.5）

各エントリは ID（`#<slug>`）を持ち、プロンプトからアンカー参照される。
実例は `styles.md` / `lighting.md` / `camera.md` を参照。

必須要素:

1. `## #<slug>` 見出し（ID はケバブケース）
2. `**用途**: ...` — どんな場面で使うか
3. `**プロンプト断片**:` の直後に triple backtick のコードブロック
4. `**相性の良い Lexicon**:` — 箇条書きで他エントリへのリンク
5. `**NG**:` — 避けるべき表現の箇条書き

## Lexicon vs Template の違い

- **Lexicon** = 素材（語彙）。複数キャラから参照される部品
- **Template** = スケルトン（枠）。新規ファイルの雛形

混同しないこと。迷ったら「これは複数キャラで共有したい語彙か？」で判断する。
