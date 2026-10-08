// Analyse et sérialisation XML des parties OOXML.
//
// DOMParser n'existe pas dans un Web Worker : on utilise @xmldom/xmldom partout (Worker et tests Node),
// ce qui garantit aussi un comportement identique dans tous les navigateurs (le spike 0.3 a montré que
// le XMLSerializer de Chromium réordonne les déclarations d'espaces de noms).
import { DOMParser, XMLSerializer, type Document, type Element, type Node } from "@xmldom/xmldom";

export type { Document, Element, Node };

export const NS = {
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  s: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
  xml: "http://www.w3.org/XML/1998/namespace",
  cp: "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
  dc: "http://purl.org/dc/elements/1.1/",
  dcterms: "http://purl.org/dc/terms/",
  ep: "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties",
} as const;

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;

const DECL = /^\uFEFF?<\?xml[^?]*\?>[ \t\r\n]*/;

export interface ParsedPart {
  doc: Document;
  /** Déclaration XML d'origine, avec les blancs qui la suivent. */
  declaration: string;
}

export function parseXml(xml: string): ParsedPart {
  const errors: string[] = [];
  let doc: Document;
  try {
    doc = new DOMParser({
      onError: (level, msg) => {
        if (level !== "warning") errors.push(msg);
      },
    }).parseFromString(xml, "text/xml");
  } catch (e) {
    throw new Error(`XML invalide : ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
  if (errors.length > 0 || !doc.documentElement) throw new Error(`XML invalide : ${errors[0] ?? "document vide"}`);
  return { doc, declaration: DECL.exec(xml)?.[0] ?? "" };
}

/** Sérialise en conservant la déclaration XML d'origine telle quelle. */
export function serializeXml(part: ParsedPart): string {
  const body = new XMLSerializer().serializeToString(part.doc).replace(DECL, "");
  return part.declaration + body;
}

export function isElement(n: Node | null | undefined): n is Element {
  return !!n && n.nodeType === ELEMENT_NODE;
}

export function childElements(el: Element | Node): Element[] {
  const out: Element[] = [];
  for (let c = el.firstChild; c; c = c.nextSibling) if (isElement(c)) out.push(c);
  return out;
}

export function elementsNS(root: Document | Element, ns: string, local: string): Element[] {
  return Array.from(root.getElementsByTagNameNS(ns, local));
}

/** Plus proche ancêtre (strict) correspondant, ou null. */
export function ancestor(el: Node, ns: string, locals: readonly string[], stopAt?: Node): Element | null {
  for (let p = el.parentNode; p && p !== stopAt; p = p.parentNode) {
    if (isElement(p) && p.namespaceURI === ns && locals.includes(p.localName ?? "")) return p;
  }
  return null;
}

export function setText(el: Element, text: string): void {
  while (el.firstChild) el.removeChild(el.firstChild);
  if (text && el.ownerDocument) el.appendChild(el.ownerDocument.createTextNode(text));
}
