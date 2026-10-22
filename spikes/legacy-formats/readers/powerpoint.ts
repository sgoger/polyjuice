// Extraction du texte d'une présentation PowerPoint 97-2003 (.ppt, .pps, [MS-PPT]), en lecture seule.
// Le flux contient toutes les versions enregistrées rapidement : on suit la structure vivante
// (Current User → dernière UserEditAtom → répertoire des objets persistants → Document), puis les
// diapositives dans l'ordre de la présentation, chacune suivie de ses commentaires de l'orateur.
// Les masques, les dispositions et les anciennes versions ne sont pas lus.
import { Cfb } from "./cfb.ts";

const latin1 = new TextDecoder("latin1");
const utf16 = new TextDecoder("utf-16le");

const T = {
  DOCUMENT: 0x03e8,
  SLIDE_ATOM: 0x03ef,
  SLIDE_PERSIST_ATOM: 0x03f3,
  VBA_INFO: 0x03ff,
  EX_OLE_OBJ_STG: 0x1011,
  TEXT_CHARS_ATOM: 0x0fa0,
  TEXT_BYTES_ATOM: 0x0fa8,
  SLIDE_LIST_WITH_TEXT: 0x0ff0,
  USER_EDIT_ATOM: 0x0ff5,
  PERSIST_DIRECTORY_ATOM: 0x1772,
  COMMENT10: 0x2ee0,
} as const;

export interface PowerPointText {
  /** Blocs de texte de chaque diapositive (commentaires de l'orateur compris), dans l'ordre. */
  slides: string[][];
  pictures: boolean;
  objects: boolean;
  macros: boolean;
  comments: boolean;
}

interface Rec {
  inst: number;
  type: number;
  body: number;
  end: number;
  container: boolean;
}

const unreadable = (what: string) => new Error(`structure de présentation illisible (${what})`);

export function readPowerPoint(file: ArrayBuffer | Uint8Array): PowerPointText {
  const cfb = Cfb.open(file);
  const s = cfb.stream("PowerPoint Document");
  const cu = cfb.stream("Current User");
  if (!s || !cu) throw new Error("flux « PowerPoint Document » absent : ce n'est pas une présentation PowerPoint");
  if (cu.length < 20) throw unreadable("Current User");
  const dv = new DataView(s.buffer, s.byteOffset, s.byteLength);
  const cdv = new DataView(cu.buffer, cu.byteOffset, cu.byteLength);
  if (cdv.getUint32(12, true) === 0xf3d1c4df || cfb.has("EncryptedSummary"))
    throw new Error("présentation protégée par mot de passe : ouvrez-la dans PowerPoint et retirez la protection");

  const rec = (p: number): Rec | null => {
    if (p + 8 > s.length) return null;
    const verInst = dv.getUint16(p, true);
    return {
      inst: verInst >> 4,
      type: dv.getUint16(p + 2, true),
      body: p + 8,
      end: Math.min(p + 8 + dv.getUint32(p + 4, true), s.length),
      container: (verInst & 0x0f) === 0x0f,
    };
  };
  const children = (r: Rec): Rec[] => {
    const out: Rec[] = [];
    for (let p = r.body; p + 8 <= r.end;) {
      const c = rec(p);
      if (!c) break;
      out.push(c);
      p = c.end;
    }
    return out;
  };
  const textOf = (r: Rec): string | null => {
    if (r.type === T.TEXT_CHARS_ATOM) return utf16.decode(s.subarray(r.body, r.end));
    if (r.type === T.TEXT_BYTES_ATOM) return latin1.decode(s.subarray(r.body, r.end));
    return null;
  };
  const found = { objects: false, comments: false };
  const texts = (r: Rec, out: string[] = []): string[] => {
    for (const c of children(r)) {
      if (c.type === T.COMMENT10) found.comments = true;
      else if (c.container) texts(c, out);
      else {
        const t = textOf(c);
        if (t !== null) out.push(t);
      }
    }
    return out;
  };

  // Répertoire des objets persistants, de l'édition la plus récente à la plus ancienne (la plus
  // récente l'emporte).
  const persist = new Map<number, number>();
  let docRef = -1;
  const visited = new Set<number>();
  for (let offset = cdv.getUint32(16, true); offset > 0 && !visited.has(offset);) {
    visited.add(offset);
    const ue = rec(offset);
    if (ue?.type !== T.USER_EDIT_ATOM || ue.body + 20 > ue.end) throw unreadable("UserEditAtom");
    if (docRef < 0) docRef = dv.getUint32(ue.body + 16, true);
    const pd = rec(dv.getUint32(ue.body + 12, true));
    if (pd?.type !== T.PERSIST_DIRECTORY_ATOM) throw unreadable("PersistDirectoryAtom");
    for (let p = pd.body; p + 4 <= pd.end;) {
      const v = dv.getUint32(p, true);
      const id = v & 0xfffff;
      const count = v >>> 20;
      p += 4;
      for (let i = 0; i < count && p + 4 <= pd.end; i++, p += 4)
        if (!persist.has(id + i)) persist.set(id + i, dv.getUint32(p, true));
    }
    offset = dv.getUint32(ue.body + 8, true);
  }
  const at = (ref: number) => {
    const o = persist.get(ref);
    return o === undefined ? null : rec(o);
  };
  const doc = at(docRef);
  if (doc?.type !== T.DOCUMENT) throw unreadable("Document");

  // Listes du Document (instance 0 : diapositives, 2 : pages de commentaires). Chaque
  // SlidePersistAtom est suivi des textes de cette page stockés dans la liste (espaces réservés).
  interface Page {
    ref: number;
    id: number;
    texts: string[];
  }
  const lists = new Map<number, Page[]>();
  let macros = false;
  const scan = (r: Rec) => {
    for (const c of children(r)) {
      if (c.type === T.VBA_INFO) macros = true;
      if (c.type === T.EX_OLE_OBJ_STG) found.objects = true;
      if (c.container && c.type !== T.SLIDE_LIST_WITH_TEXT) scan(c);
    }
  };
  scan(doc);
  for (const c of children(doc)) {
    if (c.type !== T.SLIDE_LIST_WITH_TEXT) continue;
    const pages: Page[] = [];
    for (const a of children(c)) {
      if (a.type === T.SLIDE_PERSIST_ATOM && a.body + 16 <= a.end)
        pages.push({ ref: dv.getUint32(a.body, true), id: dv.getUint32(a.body + 12, true), texts: [] });
      else {
        const t = textOf(a);
        if (t !== null) pages.at(-1)?.texts.push(t);
      }
    }
    lists.set(c.inst, pages);
  }
  const notesById = new Map((lists.get(2) ?? []).map((n) => [n.id, n]));
  // Objets OLE incorporés : stockés hors du Document, repérés dans tout le flux vivant.
  for (const o of persist.values()) if (rec(o)?.type === T.EX_OLE_OBJ_STG) found.objects = true;

  const slides = (lists.get(0) ?? []).map((slide) => {
    const out = [...slide.texts];
    const container = at(slide.ref);
    if (container) {
      out.push(...texts(container));
      const atom = children(container).find((c) => c.type === T.SLIDE_ATOM);
      const notes = atom && atom.body + 20 <= atom.end ? notesById.get(dv.getUint32(atom.body + 16, true)) : undefined;
      if (notes) {
        out.push(...notes.texts);
        const nc = at(notes.ref);
        if (nc) out.push(...texts(nc));
      }
    }
    // « * » : champ (date, numéro de diapositive, pied de page) dont le texte vit dans le masque.
    return out.map((t) => t.replace(/\r|\v/g, "\n")).filter((t) => t.trim() !== "" && t !== "*");
  });
  const pictures = (cfb.stream("Pictures")?.length ?? 0) > 0;
  return { slides, pictures, objects: found.objects, macros, comments: found.comments };
}
