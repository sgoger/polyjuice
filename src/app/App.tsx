import { useCallback, useEffect, useRef, useState } from "react";
import type { Progress } from "../engine/types.ts";
import { EngineError } from "../worker/protocol.ts";
import { AnonymizeTab } from "./AnonymizeTab.tsx";
import { CheckTab } from "./CheckTab.tsx";
import { Tabs } from "./components/tabs.tsx";
import { RestoreTab } from "./RestoreTab.tsx";
import type { SharedSettings } from "./settings.ts";
import { engine } from "./useEngine.ts";

export function App() {
  const [tab, setTab] = useState("anonymize");
  const [names, setNames] = useState("");
  // Détection par IA cochée par défaut ; le modèle n'est téléchargé qu'au dépôt d'un document
  // qui en a besoin (ensureNer, appelé par les onglets), jamais au chargement de la page.
  const [ner, setNerChecked] = useState(true);
  const [nerStatus, setNerStatus] = useState<SharedSettings["nerStatus"]>("idle");
  const [nerProgress, setNerProgress] = useState<Progress | null>(null);
  const [nerError, setNerError] = useState<string | null>(null);
  const [nerBackend, setNerBackend] = useState<string | null>(null);
  // Évite deux chargements si deux appels précèdent la mise à jour de nerStatus.
  const nerLoading = useRef(false);

  const ensureNer = useCallback(() => {
    if (!ner || nerLoading.current || nerStatus === "ready") return;
    nerLoading.current = true;
    setNerStatus("loading");
    setNerError(null);
    setNerProgress(null);
    engine()
      .call("loadNer", {}, { onNerProgress: setNerProgress })
      .promise.then(({ device, threads }) => {
        setNerBackend(backendLabel(device, threads));
        setNerStatus("ready");
      })
      .catch((e: unknown) => {
        // Échec (hors ligne…) ou annulation : la case est décochée, la détection par motifs et
        // par liste reste disponible.
        setNerChecked(false);
        if (e instanceof EngineError && e.code === "Cancelled") {
          setNerStatus("idle");
          return;
        }
        setNerStatus("error");
        setNerError(e instanceof EngineError ? e.message : String(e));
      })
      .finally(() => {
        nerLoading.current = false;
      });
  }, [ner, nerStatus]);

  // Décocher la case pendant le chargement l'annule.
  const setNer = useCallback((checked: boolean) => {
    setNerChecked(checked);
    if (!checked && nerLoading.current) engine().cancel();
  }, []);

  // Annuler un traitement termine le Worker : le modèle devra être rechargé (à la demande).
  useEffect(
    () =>
      engine().onReset(() => {
        setNerStatus((s) => (s === "ready" ? "idle" : s));
      }),
    [],
  );

  const cancelNer = useCallback(() => {
    engine().cancel();
  }, []);

  const settings: SharedSettings = {
    names,
    setNames,
    ner,
    setNer,
    ensureNer,
    cancelNer,
    nerStatus,
    nerProgress,
    nerError,
    nerBackend,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-2xl font-semibold">polyjuice</h1>
          <p className="text-slate-600">
            Pseudonymiser un document avant de l'envoyer à un outil externe, puis restaurer les données d'origine.
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "anonymize", label: "Anonymiser", content: <AnonymizeTab settings={settings} /> },
            { id: "restore", label: "Restaurer", content: <RestoreTab /> },
            {
              id: "check",
              label: "Vérifier (facultatif)",
              content: <CheckTab settings={settings} />,
              secondary: true,
            },
          ]}
        />
      </main>
      <footer className="sm:sticky bottom-0 border-t border-slate-300 bg-slate-800 text-white">
        <p className="mx-auto max-w-5xl px-6 py-3 text-sm">
          🔒 Aucune donnée ne quitte votre navigateur. Cet outil pseudonymise ; les documents produits restent des
          données personnelles au sens du RGPD.
        </p>
      </footer>
    </div>
  );
}

function backendLabel(device: string, threads: number): string {
  if (device === "webgpu") return "WebGPU (carte graphique)";
  if (device === "wasm") return `WASM, ${threads} ${threads > 1 ? "cœurs" : "cœur"}`;
  return device;
}
