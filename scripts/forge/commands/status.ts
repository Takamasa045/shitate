import {
  listCharacterIds,
  readCharacter,
  listRuns,
  readLatestLogEntry,
  listReferences,
} from "../lib/character.ts";
import { c } from "../lib/output.ts";
import { BRAND_NAME } from "../lib/brand.ts";

export interface StatusOptions {
  character?: string;
}

export async function runStatus(opts: StatusOptions): Promise<number> {
  const ids = opts.character ? [opts.character] : await listCharacterIds();
  if (ids.length === 0) {
    process.stdout.write("no characters found\n");
    return 0;
  }

  process.stdout.write(`${c.bold(`${BRAND_NAME} status`)}\n\n`);

  for (const id of ids) {
    const info = await readCharacter(id);
    const fm = info.frontmatter ?? {};
    const runs = await listRuns(id);
    const refs = await listReferences(id);
    const anchors = refs.filter((f) => /anchor/i.test(f));
    const latest = await readLatestLogEntry(id);

    const status = fm.status ?? "?";
    const statusColored =
      status === "stable"
        ? c.green(status)
        : status === "experimental"
          ? c.cyan(status)
          : status === "draft"
            ? c.gray(status)
            : c.dim(status);

    process.stdout.write(
      `${c.bold(id)}  ${c.dim("—")} ${fm.name ?? "(name?)"} ${c.dim("/")} ${statusColored} ${c.dim("/")} base ${fm.base_version ?? "?"}\n`,
    );
    process.stdout.write(
      `  runs: ${runs.length}  anchors: ${anchors.length}${anchors.length ? ` (${anchors.join(", ")})` : ""}\n`,
    );
    if (latest) {
      process.stdout.write(`  ${c.dim("latest log")} ${latest.heading}\n`);
      if (latest.nextAction) {
        process.stdout.write(`  ${c.yellow("次の改善")} ${latest.nextAction}\n`);
      }
    } else {
      process.stdout.write(`  ${c.dim("latest log")} ${c.yellow("(no log entries)")}\n`);
    }
    process.stdout.write("\n");
  }
  return 0;
}
