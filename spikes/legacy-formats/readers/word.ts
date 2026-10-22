// Extraction du texte d'un document Word 97-2003 (.doc, .dot, [MS-DOC]), en lecture seule.
// Le texte est reconstitué par la table des pièces (Clx), qui couvre aussi les documents enregistrés
// rapidement ; le texte supprimé en mode révision est écarté (propriété de caractère fRMarkDel).
// Les instructions de champ sont retirées (seul le résultat affiché est gardé), les images et objets
// ne sont pas extraits.
import { Cfb } from "./cfb.ts";

const cp1252 = new TextDecoder("windows-1252");
const utf16 = new TextDecoder("utf-16le");

/** Parties du texte, dans l'ordre du flux (FibRgLw97 : ccpText, ccpFtn, ccpHdd, ccpMcr, ccpAtn, ccpEdn, ccpTxbx, ccpHdrTxbx). */
const STORIES = [
  "body",
  "footnotes",
  "headers",
  "macros",
  "comments",
  "endnotes",
  "textboxes",
  "headerTextboxes",
] as const;
export type WordStory = (typeof STORIES)[number];

export interface WordText {
  stories: { story: WordStory; text: string }[];
  /** Caractères supprimés en mode révision, écartés. */
  deleted: number;
  /** Images ou objets dessinés présents dans le texte. */
  pictures: boolean;
  objects: boolean;
  macros: boolean;
}

/** Plages d'octets (dans le flux WordDocument) dont le texte est marqué supprimé en mode révision. */
function deletedRanges(wd: Uint8Array, table: Uint8Array, fc: number, lcb: number): [number, number][] {
  const out: [number, number][] = [];
  if (lcb < 12 || fc + lcb > table.length) return out;
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const n = (lcb - 4) / 8;
  for (let i = 0; i < n; i++) {
    const pn = tv.getUint32(fc + (n + 1) * 4 + i * 4, true) & 0x3fffff;
    const page = pn * 512;
    if (page + 512 > wd.length) continue;
    const pv = new DataView(wd.buffer, wd.byteOffset + page, 512);
    const crun = wd[page + 511] ?? 0;
    for (let k = 0; k < crun && 4 * (crun + 1) + k < 511; k++) {
      const off = (wd[page + 4 * (crun + 1) + k] ?? 0) * 2;
      if (off === 0) continue;
      const cb = wd[page + off] ?? 0;
      if (deletedSprm(wd.subarray(page + off + 1, page + off + 1 + cb)))
        out.push([pv.getUint32(k * 4, true), pv.getUint32((k + 1) * 4, true)]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** Taille de l'opérande d'un sprm selon son champ spra (3 bits de poids fort). */
const OPERAND = [1, 1, 2, 4, 2, 2, -1, 3];

/** La liste de propriétés de caractère contient-elle sprmCFRMarkDel (0x0800) à vrai ? */
function deletedSprm(grpprl: Uint8Array): boolean {
  for (let p = 0; p + 2 <= grpprl.length;) {
    const sprm = (grpprl[p] ?? 0) | ((grpprl[p + 1] ?? 0) << 8);
    p += 2;
    const size = OPERAND[sprm >> 13] ?? 1;
    if (sprm === 0x0800 && (grpprl[p] ?? 0) === 1) return true;
    p += size >= 0 ? size : 1 + (grpprl[p] ?? 0);
  }
  return false;
}

/** Texte affichable d'une partie : champs (instruction retirée, résultat gardé), marques spéciales. */
export function cleanWordText(raw: string): string {
  let out = "";
  // Pile des champs ouverts : true tant qu'on est dans l'instruction (avant le séparateur 0x14).
  const fields: boolean[] = [];
  let previous = 0;
  for (const ch of raw) {
    const c = ch.charCodeAt(0);
    const before = previous;
    previous = c;
    if (c === 0x13) fields.push(true);
    else if (c === 0x14) {
      if (fields.length) fields[fields.length - 1] = false;
    } else if (c === 0x15) fields.pop();
    else if (fields.includes(true)) continue;
    else if (c === 0x07) {
      // Fin de cellule (tabulation) ; deux marques de suite : fin de ligne de tableau.
      if (before === 0x07) out = out.replace(/\t$/, "") + "\n";
      else out += "\t";
    } else if (c === 0x0d || c === 0x0b || c === 0x0e) out += "\n";
    else if (c === 0x0c) out += "\n\n";
    else if (c === 0x1e) out += "-";
    else if (c === 0xa0) out += " ";
    else if (c === 0x09 || c >= 0x20) out += ch;
    // Autres caractères de contrôle ignorés : 0x01 image, 0x02 appel de note, 0x05 appel de
    // commentaire, 0x08 objet dessiné, 0x1f trait d'union conditionnel…
  }
  return out;
}

export function readWord(file: ArrayBuffer | Uint8Array): WordText {
  const cfb = Cfb.open(file);
  const wd = cfb.stream("WordDocument");
  if (!wd) throw new Error("flux « WordDocument » absent : ce n'est pas un document Word");
  if (wd.length < 0x1aa) throw new Error("document Word tronqué");
  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (dv.getUint16(0, true) !== 0xa5ec) throw new Error("signature Word absente");
  if (dv.getUint16(2, true) < 0x00c1)
    throw new Error("document Word 6.0/95 : format trop ancien, seul Word 97-2003 est lu");
  const flags = dv.getUint16(0x0a, true);
  if (flags & 0x0100)
    throw new Error("document protégé par mot de passe : ouvrez-le dans Word et retirez la protection");
  const table = cfb.stream(flags & 0x0200 ? "1Table" : "0Table");
  if (!table) throw new Error("flux de table absent");
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const fcLcb = (i: number): [number, number] => [dv.getUint32(154 + i * 8, true), dv.getUint32(158 + i * 8, true)];

  // Table des pièces : Clx = Prc* puis Pcdt (0x02, taille, PlcPcd).
  const [fcClx, lcbClx] = fcLcb(33);
  let p = fcClx;
  while (p < fcClx + lcbClx && table[p] === 0x01) p += 3 + tv.getUint16(p + 1, true);
  if (table[p] !== 0x02 || p + 5 > table.length) throw new Error("table des pièces absente");
  const lcb = tv.getUint32(p + 1, true);
  const plc = p + 5;
  const n = (lcb - 4) / 12;
  if (!Number.isInteger(n) || plc + lcb > table.length) throw new Error("table des pièces invalide");

  const [fcChpx, lcbChpx] = fcLcb(12);
  const deletedRuns = deletedRanges(wd, table, fcChpx, lcbChpx);
  const isDeleted = (pos: number) => {
    let lo = 0;
    let hi = deletedRuns.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [a, b] = deletedRuns[mid] ?? [0, 0];
      if (pos < a) hi = mid - 1;
      else if (pos >= b) lo = mid + 1;
      else return true;
    }
    return false;
  };

  // Texte complet, en positions de caractère (CP) ; les caractères supprimés deviennent \u0000.
  let text = "";
  let deleted = 0;
  for (let i = 0; i < n; i++) {
    const cpStart = tv.getUint32(plc + i * 4, true);
    const cpEnd = tv.getUint32(plc + (i + 1) * 4, true);
    const fc = tv.getUint32(plc + (n + 1) * 4 + i * 8 + 2, true);
    const len = Math.max(0, cpEnd - cpStart);
    const compressed = (fc & 0x40000000) !== 0;
    const start = compressed ? (fc & 0x3fffffff) / 2 : fc;
    const width = compressed ? 1 : 2;
    const bytes = wd.subarray(start, start + len * width);
    let piece = compressed ? cp1252.decode(bytes) : utf16.decode(bytes);
    if (deletedRuns.length) {
      piece = Array.from({ length: piece.length }, (_, k) => {
        if (!isDeleted(start + k * width)) return piece[k];
        deleted++;
        return "\u0000";
      }).join("");
    }
    text += piece;
  }

  const stories: WordText["stories"] = [];
  let cp = 0;
  STORIES.forEach((story, i) => {
    const len = Math.max(0, dv.getInt32(76 + i * 4, true));
    if (len > 0 && story !== "macros")
      stories.push({ story, text: cleanWordText(text.slice(cp, cp + len).replaceAll("\u0000", "")) });
    cp += len;
  });
  return {
    stories,
    deleted,
    // 0x01 : image en ligne ; 0x08 : objet dessiné (image flottante, forme, zone de texte).
    pictures: text.includes("\u0001") || text.includes("\u0008"),
    objects: cfb.has("ObjectPool") && cfb.entries.some((e) => e.path.startsWith("ObjectPool/")),
    macros: cfb.has("Macros"),
  };
}
