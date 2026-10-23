import { use, useId, useRef } from "react";
import { saveFile } from "../download.ts";
import { useT } from "../messages/index.ts";
import { countNames, GlossaryContext } from "../settings.ts";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const BUTTON =
  "rounded-md border border-slate-400 px-2 py-1 text-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

/**
 * Glossaire de noms : les termes listés sont toujours remplacés (type Personne), même si la détection
 * par IA les manque. Partagé par les onglets Anonymiser et Vérifier ; mémorisé dans le navigateur
 * seulement si l'utilisateur coche la case (voir glossary.ts).
 */
export function NamesInput({ value, onChange }: Props) {
  const id = useId();
  const helpId = useId();
  const rememberId = useId();
  const rememberNoteId = useId();
  const input = useRef<HTMLInputElement>(null);
  const glossary = use(GlossaryContext);
  const count = countNames(value);
  const remembered = !!glossary?.remember && glossary.available;
  const m = useT().names;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-medium">
          {m.label} <span className="font-normal text-slate-600">{m.optional}</span>
        </label>
        <span className="flex flex-wrap gap-2">
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
          <button type="button" onClick={() => input.current?.click()} className={BUTTON}>
            {m.load}
          </button>
          <button
            type="button"
            disabled={!value}
            onClick={() => {
              saveFile({
                name: m.fileName,
                mime: "text/plain;charset=utf-8",
                data: new TextEncoder().encode(value).buffer,
              });
            }}
            className={BUTTON}
          >
            {m.save}
          </button>
          {glossary && (
            <button type="button" disabled={!value} onClick={glossary.clear} className={BUTTON}>
              {m.clear}
            </button>
          )}
        </span>
      </div>
      <p id={helpId} className="text-sm text-slate-600">
        {m.help}
      </p>
      <textarea
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        aria-describedby={helpId}
        rows={4}
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
        placeholder={m.placeholder}
      />
      <p className="text-sm text-slate-600">
        {m.count(count)} {remembered ? m.remembered : m.notRemembered}
      </p>
      {glossary && (
        <div className="space-y-1 pt-1">
          <div className="flex items-start gap-2">
            <input
              id={rememberId}
              type="checkbox"
              checked={remembered}
              disabled={!glossary.available}
              aria-describedby={rememberNoteId}
              onChange={(e) => {
                glossary.setRemember(e.target.checked);
              }}
              className="mt-1 size-4"
            />
            <label htmlFor={rememberId} className={glossary.available ? "" : "text-slate-500"}>
              {m.remember}
            </label>
          </div>
          <p id={rememberNoteId} className="pl-6 text-sm text-slate-600">
            {glossary.available ? m.rememberNote : m.unavailable}
          </p>
          {remembered && glossary.saveFailed && (
            <p role="alert" className="pl-6 text-sm text-red-700">
              {m.saveFailed}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
