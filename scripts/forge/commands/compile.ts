import {
  compile,
  CompileError,
  writeCompileArtifacts,
} from "../lib/compile.ts";
import { c } from "../lib/output.ts";
import { relToRepo } from "../lib/character.ts";

export interface CompileCliOptions {
  character: string;
  variant: string;
  dryRun: boolean;
  withImage: boolean;
  json: boolean;
}

export async function runCompile(opts: CompileCliOptions): Promise<number> {
  try {
    const artifacts = await compile({
      characterId: opts.character,
      variantId: opts.variant,
      standalone: !opts.withImage,
    });

    if (opts.json) {
      process.stdout.write(JSON.stringify(artifacts.manifest) + "\n");
      return 0;
    }

    for (const w of artifacts.warnings) {
      process.stderr.write(`${c.yellow("WARN")} ${w}\n`);
    }

    if (opts.dryRun) {
      process.stdout.write(`${c.bold("=== dry-run ===")}\n`);
      process.stdout.write(
        `run_id: ${artifacts.runId}\nrun_dir: ${relToRepo(artifacts.runDir)}\n`,
      );
      process.stdout.write(`lexicon_used (${artifacts.lexiconUsed.length}):\n`);
      for (const ref of artifacts.lexiconUsed) {
        process.stdout.write(`  - ${ref}\n`);
      }
      process.stdout.write(`\n${c.bold("--- prompt.txt ---")}\n`);
      process.stdout.write(artifacts.prompt);
      process.stdout.write(`\n${c.bold("--- negative.txt ---")}\n`);
      process.stdout.write(artifacts.negative);
      process.stdout.write(`\n${c.bold("--- manifest.json ---")}\n`);
      process.stdout.write(JSON.stringify(artifacts.manifest, null, 2) + "\n");
      return 0;
    }

    await writeCompileArtifacts(artifacts);

    process.stdout.write(
      `${c.green("✓")} compiled → ${c.bold(relToRepo(artifacts.runDir))}\n`,
    );
    process.stdout.write(
      `  prompt.txt (${artifacts.prompt.length} chars), negative.txt (${artifacts.negative.length} chars), manifest.json\n`,
    );
    process.stdout.write(`  lexicon_used: ${artifacts.lexiconUsed.length} ref(s)\n`);
    return 0;
  } catch (err) {
    if (err instanceof CompileError) {
      process.stderr.write(`${c.red("ERROR")} ${err.message}\n`);
      return err.exitCode;
    }
    throw err;
  }
}
