import { LOCALES, type Locale } from "../../i18n/index.ts";
import { uiMessagesFor, useT } from "../messages/index.ts";

/** Sélecteur de langue (FR / DE) : boutons à bascule, chaque langue nommée dans sa propre langue. */
export function LanguageSwitch({ value, onChange }: { value: Locale; onChange: (locale: Locale) => void }) {
  const m = useT();
  return (
    <div role="group" aria-label={m.languageLabel} className="flex shrink-0 rounded-md border border-slate-300 p-0.5">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={value === l}
          title={uiMessagesFor(l).languageName}
          onClick={() => {
            onChange(l);
          }}
          className={`rounded px-2 py-1 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
            value === l ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <span aria-hidden="true">{l.toUpperCase()}</span>
          <span className="sr-only">{uiMessagesFor(l).languageName}</span>
        </button>
      ))}
    </div>
  );
}
