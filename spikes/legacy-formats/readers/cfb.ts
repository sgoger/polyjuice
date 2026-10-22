// Lecture seule d'un fichier composé (Compound File Binary, [MS-CFB]) : le conteneur OLE2 des formats
// Office 97-2003 (.doc, .xls, .ppt). Un fichier composé est un petit système de fichiers : des secteurs
// chaînés par une table d'allocation (FAT), un répertoire de flux et de stockages, et un « mini-flux »
// pour les flux de moins de 4 096 octets.

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const NOSTREAM = 0xffffffff;

export const isCfb = (b: Uint8Array): boolean => b.length >= 512 && SIGNATURE.every((v, i) => b[i] === v);

export interface CfbEntry {
  /** Chemin depuis la racine, séparé par « / » (ex. « _VBA_PROJECT_CUR/VBA/dir »). */
  path: string;
  /** 1 = stockage, 2 = flux. */
  type: number;
  size: number;
  start: number;
}

const corrupt = (why: string) => new Error(`fichier Office 97-2003 corrompu (${why})`);

export class Cfb {
  private constructor(
    private readonly buf: Uint8Array,
    private readonly sectorSize: number,
    private readonly fat: Uint32Array,
    private readonly miniFat: Uint32Array,
    private readonly miniStream: Uint8Array,
    private readonly cutoff: number,
    readonly entries: readonly CfbEntry[],
  ) {}

  static open(input: ArrayBuffer | Uint8Array): Cfb {
    const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!isCfb(buf)) throw new Error("ce n'est pas un fichier Office 97-2003 (signature OLE2 absente)");
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const shift = dv.getUint16(0x1e, true);
    if (shift !== 9 && shift !== 12) throw corrupt("taille de secteur");
    const sectorSize = 1 << shift;
    const sectorCount = Math.floor((buf.length - 512) / sectorSize) + 1;
    const sectorAt = (n: number): Uint8Array => {
      const off = (n + 1) * sectorSize;
      if (n >= sectorCount || off >= buf.length) throw corrupt("secteur hors du fichier");
      return buf.subarray(off, Math.min(off + sectorSize, buf.length));
    };
    const u32 = (s: Uint8Array, i: number) => new DataView(s.buffer, s.byteOffset, s.byteLength).getUint32(i, true);

    // Secteurs de la FAT : 109 premiers dans l'en-tête, puis chaîne DIFAT.
    const fatSectors: number[] = [];
    for (let i = 0; i < 109; i++) {
      const s = dv.getUint32(0x4c + i * 4, true);
      if (s !== FREESECT) fatSectors.push(s);
    }
    let difat = dv.getUint32(0x44, true);
    const perDifat = sectorSize / 4 - 1;
    for (let guard = 0; difat !== ENDOFCHAIN && difat !== FREESECT; guard++) {
      if (guard > sectorCount) throw corrupt("boucle DIFAT");
      const s = sectorAt(difat);
      for (let i = 0; i < perDifat; i++) {
        const v = u32(s, i * 4);
        if (v !== FREESECT) fatSectors.push(v);
      }
      difat = u32(s, perDifat * 4);
    }
    const fat = new Uint32Array(fatSectors.length * (sectorSize / 4));
    fatSectors.forEach((n, k) => {
      const s = sectorAt(n);
      for (let i = 0; i < sectorSize / 4 && i * 4 + 4 <= s.length; i++) fat[k * (sectorSize / 4) + i] = u32(s, i * 4);
    });

    const chain = (start: number): number[] => {
      const out: number[] = [];
      for (let n = start; n !== ENDOFCHAIN && n !== FREESECT; n = fat[n] ?? ENDOFCHAIN) {
        if (out.length > sectorCount || n >= fat.length) throw corrupt("chaîne de secteurs");
        out.push(n);
      }
      return out;
    };
    const readChain = (start: number, size?: number): Uint8Array => {
      const sectors = chain(start);
      const out = new Uint8Array(sectors.length * sectorSize);
      sectors.forEach((n, i) => {
        out.set(sectorAt(n), i * sectorSize);
      });
      return size === undefined ? out : out.subarray(0, Math.min(size, out.length));
    };

    // Répertoire : entrées de 128 octets.
    const dir = readChain(dv.getUint32(0x30, true));
    const ddv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
    interface Raw {
      name: string;
      type: number;
      left: number;
      right: number;
      child: number;
      start: number;
      size: number;
    }
    const raw: Raw[] = [];
    for (let off = 0; off + 128 <= dir.length; off += 128) {
      const nameLen = Math.min(ddv.getUint16(off + 0x40, true), 64);
      const name = String.fromCharCode(
        ...Array.from({ length: Math.max(0, nameLen / 2 - 1) }, (_, i) => ddv.getUint16(off + i * 2, true)),
      );
      raw.push({
        name,
        type: dir[off + 0x42] ?? 0,
        left: ddv.getUint32(off + 0x44, true),
        right: ddv.getUint32(off + 0x48, true),
        child: ddv.getUint32(off + 0x4c, true),
        start: ddv.getUint32(off + 0x74, true),
        size: ddv.getUint32(off + 0x78, true),
      });
    }
    const root = raw[0];
    if (root?.type !== 5) throw corrupt("entrée racine absente");

    // Arbre rouge-noir des entrées sœurs (gauche, droite) et descendants (child) des stockages.
    const entries: CfbEntry[] = [];
    const seen = new Set<number>();
    const walk = (id: number, prefix: string) => {
      if (id === NOSTREAM || id >= raw.length || seen.has(id)) return;
      seen.add(id);
      const e = raw[id];
      if (!e) return;
      walk(e.left, prefix);
      if (e.type === 1 || e.type === 2) {
        const path = prefix + e.name;
        entries.push({ path, type: e.type, size: e.size, start: e.start });
        if (e.type === 1) walk(e.child, `${path}/`);
      }
      walk(e.right, prefix);
    };
    walk(root.child, "");

    const cutoff = dv.getUint32(0x38, true) || 4096;
    const miniFatBytes = dv.getUint32(0x40, true) > 0 ? readChain(dv.getUint32(0x3c, true)) : new Uint8Array(0);
    const miniFat = new Uint32Array(miniFatBytes.length / 4);
    const mdv = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
    for (let i = 0; i < miniFat.length; i++) miniFat[i] = mdv.getUint32(i * 4, true);
    const miniStream = root.start === ENDOFCHAIN ? new Uint8Array(0) : readChain(root.start, root.size);
    return new Cfb(buf, sectorSize, fat, miniFat, miniStream, cutoff, entries);
  }

  has(path: string): boolean {
    return this.entries.some((e) => e.path === path);
  }

  /** Contenu d'un flux, ou `null` s'il n'existe pas. */
  stream(path: string): Uint8Array | null {
    const e = this.entries.find((x) => x.path === path && x.type === 2);
    if (!e) return null;
    if (e.size === 0) return new Uint8Array(0);
    if (e.size < this.cutoff) {
      const out = new Uint8Array(e.size);
      let written = 0;
      for (let n = e.start, guard = 0; written < e.size && n !== ENDOFCHAIN; n = this.miniFat[n] ?? ENDOFCHAIN) {
        if (guard++ > this.miniFat.length) throw corrupt("chaîne du mini-flux");
        const chunk = this.miniStream.subarray(n * 64, n * 64 + Math.min(64, e.size - written));
        if (chunk.length === 0) throw corrupt("mini-secteur hors du flux");
        out.set(chunk, written);
        written += chunk.length;
      }
      return out.subarray(0, written);
    }
    const out = new Uint8Array(e.size);
    let written = 0;
    for (let n = e.start, guard = 0; written < e.size && n !== ENDOFCHAIN; n = this.fat[n] ?? ENDOFCHAIN) {
      if (guard++ > this.fat.length) throw corrupt("chaîne de secteurs");
      const off = (n + 1) * this.sectorSize;
      const chunk = this.buf.subarray(off, Math.min(off + this.sectorSize, off + e.size - written, this.buf.length));
      if (chunk.length === 0) throw corrupt("secteur hors du fichier");
      out.set(chunk, written);
      written += chunk.length;
    }
    return out.subarray(0, written);
  }
}
