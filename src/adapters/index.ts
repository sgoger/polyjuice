// Registre des adaptateurs, par extension.
import type { Adapter, Format } from "../engine/types.ts";
import { docxAdapter } from "./docx.ts";
import { ANONYMIZE_EXTENSIONS, extensionOf } from "./formats.ts";
import { pdfAdapter } from "./pdf.ts";
import { pptxAdapter } from "./pptx.ts";
import { xlsxAdapter } from "./xlsx.ts";
import { mdAdapter, txtAdapter } from "./text.ts";

export { extensionOf } from "./formats.ts";

/**
 * Variante d'un format OOXML (avec macros) : même structure, même adaptateur ; le document produit
 * garde l'extension d'origine, qui doit correspondre au type de contenu déclaré dans le paquet.
 */
const keepExtension = (adapter: Adapter, ext: string): Adapter => ({
  extensions: [ext],
  read: async (file, options) => ({ ...(await adapter.read(file, options)), outputExtension: ext }),
  write: (doc) => adapter.write(doc),
});

const ADAPTERS: Record<(typeof ANONYMIZE_EXTENSIONS)[number], { format: Format; adapter: Adapter }> = {
  docx: { format: "docx", adapter: docxAdapter },
  docm: { format: "docm", adapter: keepExtension(docxAdapter, "docm") },
  pptx: { format: "pptx", adapter: pptxAdapter },
  pptm: { format: "pptm", adapter: keepExtension(pptxAdapter, "pptm") },
  xlsx: { format: "xlsx", adapter: xlsxAdapter },
  xlsm: { format: "xlsm", adapter: keepExtension(xlsxAdapter, "xlsm") },
  pdf: { format: "pdf", adapter: pdfAdapter },
  txt: { format: "txt", adapter: txtAdapter },
  md: { format: "md", adapter: mdAdapter },
};

export function adapterFor(fileName: string): { format: Format; adapter: Adapter } | null {
  const ext = extensionOf(fileName);
  return Object.hasOwn(ADAPTERS, ext) ? ADAPTERS[ext as keyof typeof ADAPTERS] : null;
}
