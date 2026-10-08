import type { ReactNode } from "react";

type Tone = "warning" | "success" | "error" | "info";

const STYLES: Record<Tone, { box: string; icon: string; label: string }> = {
  warning: { box: "border-amber-500 bg-amber-50 text-amber-950", icon: "⚠", label: "Avertissement" },
  success: { box: "border-green-600 bg-green-50 text-green-950", icon: "✓", label: "Succès" },
  error: { box: "border-red-600 bg-red-50 text-red-950", icon: "✕", label: "Erreur" },
  info: { box: "border-slate-400 bg-slate-100 text-slate-900", icon: "ℹ", label: "Information" },
};

/** Bandeau : l'état est porté par une icône et un libellé, pas seulement par la couleur. */
export function Banner({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  const s = STYLES[tone];
  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={`rounded-lg border-l-4 p-4 ${s.box}`}
      data-tone={tone}
    >
      <p className="font-semibold">
        <span aria-hidden="true">{s.icon} </span>
        <span className="sr-only">{s.label} : </span>
        {title}
      </p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

export function WarningsBanner({ warnings }: { warnings: readonly string[] }) {
  if (warnings.length === 0) return null;
  return (
    <Banner tone="warning" title={`${warnings.length} avertissement(s) — à lire avant de télécharger`}>
      <ul className="list-disc space-y-1 pl-5">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </Banner>
  );
}
