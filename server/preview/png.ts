// Indexed PNG with uncompressed zlib blocks. Deflate would make a smaller file, but on the
// Workers Free plan the CPU budget is 10 ms and compressing the card costs more than writing
// the raw rows. Crawlers fetch each card once; the edge cache keeps the bytes after that.
import { CARD_H, CARD_W } from './size';

const STRIDE = CARD_W + 1;

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(data: Uint8Array, from: number, to: number): number {
  let c = 0xffffffff;
  for (let i = from; i < to; i++) c = CRC_TABLE[(c ^ data[i]) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  let i = 0;
  const n = data.length;
  while (i < n) {
    const end = Math.min(i + 5552, n);
    for (; i < end; i++) {
      a += data[i]!;
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/** zlib wrapper around stored (uncompressed) deflate blocks. */
function zlibStore(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.of(0x78, 0x01)];
  let off = 0;
  while (off < raw.length) {
    const n = Math.min(65535, raw.length - off);
    const block = new Uint8Array(5 + n);
    block[0] = off + n === raw.length ? 1 : 0;
    block[1] = n & 255;
    block[2] = (n >> 8) & 255;
    const nlen = (~n) & 0xffff;
    block[3] = nlen & 255;
    block[4] = (nlen >> 8) & 255;
    block.set(raw.subarray(off, off + n), 5);
    parts.push(block);
    off += n;
  }
  const sum = new Uint8Array(4);
  new DataView(sum.buffer).setUint32(0, adler32(raw));
  parts.push(sum);
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const part of parts) {
    out.set(part, o);
    o += part.length;
  }
  return out;
}

export type Rgb = [number, number, number];

export function blankCard(): Uint8Array {
  return new Uint8Array(CARD_H * STRIDE);
}

export function fillRect(pix: Uint8Array, x: number, y: number, w: number, h: number, color: number): void {
  if (w <= 0 || h <= 0) return;
  let x0 = x < 0 ? 0 : x;
  let y0 = y < 0 ? 0 : y;
  let x1 = x + w;
  let y1 = y + h;
  if (x1 > CARD_W) x1 = CARD_W;
  if (y1 > CARD_H) y1 = CARD_H;
  if (x0 >= x1 || y0 >= y1) return;
  const span = x1 - x0;
  for (let row = y0; row < y1; row++) {
    const start = row * STRIDE + 1 + x0;
    pix.fill(color, start, start + span);
  }
}

export function encodeIndexedPng(pix: Uint8Array, palette: Rgb[]): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, CARD_W);
  view.setUint32(4, CARD_H);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const plte = new Uint8Array(palette.length * 3);
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette[i]!;
    plte[i * 3] = r;
    plte[i * 3 + 1] = g;
    plte[i * 3 + 2] = b;
  }
  const sig = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const parts = [sig, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', zlibStore(pix)), chunk('IEND', new Uint8Array())];
  let total = 0;
  for (const part of parts) total += part.length;
  const png = new Uint8Array(total);
  let o = 0;
  for (const part of parts) {
    png.set(part, o);
    o += part.length;
  }
  return png;
}
