# Integration: Tsugite

Shitate の選定済みキャラを、別リポジトリの動画制作パイプライン
Tsugite へ安全に渡す手順。

Shitate はキャラ同一性の正本、Tsugite は `project.yaml` と動画制作の正本とする。
Tsugite から Shitate のファイルを直接参照せず、run 単位の不変snapshotをコピーする。

## 前提条件

- 対象キャラについて `index.md`、`log.md` 直近3件、`prompts/base.md` を確認済み
- `pnpm forge compile <character> <variant>` が完了している
- `outputs/<run-id>/` に `prompt.txt`、`negative.txt`、`manifest.json` がある
- 選定済みanchorが `references/images/` にある
- Tsugite側に `project.yaml` と `manifest.json` がある

本手順は生成を実行しない。非dry-runの `run`、`render`、課金操作は従来どおり別承認とする。

## 入力仕様

- Shitate root
- character ID
- compileまたは生成済みrun ID
- 選定済みanchor。manifestから1件に決まらない場合は `--anchor` で明示
- Tsugiteの `project.yaml`
- 任意: anchorを割り当てるgeneration request ID

## 実行

Tsugiteリポのルートから実行する。

```sh
bin/pipeline character-import \
  --config projects/<project>/project.yaml \
  --forge-root /absolute/path/to/shitate \
  --character <character-id> \
  --run-id <run-id> \
  --anchor references/images/main-anchor.png \
  --request-id <request-id> \
  --display-name "<表示名>" \
  --json
```

`--forge-root` は、Tsugite側の移行互換名 `CHARACTER_FORGE_ROOT` 環境変数でも指定できる。
`--request-id` を省略した場合、manifestへの画像・speaker登録だけを行い、generation requestは変更しない。

## 出力仕様

Tsugiteプロジェクト内に次のsnapshotを作る。

```text
projects/<project>/media/character-forge/<character-id>/<run-id>/
├── prompt.txt
├── negative.txt
├── forge-manifest.json
├── anchor.<ext>
└── character-lock.json
```

snapshot先の `media/character-forge/` はTsugite側の既存データ契約として維持する。Shitateの表示名・リポジトリslugとは別の互換識別子である。

- `character-lock.json` は source identity、`base_sha`、binding、各ファイルのSHA-256を持つ
- Tsugite manifestの `images[]` と `speakers[]` にanchorとキャラを追加する
- `--request-id` 指定時は対象requestを `image-to-video` にし、`params.image` をsnapshot anchorへ向ける
- キャラ外へのpath traversal、anchorのsymlink脱出、既存ID衝突、checksum不一致を拒否する
- 同一snapshotの再実行はno-op。内容が異なる既存ディレクトリは上書きしない

`negative.txt` は再現情報として保存するが、現行PixVerse video CLIにはnegative prompt引数がないため、
requestへ自動結合しない。CLI結果の `character_import.negative_prompt_not_applied` 警告をGate 1で確認する。

## Tsugite側の確認

```sh
bin/pipeline guides --catalog pixverse --model v6 --input-mode image-to-video --json
bin/pipeline validate --config projects/<project>/project.yaml --json
bin/pipeline plan --config projects/<project>/project.yaml --json
bin/pipeline review --config projects/<project>/project.yaml --json
bin/pipeline run --config projects/<project>/project.yaml --dry-run --json
```

`review` のキャラクターシートで表示名とanchorを確認する。
動画promptはShitateの長い静止画promptをそのまま貼らず、anchorで同一性を固定し、
動作とカメラワークを1〜2文で書く。

実際に採用・生成した場合は、初回または大きな変更時にShitate側の `log.md` へ
Tsugite project、run ID、結果、次の改善を記録する。

## 失敗時

- `anchor_ambiguous`: `--anchor` で選定済み1枚を明示する
- `destination_conflict`: 既存snapshotを消さず、source/destinationのlockとSHAを確認する
- `image_conflict` / `speaker_conflict`: 別の `--speaker-id` を使うか、manifest側の意図を確認する
- `request_conflict`: 既存I2V画像を勝手に差し替えず、request IDを分ける
- `validate`失敗: manifestのdialogue preset人数制約やasset rootを確認する
