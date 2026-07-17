# references/sources.yaml Schema

`characters/<id>/references/sources.yaml` は参照画像のカタログ。

## フォーマット

```yaml
references:
  - path: images/<file>.png
    role: anchor | style | pose | outfit | mood | seed
    url: <出典URL or null>
    notes: <用途メモ>
    added: YYYY-MM-DD
```

## role の意味

- **anchor**: 同一性固定用。顔・鎧・持ち物など、キャラのアイデンティティを担保する。**必ず git にコミット**
- **style**: スタイル参照（画風のサンプル）
- **pose**: ポーズ参照
- **outfit**: 衣装参照
- **mood**: 雰囲気・ムードボード用
- **seed**: 逆フロー（[../../integrations/image-to-character.md](../../integrations/image-to-character.md)）で元画像として使ったもの

## コミットポリシー

- `role: anchor` は **必ず git にコミット**（FR-REF-03）
- 他の role は `.gitignore` 対象でよい
- `.gitignore` はファイル名に `anchor` を含むものをホワイトリストしているので、アンカーは **`*-anchor.<ext>` 命名**にする（例: `face-anchor.jpg`, `armor-anchor.jpg`, `regalia-anchor.jpg`）

## anchor の運用

ライフサイクル（作成・差し替え・バージョニング・古びるサイン）は [../workflows/anchor-lifecycle.md](../workflows/anchor-lifecycle.md) 参照。

Studio v0.3 では「手本」から選定済み anchor を新規登録できる。

- JPEG / PNG / WebP、5 MiB 以下
- anchor ID は ASCII kebab-case。保存名は `<id>-anchor.<ext>` をサーバー側で生成
- MIME と magic bytes を照合し、既存 ID・既存 path は上書きせず停止
- 成功時は画像、`sources.yaml`、`log.md`、`INDEX.md` を同期
- 画像生成と既存 anchor の差し替えは行わない
