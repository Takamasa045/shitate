import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import type { CharacterDetail, RunDetail } from "@studio/shared/types";
import { useApi } from "../../hooks/useApi.ts";
import { api } from "../../api.ts";

export function RunsTab({
  character,
  subPath,
}: {
  character: CharacterDetail;
  subPath: string;
}) {
  const navigate = useNavigate();
  const targetRunId = subPath || null;

  useEffect(() => {
    if (!targetRunId && character.runs.length > 0) {
      navigate(`/characters/${character.id}/runs/${character.runs[0].runId}`, {
        replace: true,
      });
    }
  }, [targetRunId, character, navigate]);

  if (character.runs.length === 0) {
    return (
      <div className="washi p-6 text-sm text-sumi-300">
        まだ巻物はありません。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="washi h-fit p-4 lg:sticky lg:top-4">
        <div className="kanji-label mb-3">runs（{character.runs.length}）</div>
        <ul className="max-h-64 space-y-0.5 overflow-auto pr-1 lg:max-h-[70vh]">
          {character.runs.map((r) => {
            const active = targetRunId === r.runId;
            return (
              <li key={r.runId}>
                <Link
                  to={`/characters/${character.id}/runs/${r.runId}`}
                  className={`block rounded-sm px-2 py-1.5 transition ${
                    active ? "bg-sumi-900 text-washi-50" : "hover:bg-washi-100"
                  }`}
                >
                  <div className="truncate font-mono text-[11px] leading-tight">
                    {r.runId}
                  </div>
                  <div
                    className={`mt-0.5 flex items-center gap-2 text-[10px] ${
                      active ? "text-washi-200" : "text-sumi-300"
                    }`}
                  >
                    <span>{r.tool ?? "?"}</span>
                    {r.evaluationOverall ? (
                      <span className={active ? "text-shu-300" : "text-shu-500"}>
                        {r.evaluationOverall}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
      <div>
        {targetRunId && <RunView characterId={character.id} runId={targetRunId} />}
      </div>
    </div>
  );
}

function RunView({ characterId, runId }: { characterId: string; runId: string }) {
  const { data, error, loading } = useApi(
    () => api.run(characterId, runId),
    [characterId, runId],
  );
  if (loading) return <div className="text-sm text-sumi-300">読み込み中…</div>;
  if (error) return <div className="washi border-shu-100 p-5 text-shu-700">{error}</div>;
  if (!data) return null;
  return <RunDetailView characterId={characterId} run={data} />;
}

function RunDetailView({ characterId, run }: { characterId: string; run: RunDetail }) {
  const thumbnails = (run.manifest.thumbnails as string[] | undefined) ?? [];
  const outputs = (run.manifest.outputs as string[] | undefined) ?? [];
  const allImages = [...thumbnails, ...outputs.filter((o) => !thumbnails.includes(o))];

  return (
    <div className="space-y-5">
      {allImages.length > 0 ? (
        <section className="washi-solid p-5">
          <div className="kanji-label mb-3">画像</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {allImages.map((name) => (
              <a
                key={name}
                href={api.runFileUrl(characterId, run.runId, name)}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-sm border border-sumi-100 bg-washi-100 transition hover:border-shu-300"
              >
                <img
                  src={api.runFileUrl(characterId, run.runId, name)}
                  alt={name}
                  className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="truncate px-2 py-1 font-mono text-[10px] text-sumi-500">
                  {name}
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="washi p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-mono text-sm font-bold text-sumi-900">{run.runId}</h2>
          <div className="text-[10px] text-sumi-300">{formatDate(run.createdAt)}</div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-sumi-100 pt-4 text-sm sm:grid-cols-4">
          <Stat label="tool" value={`${run.tool ?? "?"}`} hint={run.toolVersion ?? undefined} />
          <Stat label="variant" value={run.variantId ?? "—"} />
          <Stat label="base" value={run.baseVersion ?? "—"} />
          <Stat label="評価" value={run.evaluationOverall ?? "—"} accent />
        </dl>
      </section>

      <Section title="prompt.txt" body={run.prompt} />
      <Section title="negative.txt" body={run.negative} />
      <section className="washi p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-display text-sm text-sumi-900">manifest</h3>
          <span className="kanji-label">json</span>
        </div>
        <pre className="scroll-box max-h-[40vh] overflow-auto whitespace-pre-wrap text-[12px]">
          {JSON.stringify(run.manifest, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="kanji-label">{label}</div>
      <div
        className={`mt-1 break-all font-mono text-[13px] ${
          accent ? "text-shu-500" : "text-sumi-700"
        }`}
      >
        {value}
      </div>
      {hint ? <div className="text-[10px] text-sumi-300">{hint}</div> : null}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  return (
    <section className="washi p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display text-sm text-sumi-900">{title}</h3>
      </div>
      <pre className="scroll-box max-h-[40vh] overflow-auto whitespace-pre-wrap">
        {body ?? "（なし）"}
      </pre>
    </section>
  );
}

function formatDate(v: string | null): string {
  if (!v) return "";
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return v;
  return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
}
