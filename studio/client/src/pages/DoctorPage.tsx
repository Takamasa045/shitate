import { useApi } from "../hooks/useApi.ts";
import { api } from "../api.ts";
import type { Finding } from "@studio/shared/types";

export function DoctorPage() {
  const { data, error, loading, reload } = useApi(() => api.doctor(), []);

  if (loading) return <Body>診立て中…</Body>;
  if (error)
    return (
      <Body>
        <div className="washi border-shu-100 p-5 text-shu-700">{error}</div>
      </Body>
    );
  if (!data) return null;

  return (
    <Body>
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <div className="kanji-label mb-1">診立て / doctor</div>
          <h1 className="font-display text-4xl tracking-wa-title text-sumi-900">
            傷の在処を診る
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-sumi-300">
            リポ全体を読み取り専用で走査し、スキーマ違反・欠落・齟齬を拾います。書き込みはしません。
          </p>
        </div>
        <button onClick={reload} className="btn-ghost">
          ↻ もう一度
        </button>
      </header>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Stat
          label="errors"
          kanji="凶"
          value={data.summary.errors}
          tone="shu"
        />
        <Stat
          label="warnings"
          kanji="注"
          value={data.summary.warnings}
          tone="experimental"
        />
        <Stat
          label="infos"
          kanji="吉"
          value={data.summary.infos}
          tone="ai"
        />
      </div>

      {data.findings.length === 0 ? (
        <div className="washi-solid p-6 text-center">
          <div className="font-display text-xl text-kincha-500">清浄</div>
          <p className="mt-1 text-sm text-sumi-300">指摘なし。</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.findings.map((f, i) => (
            <li key={i}>
              <FindingRow f={f} />
            </li>
          ))}
        </ul>
      )}
    </Body>
  );
}

function Stat({
  label,
  kanji,
  value,
  tone,
}: {
  label: string;
  kanji: string;
  value: number;
  tone: "shu" | "experimental" | "ai";
}) {
  const toneClass = {
    shu: "border-shu-100 text-shu-500",
    experimental: "border-wakakusa-100 text-wakakusa-500",
    ai: "border-ai-100 text-ai-500",
  }[tone];
  const active = value > 0;
  return (
    <div
      className={`washi-solid flex items-center gap-4 px-5 py-4 ${
        active ? toneClass : "text-sumi-300"
      }`}
    >
      <div
        className={`font-display text-3xl leading-none ${
          active ? "" : "opacity-40"
        }`}
      >
        {kanji}
      </div>
      <div>
        <div className="kanji-label">{label}</div>
        <div className="font-display text-2xl leading-none text-sumi-900">
          {value}
        </div>
      </div>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const toneClass = {
    ok: "hanko-stable",
    info: "hanko-ai",
    warn: "hanko-experimental",
    error: "hanko-shu",
  }[f.severity];
  const wa = {
    ok: "良",
    info: "報",
    warn: "注",
    error: "凶",
  }[f.severity];
  return (
    <div className="washi flex gap-4 p-4">
      <span className={`${toneClass} h-fit shrink-0`} title={f.severity}>
        {wa}
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-all font-mono text-[11px] text-sumi-300">
          {f.scope}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-sumi-700">{f.message}</p>
        {f.hint ? (
          <p className="mt-1 flex items-baseline gap-1 text-[12px] text-sumi-500">
            <span className="text-shu-500">→</span>
            <span>{f.hint}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>;
}
