import { pl } from "../engine/plural.ts";
import { useId, useState, type ReactNode } from "react";
import type { AnonymizeResult } from "../worker/protocol.ts";
import { WarningsBanner, Banner } from "./components/Banner.tsx";
import { Downloads } from "./components/Downloads.tsx";
import { FileDrop } from "./components/FileDrop.tsx";
import { NamesInput } from "./components/NamesInput.tsx";
import { NerToggle } from "./components/NerToggle.tsx";
import { PrimaryButton } from "./components/PrimaryButton.tsx";
import { AnonymizeReportView } from "./components/Reports.tsx";
import { Running } from "./components/Running.tsx";
import { Step } from "./components/Step.tsx";
import { Timer } from "./components/Timer.tsx";
import { saveFile } from "./download.ts";
import { DOC_EXTENSIONS, isXlsx, useNerPreload, type SharedSettings } from "./settings.ts";
import { useEngine } from "./useEngine.ts";

export function AnonymizeTab({ settings }: { settings: SharedSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<File | null>(null);
  const [columns, setColumns] = useState("");
  const [result, setResult] = useState<AnonymizeResult | null>(null);
  const { state, run, cancel } = useEngine();
  const columnsId = useId();
  const xlsx = isXlsx(file);
  useNerPreload(settings, file);

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
    if (r) {
      setResult(r);
      saveFile(r.archive);
    }
  };

  return (
    <>
      <div className="space-y-2 rounded-lg bg-indigo-50 p-4 text-slate-800">
        <p className="font-medium">Comment ça marche ?</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <strong>Anonymisez</strong> votre document ici : les noms, adresses e-mail, numéros de téléphone… sont
            remplacés par des codes comme ⟦P-K7M2X⟧.
          </li>
          <li>
            <strong>Envoyez</strong> uniquement le document anonymisé à l'outil externe (IA, traduction, résumé…).
          </li>
          <li>
            <strong>Restaurez</strong> le document qu'il vous renvoie dans l'onglet « Restaurer », avec le fichier de
            correspondances (mapping) produit ici.
          </li>
        </ol>
      </div>

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
        {/* Réglages figés pendant le traitement. */}
        <fieldset disabled={state.running} className="min-w-0 space-y-6">
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
          <details className="rounded-md border border-slate-200 p-3">
            <summary className="cursor-pointer font-medium">
              Options avancées
              {mapping && <span className="font-normal text-slate-600"> (mapping réutilisé : {mapping.name})</span>}
            </summary>
            <div className="mt-4">
              <FileDrop
                label="Mapping existant à réutiliser (facultatif)"
                accept={["json"]}
                file={mapping}
                onFile={setMapping}
                hint="Réutilise le même salt et les mêmes tokens ; le mapping est complété, jamais tronqué."
                testId="anonymize-mapping"
              />
            </div>
          </details>
        </fieldset>
      </Step>

      <Step n={3} title="Anonymiser">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PrimaryButton disabled={!file || state.running} onClick={() => void start()}>
            Anonymiser
          </PrimaryButton>
          <p className="text-sm text-slate-600">
            {file
              ? "À la fin du traitement, une archive .zip est téléchargée automatiquement."
              : "Déposez d'abord un document (étape 1)."}
          </p>
        </div>
        <Running
          state={state}
          onCancel={cancel}
          modelLoading={
            settings.ner && !xlsx && settings.nerStatus === "loading" ? { progress: settings.nerProgress } : null
          }
        />
        <Timer state={state} />
        {state.error && <Banner tone="error" title={state.error} />}
      </Step>

      <Step n={4} title="Résultat">
        {result ? <Outcome result={result} /> : <p className="text-slate-600">Le résultat s'affichera ici.</p>}
      </Step>
    </>
  );
}

function Outcome({ result }: { result: AnonymizeResult }) {
  const { archive, document, mapping, report } = result;
  return (
    <div className="space-y-6">
      <WarningsBanner warnings={result.warnings} when="avant d'envoyer le document" />
      <Banner
        tone="success"
        title={`Document anonymisé : ${pl(result.summary.rows.length, "entité distincte remplacée", "entités distinctes remplacées")}.`}
      >
        L'archive <span className="font-mono break-all">{archive.name}</span> a été téléchargée. Elle contient trois
        fichiers :
      </Banner>
      <ul className="space-y-3">
        <FileRole name={document.name} role="À envoyer" tone="send">
          Le document anonymisé : c'est le <strong>seul</strong> fichier à transmettre à l'outil externe. Avant l'envoi,
          vous pouvez le contrôler dans l'onglet « Vérifier » (facultatif).
        </FileRole>
        <FileRole name={mapping.name} role="À garder, ne jamais transmettre" tone="keep">
          Le fichier de correspondances (mapping) : il sera indispensable pour restaurer le document dans l'onglet «
          Restaurer ». Il contient les données d'origine en clair : ne l'envoyez jamais, ni avec le document ni à
          l'outil externe. Gardez-le sur votre poste le temps nécessaire, puis supprimez-le.
        </FileRole>
        <FileRole name={report.name} role="Pour information" tone="info">
          Le rapport de détection : la liste de ce qui a été remplacé, sans les données d'origine.
        </FileRole>
      </ul>
      <section aria-labelledby="telecharger-a-nouveau" className="space-y-3">
        <h3 id="telecharger-a-nouveau" className="font-semibold">
          Télécharger à nouveau
        </h3>
        <p className="text-sm text-slate-600">
          Si le téléchargement n'a pas démarré (certains navigateurs le bloquent), ou pour récupérer un seul fichier :
        </p>
        <Downloads
          items={[
            { label: "Archive (.zip)", file: archive, primary: true },
            { label: "Document anonymisé", file: document },
            {
              label: "Mapping (JSON)",
              file: mapping,
              note: "Contient les données en clair : ne jamais le transmettre avec le document.",
            },
            { label: "Rapport (Markdown)", file: report },
          ]}
        />
      </section>
      <AnonymizeReportView r={result.summary} />
    </div>
  );
}

const ROLE_STYLES = {
  send: { box: "border-green-600 bg-green-50", badge: "bg-green-700 text-white", icon: "➜" },
  keep: { box: "border-red-600 bg-red-50", badge: "bg-red-700 text-white", icon: "🔒" },
  info: { box: "border-slate-300 bg-slate-50", badge: "bg-slate-600 text-white", icon: "ℹ" },
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
  children: ReactNode;
}) {
  const s = ROLE_STYLES[tone];
  return (
    <li className={`space-y-1 rounded-lg border-l-4 p-3 ${s.box}`}>
      <p className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${s.badge}`}>
          <span aria-hidden="true">{s.icon} </span>
          {role}
        </span>
        <span className="font-mono text-sm break-all">{name}</span>
      </p>
      <p className="text-sm text-slate-800">{children}</p>
    </li>
  );
}
