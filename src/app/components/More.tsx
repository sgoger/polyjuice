import type { ReactNode } from "react";

/** Zone repliée par défaut, pour ce qui ne sert pas au quotidien. */
export function More({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className="rounded-md border border-slate-200 p-3">
      <summary className="cursor-pointer font-medium">{summary}</summary>
      <div className="mt-4 space-y-6">{children}</div>
    </details>
  );
}
