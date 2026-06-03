// 依存ゼロの最小 ZIP ライター（無圧縮 / store のみ）。
// xlsx は実体が「複数 XML を ZIP で固めたもの」なので、外部ライブラリを足さずに
// .xlsx を組み立てるための土台。圧縮はしない（定義書サイズなら問題にならない）。

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// CRC-32（ZIP の各エントリに必要）。テーブルは初回呼び出し時に一度だけ構築。
let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

// store 方式（method=0）で ZIP を生成。タイムスタンプは固定値にして
// 同一入力 → 同一バイト列（再現性のため。Date 非依存）。
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const records = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    return { nameBytes, crc, data: entry.data };
  });

  for (const rec of records) {
    const header = new Uint8Array(30 + rec.nameBytes.length);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true); // local file header signature
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // method = store
    dv.setUint16(10, 0, true); // mod time
    dv.setUint16(12, 0x21, true); // mod date (1980-01-01)
    dv.setUint32(14, rec.crc, true);
    dv.setUint32(18, rec.data.length, true); // compressed size
    dv.setUint32(22, rec.data.length, true); // uncompressed size
    dv.setUint16(26, rec.nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra length
    header.set(rec.nameBytes, 30);

    localParts.push(header, rec.data);

    const central = new Uint8Array(46 + rec.nameBytes.length);
    const cdv = new DataView(central.buffer);
    cdv.setUint32(0, 0x02014b50, true); // central dir signature
    cdv.setUint16(4, 20, true); // version made by
    cdv.setUint16(6, 20, true); // version needed
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, 0, true); // method
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0x21, true);
    cdv.setUint32(16, rec.crc, true);
    cdv.setUint32(20, rec.data.length, true);
    cdv.setUint32(24, rec.data.length, true);
    cdv.setUint16(28, rec.nameBytes.length, true);
    cdv.setUint16(30, 0, true); // extra
    cdv.setUint16(32, 0, true); // comment
    cdv.setUint16(34, 0, true); // disk number
    cdv.setUint16(36, 0, true); // internal attrs
    cdv.setUint32(38, 0, true); // external attrs
    cdv.setUint32(42, offset, true); // local header offset
    central.set(rec.nameBytes, 46);
    centralParts.push(central);

    offset += header.length + rec.data.length;
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  const end = new Uint8Array(22);
  const edv = new DataView(end.buffer);
  edv.setUint32(0, 0x06054b50, true); // end of central dir signature
  edv.setUint16(8, records.length, true); // entries on this disk
  edv.setUint16(10, records.length, true); // total entries
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true); // central dir offset
  edv.setUint16(20, 0, true); // comment length

  const total =
    localParts.reduce((n, p) => n + p.length, 0) + centralSize + end.length;
  const result = new Uint8Array(total);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}
