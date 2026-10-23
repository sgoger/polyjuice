import { useState } from "react";
import type { CheckResult } from "../worker/protocol.ts";
import { Banner, WarningsBanner } from "./components/Banner.tsx";
import { FileDrop } from "./components/FileDrop.tsx";
import { NamesInput } from "./components/NamesInput.tsx";
import { NerToggle } from "./components/NerToggle.tsx";
import { Preflight } from "./components/Preflight.tsx";
import { PrimaryButton } from "./components/PrimaryButton.tsx";
import { Recap } from "./components/Recap.tsx";
import { CheckReportView } from "./components/Reports.tsx";
import { Running } from "./components/Running.tsx";
import { Step } from "./components/Step.tsx";
import { Timer } from "./components/Timer.tsx";
import { DOC_EXTENSIONS, isXlsx, useNerPreload, type SharedSettings } from "./settings.ts";
import { useEngine } from "./useEngine.ts";
import { useEngineT, useT } from "./messages/index.ts";

export function CheckTab({ settings }: { settings: SharedSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const { state, run, cancel } = useEngine();
  const t = useT();
  const m = t.check;
  const engineT = useEngineT();
  const xlsx = isXlsx(file);
  useNerPreload(settings, file);

  const start = async () => {
    if (!file) return;
    setResult(null);
    const r = await run("check", {
      file: await file.arrayBuffer(),
      fileName: file.name,
      names: settings.names,
      ner: settings.ner && !xlsx,
    });
    if (r) setResult(r);
  };
  const modelLoading =
    settings.ner && !xlsx && settings.nerStatus === "loading" ? { progress: settings.nerProgress } : null;

  const clean = result?.report.rows.length === 0 && result.report.notices.length === 0;

  if (file && (state.running || result)) {
    return (
      <>
        <Recap
          files={[file.name]}
          running={state.running}
          onEdit={() => {
            setResult(null);
          }}
          onRestart={() => {
            setResult(null);
            setFile(null);
          }}
        >
          <Running state={state} onCancel={cancel} modelLoading={modelLoading} />
          <Timer state={state} />
        </Recap>
        {result && (
          <section aria-labelledby="resultat-verification" className="space-y-4">
            <h2 id="resultat-verification" className="sr-only">
              {t.result}
            </h2>
            <WarningsBanner warnings={result.warnings} />
            {clean ? (
              <Banner tone="success" title={m.clean} />
            ) : (
              <Banner
                tone="warning"
                title={engineT.stillLooksPersonal(result.report.rows.length + result.report.notices.length)}
              />
            )}
            <CheckReportView r={result.report} />
          </section>
        )}
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
          testId="check-file"
        />
        <Preflight file={file} />
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
        <NamesInput value={settings.names} onChange={settings.setNames} />
      </Step>
      <Step n={3} title={m.step3}>
        <PrimaryButton disabled={!file} onClick={() => void start()}>
          {m.button}
        </PrimaryButton>
        {state.error && <Banner tone="error" title={state.error} />}
      </Step>
    </>
  );
}
