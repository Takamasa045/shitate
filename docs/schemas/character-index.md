# Character index.md Schema

`characters/<id>/index.md` の frontmatter 必須フィールド。

## Frontmatter

```yaml
---
id: <kebab-case>              # FR-CHAR-05。ディレクトリ名と一致すること
name: <表示名>                # 日本語可
role: <役割>
status: draft | experimental | stable
base_version: v<N>            # 現行の base.md バージョン
created: YYYY-MM-DD
updated: YYYY-MM-DD
source_entities:              # 任意（推奨）。Obsidian 記法で makimono entity 参照
  - "[[entities/<slug>]]"
world_refs:                   # 任意
  - "[[concepts/<slug>]]"
relations:                    # 任意
  - character: <other-id>
    type: <関係性>
tags: [<tag>, ...]
---
```

## ルール

- `id` は ASCII kebab-case のみ（FR-CHAR-05）
- `id` は **ディレクトリ名と完全一致**（`forge doctor` が検出する）
- `status` の昇格ルールは [../../STABLE.md](../../STABLE.md) 参照
- `base_version` は `prompts/base.md` の `## 依存ベースバージョン` と一致すべき（doctor が検出）

## 本文

frontmatter の下は自由記述。以下を推奨:

- キャラの一行紹介
- どの entity のどの側面を採用/脚色したか（source-to-character フローの場合は必須）
- 世界観との結びつき

## 実例

- [characters/washi-fox/index.md](../../characters/washi-fox/index.md)

## 関連

- 参照画像のカタログは [references/sources.yaml](./references.md)
- base 改訂時の anchor 扱いは [docs/workflows/anchor-lifecycle.md](../workflows/anchor-lifecycle.md)
