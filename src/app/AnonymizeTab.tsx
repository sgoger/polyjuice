import { pl } from "../engine/plural.ts";
import { useId, useState } from "react";
import type { AnonymizeResult } from "../worker/protocol.ts";
import { WarningsBanner, Banner } from "./components/Banner.tsx";
import { Downloads } from "./components/Downloads.tsx";
import { FileDrop } from "./components/FileDrop.tsx";
import { More } from "./components/More.tsx";
import { NamesInput } from "./components/NamesInput.tsx";
import { NerToggle } from "./components/NerToggle.tsx";
import { PrimaryButton } from "./components/PrimaryButton.tsx";
import { Recap } from "./components/Recap.tsx";
import { AnonymizeReportView } from "./components/Reports.tsx";
import { Running } from "./components/Running.tsx";
import { Step } from "./components/Step.tsx";
import { Timer } from "./components/Timer.tsx";
import { saveFile } from "./download.ts";
import { countNames, DOC_EXTENSIONS, isXlsx, useNerPreload, type SharedSettings } from "./settings.ts";
import { useEngine } from "./useEngine.ts";

export function AnonymizeTab({ settings }: { settings: SharedSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<File | null>(null);
  const [columns, setColumns] = useState("");
  const [result, setResult] = useState<AnonymizeResult | null>(null);
  /** Réglages du traitement lancé, figés pour le récapitulatif. */
  const [recap, setRecap] = useState<string[]>([]);
  const { state, run, cancel } = useEngine();
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
    setRecap([
      ner ? "Détection IA" : "Sans détection IA",
      ...(names > 0 ? [pl(names, "nom", "noms")] : []),
      ...(xlsx && columnList.length > 0 ? [`Colonnes : ${columnList.join(", ")}`] : []),
      ...(mapping ? [`Mapping réutilisé : ${mapping.name}`] : []),
    ]);
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
          details={recap}
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
      <p className="rounded-lg bg-indigo-50 p-4 text-slate-800">
        <strong>Anonymisez</strong> le document ici, <strong>envoyez</strong> le document anonymisé à l'outil externe
        (IA, traduction…), puis <strong>restaurez</strong> sa réponse dans l'onglet « Restaurer » avec le mapping.
      </p>

      <Step n={1} title="Déposer le document">
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
      </Step>

      <Step n={2} title="Options">
        {xlsx ? (
          <p className="text-sm text-slate-600">
            Détection par IA indisponible pour les classeurs .xlsx : les données sont repérées par motifs (e-mails,
            téléphones, IBAN…), par la liste de noms et par les colonnes ci-dessous.
          </p>
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
        <NamesInput value={settings.names} onChange={settings.setNames} />
        <More
          summary={
            <>
              Options avancées
              {mapping && <span className="font-normal text-slate-600"> (mapping réutilisé : {mapping.name})</span>}
            </>
          }
        >
          <FileDrop
            label="Mapping existant à réutiliser (facultatif)"
            accept={["json"]}
            file={mapping}
            onFile={setMapping}
            hint="Réutilise le même salt et les mêmes tokens ; le mapping est complété, jamais tronqué."
            testId="anonymize-mapping"
          />
        </More>
      </Step>

      <Step n={3} title="Anonymiser">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PrimaryButton disabled={!file} onClick={() => void start()}>
            Anonymiser
          </PrimaryButton>
          <p className="text-sm text-slate-600">
            {file ? "Une archive .zip sera téléchargée automatiquement." : "Déposez d'abord un document (étape 1)."}
          </p>
        </div>
        {state.error && <Banner tone="error" title={state.error} />}
      </Step>
    </>
  );
}

function Outcome({ result }: { result: AnonymizeResult }) {
  const { archive, document, mapping, report } = result;
  return (
    <section aria-labelledby="resultat-anonymisation" className="space-y-4">
      <h2 id="resultat-anonymisation" className="sr-only">
        Résultat
      </h2>
      <WarningsBanner warnings={result.warnings} when="avant l'envoi" />
      <Banner
        tone="success"
        title={`Document anonymisé : ${pl(result.summary.rows.length, "entité remplacée", "entités remplacées")}.`}
      >
        Archive téléchargée : <span className="font-mono break-all">{archive.name}</span>
      </Banner>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        <FileRole name={document.name} role="Envoyer" tone="send">
          seul fichier à transmettre à l'outil externe
        </FileRole>
        <FileRole name={mapping.name} role="Garder, ne jamais envoyer" tone="keep">
          données en clair, nécessaire pour restaurer
        </FileRole>
      </ul>
      <More summary="Télécharger à nouveau, rapport de détection">
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Si le téléchargement n'a pas démarré, ou pour un seul fichier :</p>
          <Downloads
            items={[
              { label: "Archive (.zip)", file: archive, primary: true },
              { label: "Document anonymisé", file: document },
              { label: "Mapping (JSON)", file: mapping, note: "Données en clair : ne jamais le transmettre." },
              { label: "Rapport (Markdown)", file: report },
            ]}
          />
        </div>
        <p className="text-sm text-slate-600">
          Contrôle facultatif avant l'envoi : déposez le document anonymisé dans l'onglet « Vérifier ».
        </p>
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
