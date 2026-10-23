import { useId, type ReactNode } from "react";
import { useT } from "../messages/index.ts";

/** Étape numérotée d'un parcours : section titrée « Étape n : … » pour les lecteurs d'écran. */
export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = useId();
  const m = useT();
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <h2 id={id} className="flex items-center gap-3 text-lg font-semibold">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-sm text-white"
        >
          {n}
        </span>
        <span>
          <span className="sr-only">{m.step(n)}</span>
          {title}
        </span>
      </h2>
      {children}
    </section>
  );
}
