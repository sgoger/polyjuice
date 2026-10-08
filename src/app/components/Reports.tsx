import {
  KIND_LABELS,
  MAPPING_REMINDER,
  SOURCE_LABELS,
  TYPE_LABELS,
  type AnonymizeReport,
  type CheckReport,
  type Context,
  type RestoreReport,
} from "../../engine/report.ts";
import { ENTITY_TYPES } from "../../engine/types.ts";

function Ctx({ c }: { c: Context }) {
  return (
    <span className="font-mono text-xs">
      {c.before}
      <mark className="bg-yellow-200 px-0.5">{c.match}</mark>
      {c.after}
    </span>
  );
}

const th = "border-b border-slate-300 px-2 py-1 text-left font-semibold";
const td = "border-b border-slate-200 px-2 py-1 align-top";

export function AnonymizeReportView({ r }: { r: AnonymizeReport }) {
  return (
    <section aria-labelledby="rapport-detection" className="space-y-3">
      <h3 id="rapport-detection" className="text-lg font-semibold">
        Rapport de détection
      </h3>
      <ul className="text-sm">
        <li>
          Fichier : <span className="font-mono">{r.fileName}</span> ({r.format})
        </li>
        <li>Détection par IA : {r.ner ? "activée" : "désactivée"}</li>
        <li>
          Entités distinctes remplacées : {r.rows.length}
          {r.rows.length > 0 &&
            ` (${ENTITY_TYPES.filter((t) => r.counts[t])
              .map((t) => `${TYPE_LABELS[t]} : ${r.counts[t] ?? 0}`)
              .join(", ")})`}
        </li>
      </ul>
      {r.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>Token</th>
                <th className={th}>Type</th>
                <th className={th}>Source</th>
                <th className={`${th} text-right`}>Occurrences</th>
                <th className={th}>Contexte (première occurrence)</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.token}>
                  <td className={`${td} font-mono whitespace-nowrap`}>{row.token}</td>
                  <td className={td}>{TYPE_LABELS[row.type]}</td>
                  <td className={td}>{SOURCE_LABELS[row.source] ?? row.source}</td>
                  <td className={`${td} text-right`}>{row.occurrences}</td>
                  <td className={td}>
                    <Ctx c={row.context} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Aucune entité détectée.</p>
      )}
      <p className="text-sm font-semibold text-red-800">⚠ {MAPPING_REMINDER}</p>
    </section>
  );
}

export function CheckReportView({ r }: { r: CheckReport }) {
  if (r.rows.length === 0 && r.notices.length === 0) return null;
  return (
    <section aria-labelledby="rapport-verification" className="space-y-3">
      <h3 id="rapport-verification" className="text-lg font-semibold">
        Éléments encore détectés
      </h3>
      {r.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>Texte</th>
                <th className={th}>Type</th>
                <th className={th}>Source</th>
                <th className={th}>Emplacement</th>
                <th className={th}>Contexte</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, i) => (
                <tr key={i}>
                  <td className={`${td} font-mono`}>{row.text}</td>
                  <td className={td}>{TYPE_LABELS[row.type]}</td>
                  <td className={td}>{SOURCE_LABELS[row.source] ?? row.source}</td>
                  <td className={td}>{KIND_LABELS[row.kind]}</td>
                  <td className={td}>
                    <Ctx c={row.context} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.notices.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {r.notices.map((n, i) => (
            <li key={i}>
              {n.where} : <span className="font-mono">{n.text}</span> (non modifié)
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RestoreReportView({ r }: { r: RestoreReport }) {
  return (
    <section aria-labelledby="rapport-restauration" className="space-y-3">
      <h3 id="rapport-restauration" className="text-lg font-semibold">
        Rapport de restauration
      </h3>
      {r.unknown.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold text-red-800">Tokens inconnus (laissés tels quels) :</p>
          <ul className="list-disc pl-5 font-mono">
            {r.unknown.map((u) => (
              <li key={u.token}>
                {u.token} × {u.occurrences}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm">
        {r.found.length} token(s) restauré(s) ({r.found.reduce((a, f) => a + f.occurrences, 0)} occurrence(s)).
      </p>
      {r.missing.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">
            {r.missing.length} token(s) du mapping non retrouvé(s) dans ce document (information)
          </summary>
          <ul className="list-disc pl-5 font-mono">
            {r.missing.map((m) => (
              <li key={m.token}>
                {m.token} ({TYPE_LABELS[m.type]})
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
