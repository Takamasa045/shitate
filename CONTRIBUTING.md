# Shitateへの改善提案

Shitateに興味を持っていただき、ありがとうございます。

小さな誤字修正は、そのままPull Requestで送れます。
機能追加、ファイル形式の変更、キャラクター資産の追加は、先にIssueで目的と影響範囲を相談してください。

## 大切にしているルール

- 1キャラクターを `characters/<id>/` の1ディレクトリにまとめる
- 人が編集する正本は Markdown・YAML・JSON にする
- 変更理由と次の改善を `log.md` に残す
- 既存runやanchorを上書きしない
- 画像生成はこのリポジトリ内で自動実行しない
- 権利を確認できない画像、個人情報、secretを追加しない

詳しい操作規約は [AGENTS.md](AGENTS.md) を参照してください。

## 変更前の確認

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm distribution:check
pnpm typecheck
pnpm forge lint
pnpm forge doctor
pnpm forge index --check
```

Studioの画面や書き込み処理を変更した場合は、`pnpm test:e2e` も実行します。
ランチャーを変更した場合は、`pnpm test:launcher:coverage` を実行します。

Pull Requestには、変更の目的、確認した内容、キャラクターの見た目やcompile結果への影響を書いてください。
