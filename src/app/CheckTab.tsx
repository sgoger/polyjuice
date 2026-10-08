import { pl } from "../engine/plural.ts";
import { useState } from "react";
import type { CheckResult } from "../worker/protocol.ts";
import { Banner, WarningsBanner } from "./components/Banner.tsx";
import { FileDrop } from "./components/FileDrop.tsx";
import { NamesInput } from "./components/NamesInput.tsx";
import { NerToggle } from "./components/NerToggle.tsx";
import { PrimaryButton } from "./components/PrimaryButton.tsx";
import { CheckReportView } from "./components/Reports.tsx";
import { Running } from "./components/Running.tsx";
import { DOC_EXTENSIONS, isXlsx, type SharedSettings } from "./settings.ts";
import { useEngine } from "./useEngine.ts";

export function CheckTab({ settings }: { settings: SharedSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const { state, run, cancel } = useEngine();
  const xlsx = isXlsx(file);

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

  const clean = result?.report.rows.length === 0 && result.report.notices.length === 0;
  return (
    <>
      <p className="text-slate-700">
        Relance la détection sur un document déjà anonymisé et affiche ce qui ressemble encore à une donnée personnelle.
        Rien n'est produit.
      </p>
      <FileDrop
        label="Document anonymisé à vérifier"
        accept={DOC_EXTENSIONS}
        file={file}
        onFile={(f) => {
          setFile(f);
          setResult(null);
        }}
        testId="check-file"
      />
      <NamesInput value={settings.names} onChange={settings.setNames} />
      <NerToggle
        checked={settings.ner}
        onChange={settings.setNer}
        onCancel={settings.cancelNer}
        disabled={xlsx}
        disabledReason="Indisponible pour les classeurs .xlsx."
        progress={settings.nerProgress}
        status={settings.nerStatus}
        error={settings.nerError}
        backend={settings.nerBackend}
      />
      <PrimaryButton disabled={!file || state.running} onClick={() => void start()}>
        Vérifier
      </PrimaryButton>
      <Running state={state} onCancel={cancel} />
      {state.error && <Banner tone="error" title={state.error} />}
      {result && (
        <div className="space-y-6">
          <WarningsBanner warnings={result.warnings} />
          {clean ? (
            <Banner
              tone="success"
              title="Rien de détecté : aucune donnée personnelle reconnue (tokens existants ignorés)."
            />
          ) : (
            <Banner
              tone="warning"
              title={`${pl(result.report.rows.length + result.report.notices.length, "élément ressemble", "éléments ressemblent")} encore à des données personnelles.`}
            />
          )}
          <CheckReportView r={result.report} />
        </div>
      )}
    </>
  );
}
