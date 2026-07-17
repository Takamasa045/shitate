import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  CharacterDetail,
  RevisionMode,
  VariantDetail,
} from "@studio/shared/types";
import { useApi } from "../../hooks/useApi.ts";
import { api, ApiError } from "../../api.ts";
import { ForgeSteps } from "../../components/ForgeSteps.tsx";

export function PromptsTab({
  character,
  subPath,
  onReload,
}: {
  character: CharacterDetail;
  subPath: string;
  onReload: () => void;
}) {
  const navigate = useNavigate();
  const target = useMemo(() => parseTarget(subPath), [subPath]);
  const [creatingVariant, setCreatingVariant] = useState(false);

  useEffect(() => {
    if (target === null) {
      navigate(`/characters/${character.id}/prompts/base`, { replace: true });
    }
  }, [target, character.id, navigate]);

  return (
    <div className="space-y-6">
      <ForgeSteps active="prompt" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="washi h-fit p-4 lg:sticky lg:top-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="kanji-label">詞書一覧</div>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() => setCreatingVariant(true)}
            >
              variant を追加
            </button>
          </div>
          <ul className="max-h-64 space-y-0.5 overflow-auto pr-1 text-sm lg:max-h-[70vh]">
            <li>
              <PromptLink
                to={`/characters/${character.id}/prompts/base`}
                active={target?.kind === "base"}
                label="base"
                kanji="本"
                hint={`v${(character.baseVersion ?? "").replace(/^v/, "")}`}
              />
            </li>
            {character.variants.length > 0 ? (
              <li className="mt-3 border-t border-sumi-100 pt-2">
                <div className="kanji-label">variants（{character.variants.length}）</div>
              </li>
            ) : null}
            {character.variants.map((variant) => (
              <li key={variant.id}>
                <PromptLink
                  to={`/characters/${character.id}/prompts/variants/${variant.id}`}
                  active={target?.kind === "variant" && target.variantId === variant.id}
                  label={variant.id}
                  kanji="差"
                  hint={variant.purpose ?? undefined}
                />
              </li>
            ))}
          </ul>
        </aside>
        <div>
          {target?.kind === "base" && (
            <BaseView character={character} onReload={onReload} />
          )}
          {target?.kind === "variant" && (
            <VariantView
              character={character}
              variantId={target.variantId}
              onReload={onReload}
            />
          )}
        </div>
      </div>

      {creatingVariant ? (
        <PromptEditor
          mode="variant-create"
          character={character}
          onClose={() => setCreatingVariant(false)}
          onSaved={(variantId) => {
            setCreatingVariant(false);
            onReload();
            navigate(`/characters/${character.id}/prompts/variants/${variantId}`);
          }}
        />
      ) : null}
    </div>
  );
}

function BaseView({
  character,
  onReload,
}: {
  character: CharacterDetail;
  onReload: () => void;
}) {
  const { data, error, loading, reload } = useApi(
    () => api.basePrompt(character.id),
    [character.id],
  );
  const [editing, setEditing] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorCard message={error} />;
  if (!data) return null;
  return (
    <>
      <PromptDetailView
        data={data}
        actionLabel="base を編集"
        onEdit={() => setEditing(true)}
      />
      {editing ? (
        <PromptEditor
          mode="base"
          character={character}
          initial={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
            onReload();
          }}
        />
      ) : null}
    </>
  );
}

function VariantView({
  character,
  variantId,
  onReload,
}: {
  character: CharacterDetail;
  variantId: string;
  onReload: () => void;
}) {
  const { data, error, loading, reload } = useApi(
    () => api.variant(character.id, variantId),
    [character.id, variantId],
  );
  const [editing, setEditing] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorCard message={error} />;
  if (!data) return null;
  return (
    <>
      <PromptDetailView
        data={data}
        actionLabel="variant を編集"
        onEdit={() => setEditing(true)}
      />
      {editing ? (
        <PromptEditor
          mode="variant-edit"
          character={character}
          initial={data}
          variantId={variantId}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
            onReload();
          }}
        />
      ) : null}
    </>
  );
}

function PromptEditor({
  mode,
  character,
  initial,
  variantId: initialVariantId = "",
  onClose,
  onSaved,
}: {
  mode: "base" | "variant-create" | "variant-edit";
  character: CharacterDetail;
  initial?: VariantDetail;
  variantId?: string;
  onClose: () => void;
  onSaved: (variantId: string) => void;
}) {
  const isBase = mode === "base";
  const isCreate = mode === "variant-create";
  const label = isBase ? "base を編集" : isCreate ? "variant を追加" : "variant を編集";
  const [variantId, setVariantId] = useState(initialVariantId);
  const [raw, setRaw] = useState(
    initial?.raw ?? promptTemplate(character.name, character.baseVersion ?? "v1"),
  );
  const [revisionMode, setRevisionMode] = useState<RevisionMode>("same-version");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checklist = useMemo(() => promptChecklist(raw), [raw]);
  const dirty = raw !== (initial?.raw ?? promptTemplate(character.name, character.baseVersion ?? "v1")) ||
    variantId !== initialVariantId;
  const validVariantId = /^[a-z0-9][a-z0-9_/-]*$/.test(variantId) && !variantId.includes("..");
  const canSave = checklist.every((item) => item.ok) && (!isCreate || validVariantId);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function close() {
    if (!dirty || window.confirm("保存していない変更を破棄しますか？")) onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (isBase) {
        await api.saveBase(character.id, {
          raw,
          expectedRevision: initial!.revision,
          revisionMode,
        });
        onSaved("base");
      } else {
        const id = isCreate ? variantId : initialVariantId;
        await api.saveVariant(character.id, id, {
          raw,
          ...(initial?.revision ? { expectedRevision: initial.revision } : {}),
        });
        onSaved(id);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError("別の画面で更新されています。上書きせず、閉じて最新内容を読み直してください。");
      } else if (caught instanceof ApiError && caught.status === 422) {
        setError(`Markdownの構造を保存できません: ${caught.message}`);
      } else {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="editor-dialog"
      >
        <form onSubmit={submit} className="flex max-h-[90vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-sumi-100 px-6 py-4">
            <div>
              <div className="kanji-label">詞書 / authoring</div>
              <h2 className="mt-1 font-display text-xl text-sumi-900">{label}</h2>
            </div>
            <button type="button" className="btn-ghost" onClick={close} aria-label="閉じる">×</button>
          </header>

          <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4 p-6">
              {isCreate ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-sumi-700">variant ID</span>
                  <input
                    className="wa-input font-mono"
                    value={variantId}
                    onChange={(event) => setVariantId(event.target.value.toLowerCase().trim())}
                    placeholder="three-view または scenes/hero-shot"
                    required
                  />
                  {!validVariantId && variantId ? (
                    <span className="mt-1 block text-[11px] text-shu-700">英数・`-`・`_`・安全な `/` のみ使えます。</span>
                  ) : null}
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-sumi-700">Markdown</span>
                <textarea
                  className="wa-textarea min-h-[48vh]"
                  value={raw}
                  onChange={(event) => setRaw(event.target.value)}
                  spellCheck={false}
                  required
                />
              </label>
              {isBase ? (
                <fieldset className="rounded-sm border border-sumi-100 p-4">
                  <legend className="px-1 text-sm font-medium text-sumi-700">版の扱い</legend>
                  <label className="mt-2 flex items-start gap-2 text-sm text-sumi-500">
                    <input
                      type="radio"
                      name="revision-mode"
                      className="mt-0.5 accent-shu-500"
                      checked={revisionMode === "same-version"}
                      onChange={() => setRevisionMode("same-version")}
                    />
                    <span><strong className="font-medium text-sumi-700">同じ version で保存</strong><br /><span className="text-[11px]">初期v1の記入や誤字修正向け。</span></span>
                  </label>
                  <label className="mt-3 flex items-start gap-2 text-sm text-sumi-500">
                    <input
                      type="radio"
                      name="revision-mode"
                      className="mt-0.5 accent-shu-500"
                      checked={revisionMode === "new-version"}
                      onChange={() => setRevisionMode("new-version")}
                    />
                    <span><strong className="font-medium text-sumi-700">主要改訂として次版を作る</strong><br /><span className="text-[11px]">historyとindexを同時に更新。既存variantは改訂が必要になります。</span></span>
                  </label>
                </fieldset>
              ) : null}
              {error ? <div role="alert" className="rounded-sm border border-shu-100 bg-shu-50 px-4 py-3 text-sm text-shu-900">{error}</div> : null}
            </div>

            <aside className="border-t border-sumi-100 bg-washi-100/50 p-6 lg:border-l lg:border-t-0">
              <div className="kanji-label">保存前の確認</div>
              <ul className="mt-4 space-y-2">
                {checklist.map((item) => (
                  <li key={item.label} className={`flex gap-2 text-[12px] ${item.ok ? "text-wakakusa-700" : "text-shu-700"}`}>
                    <span aria-hidden>{item.ok ? "✓" : "×"}</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-sumi-100 pt-4 text-[11px] leading-relaxed text-sumi-300">
                保存前にサーバー側でも同じスキーマを検証します。競合時は自動上書きしません。
              </p>
            </aside>
          </div>

          <footer className="flex flex-wrap items-center gap-3 border-t border-sumi-100 bg-white/80 px-6 py-4">
            <button className="btn-sumi" type="submit" disabled={!canSave || saving}>
              {saving ? "保存中…" : isCreate ? "variant を保存" : "保存する"}
            </button>
            <button className="btn-ghost" type="button" onClick={close}>キャンセル</button>
            <span className="ml-auto text-[11px] text-sumi-300">{raw.length.toLocaleString()} chars</span>
          </footer>
        </form>
      </section>
    </div>
  );
}

function promptChecklist(raw: string) {
  return [
    { label: "H1タイトル", ok: /^#\s+\S+/m.test(raw) },
    { label: "用途", ok: /^##\s+用途\s*$/m.test(raw) },
    { label: "依存ベースバージョン", ok: /^##\s+依存ベースバージョン\s*$/m.test(raw) },
    { label: "本文プロンプトのコードブロック", ok: /^##\s+本文プロンプト\s*\n\s*```[\s\S]*?```/m.test(raw) },
    { label: "ネガティブプロンプト", ok: /^##\s+ネガティブプロンプト\s*\n\s*```[\s\S]*?```/m.test(raw) },
    { label: "Lexicon 参照", ok: /^##\s+Lexicon\s+参照\s*$/m.test(raw) },
  ];
}

function promptTemplate(name: string, baseVersion: string) {
  return `# ${name} — variant\n\n## 用途\n（このvariantの用途）\n\n## 依存ベースバージョン\n${baseVersion}\n\n## 本文プロンプト\n\`\`\`\n(character visual description)\n\`\`\`\n\n## ネガティブプロンプト\n\`\`\`\ntext, watermark, broken anatomy\n\`\`\`\n\n## Lexicon 参照\n\n## メモ\n`;
}

function PromptLink({
  to,
  active,
  label,
  kanji,
  hint,
}: {
  to: string;
  active: boolean;
  label: string;
  kanji: string;
  hint?: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-start gap-2 rounded-sm px-2 py-1.5 transition ${
        active ? "bg-sumi-900 text-washi-50" : "text-sumi-500 hover:bg-washi-100"
      }`}
    >
      <span className={`mt-0.5 font-display text-[13px] leading-none ${active ? "text-shu-300" : "text-sumi-200"}`}>{kanji}</span>
      <span className="min-w-0 flex-1">
        <span className="block break-all text-[13px] font-medium">{label}</span>
        {hint ? <span className={`mt-0.5 block line-clamp-1 text-[11px] ${active ? "text-washi-200" : "text-sumi-300"}`}>{hint}</span> : null}
      </span>
    </Link>
  );
}

function PromptDetailView({
  data,
  actionLabel,
  onEdit,
}: {
  data: VariantDetail;
  actionLabel: string;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="washi-solid p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-sumi-900">{data.id}</h2>
            <p className="mt-1 text-sm text-sumi-500">{data.purpose ?? <span className="text-sumi-300">（用途未記載）</span>}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-sumi-300">dep <span className="font-mono text-sumi-500">{data.baseVersionDep ?? "?"}</span></div>
            <button type="button" className="btn-sumi" onClick={onEdit}>{actionLabel}</button>
          </div>
        </div>
      </div>
      <Section title="本文プロンプト" en="positive" body={data.positive} fallback="（セクション欠落）" />
      <Section title="ネガティブ" en="negative" body={data.negative} fallback="（セクション欠落）" />
      <div className="washi p-5">
        <div className="kanji-label">Lexicon 参照（{data.lexiconRefs.length}）</div>
        {data.lexiconRefs.length === 0 ? <p className="mt-2 text-sm text-sumi-300">参照なし</p> : (
          <ul className="mt-3 space-y-1">{data.lexiconRefs.map((ref) => <li key={ref} className="kamon-bullet break-all font-mono text-[11px] text-sumi-500">{ref}</li>)}</ul>
        )}
      </div>
      {data.memo ? <Section title="メモ" en="memo" body={data.memo} fallback="" /> : null}
    </div>
  );
}

function Section({ title, en, body, fallback }: { title: string; en: string; body: string | null; fallback: string }) {
  return (
    <div className="washi p-5">
      <div className="mb-2 flex items-baseline justify-between"><h3 className="font-display text-sm text-sumi-900">{title}</h3><span className="kanji-label">{en}</span></div>
      <pre className="scroll-box max-h-[40vh] overflow-auto whitespace-pre-wrap">{body ?? fallback}</pre>
    </div>
  );
}

function Loading() { return <div className="text-sm text-sumi-300">読み込み中…</div>; }
function ErrorCard({ message }: { message: string }) { return <div className="washi border-shu-100 p-5 text-shu-700"><div className="font-display text-base">読み込めませんでした</div><div className="mt-1 text-sm">{message}</div></div>; }

type Target = { kind: "base" } | { kind: "variant"; variantId: string } | null;
function parseTarget(subPath: string): Target {
  if (!subPath) return null;
  if (subPath === "base") return { kind: "base" };
  if (subPath.startsWith("variants/")) return { kind: "variant", variantId: subPath.slice("variants/".length) };
  return null;
}
