import { useEffect, useState } from "react";
import type { RunState } from "../useEngine.ts";

/** « 42 s », « 3 min 05 s ». */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

/** Minuteur discret : temps écoulé pendant le traitement, puis durée totale une fois terminé. */
export function Timer({ state }: { state: RunState }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state.running) return;
    // Avant le premier tic, `now` peut précéder le début : l'affichage est ramené à 0 s.
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [state.running]);

  const ms = state.running && state.startedAt !== null ? now - state.startedAt : state.duration;
  if (ms === null) return null;
  return (
    <p className="text-right text-xs text-slate-500 tabular-nums" data-testid="timer">
      ⏱ {state.running ? "Temps écoulé" : "Durée du traitement"} : {formatDuration(Math.max(0, ms))}
    </p>
  );
}
