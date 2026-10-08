// Lecture minimale du répertoire central d'un zip : nom, méthode, CRC, octets compressés bruts.
export interface RawEntry {
  name: string;
  method: number;
  crc: number;
  raw: Uint8Array;
  flags: number;
}

export function readCentralDirectory(buf: Uint8Array): RawEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("EOCD introuvable");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: RawEntry[] = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true);
    const lxlen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lxlen;
    out.push({ name, method, crc, flags, raw: buf.subarray(start, start + csize) });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}
