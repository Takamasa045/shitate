# Template: new-character

新規キャラクター作成時に `characters/<id>/index.md` として展開する雛形。
**使用前に** `<>` で囲まれた箇所をすべて埋めること。

---

```markdown
---
id: <kebab-case-id>
name: <表示名>
role: <役割・立場>
age: <年齢 or 不明>
status: draft
base_version: v1
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
source_entities:
  - "[[entities/<makimono-slug>]]"
world_refs:
  - "[[concepts/<concept-slug>]]"
relations: []
tags: [<tag1>, <tag2>]
---

# <表示名>

## 概要

<1-3段落でキャラの核を書く。史実ベースなら source_entities の一次情報に基づくこと>

## 外観の核（Visual Core）

- **顔**: <ポイントを3つ>
- **体格**: <身長・体型>
- **髪**: <長さ・色・結い方>
- **特徴**: <傷・装飾品・固定持ち物など>

## 性格・口調

<短く>

## 現在の制作状況

- 進行中のバリアント: <なし>
- 直近の課題: <なし>
- 次のマイルストーン: status を experimental に上げる

> 詳しい改善履歴は [log.md](./log.md) を参照。
> 現行プロンプトは [prompts/base.md](./prompts/base.md)。
```

---

## 使い方

**推奨**: CLI で一括スキャフォールドする。

```
pnpm forge new <id> --name "<表示名>"
```

手動展開する場合:

1. このファイルをコピーして `characters/<id>/index.md` に配置
2. `<>` を全て埋める
3. 同時に以下のスケルトンも作成:
   - `characters/<id>/prompts/base.md`（`templates/three-view.md` を参考に）
   - `characters/<id>/prompts/history/base.v1.md`（base.md と同一内容）
   - `characters/<id>/references/sources.yaml`（空エントリでOK）
   - `characters/<id>/log.md`（`templates/log-entry.md` の最初のエントリ）
4. `pnpm forge index --write` で INDEX を同期
5. 既存ファイルを上書きしないこと（NFR-IDEMPOTENT）
