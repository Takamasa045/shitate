import { REPO_ROOT } from "../lib/paths.ts";
import { runChecks } from "../lib/checks.ts";
import { c, formatFinding, summarize } from "../lib/output.ts";

export interface DoctorOptions {
  character?: string;
  strict: boolean;
}

export async function runDoctor(opts: DoctorOptions): Promise<number> {
  const findings = await runChecks({
    characterIds: opts.character ? [opts.character] : undefined,
    includePromotionGate: false,
  });

  const byScope = new Map<string, typeof findings>();
  for (const f of findings) {
    const bucket = byScope.get(f.scope) ?? [];
    bucket.push(f);
    byScope.set(f.scope, bucket);
  }

  process.stdout.write(`${c.bold("forge doctor")} ${c.dim(`— ${REPO_ROOT}`)}\n\n`);
  for (const [, items] of byScope.entries()) {
    for (const f of items) {
      process.stdout.write(formatFinding(f) + "\n");
    }
    process.stdout.write("\n");
  }

  const s = summarize(findings);
  const parts = [
    s.errors ? c.red(`${s.errors} error${s.errors > 1 ? "s" : ""}`) : null,
    s.warns ? c.yellow(`${s.warns} warning${s.warns > 1 ? "s" : ""}`) : null,
    s.infos ? c.cyan(`${s.infos} info`) : null,
  ].filter(Boolean);
  if (parts.length === 0) parts.push(c.green("all checks clean"));
  process.stdout.write(parts.join(c.dim(", ")) + "\n");

  if (opts.strict) return s.errors > 0 ? 1 : 0;
  return 0;
}
