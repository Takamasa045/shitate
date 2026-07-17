# STABLE.md — キャラクター status と昇格ルール

Shitate のキャラクターは `draft`、`experimental`、`stable` の3段階で管理する。
status は `characters/<id>/index.md` の frontmatter に記録する。

## draft

プロンプトを準備している段階。画像生成や評価はまだ必須ではない。

- `prompts/base.md` がある
- 少なくとも1つの variant がある
- `log.md` に次の改善が書かれている

配布サンプルの `washi-fox` はこの段階にある。

## experimental

少なくとも1回は検証し、方向性が見えた段階。

昇格には次をすべて満たす。

- base と variant がスキーマに準拠している
- compile run または生成 run が完了している
- `log.md` に初回評価がある
- `source_entities` を使う場合は参照先を確認できる
- 画像を使う場合は、利用権限と保存場所を確認している

## stable

複数の用途で同一性を保てることを確認し、base を固定できる段階。

昇格には次をすべて満たす。

- base の主要改訂を少なくとも1回行っている
- three-view 以外に3種類以上の variant がある
- 直近3回の実生成評価がすべて ◎
- 用途が明確なキービジュアルがある
- 2種類以上の anchor で顔と主要装備を確認できる
- `log.md` に5エントリ以上ある
- 利用者が base の固定に合意している

## 降格

stable 後に同一性や設定の根本問題が見つかった場合は、`experimental` に戻してよい。
理由を `log.md` に残し、base を改訂してから再評価する。

## 画像を扱うとき

配布版には個人用のキャラクター画像を含めない。利用者が自分のローカル環境で追加する画像は、
公開前に `pnpm distribution:check` で混入していないことを確認する。
