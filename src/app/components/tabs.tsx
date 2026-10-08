import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

/** Onglets accessibles (motif WAI-ARIA) : flèches gauche/droite, Début, Fin. */
export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = tabs.length;
    const next =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const t = tabs[next];
    if (t) {
      onChange(t.id);
      refs.current[t.id]?.focus();
    }
  };
  return (
    <div>
      <div role="tablist" aria-label="Actions" className="flex gap-1 border-b border-slate-300">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => {
              onChange(t.id);
            }}
            onKeyDown={(e) => {
              onKey(e, i);
            }}
            className={`-mb-px rounded-t-md border px-4 py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
              active === t.id
                ? "border-slate-300 border-b-slate-50 bg-slate-50 text-slate-900 underline decoration-2 underline-offset-8"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={active !== t.id}
          tabIndex={0}
          className="space-y-6 py-6 focus-visible:outline-none"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
