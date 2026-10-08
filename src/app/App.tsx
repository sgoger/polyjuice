import { useCallback, useState } from "react";
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
  const [ner, setNerChecked] = useState(false);
  const [nerStatus, setNerStatus] = useState<SharedSettings["nerStatus"]>("idle");
  const [nerProgress, setNerProgress] = useState<Progress | null>(null);
  const [nerError, setNerError] = useState<string | null>(null);

  // Le modèle n'est téléchargé que lorsque la case est cochée.
  const setNer = useCallback(
    (checked: boolean) => {
      setNerChecked(checked);
      if (!checked || nerStatus === "loading" || nerStatus === "ready") return;
      setNerStatus("loading");
      setNerError(null);
      engine()
        .call("loadNer", {}, { onNerProgress: setNerProgress })
        .promise.then(() => {
          setNerStatus("ready");
        })
        .catch((e: unknown) => {
          setNerStatus("error");
          setNerError(e instanceof EngineError ? e.message : String(e));
        });
    },
    [nerStatus],
  );

  const settings: SharedSettings = { names, setNames, ner, setNer, nerStatus, nerProgress, nerError };

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
            { id: "check", label: "Vérifier", content: <CheckTab settings={settings} /> },
            { id: "restore", label: "Restaurer", content: <RestoreTab /> },
          ]}
        />
      </main>
      <footer className="sticky bottom-0 border-t border-slate-300 bg-slate-800 text-white">
        <p className="mx-auto max-w-5xl px-6 py-3 text-sm">
          🔒 Aucune donnée ne quitte votre navigateur. Cet outil pseudonymise ; les documents produits restent des
          données personnelles au sens du RGPD.
        </p>
      </footer>
    </div>
  );
}
