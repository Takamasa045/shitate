# Studio v0.3 (Web UI) — 使い方

`studio/` 配下に実装された Vite + React + Hono のローカル専用 Web UI。
CLI と同じ `scripts/forge/lib/` を共有し、キャラクター作成、選定済み anchor 登録、compile 保存までの主要ループをブラウザで扱う。

## 起動

macOS では、リポジトリ直下の `Shitate Studio.command` を右クリックして「開く」と、
初回セットアップ、Studio 起動、ブラウザ表示まで自動で進む。

ターミナルから同じランチャーを使う場合:

```bash
pnpm preview
```

開発時にサーバーとUIのログを直接確認する場合:

```bash
pnpm studio
```

- API (Hono): `http://127.0.0.1:5179`
- UI (Vite + React): `http://127.0.0.1:5180`

UI の Vite が `/api/*` を API にプロキシするため、通常は `5180` だけ開けばよい。
別のローカルワークスペースを安全に試す場合は、サーバー起動前にルートを指定する。

```bash
SHITATE_ROOT=/absolute/path/to/shitate pnpm studio
```

ポート変更は次の環境変数を使う。

```bash
STUDIO_PORT=6000 \
STUDIO_CLIENT_PORT=6001 \
STUDIO_API_ORIGIN=http://127.0.0.1:6000 \
pnpm studio
```

## 主要ワークフロー

### 1. キャラクターを作る

人物録の「新しいキャラクター」から ID・表示名・役割を入力する。
ID は ASCII kebab-case（例: `washi-fox`）。作成すると `characters/<id>/` の骨組みと `INDEX.md` が更新される。
既存 ID は上書きせずエラーになる。

### 2. base を編集する

キャラ詳細の「詞書」で base を開き、Markdown 全体を編集する。

- 語句やネガティブの調整など軽微な変更: 同じ base version で保存
- 外観の核や印象が変わる主要改訂: 新しい base version として保存

主要改訂は history を残し、`index.md` の `base_version` と依存関係を整合させる。
保存は表示時の revision を伴う。別タブや別エージェントが先に変更していた場合は競合として停止する。

### 3. variant を作成・編集する

「詞書」で variant ID（例: `three-view`、`scenes/mountain-ambush`）を指定して作成する。
Markdown は [prompt schema](../schemas/prompt.md) の必須セクションをすべて含める。
既存 variant の編集にも revision 競合検出が働く。

### 4. log を追記する

「日録」から試行・評価・次の改善などを入力する。新しいエントリは `log.md` の先頭側へ DESCENDING で追記される。
「次の改善」は空にできない。Studio を開く前の直近エントリも読み、同じ失敗を繰り返さない。

### 5. 選定済み anchor を登録する

「手本」の「アンカーを登録」から、ユーザーが採用済みの画像を選ぶ。

1. anchor ID（`face`、`outfit`、`full-body` 等）を ASCII kebab-case で入力
2. JPEG / PNG / WebP（5 MiB 以下）を選択
3. 用途メモと「次の改善」を入力して登録
4. 保存名、プレビュー、容量を確認する

保存名は元ファイル名を使わず、サーバーが `<anchor-id>-anchor.<ext>` を生成する。
MIME と magic bytes が一致しない画像、同じ ID の既存 anchor、容量超過は保存前に停止する。
成功時は画像実体、`references/sources.yaml`、`log.md`、`INDEX.md` をまとめて同期する。
既存 anchor の差し替え・削除は Studio では行わない。

### 6. dry-run と compile 保存

「調合」で variant を選ぶ。

1. dry-run で結合結果・negative・warnings を確認する（ファイルは書かない）
2. 問題がなければ compile を保存する
3. 「巻物」で run と `prompt.txt` / `negative.txt` / `manifest.json` を確認する

run ID は既存ディレクトリを上書きしない。同じ日に同じ組み合わせを再実行すると `_r2`, `_r3` のように採番する。

## 画面構成

- 人物録 (`/characters`): 一覧、現況、新規キャラクター作成
- キャラクター詳細 (`/characters/<id>`): 概観、詞書、巻物、日録、手本、調合
- 診立て (`/doctor`): `forge doctor` 相当の findings と再実行

「手本」は参照画像の閲覧と、選定済み anchor の新規登録を扱う。画像生成や既存 anchor の差し替えは扱わない。

## 書き込み境界

Studio v0.3 が書き込むのは `SHITATE_ROOT` 内の次の成果物だけ。旧 `CHARACTER_FORGE_ROOT` も移行互換として受理する。

- 新規キャラの骨組みと `INDEX.md`
- `prompts/base.md`、`prompts/history/`、`prompts/variants/`
- `log.md`
- 選定済み anchor の `references/images/<id>-anchor.{jpg,png,webp}` と `references/sources.yaml`
- compile 保存先の `outputs/<run-id>/{prompt.txt,negative.txt,manifest.json}`

書き込み API は Studio 専用ヘッダーを要求する。通常 mutation は JSON、anchor 登録だけは multipart/form-data とし、ID・variant・サイズ・MIME・magic bytes を検証する。
プロンプト保存は一時ファイルからの atomic rename を使う。自動の `.bak` は作らないため、恒久的なバックアップとレビューには Git を使う。
anchor は完成済み一時ファイルを exclusive link で配置し、複合更新が失敗した場合は画像・YAML・日録を元へ戻す。
anchor 登録では書き込み先の symlink を拒否し、共通 `INDEX.md` の更新はキャラをまたいで直列化する。

### 競合が出たとき

HTTP 409 / revision conflict は、画面が表示した後に対象ファイルが変更された合図。

1. 編集中の内容を一時的に手元へ控える
2. 「読み直す」で最新版を取得する
3. 差分を統合する
4. 最新 revision に対して保存し直す

Studio は競合時に相手の変更を上書きしない。リアルタイム共同編集やファイルロックは提供しない。

## 画像生成との境界

Studio の compile 保存と anchor 登録は、画像・動画生成 API や外部ツールを呼ばない。
anchor 登録はユーザーが既に選定したローカル画像を正本へ取り込むだけである。
画像生成はユーザーが「生成して」「画像で出して」などと明示した場合のみ、実行中ランタイム向けの integration 手順を使う。
複数候補を生成した場合も、ユーザーが選んだ画像だけを anchor / output として登録する。

## テスト

```bash
pnpm test            # unit + API integration
pnpm test:launcher:coverage # ランチャー補助ロジックの 80% coverage gate
pnpm test:coverage   # Studio mutation layer の 80% coverage gate
pnpm test:e2e        # Chromium の主要ユーザージャーニー
```

E2E は毎回 OS の一時ディレクトリに fixture workspace を作り、`SHITATE_ROOT` をそこへ向け、desktop / mobile Chromium で主要導線を通す。
実リポジトリの `characters/`、`INDEX.md`、`outputs/` は変更しない。失敗時は Playwright の trace、screenshot、video を保持する。
coverage gate は mutation / prompt / log / anchor / revision service を対象に、line・function・branch を各80%以上とする。

## アーキテクチャ

```text
studio/client/        Vite + React UI
       | /api proxy
studio/server/        Hono API + local mutation boundary
       |
scripts/forge/lib/    CLI と共有する正本ロジック
       |
characters/           plain text の正本
```

- `scripts/forge/lib/*`: Node 専用。ブラウザから import しない
- `studio/shared/types.ts`: client/server 共有型。Node-only API を入れない
- `studio/client/*`: ブラウザコード。ファイルシステムへ直接アクセスしない

## トラブルシューティング

### 読み込み中のまま、または 404

```bash
curl http://127.0.0.1:5179/api/health
```

`{"ok":true}` でなければ API 側を確認する。ポートを変えた場合は `STUDIO_API_ORIGIN` も一致させる。

### variant が一覧に出ない / compile できない

```bash
pnpm forge doctor --character <id>
```

必須セクション、依存 base version、Lexicon 参照を修正してから再試行する。

### 保存が競合する

別タブ、エディタ、エージェントによる更新が原因。強制上書きはせず、最新版を読み直して統合する。

### anchor を登録できない

- HTTP 409: 同じ anchor ID が既にある。Studio は差し替えないため、[anchor lifecycle](anchor-lifecycle.md) に沿って人間が判断する
- HTTP 413: 5 MiB 以下へ縮小する
- HTTP 415 / 422: JPEG / PNG / WebP の正しい実体を選び直す（拡張子だけの変更では不可）
