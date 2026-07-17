import { cloneElement, useMemo, useState, type FormEvent, type ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api.ts";
import { ForgeSteps } from "../components/ForgeSteps.tsx";

const ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function NewCharacterPage() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validation = useMemo(() => {
    if (!id) return "IDを入力してください。";
    if (!ID_RE.test(id)) return "IDは英小文字から始まるkebab-caseで入力してください。";
    if (!name.trim()) return "表示名を入力してください。";
    if (name.trim().length > 120) return "表示名は120文字以内にしてください。";
    if (role.trim().length > 200) return "役割は200文字以内にしてください。";
    return null;
  }, [id, name, role]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (validation || submitting) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await api.createCharacter({
        id,
        name: name.trim(),
        ...(role.trim() ? { role: role.trim() } : {}),
      });
      navigate(`/characters/${result.character.id}/prompts/base`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setServerError("同じIDのキャラクターがすでにあります。別のIDを入力してください。");
      } else {
        setServerError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center gap-2 text-[11px] text-sumi-300">
        <Link to="/characters" className="ink-underline hover:text-sumi-900">人物録</Link>
        <span>／</span>
        <span>新しい輪郭</span>
      </div>

      <header className="mb-8 max-w-3xl">
        <div className="kanji-label mb-1">素材 / New character</div>
        <h1 className="font-display text-4xl tracking-wa-title text-sumi-900">
          新しいキャラクター
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-sumi-500">
          まず名前と役割だけを決めます。骨組みを作ったあと、詞書で外見を育てます。
        </p>
      </header>

      <ForgeSteps active="material" />

      <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]" noValidate>
        <section className="washi-solid space-y-5 p-6" aria-labelledby="new-character-fields">
          <div>
            <div className="kanji-label">character file</div>
            <h2 id="new-character-fields" className="mt-1 font-display text-xl text-sumi-900">
              輪郭の基本
            </h2>
          </div>
          <Field label="ID" hint="例: washi-fox。作成後のフォルダ名になります。">
            <input
              className="wa-input font-mono"
              value={id}
              onChange={(event) => setId(event.target.value.toLowerCase().trim())}
              name="id"
              autoComplete="off"
              maxLength={80}
              required
            />
          </Field>
          <Field label="表示名" hint="人物録と見出しに表示します。">
            <input
              className="wa-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              name="name"
              maxLength={120}
              required
            />
          </Field>
          <Field label="役割" hint="任意。物語やシリーズでの立場を短く。">
            <input
              className="wa-input"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              name="role"
              maxLength={200}
            />
          </Field>
          {serverError ? (
            <div role="alert" className="rounded-sm border border-shu-100 bg-shu-50 px-4 py-3 text-sm text-shu-900">
              {serverError}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-sumi-100 pt-5">
            <button className="btn-sumi" type="submit" disabled={Boolean(validation) || submitting}>
              {submitting ? "作成中…" : "作成する"}
            </button>
            <Link className="btn-ghost" to="/characters">戻る</Link>
          </div>
        </section>

        <aside className="washi h-fit p-5 lg:sticky lg:top-6" aria-live="polite">
          <div className="kanji-label">確認</div>
          <div className="mt-3 font-display text-lg text-sumi-900">{name.trim() || "名称未定"}</div>
          <div className="mt-1 font-mono text-[12px] text-sumi-300">{id || "character-id"}</div>
          <p className={`mt-5 text-[12px] leading-relaxed ${validation ? "text-shu-700" : "text-wakakusa-700"}`}>
            {validation ?? "入力は整っています。作成すると安全な骨組みと日録が用意されます。"}
          </p>
          <div className="mt-5 border-t border-sumi-100 pt-4 text-[11px] leading-relaxed text-sumi-300">
            画像は生成しません。作成するのはMarkdown・YAMLと空の素材フォルダだけです。
          </div>
        </aside>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactElement;
}) {
  const id = `field-${label}`;
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-sumi-700">{label}</span>
        <span className="text-[11px] text-sumi-300">{hint}</span>
      </span>
      {cloneElement(children, { id } as Record<string, unknown>)}
    </label>
  );
}
