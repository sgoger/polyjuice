import { useId, useState } from "react";
import type { AnonymizeResult } from "../worker/protocol.ts";
import { WarningsBanner, Banner } from "./components/Banner.tsx";
import { Downloads } from "./components/Downloads.tsx";
import { FileDrop } from "./components/FileDrop.tsx";
import { FormatsHint } from "./components/FormatsHint.tsx";
import { More } from "./components/More.tsx";
import { NamesInput } from "./components/NamesInput.tsx";
import { NerToggle } from "./components/NerToggle.tsx";
import { Preflight } from "./components/Preflight.tsx";
import { PrimaryButton } from "./components/PrimaryButton.tsx";
import { Recap } from "./components/Recap.tsx";
import { AnonymizeReportView } from "./components/Reports.tsx";
import { Running } from "./components/Running.tsx";
import { Step } from "./components/Step.tsx";
import { Timer } from "./components/Timer.tsx";
import { saveFile } from "./download.ts";
import { countNames, DOC_EXTENSIONS, isPdf, isXlsx, useNerPreload, type SharedSettings } from "./settings.ts";
import { useEngine } from "./useEngine.ts";
import { useT } from "./messages/index.ts";

export function AnonymizeTab({ settings }: { settings: SharedSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<File | null>(null);
  const [columns, setColumns] = useState("");
  const [result, setResult] = useState<AnonymizeResult | null>(null);
  /** Réglages du traitement lancé, figés pour le récapitulatif. */
  const [recap, setRecap] = useState<{ ner: boolean; names: number; columns: string[]; mapping: string | null }>({
    ner: false,
    names: 0,
    columns: [],
    mapping: null,
  });
  const { state, run, cancel } = useEngine();
  const m = useT().anonymize;
  const columnsId = useId();
  const xlsx = isXlsx(file);
  useNerPreload(settings, file);
  const columnList = columns
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const modelLoading =
    settings.ner && !xlsx && settings.nerStatus === "loading" ? { progress: settings.nerProgress } : null;

  const start = async () => {
    if (!file) return;
    setResult(null);
    const ner = settings.ner && !xlsx;
    const names = countNames(settings.names);
    setRecap({ ner, names, columns: xlsx ? columnList : [], mapping: mapping?.name ?? null });
    const r = await run("anonymize", {
      file: await file.arrayBuffer(),
      fileName: file.name,
      names: settings.names,
      ner,
      columns: xlsx ? columnList : [],
      mapping: mapping ? await mapping.text() : null,
    });
    if (r) {
      setResult(r);
      saveFile(r.archive);
    }
  };

  // Une fois le traitement lancé, les étapes de préparation laissent place à un récapitulatif.
  if (file && (state.running || result)) {
    return (
      <>
        <Recap
          files={[file.name]}
          details={[
            m.recapNer(recap.ner),
            ...(recap.names > 0 ? [m.recapNames(recap.names)] : []),
            ...(recap.columns.length > 0 ? [m.recapColumns(recap.columns.join(", "))] : []),
            ...(recap.mapping ? [m.recapMapping(recap.mapping)] : []),
          ]}
          running={state.running}
          onEdit={() => {
            setResult(null);
          }}
          onRestart={() => {
            setResult(null);
            setFile(null);
            setMapping(null);
            setColumns("");
          }}
        >
          <Running state={state} onCancel={cancel} modelLoading={modelLoading} />
          <Timer state={state} />
        </Recap>
        {result && <Outcome result={result} />}
      </>
    );
  }

  return (
    <>
      <p className="rounded-lg bg-indigo-50 p-4 text-slate-800">{m.intro}</p>

      <Step n={1} title={m.step1}>
        <FileDrop
          label={m.fileLabel}
          accept={DOC_EXTENSIONS}
          file={file}
          onFile={(f) => {
            setFile(f);
            setResult(null);
          }}
          hint={<FormatsHint />}
          testId="anonymize-file"
        />
        <Preflight file={file} />
        {isPdf(file) && <PdfNote />}
      </Step>

      <Step n={2} title={m.step2}>
        {xlsx ? (
          <p className="text-sm text-slate-600">{m.xlsxNoNer}</p>
        ) : (
          <NerToggle
            checked={settings.ner}
            onChange={settings.setNer}
            onCancel={settings.cancelNer}
            disabled={false}
            progress={settings.nerProgress}
            status={settings.nerStatus}
            error={settings.nerError}
            backend={settings.nerBackend}
          />
        )}
        {xlsx && (
          <div className="space-y-1">
            <label htmlFor={columnsId} className="block font-medium">
              {m.columnsLabel} <span className="font-normal text-slate-600">{m.columnsHint}</span>
            </label>
            <input
              id={columnsId}
              value={columns}
              onChange={(e) => {
                setColumns(e.target.value);
              }}
              placeholder={m.columnsPlaceholder}
              className="w-full rounded-md border border-slate-300 p-2"
            />
            <p className="text-sm text-slate-600">{m.columnsHelp}</p>
          </div>
        )}
        <NamesInput value={settings.names} onChange={settings.setNames} />
        <More
          summary={
            <>
              {m.advanced}
              {mapping && <span className="font-normal text-slate-600">{m.advancedMapping(mapping.name)}</span>}
            </>
          }
        >
          <FileDrop
            label={m.mappingLabel}
            accept={["json"]}
            file={mapping}
            onFile={setMapping}
            hint={m.mappingHint}
            testId="anonymize-mapping"
          />
        </More>
      </Step>

      <Step n={3} title={m.step3}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PrimaryButton disabled={!file} onClick={() => void start()}>
            {m.button}
          </PrimaryButton>
          <p className="text-sm text-slate-600">{file ? m.willDownload : m.needFile}</p>
        </div>
        {state.error && <Banner tone="error" title={state.error} />}
      </Step>
    </>
  );
}

function Outcome({ result }: { result: AnonymizeResult }) {
  const { archive, document, alternate, mapping, report } = result;
  const t = useT();
  const m = t.anonymize;
  return (
    <section aria-labelledby="resultat-anonymisation" className="space-y-4">
      <h2 id="resultat-anonymisation" className="sr-only">
        {t.result}
      </h2>
      <WarningsBanner warnings={result.warnings} beforeSending />
      <Banner tone="success" title={m.success(result.summary.rows.length)}>
        {m.archiveDownloaded}
        <span className="font-mono break-all">{archive.name}</span>
      </Banner>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        <FileRole name={document.name} role={m.roleSend} tone="send">
          {alternate ? m.sendDocument : m.sendOnly}
        </FileRole>
        {alternate && (
          <FileRole name={alternate.name} role={m.roleOrSend} tone="send">
            {m.sendAlternate}
          </FileRole>
        )}
        <FileRole name={mapping.name} role={m.roleKeep} tone="keep">
          {m.keepMapping}
        </FileRole>
      </ul>
      <More summary={m.more}>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">{m.moreIntro}</p>
          <Downloads
            items={[
              { label: m.dlArchive, file: archive, primary: true },
              { label: m.dlDocument, file: document },
              ...(alternate ? [{ label: m.dlAlternate, file: alternate }] : []),
              { label: m.dlMapping, file: mapping, note: m.dlMappingNote },
              { label: m.dlReport, file: report },
            ]}
          />
        </div>
        <p className="text-sm text-slate-600">{m.checkHint}</p>
        <AnonymizeReportView r={result.summary} />
      </More>
    </section>
  );
}

const ROLE_STYLES = {
  send: { badge: "bg-green-700 text-white", icon: "➜" },
  keep: { badge: "bg-red-700 text-white", icon: "🔒" },
  info: { badge: "bg-slate-600 text-white", icon: "ℹ" },
} as const;

function FileRole({
  name,
  role,
  tone,
  children,
}: {
  name: string;
  role: string;
  tone: keyof typeof ROLE_STYLES;
  children: string;
}) {
  const s = ROLE_STYLES[tone];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${s.badge}`}>
        <span aria-hidden="true">{s.icon} </span>
        {role}
      </span>
      <span className="font-mono text-sm break-all">{name}</span>
      <span className="text-sm text-slate-600">— {children}</span>
    </li>
  );
}

/** Ce qui va se passer pour un PDF, avant le traitement. */
function PdfNote() {
  const m = useT().anonymize;
  return (
    <Banner tone="info" title={m.pdfTitle}>
      <p>
        {m.pdfBody}{" "}
        <a
          href="https://github.com/sgoger/polyjuice/blob/main/docs/FORMATS.md#pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
        >
          {m.learnMore}
        </a>
      </p>
    </Banner>
  );
}
