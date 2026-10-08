// Fichiers d'exécution ONNX (WASM) servis par l'application elle-même : sans cela, transformers.js
// les télécharge depuis cdn.jsdelivr.net. Module importé uniquement dans le navigateur.
// onnxruntime-web est une dépendance de @huggingface/transformers (version figée par celle-ci).
import asyncifyMjs from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import asyncifyWasm from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import plainMjs from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import plainWasm from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";

/** Même choix que transformers.js : build « asyncify », sauf Safari < 26 sans WebGPU. */
export function wasmPaths(webgpu: boolean): { mjs: string; wasm: string } {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const safari = /Version\/(\d+)[\d.]* .*Safari/.exec(ua);
  const oldSafari = !!safari && Number(safari[1]) < 26 && !/Chrome|Chromium|Android/.test(ua);
  return oldSafari && !webgpu ? { mjs: plainMjs, wasm: plainWasm } : { mjs: asyncifyMjs, wasm: asyncifyWasm };
}
