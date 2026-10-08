// Registre des adaptateurs, par extension.
import type { Adapter, Format } from "../engine/types.ts";
import { docxAdapter } from "./docx.ts";
import { pdfAdapter } from "./pdf.ts";
import { pptxAdapter } from "./pptx.ts";
import { xlsxAdapter } from "./xlsx.ts";
import { mdAdapter, txtAdapter } from "./text.ts";

const ADAPTERS: Partial<Record<Format, Adapter>> = {
  docx: docxAdapter,
  pptx: pptxAdapter,
  xlsx: xlsxAdapter,
  pdf: pdfAdapter,
  txt: txtAdapter,
  md: mdAdapter,
};

export const SUPPORTED_EXTENSIONS = ["docx", "pptx", "xlsx", "pdf", "md", "txt"] as const;

export function extensionOf(fileName: string): string {
  const m = /\.([^./\\]+)$/.exec(fileName);
  return m?.[1]?.toLowerCase() ?? "";
}

export function isFormat(ext: string): ext is Format {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function adapterFor(fileName: string): { format: Format; adapter: Adapter } | null {
  const ext = extensionOf(fileName);
  if (!isFormat(ext)) return null;
  const adapter = ADAPTERS[ext];
  return adapter ? { format: ext, adapter } : null;
}
