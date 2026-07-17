import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CharacterDetail, CompileDryRunResponse } from "@studio/shared/types";
import { api } from "../../api.ts";
import { ForgeSteps } from "../../components/ForgeSteps.tsx";

export function CompileTab({
  character,
  onReload,
}: {
  character: CharacterDetail;
  onReload: () => void;
}) {
  const [variant, setVariant] = useState<string>(
    character.variants[0]?.id ?? "",
  );
  const [result, setResult] = useState<CompileDryRunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [autoRun, setAutoRun] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (autoRun && variant) {
      void runOnce(character.id, variant, setResult, setRunning);
    }
  }, [character.id, variant, autoRun]);

  if (character.variants.length === 0) {
    return (
      <div className="washi p-6 text-sm text-sumi-300">
        調合するには `prompts/variants/` に variant が必要です。
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ForgeSteps active="compile" />
      <section className="washi-solid p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display text-sm text-sumi-900">調合</h3>
          <span className="kanji-label">preview → immutable run</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <div className="kanji-label mb-1">variant</div>
            <select
              className="wa-select"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
            >
              {character.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn-sumi"
            onClick={() => runOnce(character.id, variant, setResult, setRunning)}
            disabled={running || !variant}
          >
            {running ? "調合中…" : "調合する"}
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-sumi-300">
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => setAutoRun(e.target.checked)}
              className="accent-shu-500"
            />
            選択時に自動
          </label>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-sumi-300">
          まずdry-runで内容を確認し、その結果に問題がなければ新しいrunとして保存します。既存runは上書きしません。
        </p>
      </section>

      {result === null ? (
        <div className="washi p-6 text-sm text-sumi-300">
          「調合する」を押すと結果が現れます。
        </div>
      ) : result.ok ? (
        <>
          <CompileSuccess result={result} />
          <section className="washi-solid border-ai-100 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-sumi"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setSaveError(null);
                  try {
                    const written = await api.compileWrite(character.id, variant);
                    setSavedRunId(written.run.runId);
                  } catch (error) {
                    setSaveError(error instanceof Error ? error.message : String(error));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "保存中…" : "compile を保存"}
              </button>
              <span className="text-[11px] text-sumi-300">prompt.txt / negative.txt / manifest.json</span>
            </div>
            {savedRunId ? (
              <div className="mt-4 rounded-sm border border-wakakusa-100 bg-wakakusa-100/40 px-4 py-3 text-sm text-wakakusa-700">
                <span className="font-mono">{savedRunId}</span> を保存しました。{" "}
                <Link
                  className="ink-underline font-medium"
                  to={`/characters/${character.id}/runs/${savedRunId}`}
                  onClick={onReload}
                >
                  巻物で確認
                </Link>
              </div>
            ) : null}
            {saveError ? <div role="alert" className="mt-4 text-sm text-shu-700">{saveError}</div> : null}
          </section>
        </>
      ) : (
        <CompileError message={result.message} exitCode={result.exitCode} />
      )}
    </div>
  );
}

async function runOnce(
  characterId: string,
  variantId: string,
  setResult: (r: CompileDryRunResponse | null) => void,
  setRunning: (b: boolean) => void,
) {
  setRunning(true);
  try {
    const r = await api.compileDryRun(characterId, variantId);
    setResult(r);
  } catch (err) {
    setResult({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      exitCode: -1,
    });
  } finally {
    setRunning(false);
  }
}

function CompileSuccess({
  result,
}: {
  result: Extract<CompileDryRunResponse, { ok: true }>;
}) {
  return (
    <div className="space-y-4">
      <section className="washi-solid p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="run_id" value={result.runId} mono />
          <Stat label="lexicon" value={`${result.lexiconUsed.length} ref`} />
          <Stat label="prompt" value={`${result.prompt.length.toLocaleString()} 字`} />
          <Stat label="negative" value={`${result.negative.length.toLocaleString()} 字`} />
        </dl>
        {result.warnings.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-sumi-100 pt-3">
            {result.warnings.map((w, i) => (
              <li key={i} className="kamon-bullet text-[12px] text-shu-700">
                {w}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="washi p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-display text-sm text-sumi-900">lexicon 参照</h3>
          <span className="kanji-label">{result.lexiconUsed.length}</span>
        </div>
        <ul className="space-y-1">
          {result.lexiconUsed.map((r) => (
            <li key={r} className="kamon-bullet break-all font-mono text-[11px] text-sumi-500">
              {r}
            </li>
          ))}
        </ul>
      </section>
      <Section title="prompt.txt" en="preview" body={result.prompt} />
      <Section title="negative.txt" en="preview" body={result.negative} />
    </div>
  );
}

function CompileError({ message, exitCode }: { message: string; exitCode: number }) {
  return (
    <div className="washi border-shu-100 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-base text-shu-700">調合エラー</h3>
        <span className="font-mono text-[11px] text-shu-500">exit {exitCode}</span>
      </div>
      <p className="mt-2 font-mono text-[12px] text-shu-900">{message}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="kanji-label">{label}</div>
      <div
        className={`mt-1 break-all text-[13px] text-sumi-700 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  en,
  body,
}: {
  title: string;
  en: string;
  body: string;
}) {
  return (
    <section className="washi p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display text-sm text-sumi-900">{title}</h3>
        <span className="kanji-label">{en}</span>
      </div>
      <pre className="scroll-box max-h-[40vh] overflow-auto whitespace-pre-wrap">
        {body}
      </pre>
    </section>
  );
}
