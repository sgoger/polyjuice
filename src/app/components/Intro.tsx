import type { ReactNode } from "react";

/** Encadré d'introduction en tête d'onglet : texte simple, ou paragraphes et liste numérotée. */
export function Intro({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg bg-indigo-50 p-4 text-slate-800 [&_ol]:list-decimal [&_ol]:pl-5">
      {children}
    </div>
  );
}
