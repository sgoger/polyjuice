import type { OutputFile } from "../worker/protocol.ts";

/** Téléchargement local par Blob + lien `download` : rien n'est envoyé nulle part. */
export function saveFile(file: OutputFile): void {
  const url = URL.createObjectURL(new Blob([file.data], { type: file.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

export const readFile = (f: File): Promise<ArrayBuffer> => f.arrayBuffer();
