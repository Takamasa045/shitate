import { useState, type FormEvent } from "react";
import type { CharacterDetail, LogEntrySummary } from "@studio/shared/types";
import { api } from "../../api.ts";
import { ForgeSteps } from "../../components/ForgeSteps.tsx";

export function LogTab({
  character,
  onReload,
}: {
  character: CharacterDetail;
  onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-5">
      <ForgeSteps active="log" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="kanji-label">新しい順（DESCENDING）・最新 {character.logEntries.length} 件</p>
        <button type="button" className="btn-sumi" onClick={() => setAdding(true)}>
          記録を追加
        </button>
      </div>
      {character.logEntries.length === 0 ? (
        <div className="washi p-6 text-sm text-sumi-300">
          日録はまだありません。最初の試行と次の改善を記録してください。
        </div>
      ) : (
        <ol className="relative space-y-4">
          <div aria-hidden className="absolute bottom-2 left-[11px] top-2 w-px bg-gradient-to-b from-sumi-100 via-sumi-100 to-transparent" />
          {character.logEntries.map((entry, index) => (
            <li key={`${entry.heading}-${index}`} className="relative pl-8">
              <span aria-hidden className={`absolute left-1.5 top-5 h-2.5 w-2.5 rounded-full border-2 ${index === 0 ? "border-shu-500 bg-washi-50" : "border-sumi-100 bg-washi-50"}`} />
              <LogEntryCard entry={entry} highlight={index === 0} />
            </li>
          ))}
        </ol>
      )}
      {adding ? (
        <LogEditor
          character={character}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onReload();
          }}
        />
      ) : null}
    </div>
  );
}

function LogEditor({
  character,
  onClose,
  onSaved,
}: {
  character: CharacterDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [variant, setVariant] = useState(character.variants[0]?.id ?? "base");
  const [tried, setTried] = useState("");
  const [promptDiff, setPromptDiff] = useState("");
  const [artifact, setArtifact] = useState("（なし）");
  const [evaluation, setEvaluation] = useState("◯");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = Boolean(tried || promptDiff || nextAction);
  const canSave = tried.trim() && promptDiff.trim() && artifact.trim() && nextAction.trim();

  function close() {
    if (!dirty || window.confirm("入力中の日録を破棄しますか？")) onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.appendLog(character.id, {
        variant: variant.trim(),
        tried: tried.trim(),
        promptDiff: promptDiff.trim(),
        artifact: artifact.trim(),
        evaluation,
        nextAction: nextAction.trim(),
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <section role="dialog" aria-modal="true" aria-label="日録に追記" className="editor-dialog max-w-3xl">
        <form onSubmit={submit}>
          <header className="flex items-start justify-between gap-4 border-b border-sumi-100 px-6 py-4">
            <div><div className="kanji-label">日録 / learning loop</div><h2 className="mt-1 font-display text-xl text-sumi-900">日録に追記</h2></div>
            <button type="button" className="btn-ghost" onClick={close} aria-label="閉じる">×</button>
          </header>
          <div className="grid max-h-[72vh] gap-5 overflow-auto p-6 sm:grid-cols-2">
            <Field label="variant">
              <input className="wa-input font-mono" value={variant} onChange={(event) => setVariant(event.target.value)} maxLength={160} required />
            </Field>
            <Field label="評価">
              <select className="wa-select" value={evaluation} onChange={(event) => setEvaluation(event.target.value)}>
                <option value="◎">◎ 完璧</option>
                <option value="◯">◯ 概ね良い</option>
                <option value="△">△ 改善が必要</option>
                <option value="✗">✗ 方向転換</option>
              </select>
            </Field>
            <Field label="試行" wide>
              <textarea className="wa-textarea min-h-24" value={tried} onChange={(event) => setTried(event.target.value)} maxLength={4000} required />
            </Field>
            <Field label="プロンプト差分">
              <input className="wa-input" value={promptDiff} onChange={(event) => setPromptDiff(event.target.value)} maxLength={1000} placeholder="[three-view](prompts/variants/three-view.md)" required />
            </Field>
            <Field label="生成物">
              <input className="wa-input" value={artifact} onChange={(event) => setArtifact(event.target.value)} maxLength={1000} required />
            </Field>
            <Field label="次の改善" wide>
              <textarea className="wa-textarea min-h-24" value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={4000} required />
              <p className="mt-1 text-[11px] text-sumi-300">空にはできません。次のセッションがそのまま実行できる言葉で書きます。</p>
            </Field>
            {error ? <div role="alert" className="rounded-sm border border-shu-100 bg-shu-50 px-4 py-3 text-sm text-shu-900 sm:col-span-2">{error}</div> : null}
          </div>
          <footer className="flex items-center gap-3 border-t border-sumi-100 bg-white/80 px-6 py-4">
            <button className="btn-sumi" type="submit" disabled={!canSave || saving}>{saving ? "追記中…" : "日録に追記"}</button>
            <button className="btn-ghost" type="button" onClick={close}>キャンセル</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1 block text-sm font-medium text-sumi-700">{label}</span>{children}</label>;
}

function LogEntryCard({ entry, highlight }: { entry: LogEntrySummary; highlight: boolean }) {
  return (
    <article className={`washi-solid p-5 ${highlight ? "border-shu-100/80" : ""}`}>
      <header className="flex items-baseline justify-between gap-3 border-b border-sumi-100 pb-3"><h3 className="font-mono text-[12px] font-semibold text-sumi-900">{entry.heading}</h3>{entry.evaluation ? <EvalChip raw={entry.evaluation} /> : null}</header>
      {entry.tried ? <div className="mt-3"><div className="kanji-label mb-1">試行</div><p className="text-[13px] leading-relaxed text-sumi-700">{entry.tried}</p></div> : null}
      {entry.nextAction ? <div className="mt-4 rounded-sm border border-shu-100 bg-shu-50/50 px-4 py-3"><div className="mb-1 flex items-baseline gap-2"><span className="hanko-shu">次</span><span className="kanji-label text-shu-500">next step</span></div><p className="text-[13px] leading-relaxed text-shu-900">{entry.nextAction}</p></div> : <div className="mt-3 text-[11px] text-shu-500">⚠ 「次の改善」欄が空（ログ・スキーマ違反）</div>}
    </article>
  );
}

function EvalChip({ raw }: { raw: string }) {
  const head = raw.split(/[\s/、，]/)[0]?.trim() ?? "";
  let cls = "hanko-draft";
  if (head.includes("◎")) cls = "hanko-stable";
  else if (head.includes("◯") || head.includes("○")) cls = "hanko-ai";
  else if (head.includes("△")) cls = "hanko-experimental";
  else if (head.includes("✗") || head.includes("×")) cls = "hanko-shu";
  return <span className={cls} title={raw}>{head || raw}</span>;
}
