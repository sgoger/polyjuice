import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Progress } from "../engine/types.ts";
import { EngineError } from "../worker/protocol.ts";
import { AnonymizeTab } from "./AnonymizeTab.tsx";
import { CheckTab } from "./CheckTab.tsx";
import { Tabs } from "./components/tabs.tsx";
import { RestoreTab } from "./RestoreTab.tsx";
import { glossaryStore } from "./glossary.ts";
import { GlossaryContext, type GlossaryPersistence, type SharedSettings } from "./settings.ts";
import { engine } from "./useEngine.ts";
import { LanguageSwitch } from "./components/LanguageSwitch.tsx";
import { LocaleContext, uiMessagesFor } from "./messages/index.ts";
import type { UiMessages } from "./messages/fr.tsx";
import { getLocale, setLocale, type Locale } from "../i18n/index.ts";

export function App() {
  const [tab, setTab] = useState("anonymize");
  // Langue détectée au démarrage (main.tsx), modifiable par le sélecteur en haut à droite. La valeur
  // du module i18n suit l'état : elle sert aux messages hors React et est transmise au Worker.
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  const changeLocale = useCallback((l: Locale) => {
    setLocale(l);
    setLocaleState(l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const m = uiMessagesFor(locale);
  // Glossaire de noms : restauré au chargement seulement si l'utilisateur a demandé à le mémoriser.
  const [store] = useState(() => glossaryStore());
  const [saved] = useState(() => store.load());
  const [names, setNamesState] = useState(saved ?? "");
  const [remember, setRememberState] = useState(saved !== null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Détection par IA cochée par défaut ; le modèle n'est téléchargé qu'au dépôt d'un document
  // qui en a besoin (ensureNer, appelé par les onglets), jamais au chargement de la page.
  const [ner, setNerChecked] = useState(true);
  const [nerStatus, setNerStatus] = useState<SharedSettings["nerStatus"]>("idle");
  const [nerProgress, setNerProgress] = useState<Progress | null>(null);
  const [nerError, setNerError] = useState<string | null>(null);
  const [nerDevice, setNerDevice] = useState<{ device: string; threads: number } | null>(null);
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
        setNerDevice({ device, threads });
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

  // Case cochée : la copie enregistrée suit le champ à chaque modification (un glossaire vide n'est
  // pas gardé). Case décochée : rien n'est écrit, la copie éventuelle est supprimée.
  const persist = useCallback(
    (value: string, on: boolean) => {
      if (on && value.trim()) {
        setSaveFailed(!store.save(value));
      } else {
        store.clear();
        setSaveFailed(false);
      }
    },
    [store],
  );

  const setNames = useCallback(
    (value: string) => {
      setNamesState(value);
      persist(value, remember);
    },
    [persist, remember],
  );

  const glossary = useMemo<GlossaryPersistence>(
    () => ({
      available: store.available,
      remember,
      setRemember: (on) => {
        setRememberState(on);
        persist(names, on);
      },
      saveFailed,
      clear: () => {
        setNamesState("");
        persist("", false);
      },
    }),
    [store, remember, saveFailed, names, persist],
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
    nerBackend: nerDevice && backendLabel(nerDevice.device, nerDevice.threads, m.backend),
  };

  return (
    <LocaleContext value={locale}>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-start justify-between gap-4 px-6 py-4">
            <div>
              <h1 className="text-2xl font-semibold">polyjuice</h1>
              <p className="text-slate-600">{m.tagline}</p>
            </div>
            <LanguageSwitch value={locale} onChange={changeLocale} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
          <GlossaryContext value={glossary}>
            <Tabs
              active={tab}
              onChange={setTab}
              tabs={[
                { id: "anonymize", label: m.tabs.anonymize, content: <AnonymizeTab settings={settings} /> },
                { id: "restore", label: m.tabs.restore, content: <RestoreTab /> },
                {
                  id: "check",
                  label: m.tabs.check,
                  content: <CheckTab settings={settings} />,
                  secondary: true,
                },
              ]}
            />
          </GlossaryContext>
        </main>
        <footer className="sm:sticky bottom-0 border-t border-slate-300 bg-slate-800 text-white">
          <p className="mx-auto max-w-5xl px-6 py-3 text-sm">{m.footer}</p>
        </footer>
      </div>
    </LocaleContext>
  );
}

function backendLabel(device: string, threads: number, labels: UiMessages["backend"]): string {
  if (device === "webgpu") return labels.webgpu;
  if (device === "wasm") return labels.wasm(threads);
  return device;
}
