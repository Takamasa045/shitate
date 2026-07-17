const STEPS = [
  { key: "material", mark: "素", label: "素材", hint: "character" },
  { key: "prompt", mark: "詞", label: "詞書", hint: "prompt" },
  { key: "log", mark: "録", label: "日録", hint: "learn" },
  { key: "compile", mark: "調", label: "調合", hint: "compile" },
] as const;

export type ForgeStep = (typeof STEPS)[number]["key"];

export function ForgeSteps({ active }: { active: ForgeStep }) {
  const activeIndex = STEPS.findIndex((step) => step.key === active);
  return (
    <ol className="forge-steps" aria-label="キャラクターの鍛造工程">
      {STEPS.map((step, index) => {
        const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "next";
        return (
          <li key={step.key} className="forge-step" data-state={state}>
            <span className="forge-step-mark" aria-hidden>{step.mark}</span>
            <span>
              <span className="forge-step-label">{step.label}</span>
              <span className="forge-step-hint">{step.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
