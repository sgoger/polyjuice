// Algorithme commun de fusion des runs (w:r/w:t en WordprocessingML, a:r/a:t en DrawingML).
//
// Un paragraphe est vu comme la concaténation de ses éléments texte, dans l'ordre du document ;
// les tabulations et sauts de ligne comptent pour un caractère (« \t », « \n ») mais ne sont jamais
// modifiés. Pour chaque remplacement, le texte de remplacement est écrit dans le premier élément
// texte touché (son run garde sa mise en forme) ; la partie remplacée est retirée des éléments
// suivants, vidés s'ils sont entièrement couverts. Les autres runs ne sont pas modifiés.
import type { Edit } from "../../engine/types.ts";
import { ELEMENT_NODE, NS, setText, TEXT_NODE, type Element, type Node } from "./xml.ts";

export interface RunModel {
  ns: string;
  /** Élément paragraphe (non traversé quand il est imbriqué : zones de texte). */
  paragraph: string;
  /** Éléments porteurs de texte. */
  text: readonly string[];
  /** Éléments comptés comme « \t ». */
  tab: readonly string[];
  /** Éléments comptés comme « \n ». */
  br: readonly string[];
  /** Conteneurs ignorés (texte supprimé, champs non traités…). */
  skip: readonly string[];
  /** Poser xml:space="preserve" sur les éléments texte écrits. */
  preserveSpace: boolean;
}

export const WORD: RunModel = {
  ns: NS.w,
  paragraph: "p",
  text: ["t"],
  tab: ["tab", "ptab"],
  br: ["br", "cr"],
  skip: ["del", "moveFrom", "rPr", "pPr", "instrText", "delText"],
  preserveSpace: true,
};

export const DRAWING: RunModel = {
  ns: NS.a,
  paragraph: "p",
  text: ["t"],
  tab: [],
  br: ["br"],
  skip: ["fld", "rPr", "pPr", "endParaRPr"],
  preserveSpace: false,
};

/** Texte riche des chaînes partagées XLSX (si/r/t). */
export const SHEET: RunModel = {
  ns: NS.s,
  paragraph: "si",
  text: ["t"],
  tab: [],
  br: [],
  skip: ["rPh", "phoneticPr", "rPr"],
  preserveSpace: true,
};

export interface Piece {
  kind: "text" | "tab" | "br";
  node: Element;
  start: number;
  end: number;
}

export interface Collected {
  text: string;
  pieces: Piece[];
}

function textOf(el: Element): string {
  let s = "";
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === TEXT_NODE || c.nodeType === 4 /* CDATA */) s += c.nodeValue ?? "";
  }
  return s;
}

/** Concatène le texte d'un paragraphe et repère chaque élément texte / tabulation / saut de ligne. */
export function collect(paragraph: Element, model: RunModel): Collected {
  const pieces: Piece[] = [];
  let text = "";
  const walk = (node: Node) => {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== ELEMENT_NODE) continue;
      const el = c as Element;
      const local = el.localName ?? "";
      if (el.namespaceURI === model.ns) {
        if (local === model.paragraph || model.skip.includes(local)) continue;
        if (model.text.includes(local)) {
          const t = textOf(el);
          pieces.push({ kind: "text", node: el, start: text.length, end: text.length + t.length });
          text += t;
          continue;
        }
        if (model.tab.includes(local) || model.br.includes(local)) {
          const kind = model.tab.includes(local) ? "tab" : "br";
          pieces.push({ kind, node: el, start: text.length, end: text.length + 1 });
          text += kind === "tab" ? "\t" : "\n";
          continue;
        }
      }
      walk(el);
    }
  };
  walk(paragraph);
  return { text, pieces };
}

/**
 * Applique des édits (coordonnées du texte collecté, sans chevauchement) au paragraphe.
 * Renvoie le texte résultant, pour contrôle.
 */
export function applyEdits(collected: Collected, edits: readonly Edit[], model: RunModel): string {
  const texts = collected.pieces.filter((p) => p.kind === "text");
  const current = new Map(texts.map((p) => [p, textOf(p.node)]));
  const touched = new Set<Piece>();
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    const overlapping = texts.filter((p) => p.start < e.end && e.start < p.end);
    const first = texts.find((p) => p.start <= e.start && e.start < p.end) ?? overlapping[0];
    if (!first) throw new Error(`remplacement hors du texte du paragraphe (${e.start}-${e.end})`);
    const firstText = current.get(first) ?? "";
    const head = firstText.slice(0, Math.max(0, e.start - first.start));
    const tail = e.end < first.end ? firstText.slice(e.end - first.start) : "";
    current.set(first, head + e.replacement + tail);
    touched.add(first);
    for (const p of overlapping) {
      if (p === first) continue;
      const t = current.get(p) ?? "";
      current.set(p, e.end < p.end ? t.slice(e.end - p.start) : "");
      touched.add(p);
    }
  }
  for (const p of touched) {
    setText(p.node, current.get(p) ?? "");
    if (model.preserveSpace) p.node.setAttributeNS(NS.xml, "xml:space", "preserve");
  }
  return collected.pieces
    .map((p) => (p.kind === "text" ? (current.get(p) ?? "") : p.kind === "tab" ? "\t" : "\n"))
    .join("");
}
