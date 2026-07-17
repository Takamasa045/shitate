# log.md Entry Schema

`characters/<id>/log.md` は **新しい順（DESCENDING）** で追記する。
セッション冒頭でエージェントは **直近3エントリを読む義務**（AGENTS.md §1）。

## エントリフォーマット

```markdown
## YYYY-MM-DD / base v<N> / <variant>

- **試行**: 何を変えたか。1-3行。
- **プロンプト差分**: [base.v<N-1> → v<N>](prompts/history/base.v<N>.md) または variant への相対リンク
- **生成物**: [<run-id>](outputs/<run-id>/manifest.json)
- **評価**: ◎ / ◯ / △ / ✗
  - 顔の一貫性: ◎
  - 衣装: ◯
  - ポーズ: △（具体的な破綻箇所）
  - 背景: ◎
- **次の改善**: 次に試すこと。次回の Claude Code が読んで実行する想定で書く。
```

## 評価記号

- **◎** 完璧。これで確定してよい
- **◯** 概ね良い。細部の調整のみ
- **△** 方向は合っているが破綻あり
- **✗** 方向転換が必要

## ルール

- 「次の改善」欄は **空にしない**。何もなければ「このバリアントは確定。次は別のバリアント」と書く
- プロンプト差分だけでは意図が読めないので、**試行欄に「なぜ」を 1-3 行で書く**
- compile 単独 run は log に残さなくてよい（副作用無しで再試行可能なため）
- 生成物を伴う run は必ず 1 エントリを残す

## 実例

- [characters/washi-fox/log.md](../../characters/washi-fox/log.md)
