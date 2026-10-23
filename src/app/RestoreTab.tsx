import { useState } from "react";
import type { RestoreResult } from "../worker/protocol.ts";
import { Banner, WarningsBanner } from "./components/Banner.tsx";
import { Downloads } from "./components/Downloads.tsx";
import { FileDrop } from "./components/FileDrop.tsx";
import { More } from "./components/More.tsx";
import { PrimaryButton } from "./components/PrimaryButton.tsx";
import { Recap } from "./components/Recap.tsx";
import { RestoreReportView } from "./components/Reports.tsx";
import { Running } from "./components/Running.tsx";
import { Step } from "./components/Step.tsx";
import { Timer } from "./components/Timer.tsx";
import { saveFile } from "./download.ts";
import { RESTORE_EXTENSIONS } from "./settings.ts";
import { useEngine } from "./useEngine.ts";
import { useT } from "./messages/index.ts";

export function RestoreTab() {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<File | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const { state, run, cancel } = useEngine();
  const m = useT().restore;

  const start = async () => {
    if (!file || !mapping) return;
    setResult(null);
    const r = await run("restore", {
      file: await file.arrayBuffer(),
      fileName: file.name,
      mapping: await mapping.text(),
    });
    if (r) {
      setResult(r);
      saveFile(r.document);
    }
  };

  if (file && mapping && (state.running || result)) {
    return (
      <>
        <Recap
          files={[file.name, mapping.name]}
          running={state.running}
          onRestart={() => {
            setResult(null);
            setFile(null);
            setMapping(null);
          }}
        >
          <Running state={state} onCancel={cancel} />
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
          accept={RESTORE_EXTENSIONS}
          file={file}
          onFile={(f) => {
            setFile(f);
            setResult(null);
          }}
          hint={m.fileHint}
          testId="restore-file"
        />
        <FileDrop
          label={m.mappingLabel}
          accept={["json"]}
          file={mapping}
          onFile={setMapping}
          testId="restore-mapping"
        />
      </Step>
      <Step n={2} title={m.step2}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PrimaryButton disabled={!file || !mapping} onClick={() => void start()}>
            {m.button}
          </PrimaryButton>
          <p className="text-sm text-slate-600">{file && mapping ? m.willDownload : m.needFiles}</p>
        </div>
        {state.error && <Banner tone="error" title={state.error} />}
      </Step>
    </>
  );
}

function Outcome({ result }: { result: RestoreResult }) {
  const unknown = result.unknownTokens.length;
  const t = useT();
  const m = t.restore;
  return (
    <section aria-labelledby="resultat-restauration" className="space-y-4">
      <h2 id="resultat-restauration" className="sr-only">
        {t.result}
      </h2>
      <WarningsBanner warnings={result.warnings} />
      {unknown > 0 ? (
        <Banner tone="error" title={m.unknown(unknown)}>
          {m.unknownBody}
          <span className="font-mono break-all">{result.document.name}</span>
        </Banner>
      ) : (
        <Banner tone="success" title={m.success}>
          {m.downloaded}
          <span className="font-mono break-all">{result.document.name}</span>
        </Banner>
      )}
      <More summary={m.more}>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">{m.moreIntro}</p>
          <Downloads
            items={[
              { label: m.dlDocument, file: result.document, primary: true },
              { label: m.dlReport, file: result.report },
            ]}
          />
        </div>
        <RestoreReportView r={result.summary} />
      </More>
    </section>
  );
}
