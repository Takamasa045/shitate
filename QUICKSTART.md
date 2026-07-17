# Shitateを最初の5分で試す

このガイドでは、Shitate Studioを開き、サンプルキャラクターの設定と生成用プロンプトを見るところまで進みます。
知識wikiの makimono や画像生成サービスは必要ありません。

## Mac：ランチャーで開く

### 1. Node.jsを準備する

[Node.jsのダウンロードページ](https://nodejs.org/ja/download)から、Node.js 22以上をインストールします。
すでに入っている場合は、そのまま次へ進めます。

### 2. Shitateをダウンロードする

GitHubの緑色の「Code」ボタンから「Download ZIP」を選び、ダウンロードしたZIPを展開します。

Gitを使える方は、リポジトリをcloneしても構いません。

### 3. ランチャーを開く

展開したShitateフォルダの中にある **`Shitate Studio.command`** を探します。

初回は、ファイルを右クリックして「開く」を選んでください。
確認画面が出たら、もう一度「開く」を選びます。

ターミナルが開き、初回セットアップが始まります。必要なファイルをダウンロードするため、数分かかることがあります。
準備が終わると、ブラウザで `http://127.0.0.1:5180` が自動的に開きます。

2回目からは `Shitate Studio.command` のダブルクリックだけで起動できます。

## Studioで一巡する

### 1. サンプルを見る

「キャラクター」から、画像なしのサンプル「和紙狐」を開きます。

- 「人物」では、名前・役割・外見の核を確認できます
- 「詞書」では、基本の見た目と三面図などの場面差分を確認できます
- 「手本」では、採用済みのanchor画像を確認できます
- 「日録」では、これまでの評価と次の改善を確認できます
- 「巻物」では、過去にまとめたプロンプトを確認できます

### 2. プロンプトを確認する

キャラクター詳細の「調合」を開き、variantを選びます。
まずdry-runで内容を確認し、必要な場合だけ保存します。

保存すると、次の3つが新しいrunとして残ります。

- `prompt.txt` — 画像生成ツールへ渡す本文
- `negative.txt` — 避けたい表現
- `manifest.json` — 何を組み合わせたかの記録

同じrun名のフォルダを上書きすることはありません。

### 3. 終了する

ランチャーが開いたターミナルで `Control + C` を押します。
確認が出た場合は終了を選び、ターミナルを閉じます。

## うまく起動しないとき

### 「Node.jsが見つかりません」と表示される

[Node.js 22以上](https://nodejs.org/ja/download)をインストールし、ランチャーをもう一度開きます。

### ダブルクリックしても開けない

初回はダブルクリックではなく、`Shitate Studio.command` を右クリックして「開く」を選びます。

「アクセス権がありません」と表示される場合は、ターミナルでShitateフォルダを開き、次を一度だけ実行します。

```bash
chmod +x "Shitate Studio.command"
```

### 初回セットアップが止まる

インターネット接続を確認して、ランチャーを開き直します。
途中まで準備できている場合も、不足分だけが続けてインストールされます。

### ブラウザが開かない

ターミナルに「ブラウザで開きました」と表示されていれば、ブラウザへ次のURLを入力します。

```text
http://127.0.0.1:5180
```

### 5180番ポートが他のアプリで使われている

ターミナルから別のポートを指定できます。

```bash
STUDIO_CLIENT_PORT=6180 node scripts/launch-studio.mjs
```

ブラウザには `http://127.0.0.1:6180` が開きます。

## Windows / Linux

Node.js 22以上を入れ、Shitateフォルダで次を実行します。

```bash
node scripts/launch-studio.mjs
```

必要なファイルの準備、Studioの起動、ブラウザ表示まで自動で進みます。

## ターミナルで使う方へ

すでにNode.jsとpnpmを使っている場合は、従来どおりコマンドから操作できます。

```bash
pnpm install --frozen-lockfile
pnpm forge status
pnpm forge doctor
pnpm studio
```

サンプルキャラクターのプロンプトだけを確認する場合:

```bash
pnpm forge compile washi-fox three-view --dry-run
```

ファイルとして保存する場合は `--dry-run` を外します。

```bash
pnpm forge compile washi-fox three-view
```

詳しいCLIの説明は [docs/workflows/forge-cli.md](docs/workflows/forge-cli.md) を参照してください。

## 次に読むもの

- [README.md](README.md) — Shitateでできること
- [INDEX.md](INDEX.md) — キャラクター一覧
- [docs/workflows/studio.md](docs/workflows/studio.md) — Studioの詳しい使い方
- [AGENTS.md](AGENTS.md) — AIアシスタント向けの操作ルール

困ったときは `pnpm forge doctor` でデータの整合性を確認できます。
