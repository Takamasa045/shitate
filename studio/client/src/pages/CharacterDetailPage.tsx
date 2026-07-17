import { useParams, NavLink, Link, useLocation } from "react-router-dom";
import { useApi } from "../hooks/useApi.ts";
import { api } from "../api.ts";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { OverviewTab } from "./detail/OverviewTab.tsx";
import { PromptsTab } from "./detail/PromptsTab.tsx";
import { RunsTab } from "./detail/RunsTab.tsx";
import { LogTab } from "./detail/LogTab.tsx";
import { ReferencesTab } from "./detail/ReferencesTab.tsx";
import { CompileTab } from "./detail/CompileTab.tsx";

const SECTIONS = [
  { slug: "overview", label: "概観", en: "overview" },
  { slug: "prompts", label: "詞書", en: "prompts" },
  { slug: "runs", label: "巻物", en: "runs" },
  { slug: "log", label: "日録", en: "log" },
  { slug: "references", label: "手本", en: "refs" },
  { slug: "compile", label: "調合", en: "compile" },
] as const;

export function CharacterDetailPage() {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const location = useLocation();

  const { data, error, loading, reload } = useApi(
    () => api.character(id!),
    [id],
  );

  const activeSection = section ?? "overview";

  if (!id) return null;
  if (loading && !data)
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 text-sumi-300">
        読み込み中…
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="washi border-shu-100 p-5 text-shu-700">{error}</div>
      </div>
    );
  if (!data) return null;

  const subPath = (() => {
    const prefix = `/characters/${id}/${activeSection}`;
    if (!location.pathname.startsWith(prefix)) return "";
    return location.pathname.slice(prefix.length).replace(/^\/+/, "");
  })();

  const primaryImage = data.primaryImageName ? api.imageUrl(id, data.primaryImageName) : null;

  return (
    <div className="flex h-full flex-col">
      {/* ── キャラクター見出し（明朝の大扉） ──────── */}
      <div className="relative border-b border-sumi-100/70 bg-washi-50/60 backdrop-blur-[1px]">
        <div className="mx-auto max-w-6xl px-6 pb-5 pt-8">
          <div className="mb-3 flex items-center gap-2 text-[11px] text-sumi-300">
            <Link to="/characters" className="ink-underline hover:text-sumi-900">
              人物録
            </Link>
            <span>／</span>
            <span className="font-mono">{id}</span>
          </div>

          <div className="flex flex-wrap items-end gap-5">
            {primaryImage ? (
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-sumi-100 bg-washi-100 sm:h-24 sm:w-20">
                <img
                  src={primaryImage}
                  alt={data.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl leading-tight tracking-wa-title text-sumi-900 sm:text-4xl">
                {data.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-sumi-500">
                <StatusBadge status={data.status} />
                <span className="flex items-baseline gap-1">
                  <span className="text-sumi-300">base</span>
                  <span className="font-mono">{data.baseVersion ?? "?"}</span>
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="text-sumi-300">runs</span>
                  <span className="font-mono">{data.runCount}</span>
                </span>
                {data.updated ? (
                  <span className="flex items-baseline gap-1">
                    <span className="text-sumi-300">updated</span>
                    <span className="font-mono">{data.updated}</span>
                  </span>
                ) : null}
              </div>
            </div>
            <button
              onClick={reload}
              className="btn-ghost ml-auto text-[11px]"
              title="再読み込み"
            >
              ↻ 読み直す
            </button>
          </div>

          {/* ── タブ ──────────────────────────── */}
          <nav className="-mb-px mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {SECTIONS.map((s) => (
              <NavLink
                key={s.slug}
                to={`/characters/${id}/${s.slug}`}
                end={s.slug === "overview"}
                className={({ isActive }) => {
                  const active = isActive || s.slug === activeSection;
                  return `group inline-flex items-baseline gap-1.5 border-b-2 pb-2 font-serif transition ${
                    active
                      ? "border-shu-500 text-sumi-900"
                      : "border-transparent text-sumi-300 hover:text-sumi-900"
                  }`;
                }}
              >
                <span>{s.label}</span>
                <span className="text-[10px] uppercase tracking-wa-heading text-sumi-200 group-hover:text-sumi-300">
                  {s.en}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* ── 本文 ───────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          {activeSection === "overview" && <OverviewTab character={data} />}
          {activeSection === "prompts" && (
            <PromptsTab character={data} subPath={subPath} onReload={reload} />
          )}
          {activeSection === "runs" && (
            <RunsTab character={data} subPath={subPath} />
          )}
          {activeSection === "log" && <LogTab character={data} onReload={reload} />}
          {activeSection === "references" && (
            <ReferencesTab character={data} onReload={reload} />
          )}
          {activeSection === "compile" && <CompileTab character={data} onReload={reload} />}
        </div>
      </div>
    </div>
  );
}
