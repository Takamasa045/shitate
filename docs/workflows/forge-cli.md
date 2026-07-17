# forge CLI — 使い方

`scripts/forge/` に実装された TypeScript 製 CLI。
リポ固有の整合チェック・compile 自動化・INDEX 同期を担う。

## 前提

- Node.js v22+（`package.json` の engines で指定）
- 初回のみ `pnpm install`（devDep の tsx / typescript と runtime deps を取得）

## 起動

すべて以下のいずれかで起動できる:

```
pnpm forge <subcommand> [args]     # 推奨
./bin/forge <subcommand> [args]    # シェルラッパー
npx tsx scripts/forge/cli.ts ...   # 直接
```

以下、例は `pnpm forge` で記載。

## サブコマンド

### `forge status`

各キャラの現況ダッシュボード。名前・status・base・run 数・anchor 有無・log 最新エントリ・次の改善を表示。

```
pnpm forge status
pnpm forge status --character washi-fox
```

セッション冒頭で「いま何をすべきか」を掴むのに使う。AGENTS.md §1 の「log 直近3件読む義務」を
1 コマンドで俯瞰できる（詳細は各 log.md を読む）。

### `forge doctor`

リポ全体の整合性を **読み取り専用** でチェック。

```
pnpm forge doctor
pnpm forge doctor --character washi-fox
pnpm forge doctor --strict       # error が1件でもあれば exit 1
```

検出するもの:

- index.md frontmatter の必須フィールド欠落・id 不一致
- base.md / variant.md の必須セクション欠落
- variant の Lexicon 参照の解決失敗・`lexicon/negatives.md#` 混入
- history/base.v\<N\>.md の欠落
- outputs/\<run\>/manifest.json の欠落・run_id 不一致・必須フィールド欠落
- prompt.txt と manifest.compiled_prompt の乖離
- INDEX.md に載っていないキャラ、INDEX.md の幽霊参照
- anchor 命名の不在

### `forge compile <character> <variant>`

base + variant + lexicon を [../schemas/compile.md](../schemas/compile.md) の仕様どおりに結合し、
`characters/<id>/outputs/<run-id>/` に `prompt.txt` / `negative.txt` / `manifest.json` を書き出す。
**compile の標準実行手段（参照実装）**。手動手順は CLI 不能時のみ [../../integrations/prompt-compile.md](../../integrations/prompt-compile.md)。

```
pnpm forge compile washi-fox three-view
pnpm forge compile washi-fox three-view --dry-run    # 書き出さず stdout に表示
pnpm forge compile washi-fox three-view --with-image # 画像生成を伴う run (_compile サフィックス無し)
```

副作用:

- `outputs/<run-id>/` 配下の 3 ファイルのみ作成
- **log.md は編集しない**（compile は WIP で繰り返し走るため）
- `INDEX.md` は更新しない（別途 `forge index --write`）

エラー:

- dep version 不一致・セクション欠落・lexicon 解決失敗などで exit code 非ゼロ
- 既存 run_id は上書きせず `_r2`, `_r3` ... を採番

### `forge new <id>`

templates 相当の骨組みを一発生成し、INDEX.md の Characters 表を同期する。

```
pnpm forge new my-mascot --name "マイマスコット"
pnpm forge new kusunoki-youth --name "楠木の若者" --role "南北朝の青年武人"
pnpm forge new my-mascot --skip-index   # INDEX は後で forge index --write
```

作成するもの:

- `characters/<id>/index.md`
- `prompts/base.md` + `prompts/history/base.v1.md`
- `log.md`（scaffold エントリ）
- `references/sources.yaml`
- 空の `prompts/variants/` / `references/images/` / `outputs/`

既存 `characters/<id>/` がある場合は失敗する（`--force` は上書き。通常使わない）。

### `forge lint`

品質ゲート。error が1件でもあれば exit 1。`--promotion` で warning も error 扱い（stable 昇格・画像生成投入前に使う）。

```
pnpm forge lint                                   # 全キャラの error チェック
pnpm forge lint --character washi-fox
pnpm forge lint --character washi-fox --promotion   # 昇格ゲート
```

`doctor` との違い:

- `doctor` は「俯瞰」。デフォルト exit 0、`--strict` で error があれば exit 1
- `lint` は「合格判定」。デフォルト exit 1 on error、`--promotion` で warning も exit 1 に昇格
- `lint --promotion` の追加チェック:
  - log.md 最新エントリの「次の改善」欄が空でないこと
  - status: stable のキャラに anchor が 1 枚以上あること
  - manifest.compiled_prompt が `(see prompt.txt)` プレースホルダーでないこと (error 扱い)

**pre-commit hook には入れない**。WIP 作業を壊すため。手動実行のみを想定。

### `forge index`

INDEX.md の Characters 表を実データから再生成する。

```
pnpm forge index --check    # 差分があれば exit 1、無ければ exit 0
pnpm forge index --write    # Characters 表ブロックを書き換える
```

- 生成ブロックは `<!-- forge:generated:characters:start -->` / `<!-- forge:generated:characters:end -->` で囲まれる
- **凡例・評価ハイライト・makimono entities 表は手書きのまま保持**される
- 初回実行時はマーカーを挿入しつつ既存 Characters 表を差し替える

## 運用例

新規キャラ追加後:

```
pnpm forge doctor --character <new-id>   # 骨組みが揃っているか確認
pnpm forge compile <new-id> three-view   # 三面図 compile
pnpm forge index --write                 # INDEX.md に反映
```

プロンプト改善後:

```
pnpm forge compile <id> <variant> --dry-run   # 差分確認
pnpm forge compile <id> <variant>             # 書き出し
```

セッション冒頭:

```
pnpm forge status          # 全キャラの直近状態を俯瞰
pnpm forge doctor          # ドリフトの有無を確認
```

## 設計原則

- 書き込み副作用は **明示的なサブコマンド（compile, index --write）でのみ**
- doctor / status は **読み取り専用**
- compile は仕様書 [../schemas/compile.md](../schemas/compile.md) の参照実装
- 手動 compile（Claude Code が Read/Write で行う場合）も同仕様に準拠すべき
