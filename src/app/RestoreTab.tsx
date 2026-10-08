import { useState } from "react";
import type { RestoreResult } from "../worker/protocol.ts";
import { Banner, WarningsBanner } from "./components/Banner.tsx";
import { Downloads } from "./components/Downloads.tsx";
import { FileDrop } from "./components/FileDrop.tsx";
import { PrimaryButton } from "./components/PrimaryButton.tsx";
import { RestoreReportView } from "./components/Reports.tsx";
import { Running } from "./components/Running.tsx";
import { RESTORE_EXTENSIONS } from "./settings.ts";
import { useEngine } from "./useEngine.ts";

export function RestoreTab() {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<File | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const { state, run, cancel } = useEngine();

  const start = async () => {
    if (!file || !mapping) return;
    setResult(null);
    const r = await run("restore", {
      file: await file.arrayBuffer(),
      fileName: file.name,
      mapping: await mapping.text(),
    });
    if (r) setResult(r);
  };

  return (
    <>
      <p className="text-slate-700">
        Remplace les tokens du document retourné par l'outil externe par les valeurs d'origine. Le document est traité
        selon son extension, quelle que soit celle de l'original (un PDF anonymisé revient en .md ou .txt).
      </p>
      <FileDrop
        label="Document retourné par l'outil externe"
        accept={RESTORE_EXTENSIONS}
        file={file}
        onFile={(f) => {
          setFile(f);
          setResult(null);
        }}
        hint="Formats : .docx, .pptx, .xlsx, .md, .txt (pas de .pdf : déposez le .md produit)."
        testId="restore-file"
      />
      <FileDrop
        label="Mapping (JSON) produit lors de l'anonymisation"
        accept={["json"]}
        file={mapping}
        onFile={setMapping}
        testId="restore-mapping"
      />
      <PrimaryButton disabled={!file || !mapping || state.running} onClick={() => void start()}>
        Restaurer
      </PrimaryButton>
      <Running state={state} onCancel={cancel} />
      {state.error && <Banner tone="error" title={state.error} />}
      {result && (
        <div className="space-y-6">
          <WarningsBanner warnings={result.warnings} />
          {result.unknownTokens.length > 0 ? (
            <Banner
              tone="error"
              title={`${result.unknownTokens.length} token(s) absents du mapping : laissés tels quels dans le document restauré.`}
            >
              Vérifiez que le mapping correspond à ce document.
            </Banner>
          ) : (
            <Banner tone="success" title="Document restauré." />
          )}
          <Downloads
            items={[
              { label: "Document restauré", file: result.document, primary: true },
              { label: "Rapport de restauration", file: result.report },
            ]}
          />
          <RestoreReportView r={result.summary} />
        </div>
      )}
    </>
  );
}
