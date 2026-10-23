import { useT } from "../messages/index.ts";

/** Formats acceptés par « Anonymiser », et pourquoi les anciens formats Office sont refusés. */
export function FormatsHint() {
  const m = useT().formatsHint;
  return (
    <>
      {m.formats}
      <details className="mt-1">
        <summary className="cursor-pointer underline">{m.legacyQuestion}</summary>
        <span className="mt-1 block">{m.legacyAnswer}</span>
        <span className="mt-1 block">{m.otherFormats}</span>
      </details>
    </>
  );
}
