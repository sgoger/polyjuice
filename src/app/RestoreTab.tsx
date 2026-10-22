import { agree, pl } from "../engine/plural.ts";
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
      <p className="rounded-lg bg-indigo-50 p-4 text-slate-800">
        Remplace les tokens du document renvoyé par l'outil externe par les données d'origine, grâce au mapping (le
        fichier .json de l'archive).
      </p>
      <Step n={1} title="Déposer les fichiers">
        <FileDrop
          label="Document renvoyé par l'outil externe"
          accept={RESTORE_EXTENSIONS}
          file={file}
          onFile={(f) => {
            setFile(f);
            setResult(null);
          }}
          hint="Formats : .docx, .pptx, .xlsx (et .docm, .pptm, .xlsm), .md, .txt (pour un PDF anonymisé, déposez le .md produit)."
          testId="restore-file"
        />
        <FileDrop
          label="Mapping (.json) produit lors de l'anonymisation"
          accept={["json"]}
          file={mapping}
          onFile={setMapping}
          testId="restore-mapping"
        />
      </Step>
      <Step n={2} title="Restaurer">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PrimaryButton disabled={!file || !mapping} onClick={() => void start()}>
            Restaurer
          </PrimaryButton>
          <p className="text-sm text-slate-600">
            {file && mapping
              ? "Le document restauré sera téléchargé automatiquement."
              : "Déposez d'abord le document et le mapping (étape 1)."}
          </p>
        </div>
        {state.error && <Banner tone="error" title={state.error} />}
      </Step>
    </>
  );
}

function Outcome({ result }: { result: RestoreResult }) {
  const unknown = result.unknownTokens.length;
  return (
    <section aria-labelledby="resultat-restauration" className="space-y-4">
      <h2 id="resultat-restauration" className="sr-only">
        Résultat
      </h2>
      <WarningsBanner warnings={result.warnings} />
      {unknown > 0 ? (
        <Banner
          tone="error"
          title={`${pl(unknown, "token absent", "tokens absents")} du mapping, ${agree(unknown, "laissé tel quel", "laissés tels quels")}.`}
        >
          Vérifiez que le mapping correspond à ce document. Téléchargé quand même :{" "}
          <span className="font-mono break-all">{result.document.name}</span>
        </Banner>
      ) : (
        <Banner tone="success" title="Document restauré.">
          Téléchargé : <span className="font-mono break-all">{result.document.name}</span>
        </Banner>
      )}
      <More summary="Télécharger à nouveau, rapport de restauration">
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Si le téléchargement n'a pas démarré, ou pour le rapport :</p>
          <Downloads
            items={[
              { label: "Document restauré", file: result.document, primary: true },
              { label: "Rapport de restauration", file: result.report },
            ]}
          />
        </div>
        <RestoreReportView r={result.summary} />
      </More>
    </section>
  );
}
