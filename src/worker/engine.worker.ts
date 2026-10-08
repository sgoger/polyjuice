/// <reference lib="webworker" />
// Point d'entrée du Web Worker du moteur.
import { createDispatcher } from "./handler.ts";
import type { ToWorker } from "./protocol.ts";

declare const self: DedicatedWorkerGlobalScope;

const dispatch = createDispatcher((msg, transfer) => {
  self.postMessage(msg, transfer ?? []);
});

self.onmessage = (e: MessageEvent<ToWorker>) => {
  void dispatch(e.data);
};
