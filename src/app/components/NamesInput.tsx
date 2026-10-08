import { useId, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** Liste de noms : jamais stockée, vidée au rechargement de la page. */
export function NamesInput({ value, onChange }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const count = value.split(/\r?\n/).filter((l) => l.replace(/#.*$/, "").trim()).length;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-medium">
          Liste de noms{" "}
          <span className="font-normal text-slate-600">(facultatif, un nom par ligne, # pour commenter)</span>
        </label>
        <span>
          <input
            ref={input}
            type="file"
            accept=".txt"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void f.text().then(onChange);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="rounded-md border border-slate-400 px-2 py-1 text-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Charger un .txt
          </button>
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        rows={4}
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
        placeholder={"Paulina Kowalski\nJean Dupont"}
      />
      <p className="text-sm text-slate-600">
        {count} terme(s). La liste n'est jamais enregistrée : elle est perdue au rechargement de la page.
      </p>
    </div>
  );
}
