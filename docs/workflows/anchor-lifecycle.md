# Anchor Lifecycle

アンカーは「キャラの視覚的同一性を固定する石」であり、**生成の起点であって結果ではない**。
`base.md` の改訂と anchor の関係を明示しておく。

## いつ anchor を作るか

- 新規キャラの初回 three-view が通った直後（顔を正面から見た安定カットを切り出す）
- 主要装備（鎧・持ち物・家紋など）の意匠が確定したとき
- 左右の対比・前後の対比など「向き依存」の視覚情報がある場合（[../../lexicon/negatives.md](../../lexicon/negatives.md) の `#regalia-orientation-lock` 参照）

1 キャラあたり推奨: face-anchor + 装備系 anchor 1-2 枚。合計 2-4 枚程度。

選定済み画像の初回登録は Studio v0.3 の「手本」から行える。Studio は新規登録だけを扱い、
同じ anchor ID の現行 anchor が既にある場合は形式が違っても停止する。差し替えは以下のケース判断と
ユーザー合意を経て、手動ワークフローで行う。

## base の主要改訂と anchor の関係

base v1 → v2 のような主要改訂で、anchor が既存の場合:

### ケース A: 改訂が細部のみ

色調・古傷の強調・髪型の明示など。

- anchor は **据え置き**（v1 派生のまま使い続ける）
- 生成時に anchor を参照画像として渡し、新プロンプトで微差を効かせる
- `log.md` に「anchor は v1 派生を継続使用、v2 での視認性差を後続 run で検証」と明記

### ケース B: 改訂がキャラの骨格に関わる

顔の印象・体格・基本装束が変わる。

- anchor は **差し替え**が必要
- 手順:
  1. 旧 anchor を `references/images/<anchor-id>-anchor.v1.<ext>` にリネーム
  2. 新しい anchor を生成（ユーザー明示指示があれば）、`<anchor-id>-anchor.jpg` として配置
  3. `references/sources.yaml` に両方を登録し、旧は `role: anchor-archive` に変更
  4. `log.md` に差し替え理由と時期を記録
  5. `INDEX.md` の anchors 欄を更新（または `forge index --write` で自動反映）

### ケース C: 改訂内容はまだ不明（実験中）

- anchor は **据え置き**、新 run で実験して必要性を判断
- `log.md` に「anchor 差し替え判断を保留」と記録

## バージョニング

基本は **1 ファイル 1 役割**（`face-anchor.jpg` / `armor-anchor.jpg` 等）。
ただし歴史的に重要な差し替えが起きた場合のみ、バージョン接尾辞 `.v<N>` を使う:

```
references/images/
├── face-anchor.jpg           # 現行（常に最新）
├── face-anchor.v1.jpg        # 履歴（差し替え前、role: anchor-archive）
└── armor-anchor.jpg          # 現行
```

- `<anchor-id>-anchor.<ext>` が **現行の正本**
- `<anchor-id>-anchor.v<N>.<ext>` は archive（ファイル名に `anchor` を保つことで `.gitignore` ホワイトリストに残す）
- 現行 anchor は 1 つだけ（「複数の現行」は混乱の元）

## スタイル一貫性

- 同じキャラの anchor は **同じ画像生成ルート + 同じスタイル指示** で作るのが原則
- 例: Codex なら `chatgpt-image`、Claude Code なら `nano-banana` + キャラ固有のスタイル指定（AGENTS.md §8.1）
- 異なるルート間で anchor を混ぜると顔の印象がブレる可能性がある
- 差し替え時は「なぜ新 anchor を採用するのか」を `log.md` で比較可能に

## 古びるサイン

以下が観察されたら差し替えを検討:

- 同じ anchor を使った新しい run で顔や装束が徐々にブレる
- generator のモデル更新で anchor との整合が崩れる
- base 改訂で世界観が変わったが、anchor だけ旧世界観のまま
- ユーザーから「顔が最近ちょっと違って見える」という feedback

差し替えの判断は **ユーザーと合意**してから（勝手に上書きしない、NFR-IDEMPOTENT）。
