import { useId, useRef, useState, type DragEvent } from "react";

interface Props {
  label: string;
  /** Extensions acceptées, sans point. */
  accept: readonly string[];
  file: File | null;
  onFile: (file: File | null) => void;
  hint?: string;
  testId?: string;
}

const ext = (name: string) => /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";

export function FileDrop({ label, accept, file, onFile, hint, testId }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = (f: File | undefined) => {
    if (!f) return;
    if (!accept.includes(ext(f.name))) {
      setError(
        `« ${f.name} » n'est pas pris en charge ici. Formats acceptés : ${accept.map((a) => `.${a}`).join(", ")}.`,
      );
      onFile(null);
      return;
    }
    setError(null);
    onFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files[0]);
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
            take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Choisir un fichier
        </button>
        <span className="text-sm text-slate-600">ou glisser-déposer ici</span>
        {file && (
          <span className="flex items-center gap-2 text-sm">
            <span className="font-mono">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                onFile(null);
              }}
              className="rounded px-1 text-slate-600 underline hover:text-slate-900"
              aria-label={`Retirer ${file.name}`}
            >
              retirer
            </button>
          </span>
        )}
      </div>
      {hint && <p className="text-sm text-slate-600">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
