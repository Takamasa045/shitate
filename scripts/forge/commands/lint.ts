import { REPO_ROOT } from "../lib/paths.ts";
import { runChecks } from "../lib/checks.ts";
import { c, formatFinding, summarize } from "../lib/output.ts";

export interface LintOptions {
  character?: string;
  promotion: boolean;
}

export async function runLint(opts: LintOptions): Promise<number> {
  const findings = await runChecks({
    characterIds: opts.character ? [opts.character] : undefined,
    includePromotionGate: opts.promotion,
  });

  const title = opts.promotion ? "forge lint --promotion" : "forge lint";
  process.stdout.write(`${c.bold(title)} ${c.dim(`— ${REPO_ROOT}`)}\n\n`);

  const visible = findings.filter((f) => f.severity !== "info");
  if (visible.length === 0) {
    process.stdout.write(`${c.green("✓")} no errors or warnings\n`);
    return 0;
  }

  const byScope = new Map<string, typeof findings>();
  for (const f of visible) {
    const bucket = byScope.get(f.scope) ?? [];
    bucket.push(f);
    byScope.set(f.scope, bucket);
  }
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
  ].filter(Boolean);
  process.stdout.write(parts.join(c.dim(", ")) + "\n");

  // lint の exit ルール:
  //   - error が 1 件でもあれば non-zero
  //   - --promotion: warning も non-zero (昇格ゲートのため)
  if (s.errors > 0) return 1;
  if (opts.promotion && s.warns > 0) return 1;
  return 0;
}
