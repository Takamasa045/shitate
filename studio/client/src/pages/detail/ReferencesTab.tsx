import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { CharacterDetail } from "@studio/shared/types";
import { ApiError, api } from "../../api.ts";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ANCHOR_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function ReferencesTab({
  character,
  onReload,
}: {
  character: CharacterDetail;
  onReload: () => void;
}) {
  const refs = character.references;
  const [adding, setAdding] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function closeEditor() {
    setAdding(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className="space-y-5">
      <section className="washi-solid overflow-hidden">
        <div className="grid gap-5 p-5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
          <div
            aria-hidden
            className="seal h-14 w-14 border-shu-500 bg-shu-50 text-base text-shu-500"
          >
            石
          </div>
          <div>
            <div className="kanji-label">identity anchor / selected image</div>
            <h2 className="mt-1 font-display text-xl text-sumi-900">基準の一枚を据える</h2>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-sumi-500">
              選定済み画像を anchor として登録し、sources・日録・INDEX をまとめて同期します。
              画像生成や既存 anchor の差し替えは行いません。
            </p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="btn-sumi justify-center"
            onClick={() => setAdding(true)}
          >
            アンカーを登録
          </button>
        </div>
        <div className="border-t border-sumi-100 bg-washi-100/50 px-5 py-2 text-[10px] tracking-wa-heading text-sumi-300">
          JPEG · PNG · WebP / 5 MiB 以下 / 新規登録のみ
        </div>
      </section>

      {savedName ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-sm border border-wakakusa-300 bg-wakakusa-100/60 px-4 py-3 text-sm text-wakakusa-700"
        >
          {savedName} を登録し、sources・日録・INDEX を同期しました。
        </div>
      ) : null}

      <section className="washi-solid p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display text-sm text-sumi-900">画像</h3>
          <span className="kanji-label">{refs.images.length} points</span>
        </div>
        {refs.images.length === 0 ? (
          <p className="text-sm text-sumi-300">まだ基準画像はありません。</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {refs.images.map((img) => (
              <a
                key={img.name}
                href={api.imageUrl(character.id, img.name)}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-sm border border-sumi-100 bg-washi-100 transition hover:border-shu-300"
              >
                <div className="relative">
                  <img
                    src={api.imageUrl(character.id, img.name)}
                    alt={img.name}
                    className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                  {img.isAnchor ? (
                    <span className="absolute right-1 top-1 hanko-shu bg-shu-50/90 backdrop-blur-[1px]">
                      石
                    </span>
                  ) : null}
                </div>
                <div className="truncate px-2 py-1 font-mono text-[10px] text-sumi-500">
                  {img.name}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {refs.hasYaml ? (
        <section className="washi p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-display text-sm text-sumi-900">sources.yaml</h3>
          </div>
          <pre className="scroll-box max-h-[40vh] overflow-auto whitespace-pre-wrap">
            {refs.yamlRaw ?? ""}
          </pre>
        </section>
      ) : (
        <div className="washi p-5 text-sm text-shu-700">
          sources.yaml は最初の anchor 登録時に作成されます。
        </div>
      )}

      {adding ? (
        <AnchorEditor
          character={character}
          onClose={closeEditor}
          onSaved={(name) => {
            setSavedName(name);
            closeEditor();
            onReload();
          }}
        />
      ) : null}
    </div>
  );
}

function AnchorEditor({
  character,
  onClose,
  onSaved,
}: {
  character: CharacterDetail;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [anchorId, setAnchorId] = useState("face");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  useEffect(() => {
    const first = dialogRef.current?.querySelector<HTMLElement>(
      "[data-anchor-initial-focus]",
    );
    first?.focus();
  }, []);

  const normalizedId = anchorId.trim();
  const extension = file ? extensionFor(file.type) : null;
  const duplicate = character.anchors.includes(normalizedId);
  const fileProblem = validateFile(file);
  const idProblem =
    normalizedId && !ANCHOR_ID_RE.test(normalizedId)
      ? "英小文字・数字・ハイフンの kebab-case で入力してください。"
      : duplicate
        ? "同じ ID の anchor が既にあります。上書きはできません。"
        : null;
  const canSave = Boolean(
    file &&
      !fileProblem &&
      normalizedId &&
      !idProblem &&
      notes.trim() &&
      nextAction.trim(),
  );
  const dirty = Boolean(file || notes || nextAction || anchorId !== "face");

  function close() {
    if (saving) return;
    if (!dirty || window.confirm("入力中の anchor 登録を破棄しますか？")) onClose();
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await api.registerAnchor(character.id, {
        anchorId: normalizedId,
        notes: notes.trim(),
        nextAction: nextAction.trim(),
        file,
      });
      onSaved(response.anchor.name);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError("同じ anchor が既に登録されています。既存画像は上書きしていません。");
      } else {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="アンカーを登録"
        aria-busy={saving}
        className="editor-dialog max-w-4xl"
        onKeyDown={handleDialogKeyDown}
      >
        <form onSubmit={submit} className="flex max-h-[90vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-sumi-100 px-6 py-4">
            <div>
              <div className="kanji-label">手本 / identity anchor</div>
              <h2 className="mt-1 font-display text-xl text-sumi-900">アンカーを登録</h2>
            </div>
            <button
              type="button"
              className="btn-ghost disabled:opacity-40"
              onClick={close}
              aria-label="閉じる"
              disabled={saving}
            >
              ×
            </button>
          </header>

          <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5 p-6">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-sumi-700">anchor ID</span>
                <input
                  className="wa-input font-mono"
                  autoFocus
                  data-anchor-initial-focus
                  value={anchorId}
                  onChange={(event) => setAnchorId(event.target.value.toLowerCase())}
                  maxLength={48}
                  placeholder="face / outfit / full-body"
                  required
                />
                {idProblem ? <span className="mt-1 block text-[11px] text-shu-700">{idProblem}</span> : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-sumi-700">画像ファイル</span>
                <input
                  className="block w-full rounded-sm border border-dashed border-sumi-200 bg-washi-100/50 px-3 py-4 text-sm text-sumi-500 file:mr-3 file:rounded-sm file:border-0 file:bg-sumi-900 file:px-3 file:py-1.5 file:font-serif file:text-washi-50"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                />
                {fileProblem ? <span className="mt-1 block text-[11px] text-shu-700">{fileProblem}</span> : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-sumi-700">用途メモ</span>
                <textarea
                  className="wa-textarea min-h-20"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={1000}
                  placeholder="何を固定する基準画像か"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-sumi-700">次の改善</span>
                <input
                  className="wa-input"
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  maxLength={1000}
                  placeholder="この anchor で次に確認すること"
                  required
                />
                <span className="mt-1 block text-[11px] text-sumi-300">
                  登録と同時に日録へ記録します。改行は使えません。
                </span>
              </label>

              {error ? (
                <div role="alert" className="rounded-sm border border-shu-100 bg-shu-50 px-4 py-3 text-sm text-shu-900">
                  {error}
                </div>
              ) : null}
            </div>

            <aside className="border-t border-sumi-100 bg-washi-100/50 p-6 lg:border-l lg:border-t-0">
              <div className="kanji-label">登録前の見立て</div>
              <div className="mt-4 overflow-hidden rounded-sm border border-sumi-100 bg-white">
                {previewUrl ? (
                  <img src={previewUrl} alt="選択画像のプレビュー" className="aspect-square w-full object-contain" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-center text-[12px] leading-relaxed text-sumi-300">
                    画像を選ぶと<br />ここに表示されます
                  </div>
                )}
              </div>
              <dl className="mt-4 space-y-3 text-[11px]">
                <div>
                  <dt className="kanji-label">保存名</dt>
                  <dd className="mt-1 break-all font-mono text-sumi-700">
                    {normalizedId && extension ? `${normalizedId}-anchor.${extension}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="kanji-label">容量</dt>
                  <dd className="mt-1 font-mono text-sumi-700">
                    {file ? formatBytes(file.size) : "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 border-t border-sumi-100 pt-4 text-[11px] leading-relaxed text-sumi-300">
                元ファイル名は保存に使いません。形式と実データをサーバー側でも照合し、同名ファイルがあれば停止します。
              </p>
            </aside>
          </div>

          <footer className="flex flex-wrap items-center gap-3 border-t border-sumi-100 bg-white/80 px-6 py-4">
            <button className="btn-sumi" type="submit" disabled={!canSave || saving}>
              {saving ? "登録中…" : "登録する"}
            </button>
            <button
              className="btn-ghost disabled:opacity-40"
              type="button"
              onClick={close}
              disabled={saving}
            >
              キャンセル
            </button>
            <span className="ml-auto text-[11px] text-sumi-300">既存 anchor は上書きしません</span>
          </footer>
        </form>
      </section>
    </div>
  );
}

function validateFile(file: File | null): string | null {
  if (!file) return null;
  if (!ACCEPTED_TYPES.has(file.type)) return "JPEG / PNG / WebP を選んでください。";
  if (file.size === 0) return "空のファイルは登録できません。";
  if (file.size > MAX_FILE_BYTES) return "5 MiB 以下の画像を選んでください。";
  return null;
}

function extensionFor(type: string): string | null {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}
