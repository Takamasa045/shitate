import type { CharacterStatus } from "@studio/shared/types";

const LABEL: Record<string, { text: string; kanji: string; cls: string }> = {
  stable: { text: "stable", kanji: "定", cls: "hanko-stable" },
  experimental: { text: "experimental", kanji: "試", cls: "hanko-experimental" },
  draft: { text: "draft", kanji: "草", cls: "hanko-draft" },
};

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: CharacterStatus | null;
  size?: "sm" | "seal";
}) {
  const meta = status ? LABEL[status] : LABEL.draft;
  if (size === "seal") {
    return (
      <span
        className={`seal ${meta.cls}`}
        title={meta.text}
        aria-label={meta.text}
      >
        {meta.kanji}
      </span>
    );
  }
  return <span className={meta.cls}>{meta.text}</span>;
}
