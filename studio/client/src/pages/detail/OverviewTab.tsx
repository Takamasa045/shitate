import { api } from "../../api.ts";
import type { CharacterDetail } from "@studio/shared/types";

export function OverviewTab({ character }: { character: CharacterDetail }) {
  const anchor = character.primaryImageName
    ? api.imageUrl(character.id, character.primaryImageName)
    : null;
  const threeView = character.threeViewPreview
    ? api.runFileUrl(character.id, character.threeViewPreview.runId, character.threeViewPreview.name)
    : null;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <VisualPanel label="正面 anchor" image={anchor} empty="anchor 未登録" />
        <VisualPanel label="三面図 / front・side・back" image={threeView} empty="三面図はまだ準備中" />
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <article className="washi-solid p-6">
        <div className="kanji-label mb-3">index.md</div>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap font-serif text-[14px] leading-[1.9] text-sumi-700">
          {character.indexMarkdown}
        </pre>
      </article>
      <aside className="space-y-4">
        <div className="washi p-4">
          <div className="kanji-label mb-2">出典 entity</div>
          {character.sourceEntities.length === 0 ? (
            <p className="text-sm text-sumi-300">なし</p>
          ) : (
            <ul className="space-y-1">
              {character.sourceEntities.map((e) => (
                <li key={e} className="break-all font-mono text-[11px] text-sumi-500">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="washi p-4">
          <div className="kanji-label mb-2">題目 tags</div>
          {character.tags.length === 0 ? (
            <p className="text-sm text-sumi-300">なし</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {character.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-sm border border-sumi-100 bg-washi-100 px-2 py-0.5 text-[11px] text-sumi-500"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="washi p-4">
          <div className="kanji-label mb-2">石 anchors</div>
          {character.anchors.length === 0 ? (
            <p className="text-sm text-sumi-300">未設置</p>
          ) : (
            <ul className="space-y-1 text-sm text-sumi-700">
              {character.anchors.map((a) => (
                <li key={a} className="kamon-bullet">
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}

function VisualPanel({ label, image, empty }: { label: string; image: string | null; empty: string }) {
  return (
    <div className="visual-panel overflow-hidden">
      <div className="kanji-label border-b border-[#b8ab83]/40 px-4 py-2">{label}</div>
      {image ? <img src={image} alt={label} className="h-72 w-full object-contain p-3" /> : <div className="flex h-72 items-center justify-center text-sm text-sumi-300">{empty}</div>}
    </div>
  );
}
