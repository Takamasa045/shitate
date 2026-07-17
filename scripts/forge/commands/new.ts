import { scaffoldCharacter, ScaffoldError } from "../lib/scaffold.ts";
import { c } from "../lib/output.ts";
import { runIndex } from "./index.ts";

export interface NewOptions {
  id: string;
  name?: string;
  role?: string;
  skipIndex?: boolean;
  force?: boolean;
}

export async function runNew(opts: NewOptions): Promise<number> {
  let result;
  try {
    result = await scaffoldCharacter({
      id: opts.id,
      name: opts.name,
      role: opts.role,
      force: opts.force,
    });
  } catch (error) {
    if (error instanceof ScaffoldError) {
      process.stderr.write(`${c.red("ERROR")} ${error.message}\n`);
      return 1;
    }
    throw error;
  }

  process.stdout.write(`${c.green("✓")} scaffolded characters/${result.id}/\n`);
  for (const path of result.files) {
    process.stdout.write(`  ${c.dim(`characters/${result.id}/${path}`)}\n`);
  }
  process.stdout.write(
    `${c.dim("next")}: edit prompts/base.md, add a variant, then: pnpm forge compile ${result.id} <variant>\n`,
  );

  if (!opts.skipIndex) {
    const code = await runIndex({ mode: "write" });
    if (code !== 0) return code;
  }
  return 0;
}
