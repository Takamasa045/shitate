# Shitate 配布前チェックリスト

このリポジトリの現在の Git 履歴には、個人利用のキャラクター画像が含まれていた履歴がある。
そのため、既存リポジトリをそのまま public に切り替えない。
配布には、履歴を持たない新しいスナップショットを使う。

公開・push・リポジトリ設定変更は、この手順とは別に明示して実行する。

## 1. 配布ゲート

```bash
pnpm distribution:check
```

このゲートは次を拒否する。

- `characters/` 配下の画像
- 配布サンプル `washi-fox` 以外のキャラクターディレクトリ
- 作品固有テーマの名称や旧ID
- 個人端末の絶対パス
- symlink

## 2. 品質チェック

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:launcher:coverage
pnpm test:coverage
pnpm typecheck
pnpm forge lint
pnpm forge doctor --strict
pnpm forge index --check
node scripts/ci/compile-all.mjs
pnpm audit --prod --audit-level high
pnpm test:e2e
git diff --check
```

## 3. 履歴なしの配布スナップショットを作る

保存先は、存在しない新しいディレクトリを指定する。

```bash
pnpm distribution:create -- ../shitate-distribution
```

作成コマンドは配布ゲートを先に実行し、次をコピーしない。

- `.git/`
- `node_modules/`
- Playwright のレポートとテスト成果物
- `.DS_Store`
- ローカル専用のエージェント設定

作成後、新しいディレクトリでも `pnpm distribution:check` を実行する。

## 4. ライセンスを決める

- [ ] ソースコードのライセンスを決め、ルートに `LICENSE` を追加する
- [ ] キャラクター設定とプロンプトへ同じ条件を適用するか決める
- [ ] README の「ライセンス」を確定内容へ更新する

ライセンスは権利者の意思を伴うため、自動では決めない。

## 5. 初めて使う人の動線

- [ ] Macで「ZIPを展開 → `Shitate Studio.command` を右クリックして開く」を確認する
- [ ] 初回セットアップ後にブラウザが開く
- [ ] 2回目は依存関係の再インストールなしで起動する
- [ ] `Control + C` で終了できる
- [ ] Windows / Linux では `node scripts/launch-studio.mjs` で起動できる

## 6. 公開直前

- [ ] 新しい空のGitリポジトリを配布スナップショット内で初期化する
- [ ] `git status --short` で配布対象を確認する
- [ ] 初回commit後に、キャラクター画像が履歴へ入っていないことを再確認する
- [ ] 公開先、About、Topics、READMEの表記を `Shitate` に揃える
- [ ] public 切り替え後に、公開URLからREADMEとランチャーを再確認する
