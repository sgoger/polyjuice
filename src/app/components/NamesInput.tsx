import { pl } from "../../engine/plural.ts";
import { use, useId, useRef } from "react";
import { saveFile } from "../download.ts";
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
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-medium">
          Glossaire de noms <span className="font-normal text-slate-600">(facultatif)</span>
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
            Charger un .txt
          </button>
          <button
            type="button"
            disabled={!value}
            onClick={() => {
              saveFile({
                name: "glossaire.txt",
                mime: "text/plain;charset=utf-8",
                data: new TextEncoder().encode(value).buffer,
              });
            }}
            className={BUTTON}
          >
            Enregistrer en .txt
          </button>
          {glossary && (
            <button type="button" disabled={!value} onClick={glossary.clear} className={BUTTON}>
              Effacer
            </button>
          )}
        </span>
      </div>
      <p id={helpId} className="text-sm text-slate-600">
        Les noms listés ici sont toujours remplacés (type Personne), même si la détection par IA les manque. Un nom par
        ligne, écrit tel qu'il apparaît dans les documents (« Thomas Rivière ») ; # pour un commentaire. Le même
        glossaire sert aux onglets Anonymiser et Vérifier.
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
        placeholder={"Thomas Rivière\nJean Dupont"}
      />
      <p className="text-sm text-slate-600">
        {pl(count, "terme", "termes")}.{" "}
        {remembered ? "Mémorisé dans ce navigateur." : "Non mémorisé : perdu au rechargement de la page."}
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
              Mémoriser ce glossaire dans ce navigateur
            </label>
          </div>
          <p id={rememberNoteId} className="pl-6 text-sm text-slate-600">
            {glossary.available
              ? "Le glossaire reste sur cet ordinateur, dans ce navigateur, jusqu'à ce que vous décochiez la case ou cliquiez sur « Effacer ». Ne cochez pas cette case sur un poste partagé."
              : "Indisponible : ce navigateur bloque le stockage local (navigation privée ?). Le glossaire sera perdu au rechargement de la page ; utilisez « Enregistrer en .txt » pour le conserver."}
          </p>
          {remembered && glossary.saveFailed && (
            <p role="alert" className="pl-6 text-sm text-red-700">
              ⚠ Le glossaire n'a pas pu être mémorisé (stockage plein ou bloqué). Utilisez « Enregistrer en .txt » pour
              le conserver.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
