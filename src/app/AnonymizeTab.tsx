import { pl } from "../engine/plural.ts";
import { useId, useState } from "react";
import type { AnonymizeResult } from "../worker/protocol.ts";
import { WarningsBanner, Banner } from "./components/Banner.tsx";
import { Downloads } from "./components/Downloads.tsx";
import { FileDrop } from "./components/FileDrop.tsx";
import { NamesInput } from "./components/NamesInput.tsx";
import { NerToggle } from "./components/NerToggle.tsx";
import { PrimaryButton } from "./components/PrimaryButton.tsx";
import { AnonymizeReportView } from "./components/Reports.tsx";
import { Running } from "./components/Running.tsx";
import { DOC_EXTENSIONS, isXlsx, type SharedSettings } from "./settings.ts";
import { useEngine } from "./useEngine.ts";

export function AnonymizeTab({ settings }: { settings: SharedSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<File | null>(null);
  const [columns, setColumns] = useState("");
  const [result, setResult] = useState<AnonymizeResult | null>(null);
  const { state, run, cancel } = useEngine();
  const columnsId = useId();
  const xlsx = isXlsx(file);

  const start = async () => {
    if (!file) return;
    setResult(null);
    const r = await run("anonymize", {
      file: await file.arrayBuffer(),
      fileName: file.name,
      names: settings.names,
      ner: settings.ner && !xlsx,
      columns: xlsx
        ? columns
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : [],
      mapping: mapping ? await mapping.text() : null,
    });
    if (r) setResult(r);
  };

  return (
    <>
      <FileDrop
        label="Document à anonymiser"
        accept={DOC_EXTENSIONS}
        file={file}
        onFile={(f) => {
          setFile(f);
          setResult(null);
        }}
        hint="Formats : .docx, .pptx, .xlsx, .pdf (converti en .md), .md, .txt."
        testId="anonymize-file"
      />
      <NamesInput value={settings.names} onChange={settings.setNames} />
      <NerToggle
        checked={settings.ner}
        onChange={settings.setNer}
        onCancel={settings.cancelNer}
        disabled={xlsx}
        disabledReason="Indisponible pour les classeurs .xlsx : détection par motifs, liste de noms et colonnes uniquement."
        progress={settings.nerProgress}
        status={settings.nerStatus}
        error={settings.nerError}
        backend={settings.nerBackend}
      />
      {xlsx && (
        <div className="space-y-1">
          <label htmlFor={columnsId} className="block font-medium">
            Colonnes à anonymiser{" "}
            <span className="font-normal text-slate-600">(en-têtes séparés par des virgules)</span>
          </label>
          <input
            id={columnsId}
            value={columns}
            onChange={(e) => {
              setColumns(e.target.value);
            }}
            placeholder="Nom, Prénom"
            className="w-full rounded-md border border-slate-300 p-2"
          />
          <p className="text-sm text-slate-600">
            Toutes les cellules texte de ces colonnes sont remplacées intégralement, sur chaque feuille (en-tête =
            première ligne non vide).
          </p>
        </div>
      )}
      <FileDrop
        label="Mapping existant à réutiliser (facultatif)"
        accept={["json"]}
        file={mapping}
        onFile={setMapping}
        hint="Réutilise le même salt et les mêmes tokens ; le mapping est complété, jamais tronqué."
        testId="anonymize-mapping"
      />
      <PrimaryButton disabled={!file || state.running} onClick={() => void start()}>
        Anonymiser
      </PrimaryButton>
      <Running state={state} onCancel={cancel} />
      {state.error && <Banner tone="error" title={state.error} />}
      {result && (
        <div className="space-y-6">
          <WarningsBanner warnings={result.warnings} />
          <Banner
            tone="success"
            title={`Document anonymisé : ${pl(result.summary.rows.length, "entité distincte remplacée", "entités distinctes remplacées")}.`}
          />
          <Downloads
            items={[
              { label: "Document anonymisé", file: result.document, primary: true },
              {
                label: "Mapping (JSON)",
                file: result.mapping,
                note: "Contient les données en clair : ne jamais le transmettre avec le document.",
              },
              { label: "Rapport (Markdown)", file: result.report },
            ]}
          />
          <AnonymizeReportView r={result.summary} />
        </div>
      )}
    </>
  );
}
