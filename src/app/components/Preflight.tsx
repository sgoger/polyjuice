import { useEffect, useState } from "react";
import type { Inspection } from "../../worker/protocol.ts";
import { preflightMessage } from "../preflight.ts";
import { engine } from "../useEngine.ts";
import { Banner } from "./Banner.tsx";

const OFFICE = /\.(docx|pptx|xlsx|docm|pptm|xlsm)$/i;

/**
 * Inspection au dépôt : avertit, sans bloquer, des commentaires, révisions et noms d'auteurs d'un
 * document Office. En cas d'erreur (fichier illisible), rien n'est affiché : le traitement la signalera.
 */
export function Preflight({ file }: { file: File | null }) {
  const [inspected, setInspected] = useState<{ file: File; inspection: Inspection | null } | null>(null);
  const office = !!file && OFFICE.test(file.name);

  useEffect(() => {
    if (!file || !office) return;
    const live = { current: true };
    void (async () => {
      let inspection: Inspection | null = null;
      try {
        inspection = await engine().call("inspect", { file: await file.arrayBuffer(), fileName: file.name }).promise;
      } catch {
        // Fichier illisible ou Worker réinitialisé : rien à afficher ici.
      }
      if (live.current) setInspected({ file, inspection });
    })();
    return () => {
      live.current = false;
    };
  }, [file, office]);

  if (!file || !office) return null;
  if (inspected?.file !== file) {
    return (
      <p className="text-sm text-slate-600" aria-live="polite" data-testid="preflight-pending">
        Recherche de commentaires et de révisions…
      </p>
    );
  }
  const message = preflightMessage(inspected.inspection);
  if (!message) return null;
  return (
    <div data-testid="preflight">
      <Banner tone="warning" title={message.title}>
        <div className="space-y-1">
          {message.details.map((d) => (
            <p key={d}>{d}</p>
          ))}
        </div>
      </Banner>
    </div>
  );
}
