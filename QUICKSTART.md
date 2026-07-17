# ShitateをCodex / Claude Codeで始める

このガイドでは、cloneしたShitateをCodexまたはClaude Codeで開き、自然な言葉だけでStudioの起動と最初の案内を頼みます。
知識wikiの makimono や画像生成サービスは必要ありません。

## 1. Shitateのリポジトリを用意する

[GitHubのShitateリポジトリ](https://github.com/Takamasa045/shitate)をcloneします。
自分のGitHub上にコピーを持ちたい場合は、先に「Fork」を押し、そのForkをcloneします。

- **Fork** — 自分のGitHub上にShitateのコピーを作ること
- **clone** — GitHubのリポジトリを、PCで使える作業用フォルダにすること

ターミナルを使う場合のcloneコマンドは次のとおりです。GitHub Desktopなどを使ってcloneしても構いません。

```bash
git clone https://github.com/Takamasa045/shitate.git
```

Forkした場合は、上のURLを自分のForkのURLへ置き換えます。

## 2. Codex / Claude Codeでフォルダを開く

- **Codex** — 「Add project」などから、cloneした `shitate` フォルダまたはGitリポジトリを選びます
- **Claude Code Desktop** — 「Code」→「Local」→「Select folder」から、cloneした `shitate` フォルダを選びます
- **Claude Code CLI** — Shitateフォルダで `claude` を起動します

[Codexの公式スタートガイド](https://openai.com/codex/get-started/)と[Claude Code Desktopの公式ガイド](https://code.claude.com/docs/en/desktop-quickstart)にも、フォルダを選ぶ画面が掲載されています。

## 3. 最初の依頼を貼り付ける

Codex / Claude Codeのチャットへ、次の文章をそのまま貼り付けます。

```text
このShitateリポジトリを使える状態にセットアップしてください。
AGENTS.mdとREADME.mdを読み、必要な環境を確認して、不足があれば分かりやすく案内してください。
準備ができたら、同梱のランチャーでShitate Studioを起動し、サンプル「和紙狐」で基本操作を案内してください。
その後、私の最初のキャラクター作成を質問しながら進めてください。
画像は、私が明示するまで生成しないでください。
最後に、次に私がCodex / Claude Codeへ頼める一言を示してください。
```

Codex / Claude Codeが次を進めます。

- `AGENTS.md`を読み、このリポジトリの安全ルールを確認する
- Node.js 22以上など、起動に必要な環境を確認する
- 不足する依存関係を準備する
- 同梱ランチャーからShitate Studioを起動する
- ブラウザが開いたら、サンプルから操作を案内する

ファイル変更やコマンド実行の許可を求められた場合は、内容を確認して許可してください。

## Studioで一巡する

### 1. サンプルを見る

「人物録」から、画像なしのサンプル「和紙狐」を開きます。

- 「概観」では、名前・役割・外見の核を確認できます
- 「詞書」では、基本の見た目と三面図などの場面差分を確認できます
- 「手本」では、採用したお手本画像を確認できます。配布サンプルでは空です
- 「日録」では、これまでの評価と次の改善を確認できます
- 「巻物」では、過去にまとめたプロンプトを確認できます
- 「調合」では、基本設定と場面指定を画像生成用の文章へまとめます

### 2. プロンプトを確認する

キャラクター詳細の「調合」を開き、variantを選びます。
「調合する」を押すと、ファイルを書き込まない確認結果（dry-run）が表示されます。必要な場合だけ「compile を保存」を押します。

保存すると、次の3つが新しいrunとして残ります。

- `prompt.txt` — 画像生成ツールへ渡す本文
- `negative.txt` — 避けたい表現
- `manifest.json` — 何を組み合わせたかの記録

同じrun名のフォルダを上書きすることはありません。

### 3. 自分のキャラクターを作る

流れを確認できたら、「人物録」に戻り、「新しいキャラクター」を押します。

1. IDに、英小文字から始まる英小文字・数字・ハイフンの管理名を入れます。例: `my-fox`
2. 表示名に、画面で使いたいキャラクター名を入れます
3. 必要なら、役割に「案内役」「マスコット」などを入れて作成します
4. 「詞書」の `base` に、毎回守りたい顔、体格、衣装、色、持ち物を書きます
5. 「詞書」で variant を追加し、三面図や表情集など、作りたい場面を書きます
6. 「調合」で内容を確認し、問題がなければ compile を保存します
7. `prompt.txt` を普段使っている画像生成ツールへ渡します
8. 結果を見て「日録」に評価と次の改善を残します

詞書を編集するときは、`##` で始まる見出しや、本文を囲む3つのバッククォートを残します。
右側の「保存前の確認」がすべて `✓` になれば保存できます。

採用した画像ができた場合だけ、「手本」から登録します。
Shitate は画像を自動生成せず、画像やプロンプトを自動で外部へ送りません。

### 4. 終了する

Codex / Claude Codeに、次のように頼めます。

> Shitate Studioを終了して。保存されていない変更がないかも確認して。

自分で終了する場合は、ランチャーが開いたターミナルで `Control + C` を押します。

## 保存場所とバックアップ

作成した内容は、すべてcloneした Shitate フォルダ内に保存されます。

- キャラクター設定: `characters/<キャラクターID>/`
- 保存したプロンプト: その中の `outputs/`
- 登録したお手本画像: その中の `references/images/`

Shitate フォルダを丸ごとコピーすれば、設定と履歴をまとめてバックアップできます。
画像生成サービス側にだけ保存した画像は含まれないため、必要な画像は別途保管してください。

## 次回からの頼み方

一度セットアップした後は、ShitateのフォルダをCodex / Claude Codeで開き、次のように頼めます。

- 「Shitate Studioを起動して、前回の続きから案内して」
- 「新しいキャラクターを作りたい。必要なことを一つずつ質問して」
- 「前回の日録を読んで、次に改善することを提案して」
- 「このキャラクターの三面図用プロンプトを調合して」

## AIを使わずに起動する場合

通常はCodex / Claude Codeに「Studioを起動して」と頼めば十分です。
自分で起動したい場合だけ、次の方法を使います。

### Mac

1. [Node.js 22以上](https://nodejs.org/ja/download)をインストールします
2. Shitateフォルダの `Shitate Studio.command` を右クリックして「開く」を選びます
3. 準備が終わると、ブラウザで `http://127.0.0.1:5180` が開きます

2回目からは `Shitate Studio.command` のダブルクリックだけで起動できます。

## うまく起動しないとき

まず、表示されたエラーをCodex / Claude Codeへそのまま渡してください。

> Shitate Studioが起動しません。このエラーを確認して、必要な対応を進めてください。個人データや画像は外部へ送らないでください。

自分で確認する場合は、次の項目を参照してください。

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
