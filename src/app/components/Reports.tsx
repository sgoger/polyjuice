import type { AnonymizeReport, CheckReport, Context, RestoreReport } from "../../engine/report.ts";
import { ENTITY_TYPES } from "../../engine/types.ts";
import { useEngineT, useT } from "../messages/index.ts";

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
  const m = useT().reports;
  const { labels, report, colon, mappingReminder } = useEngineT();
  return (
    <section aria-labelledby="rapport-detection" className="space-y-3">
      <h3 id="rapport-detection" className="text-lg font-semibold">
        {m.detection}
      </h3>
      <ul className="text-sm">
        <li>
          {report.file}
          {colon}
          <span className="font-mono">{r.fileName}</span> ({r.format})
        </li>
        <li>{m.ner(r.ner)}</li>
        <li>
          {report.replacedEntities}
          {colon}
          {r.rows.length}
          {r.rows.length > 0 &&
            ` (${ENTITY_TYPES.filter((type) => r.counts[type])
              .map((type) => `${labels.types[type]}${colon}${r.counts[type] ?? 0}`)
              .join(", ")})`}
        </li>
      </ul>
      {r.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>{report.token}</th>
                <th className={th}>{report.type}</th>
                <th className={th}>{report.source}</th>
                <th className={`${th} text-right`}>{report.occurrences}</th>
                <th className={th}>{report.firstContext}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.token}>
                  <td className={`${td} font-mono whitespace-nowrap`}>{row.token}</td>
                  <td className={td}>{labels.types[row.type]}</td>
                  <td className={td}>{labels.sources[row.source] ?? row.source}</td>
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
        <p>{report.noEntity}</p>
      )}
      <p className="text-sm font-semibold text-red-800">⚠ {mappingReminder}</p>
    </section>
  );
}

export function CheckReportView({ r }: { r: CheckReport }) {
  const m = useT().reports;
  const { labels, report, colon } = useEngineT();
  if (r.rows.length === 0 && r.notices.length === 0) return null;
  return (
    <section aria-labelledby="rapport-verification" className="space-y-3">
      <h3 id="rapport-verification" className="text-lg font-semibold">
        {m.stillDetected}
      </h3>
      {r.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>{report.text}</th>
                <th className={th}>{report.type}</th>
                <th className={th}>{report.source}</th>
                <th className={th}>{report.location}</th>
                <th className={th}>{report.context}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, i) => (
                <tr key={i}>
                  <td className={`${td} font-mono`}>{row.text}</td>
                  <td className={td}>{labels.types[row.type]}</td>
                  <td className={td}>{labels.sources[row.source] ?? row.source}</td>
                  <td className={td}>{labels.kinds[row.kind]}</td>
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
              {n.where}
              {colon}
              <span className="font-mono">{n.text}</span> {m.unchanged}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RestoreReportView({ r }: { r: RestoreReport }) {
  const m = useT().reports;
  const { labels } = useEngineT();
  return (
    <section aria-labelledby="rapport-restauration" className="space-y-3">
      <h3 id="rapport-restauration" className="text-lg font-semibold">
        {m.restore}
      </h3>
      {r.unknown.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold text-red-800">{m.unknownTokens}</p>
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
        {m.restored(
          r.found.length,
          r.found.reduce((a, f) => a + f.occurrences, 0),
        )}
      </p>
      {r.missing.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">{m.missing(r.missing.length)}</summary>
          <ul className="list-disc pl-5 font-mono">
            {r.missing.map((x) => (
              <li key={x.token}>
                {x.token} ({labels.types[x.type]})
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
