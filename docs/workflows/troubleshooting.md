# Troubleshooting

よくある失敗と対処。AGENTS.md §10 の詳細版。

## 過去に没にしたプロンプトに戻っている

**原因**: log.md を読まずに改善案を作った。

**対処**: AGENTS.md §1 の手順に戻る（対象キャラの log.md 直近3エントリを読む）。
`forge status` で全キャラの「次の改善」を俯瞰できる。

## キャラの顔が毎回違う

**原因**: アンカー画像が無い、または `references/sources.yaml` に未登録。

**対処**:
- `references/images/` に `*-anchor.<ext>` 命名で配置
- `sources.yaml` に `role: anchor` で登録
- 詳細は [../schemas/references.md](../schemas/references.md) と [./anchor-lifecycle.md](./anchor-lifecycle.md)

## manifest を上書きしてしまった

**原因**: 同じ run_id で再実行。

**対処**: `_r2` を付けた新 run を作る。前の manifest は git で復元。
`forge compile` は既存 run があれば自動で `_r2`, `_r3` ... を付ける。

## base.md と history/base.v\<N\>.md が食い違う

**原因**: base を編集したが history にコピーしなかった。

**対処**: 主要改訂は必ず `prompts/history/base.v<N>.md` への新規コピー → `base.md` 差し替え。
`forge doctor` が history の欠落を検出する。

## source_entities がリンク切れ

**原因**: makimono 側でリネーム・削除。

**対処**:
- `~/makimono/entities/` を再確認
- 該当 entity の新名へ `source_entities` を更新
- log.md に変更を記録

## forge compile が `missing required section` で停止

**原因**: prompt ファイルのスキーマ違反（セクション名の微差、コードブロック未設置など）。

**対処**: [../schemas/prompt.md](../schemas/prompt.md) を参照し、必須セクション7種を確認。
見出し行は半角スペース・全角コロンの混入に注意。

## forge compile が lexicon 参照で停止

**原因の典型**:
- variant の `## Lexicon 参照` が `lexicon/<cat>.md#<slug>` 形式で書かれていない
- 参照先の lexicon ファイルが存在しない、または該当 slug のエントリが無い
- `lexicon/negatives.md#...` が誤って variant の Lexicon 参照に書かれている（§4.5.3b 違反）

**対処**: エラーメッセージに該当参照が出るので修正する。negatives の手動コピー運用は
[../schemas/prompt.md](../schemas/prompt.md) の「Lexicon / Negatives（執筆ガイド）」参照。

## INDEX.md が実データと乖離

**原因**: 新規キャラ追加や run 追加時に INDEX.md を手動更新していない。

**対処**: `forge index --check` で差分確認、`forge index --write` で Characters 表のみ再生成。
凡例・評価ハイライトなど手書き部分は保持される。
