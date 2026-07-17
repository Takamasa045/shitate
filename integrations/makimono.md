# Integration: makimono

knowledge wiki (`~/makimono/`) の一次情報と Shitate をリンクする手順書。
参照は **read-only**。Shitate 側からは書き戻さない。

Shitate のレイヤー構造（AGENTS.md §0.1 参照）における **歴史・知識系の入口**。
「いろんな資料を巻物に投げて wiki 化したものを、視覚的キャラクターに翻訳する」運用の
Shitate 側の手順がここにある。

---

## 上流のチェーン（Shitate が触らない範囲）

Shitate が makimono を参照する前に、**makimono 側に知識が既に整っている**ことが前提。
makimono 自身の入力経路（NotebookLM / Google Drive / YouTube / PDF / 手動整理等）は
**makimono の責務** であって Shitate は関与しない。

```
raw sources
   ↓
NotebookLM / Google Drive / 手動収集
   ↓
~/makimono/50_raw/  (原文・PDF・トランスクリプト)
   ↓
~/makimono/entities/ / concepts/ / sources/  (wiki 化された正本)
   ↑
   ここから Shitate が読む
```

Shitate 内の手順はすべて「entity がすでに存在している」ことを前提にする。
entity が無ければ **まず makimono 側に追加する** のが正しい順序（§「entity 欠落時の対処」参照）。

---

## 前提条件

- `~/makimono/` が存在し、`entities/`, `concepts/` ディレクトリを持つこと。
- キャラの `index.md` に `source_entities:` 欄があること。
- 参照記法は Obsidian 形式: `[[entities/<slug>]]` または `[[concepts/<slug>]]`。
- makimono 側の `CLAUDE.md` を読んで運用方針と競合しないこと。

---

## 入力仕様

Shitate 側で準備するもの:

- `characters/<id>/index.md` の `source_entities:` 配列
  ```yaml
  source_entities:
    - "[[entities/kusunoki-masashige]]"
    - "[[entities/yamato-taijutsu]]"
  ```
- `world_refs:` 配列（任意、concepts 参照用）
  ```yaml
  world_refs:
    - "[[concepts/tousenkyo]]"
  ```

---

## 出力仕様

連携先（ユーザーや他スキル）に渡される形:

- `source_entities` は実ファイルに解決されていること
  - `[[entities/kusunoki-masashige]]` → `~/makimono/entities/kusunoki-masashige.md`
- 解決できないリンクは `log.md` に警告として記録されていること
- プロンプトや log.md の本文が、参照 entity の一次情報と整合していること
  - 矛盾がある場合は log.md に「意図的な脚色」として記録

---

## 実行手順

### 1. 参照の解決確認

キャラの新規作成・改善前に必ず実行:

1. 対象キャラの `characters/<id>/index.md` を読む
2. `source_entities` と `world_refs` を抽出する
3. 各リンクを絶対パスに変換:
   - `[[entities/foo]]` → `~/makimono/entities/foo.md`
   - `[[concepts/bar]]` → `~/makimono/concepts/bar.md`
4. 各ファイルが存在するか確認（Read ツール）
5. 存在しないものがあれば「entity 欠落時の対処」に進む

### 2. 一次情報の読み込み

1. 解決済みの各 entity / concept を Read で読む
2. キャラ設定に使う要素を抽出:
   - 時代・地域・身分・文化圏
   - 特徴的な逸話・技・衣装・象徴的な道具
   - 関連人物（relations の候補）
   - 「絵になる場面」（シーンバリアント候補）
3. プロンプトや index.md 本文を書くとき、これらに矛盾しないようにする
4. 読み取った内容は Shitate 側のキャラ index.md の概要欄に **どの側面を採用したか** として要約を残す

### 3. 脚色の明記

史実 / 伝承 entity を参照しつつ意図的に変更する場合（キャラクター化の都合）:

1. `log.md` の該当エントリに「脚色」セクションを追記
2. 何を史実から変えたか、なぜ変えたかを1-2行で書く
3. 例:
   ```markdown
   - **脚色**: 史実の楠木正成は40代半ばで戦死だが、本キャラは20代前半の青年として再構成。
     理由: 若年層ターゲットのシリーズのため「これから育つ武人」像にしたい。
   ```
4. キャラ ID を entity と変えた場合も脚色の一種として記録する

### 4. 双方向リンク（任意）

makimono 側にも後方リンクを残したい場合（FR-INT-02 相当）:

1. `~/makimono/entities/<slug>.md` の frontmatter または本文末尾に追記
   ```yaml
   used_by:
     - shitate/characters/<id>
   ```
2. ただし **必須ではない**。makimono の CLAUDE.md と運用方針を確認してから行う。

---

## entity 欠落時の対処

Shitate でキャラを作ろうとしたら `~/makimono/entities/<slug>.md` が存在しない場合、
**Shitate を先行させない**。正しい順序は:

1. **まず makimono 側に entity を追加する**（または追加を依頼する）
2. その後 Shitate で `source_entities` に参照を書いてキャラ化作業に進む

### 対処の具体的手順

1. ユーザーに伝える: 「このキャラに対応する entity が makimono に無いため、先に makimono 側の整理が必要です」
2. 追加方法をユーザーに確認する:
   - **手動で entity を書く**: ユーザーが makimono に直接 `entities/<slug>.md` を追加する
   - **NotebookLM 経由**: 既に notebooklm にソースがあるなら、makimono 側で `notebooklm-mcp` の `cross_notebook_query` で抽出 → wiki 化
   - **Google Drive 経由**: Drive にある文書から makimono 側で読み込み → wiki 化
   - **raw source から直接**: 講義動画・PDF・書籍等を makimono の `50_raw/` に投入 → 手動 or LLM 整理
3. makimono 側の作業が完了してから Shitate 側の作業を始める
4. 「entity が今すぐ作れないが character 作業を進めたい」場合:
   - 一時的に `source_entities` を空にして (a) 素のテキスト情報ルートで始める（AGENTS.md §2 (a)）
   - `log.md` に「将来 entity 化予定: <トピック>」と明記
   - entity が追加されたら後追いで `source_entities` を埋めて log.md に補足エントリ

### 欠落時にやってはいけないこと

- entity が無いまま Shitate 側で史実や伝承を勝手に書き下ろす
  - 情報の正本は makimono に一元化する原則に反する
  - 後から makimono と Shitate で記述が食い違う
- Shitate から NotebookLM や Google Drive に直接アクセスして情報を取ってくる
  - それは makimono の責務を Shitate が奪うことになる
  - 結果は makimono に反映されず、知識が散逸する

---

## 失敗時のリカバリ

| 症状 | 原因 | 対処 |
|---|---|---|
| `[[entities/foo]]` が解決できない | makimono 側でリネーム・削除 | `~/makimono/entities/` を Grep して新ファイル名を探し、`index.md` を更新。見つからなければ `log.md` に警告追記し、該当箇所を `source_entities` から外す |
| キャラ化したいトピックの entity が makimono に存在しない | 上流の wiki 化が未着手 | 「entity 欠落時の対処」に従い、先に makimono 側で wiki 化する |
| プロンプトが一次情報と矛盾 | 脚色が未記録 | `log.md` に脚色エントリを追加し意図を明示 |
| makimono CLAUDE.md の方針に反する編集をしてしまった | makimono 側の運用方針未確認 | 編集をロールバックし、makimono 側を先に読んでから再実行 |
| makimono が存在しない | 外部リポ未配置 | `source_entities` 欄を空にしてキャラ単体で進める。Shitate は単体完結する設計（NFR-STANDALONE）。ただし本流は (c) makimono entity からなので、makimono 配置が推奨 |
| NotebookLM や Drive の情報を Shitate 側で直接使ってしまった | レイヤー違反 | Shitate 側を一旦止め、情報を makimono 側に転記してから改めて Shitate から参照し直す |
