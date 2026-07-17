# Shitate INDEX

現在同梱しているサンプルキャラクターの一覧。
新しいセッションで状況を把握するときの入口として使う。

> Characters 表は `pnpm forge index --write` で同期する（`forge new` も自動反映）。
> キャラ詳細は各 `characters/<id>/index.md`、規約正本は [AGENTS.md](AGENTS.md)、
> 昇格ルールは [STABLE.md](STABLE.md) を参照。

## Characters

<!-- forge:generated:characters:start -->

| ID | 表示名 | status | base | 出典 entity | runs | anchors | 最終更新 |
|---|---|---|---|---|---|---|---|
| [washi-fox](characters/washi-fox/index.md) | 和紙狐 | draft | v1 | — | 1 (three-view) | — | 2026-07-17 |

<!-- forge:generated:characters:end -->

## サンプルについて

`washi-fox` は操作確認用のオリジナルサンプルで、画像や anchor を同梱していない。
自分のキャラクターを作成したら、サンプルを残すか削除するかは利用者が選べる。

## 凡例

- **status**: `draft` → `experimental` → `stable`（詳細は [STABLE.md](STABLE.md)）
- **base**: `prompts/history/base.v<N>.md` で保存されている主要ベース版
- **runs**: `outputs/<run-id>/` の数
- **anchors**: `references/images/*-anchor.*` の数。配布サンプルでは画像を持たない

## 更新時のルール

- 新規キャラクターを追加したとき
- status を変更したとき
- base を主要改訂したとき
- 新しい run を完了したとき

上記のタイミングで `pnpm forge index --write` を実行する。
