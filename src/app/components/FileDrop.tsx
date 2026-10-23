import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { extensionOf, refusalMessage, signatureProblem } from "../../adapters/formats.ts";
import { useT } from "../messages/index.ts";

interface Props {
  label: string;
  /** Extensions acceptées, sans point. */
  accept: readonly string[];
  file: File | null;
  onFile: (file: File | null) => void;
  hint?: ReactNode;
  testId?: string;
}

export function FileDrop({ label, accept, file, onFile, hint, testId }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = useT().fileDrop;
  /** Dernier fichier déposé : un dépôt plus récent l'emporte sur une lecture d'en-tête en cours. */
  const latest = useRef<File | null>(null);

  const take = async (f: File | undefined) => {
    if (!f) return;
    latest.current = f;
    if (!accept.includes(extensionOf(f.name))) {
      setError(refusalMessage(f.name, accept));
      onFile(null);
      return;
    }
    // Contenu qui ne correspond pas à l'extension (.doc renommé en .docx…), d'après les premiers octets.
    const problem = signatureProblem(f.name, new Uint8Array(await f.slice(0, 8).arrayBuffer()));
    if (latest.current !== f) return;
    setError(problem);
    onFile(problem ? null : f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void take(e.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => {
          setOver(false);
        }}
        onDrop={onDrop}
        className={`flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed p-4 ${
          over ? "border-indigo-600 bg-indigo-50" : "border-slate-300 bg-white"
        }`}
      >
        <input
          ref={input}
          id={id}
          type="file"
          data-testid={testId}
          accept={accept.map((a) => `.${a}`).join(",")}
          className="sr-only"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {m.choose}
        </button>
        <span className="text-sm text-slate-600">{m.orDrop}</span>
        {file && (
          <span className="flex items-center gap-2 text-sm">
            <span className="font-mono">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                onFile(null);
              }}
              className="rounded px-1 text-slate-600 underline hover:text-slate-900"
              aria-label={m.removeLabel(file.name)}
            >
              {m.remove}
            </button>
          </span>
        )}
      </div>
      {hint && <div className="text-sm text-slate-600">{hint}</div>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
