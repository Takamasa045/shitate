#!/usr/bin/env node
import { Command } from "commander";
import { runDoctor } from "./commands/doctor.ts";
import { runStatus } from "./commands/status.ts";
import { runCompile } from "./commands/compile.ts";
import { runIndex } from "./commands/index.ts";
import { runLint } from "./commands/lint.ts";
import { runNew } from "./commands/new.ts";
import { BRAND_NAME } from "./lib/brand.ts";

const program = new Command();

program
  .name("forge")
  .description(`${BRAND_NAME} CLI — repo-native tooling for prompt factory workflow`)
  .version("0.1.0");

program
  .command("doctor")
  .description("リポ全体の整合性を読み取り専用でチェック")
  .option("-c, --character <id>", "特定キャラのみ検査")
  .option("--strict", "error が1件でもあれば非ゼロ終了")
  .action(async (options) => {
    const code = await runDoctor({
      character: options.character,
      strict: Boolean(options.strict),
    });
    process.exit(code);
  });

program
  .command("status")
  .description("各キャラの現況・直近の log を一覧表示")
  .option("-c, --character <id>", "特定キャラのみ表示")
  .action(async (options) => {
    const code = await runStatus({ character: options.character });
    process.exit(code);
  });

program
  .command("compile")
  .description("base + variant + lexicon を結合して outputs/<run-id>/ に書き出す")
  .argument("<character>", "キャラ ID (例: washi-fox)")
  .argument("<variant>", "variant path (例: three-view, scenes/mountain-ambush)")
  .option("--dry-run", "ファイル書き出しをせず stdout に出力")
  .option("--with-image", "画像生成を伴う run として扱う (_compile サフィックス無し)")
  .option("--json", "manifest のみを JSON で stdout に出力 (CI/外部連携向け、書き込みなし)")
  .action(async (character, variant, options) => {
    const code = await runCompile({
      character,
      variant,
      dryRun: Boolean(options.dryRun),
      withImage: Boolean(options.withImage),
      json: Boolean(options.json),
    });
    process.exit(code);
  });

program
  .command("new")
  .description("キャラ骨組みをスキャフォールドし INDEX を同期する")
  .argument("<id>", "キャラ ID (ASCII kebab-case, 例: aka-shiba)")
  .option("--name <displayName>", "表示名 (省略時は id)")
  .option("--role <role>", "役割・立場")
  .option("--skip-index", "INDEX.md を更新しない")
  .option("--force", "既存ファイルを上書きする (危険)")
  .action(async (id, options) => {
    const code = await runNew({
      id,
      name: options.name,
      role: options.role,
      skipIndex: Boolean(options.skipIndex),
      force: Boolean(options.force),
    });
    process.exit(code);
  });

program
  .command("index")
  .description("INDEX.md の Characters 表を実データと突き合わせる")
  .option("--check", "差分を表示するのみ。差があれば exit 1")
  .option("--write", "差分を書き込む (Characters 表ブロックのみ、他は手動編集のまま)")
  .action(async (options) => {
    const mode: "check" | "write" = options.write ? "write" : "check";
    const code = await runIndex({ mode });
    process.exit(code);
  });

program
  .command("lint")
  .description("manual-only の品質ゲート (error で exit 1、--promotion で warning も exit 1)")
  .option("-c, --character <id>", "特定キャラのみ検査")
  .option("--promotion", "stable 昇格・外部 generator 投入前の厳格チェック")
  .action(async (options) => {
    const code = await runLint({
      character: options.character,
      promotion: Boolean(options.promotion),
    });
    process.exit(code);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
