// Ouverture et réécriture d'un paquet OOXML (zip) sans perte : seules les parties explicitement
// modifiées sont recompressées ; toutes les autres gardent leurs octets compressés, leur méthode de
// compression et leur position (règles du spike 0.3, docs/DEVIATIONS.md).
import JSZip from "jszip";

interface CentralEntry {
  name: string;
  method: number;
}

/** Lecture minimale du répertoire central : nom et méthode de compression de chaque entrée. */
export function centralDirectory(buf: Uint8Array): CentralEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("archive zip invalide (répertoire central introuvable)");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: CentralEntry[] = [];
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    out.push({ name: dec.decode(buf.subarray(p + 46, p + 46 + nlen)), method });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

export class OoxmlPackage {
  private readonly modified = new Set<string>();

  private constructor(
    private readonly zip: JSZip,
    private readonly methods: Map<string, number>,
  ) {}

  static async open(file: ArrayBuffer): Promise<OoxmlPackage> {
    const bytes = new Uint8Array(file);
    const zip = await JSZip.loadAsync(bytes, { createFolders: false });
    const methods = new Map(centralDirectory(bytes).map((e) => [e.name, e.method]));
    return new OoxmlPackage(zip, methods);
  }

  /** Noms des parties (hors dossiers), dans l'ordre de l'archive. */
  names(): string[] {
    return Object.values(this.zip.files)
      .filter((f) => !f.dir)
      .map((f) => f.name);
  }

  has(name: string): boolean {
    const f = this.zip.files[name];
    return !!f && !f.dir;
  }

  async readText(name: string): Promise<string> {
    const f = this.zip.file(name);
    if (!f) throw new Error(`partie absente : ${name}`);
    return f.async("string");
  }

  async readBytes(name: string): Promise<Uint8Array> {
    const f = this.zip.file(name);
    if (!f) throw new Error(`partie absente : ${name}`);
    return f.async("uint8array");
  }

  /** Remplace le contenu d'une partie (même date, même position dans l'archive). */
  setText(name: string, content: string): void {
    const old = this.zip.files[name];
    this.zip.file(name, content, {
      createFolders: false,
      compression: "DEFLATE",
      ...(old ? { date: old.date } : {}),
    });
    this.modified.add(name);
  }

  remove(name: string): void {
    this.zip.remove(name);
    this.modified.delete(name);
  }

  isModified(name: string): boolean {
    return this.modified.has(name);
  }

  async generate(): Promise<ArrayBuffer> {
    for (const f of Object.values(this.zip.files)) {
      if (this.modified.has(f.name)) continue;
      // Méthode d'origine (sinon JSZip applique la méthode globale à toutes les entrées).
      (f as unknown as { options: { compression: string } }).options.compression =
        this.methods.get(f.name) === 8 ? "DEFLATE" : "STORE";
    }
    const out = await this.zip.generateAsync({ type: "uint8array", compression: "STORE" });
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  }
}
