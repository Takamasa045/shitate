import { Link } from "react-router-dom";
import type { CharacterSummary } from "@studio/shared/types";
import { useApi } from "../hooks/useApi.ts";
import { api } from "../api.ts";
import { StatusBadge } from "../components/StatusBadge.tsx";

export function CharactersPage() {
  const { data, error, loading } = useApi(() => api.characters(), []);

  if (loading) return <Body>読み込み中…</Body>;
  if (error) return <Body><ErrorCard message={error} /></Body>;
  if (!data) return null;
  const readyCount = data.characters.filter((c) => c.threeViewPreview).length;

  return (
    <Body>
      <header className="studio-hero mb-8 overflow-hidden rounded-xl border border-[#c8b36d]/50">
        <div className="grid gap-6 px-6 py-7 sm:grid-cols-[1fr_auto] sm:items-end sm:px-8">
          <div>
            <div className="kanji-label mb-2 text-[#79543a]">Character workspace</div>
            <h1 className="font-display text-4xl tracking-wa-title text-[#263b45] sm:text-5xl">
              キャラクター
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#665d4f]">
              世界観、外観、プロンプト、anchor、改善履歴をキャラクターごとに整理します。
              最初は画像なしのサンプルを開き、自分の設定へ置き換えてください。
            </p>
          </div>
          <div className="studio-count-card">
            <strong>{data.characters.length}</strong>
            <span>キャラクター</span>
            <small>三面図 {readyCount}/{data.characters.length}</small>
          </div>
        </div>
        <div className="studio-accent-bands" aria-hidden />
      </header>
      <div className="mb-6 flex justify-end">
        <Link to="/characters/new" className="btn-sumi shrink-0">新しいキャラクター</Link>
      </div>
      <section aria-label="キャラクター一覧">
        <CharacterGrid characters={data.characters} />
      </section>
    </Body>
  );
}

function CharacterGrid({ characters }: { characters: CharacterSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {characters.map((character) => (
        <CharacterCard key={character.id} c={character} />
      ))}
    </div>
  );
}

function CharacterCard({ c }: { c: CharacterSummary }) {
  const anchorImage = c.primaryImageName ? api.imageUrl(c.id, c.primaryImageName) : null;
  const threeViewImage = c.threeViewPreview
    ? api.runFileUrl(c.id, c.threeViewPreview.runId, c.threeViewPreview.name)
    : null;

  return (
    <Link
      to={`/characters/${c.id}`}
      className="character-card group relative overflow-hidden p-0 transition hover:-translate-y-1"
    >
      <div className="relative grid grid-cols-[112px_1fr] gap-4 p-4">
        <div className="relative">
          {anchorImage ? (
            <div className="h-36 w-28 shrink-0 overflow-hidden rounded-lg border border-[#b8ab83]/70 bg-[#f1eee5]">
              <img
                src={anchorImage}
                alt={c.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="flex h-36 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#b8ab83] bg-[#f1eee5] font-display text-2xl text-[#b8ab83]">
              {c.name.slice(0, 1)}
            </div>
          )}
          <div className="absolute -right-2 -top-2">
            <StatusBadge status={c.status} size="seal" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="truncate font-display text-xl leading-tight text-sumi-900">
              {c.name}
            </h2>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-sumi-300">
            {c.id}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-sumi-500">
            <div className="flex items-baseline gap-1">
              <dt className="text-sumi-300">base</dt>
              <dd className="font-mono">{c.baseVersion ?? "?"}</dd>
            </div>
            <div className="flex items-baseline gap-1">
              <dt className="text-sumi-300">runs</dt>
              <dd className="font-mono">{c.runCount}</dd>
            </div>
            {c.anchors.length > 0 ? (
              <div className="flex items-baseline gap-1">
                <dt className="text-sumi-300">anchor</dt>
                <dd className="font-mono">{c.anchors.join("・")}</dd>
              </div>
            ) : null}
          </dl>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${threeViewImage ? "bg-[#dfe6cb] text-[#4d6333]" : "bg-[#ece5d4] text-[#88785d]"}`}>
            <span>{threeViewImage ? "●" : "○"}</span>
            三面図 {threeViewImage ? "できあがり" : "準備中"}
          </div>
        </div>
      </div>
      {threeViewImage ? (
        <div className="border-t border-[#b8ab83]/40 bg-[#f1eee5]/70 p-3">
          <img src={threeViewImage} alt={`${c.name}の三面図`} className="h-24 w-full rounded-md object-cover object-top" loading="lazy" />
        </div>
      ) : null}
      {c.latestLog ? (
        <div className="border-t border-sumi-100/70 bg-washi-100/40 px-5 py-3">
          <div className="kanji-label mb-1">直近の記</div>
          <div className="text-[12px] text-sumi-500">{c.latestLog.heading}</div>
          {c.latestLog.nextAction ? (
            <div className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-shu-700">
              <span className="kamon-bullet" />
              {c.latestLog.nextAction}
            </div>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">{children}</div>;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="washi border-shu-100 p-5 text-shu-700">
      <div className="font-display text-lg">読み込めませんでした</div>
      <div className="mt-1 text-sm">{message}</div>
    </div>
  );
}
