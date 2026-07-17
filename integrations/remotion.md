# Integration: remotion

Remotion プロジェクトにキャラのアセットを流し込む手順。
**動画編集は ffmpeg ではなく Remotion**（ユーザーフィードバック準拠）。

---

## 前提条件

- 受け渡し先の Remotion プロジェクトが存在する（`~/apps/*/remotion-*` 等）
- 対象キャラの `outputs/<run-id>/` に使用するアセットが揃っている（静止画・動画・サムネ）
- Remotion プロジェクトの `public/` ディレクトリが書き込み可能
- ユーザーから受け渡し先プロジェクトが明示されている（複数ある場合）

---

## 入力仕様

Shitate 側から持ち出すもの:

- `characters/<id>/outputs/<run-id>/*.png`（静止画）
- `characters/<id>/outputs/<run-id>/*.mp4`（動画）
- `characters/<id>/outputs/<run-id>/manifest.json`（メタ情報）
- 必要に応じて `references/images/*anchor*`（参照用）

---

## 出力仕様

Remotion プロジェクト側に配置される形:

```
<remotion-project>/
└── public/
    └── shitate/
        └── <character-id>/
            └── <run-id>/
                ├── manifest.json
                ├── front.png
                ├── side.png
                └── ...
```

- `public/shitate/<id>/<run-id>/` 配下に run 単位で整理
- manifest.json も同梱することで Remotion 側から再現情報を参照できる
- 元の Shitate `outputs/` は **削除しない**（コピーのみ）

---

## 実行手順

### 1. 受け渡し先の確認

1. ユーザーにどの Remotion プロジェクトに渡すか確認
2. プロジェクトのルートを特定（`~/apps/<name>/remotion-*/`）
3. `public/` ディレクトリが存在するか確認

### 2. アセットのコピー

1. 受け渡し元: `characters/<id>/outputs/<run-id>/`
2. 受け渡し先: `<remotion-project>/public/shitate/<id>/<run-id>/`
3. `cp -R` でディレクトリごとコピー（`.log` 等の一時ファイルは除外）
4. manifest.json が含まれていることを確認

### 3. Remotion 側の composition への組み込み

1. Remotion プロジェクトの composition ファイル（`src/*.tsx`）を開く
2. `staticFile('shitate/<id>/<run-id>/<file>')` で参照
3. 必要なら manifest.json を `import` してメタ情報ベースでレンダリング

### 4. Shitate 側への記録

1. `characters/<id>/log.md` に「Remotion 連携」エントリを追記
   - どのプロジェクトのどの composition に組み込んだか
   - 使った run_id
   - 備考
2. ただし run_id ごとに毎回書く必要はない。**初回と大きな変更時のみ** で十分

---

## 失敗時のリカバリ

| 症状 | 原因 | 対処 |
|---|---|---|
| Remotion 側で画像が表示されない | パスが `public/` からの相対で書かれていない | `staticFile()` を使っているか確認。直接の絶対パスや `../` は NG |
| アセットが古い | 新 run を作ったが Remotion 側にコピーしなかった | 最新 run_id のディレクトリを再コピー |
| 動画が再生されない | コーデックの問題（Remotion は H.264 推奨） | 元の生成段階で H.264 / AAC を指定。駄目なら Remotion 側で再エンコード設定 |
| Shitate の outputs が消えた | 30日以上古くて手動削除された（§14 Q6） | manifest.json は残っているはず。再生成 → 新 run を作り直す |
| 受け渡し先プロジェクトが不明 | ユーザー確認漏れ | 勝手にコピーせず、ユーザーに明示確認してから実行 |
