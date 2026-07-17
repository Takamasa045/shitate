// 端末表示のユーティリティ。chalk 等に頼らず ANSI 直書き。
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const colorEnabled = process.stdout.isTTY && process.env.NO_COLOR !== "1";

function wrap(code: string, text: string): string {
  if (!colorEnabled) return text;
  return `${code}${text}${ANSI.reset}`;
}

export const c = {
  bold: (s: string) => wrap(ANSI.bold, s),
  dim: (s: string) => wrap(ANSI.dim, s),
  red: (s: string) => wrap(ANSI.red, s),
  green: (s: string) => wrap(ANSI.green, s),
  yellow: (s: string) => wrap(ANSI.yellow, s),
  blue: (s: string) => wrap(ANSI.blue, s),
  cyan: (s: string) => wrap(ANSI.cyan, s),
  gray: (s: string) => wrap(ANSI.gray, s),
};

export type Severity = "ok" | "info" | "warn" | "error";

export interface Finding {
  severity: Severity;
  scope: string;
  message: string;
  hint?: string;
}

export function formatFinding(f: Finding): string {
  const badge = {
    ok: c.green("OK   "),
    info: c.cyan("INFO "),
    warn: c.yellow("WARN "),
    error: c.red("ERROR"),
  }[f.severity];
  const head = `${badge}  ${c.bold(f.scope)}  ${f.message}`;
  if (f.hint) return `${head}\n       ${c.dim("→ " + f.hint)}`;
  return head;
}

export function summarize(findings: Finding[]): {
  errors: number;
  warns: number;
  infos: number;
  oks: number;
} {
  return {
    errors: findings.filter((f) => f.severity === "error").length,
    warns: findings.filter((f) => f.severity === "warn").length,
    infos: findings.filter((f) => f.severity === "info").length,
    oks: findings.filter((f) => f.severity === "ok").length,
  };
}
