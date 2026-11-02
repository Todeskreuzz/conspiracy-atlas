#!/usr/bin/env node
// Builds the glyph atlas used by the social-preview cards (server/og/atlas.generated.ts).
//
// The cards are drawn inside a Pages Function. On the Workers Free plan a request has 10 ms of
// CPU time, and rasterising a 1200×630 SVG with @resvg/resvg-wasm takes longer than that (the
// wasm module alone needs ~20 ms to start). This script therefore rasterises the fonts once,
// with resvg, and commits the bitmaps. Re-run it with `npm run og:font` after a font update.
//
// Fonts are the OFL files already installed via @fontsource (no download):
//   Playfair Display 700 — Claus Eggers Sørensen
//   IBM Plex Sans 400/600 — IBM
//   Special Elite 400 — Astigmatic
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

const OUT = new URL('../server/preview/atlas.generated.ts', import.meta.url);

/** Latin-1 plus the punctuation the archive actually uses (dashes, quotes, ellipsis). */
const EXTRA = [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026];

const FONTS = [
  { id: 'display-md', file: 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff', family: 'Playfair', size: 48 },
  { id: 'display-sm', file: 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff', family: 'Playfair', size: 34 },
  { id: 'body', file: 'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff', family: 'Plex', size: 24 },
  { id: 'label', file: 'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff', family: 'Plex', size: 26 },
  { id: 'stamp', file: 'node_modules/@fontsource/special-elite/files/special-elite-latin-400-normal.woff', family: 'Stamp', size: 22 },
];

/** WOFF (not WOFF2) is a zlib-compressed TrueType. resvg reads TrueType. */
function woffToTtf(u8) {
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (view.getUint32(0) !== 0x774f4646) throw new Error('not a WOFF font');
  const numTables = view.getUint16(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    tables.push({
      tag: u8.slice(o, o + 4),
      start: view.getUint32(o + 4),
      comp: view.getUint32(o + 8),
      orig: view.getUint32(o + 12),
    });
  }
  const searchRange = 2 ** Math.floor(Math.log2(numTables)) * 16;
  const headerSize = 12 + numTables * 16;
  let body = headerSize;
  const records = tables.map((t) => {
    const raw = u8.subarray(t.start, t.start + t.comp);
    const data = t.comp === t.orig ? raw : inflateSync(raw);
    const rec = { tag: t.tag, data: Uint8Array.from(data), offset: body };
    body += (data.length + 3) & ~3;
    return rec;
  });
  const out = new Uint8Array(body);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, 0x00010000);
  outView.setUint16(4, numTables);
  outView.setUint16(6, searchRange);
  outView.setUint16(8, Math.floor(Math.log2(numTables)));
  outView.setUint16(10, numTables * 16 - searchRange);
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const p = 12 + i * 16;
    out.set(r.tag, p);
    outView.setUint32(p + 8, r.offset);
    outView.setUint32(p + 12, r.data.length);
    out.set(r.data, r.offset);
  }
  return out;
}

function table(ttf, tag) {
  const view = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const n = view.getUint16(4);
  for (let i = 0; i < n; i++) {
    const p = 12 + i * 16;
    const name = String.fromCharCode(ttf[p], ttf[p + 1], ttf[p + 2], ttf[p + 3]);
    if (name === tag) return { offset: view.getUint32(p + 8), length: view.getUint32(p + 12), view };
  }
  throw new Error(`font has no ${tag} table`);
}

/** Unicode BMP cmap (format 4) → glyph id. Returns 0 when the font has no such character. */
function cmap(ttf) {
  const { offset, view } = table(ttf, 'cmap');
  const num = view.getUint16(offset + 2);
  let sub = 0;
  for (let i = 0; i < num; i++) {
    const platform = view.getUint16(offset + 4 + i * 8);
    const encoding = view.getUint16(offset + 6 + i * 8);
    const rel = view.getUint32(offset + 8 + i * 8);
    if ((platform === 3 && encoding === 1) || platform === 0) sub = offset + rel;
    if (platform === 3 && encoding === 1) break;
  }
  if (!sub || view.getUint16(sub) !== 4) throw new Error('font has no Unicode cmap');
  const segCount = view.getUint16(sub + 6) / 2;
  const endPos = sub + 14;
  const startPos = endPos + segCount * 2 + 2;
  const deltaPos = startPos + segCount * 2;
  const rangePos = deltaPos + segCount * 2;
  const map = new Map();
  for (let code = 0; code <= 0xffff; code++) {
    let gid = 0;
    for (let i = 0; i < segCount; i++) {
      const end = view.getUint16(endPos + i * 2);
      if (code > end) continue;
      const start = view.getUint16(startPos + i * 2);
      if (code < start) break;
      const delta = view.getInt16(deltaPos + i * 2);
      const rangeOff = view.getUint16(rangePos + i * 2);
      if (rangeOff === 0) gid = (code + delta) & 0xffff;
      else {
        const glyphPos = rangePos + i * 2 + rangeOff + (code - start) * 2;
        const g = view.getUint16(glyphPos);
        gid = g === 0 ? 0 : (g + delta) & 0xffff;
      }
      break;
    }
    if (gid) map.set(code, gid);
  }
  return map;
}

function metrics(ttf) {
  const head = table(ttf, 'head');
  const hhea = table(ttf, 'hhea');
  const units = head.view.getUint16(head.offset + 18);
  const ascent = hhea.view.getInt16(hhea.offset + 4);
  const descent = hhea.view.getInt16(hhea.offset + 6);
  const nMetrics = hhea.view.getUint16(hhea.offset + 34);
  const hmtx = table(ttf, 'hmtx');
  const advance = (gid) => {
    const i = Math.min(gid, nMetrics - 1);
    return hmtx.view.getUint16(hmtx.offset + i * 4);
  };
  return { units, ascent, descent, advance };
}

function wanted(map) {
  const codes = [];
  for (let c = 0x20; c <= 0xff; c++) {
    if (c >= 0x7f && c < 0xa0) continue;
    if (map.has(c)) codes.push(c);
  }
  for (const c of EXTRA) if (map.has(c) && !codes.includes(c)) codes.push(c);
  return codes;
}

/** Alpha → 0..3. The runtime blends 1 and 2; 3 is solid ink. */
function level(alpha) {
  // Two kept levels: the faintest edge (level 1) is most of the runs and the CPU cost.
  if (alpha < 90) return 0;
  if (alpha < 180) return 2;
  return 3;
}

function runsFor(pixels, width, cell, col, row, baseline, pad) {
  const x0 = col * cell;
  const y0 = row * cell;
  let minX = cell;
  let minY = cell;
  let maxX = 0;
  let maxY = 0;
  const rows = [];
  for (let y = 0; y < cell; y++) {
    const spans = [];
    let x = 0;
    while (x < cell) {
      const a = pixels[((y0 + y) * width + (x0 + x)) * 4 + 3];
      const lv = level(a);
      if (!lv) {
        x++;
        continue;
      }
      let x2 = x + 1;
      while (x2 < cell && level(pixels[((y0 + y) * width + (x0 + x2)) * 4 + 3]) === lv) x2++;
      spans.push({ x, len: x2 - x, level: lv });
      if (x < minX) minX = x;
      if (x2 - 1 > maxX) maxX = x2 - 1;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      x = x2;
    }
    if (spans.length) rows.push({ y, spans });
  }
  if (!rows.length) return { bearingX: 0, bearingY: 0, width: 0, height: 0, runs: [] };
  const runs = [];
  for (const row of rows) {
    for (const s of row.spans) {
      const x = s.x - minX;
      const y = row.y - minY;
      if (x > 255 || y > 255 || s.len > 255) throw new Error('glyph is larger than one byte can describe');
      runs.push(y, x, s.len, s.level);
    }
  }
  return { bearingX: minX - pad, bearingY: baseline - minY, width: maxX - minX + 1, height: maxY - minY + 1, runs };
}

async function rasterise(font, ttf, map) {
  const codes = wanted(map);
  const cell = font.size * 3;
  const pad = Math.round(font.size * 0.2);
  const baseline = Math.round(font.size * 1.35);
  const cols = 12;
  const rows = Math.ceil(codes.length / cols);
  const width = cols * cell;
  const height = rows * cell;
  const texts = codes
    .map((code, i) => {
      const x = (i % cols) * cell + pad;
      const y = Math.floor(i / cols) * cell + baseline;
      return `<text x="${x}" y="${y}" font-family="${font.family}" font-size="${font.size}">&#${code};</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${texts}</svg>`;
  const resvg = new Resvg(svg, {
    background: 'rgba(0,0,0,0)',
    textRendering: 2,
    font: { fontBuffers: [ttf], loadSystemFonts: false, defaultFontFamily: font.family, sansSerifFamily: font.family, serifFamily: font.family },
  });
  const image = resvg.render();
  const pixels = image.pixels;
  if (image.width !== width || image.height !== height) throw new Error(`${font.id} rendered at ${image.width}x${image.height}`);
  const meta = metrics(ttf);
  const scale = font.size / meta.units;
  const glyphs = codes.map((code, i) => {
    const box = runsFor(pixels, image.width, cell, i % cols, Math.floor(i / cols), baseline, pad);
    const advance = Math.max(1, Math.round(meta.advance(map.get(code)) * scale));
    return { code, advance, ...box };
  });
  image.free();
  resvg.free();
  return {
    id: font.id,
    ascent: Math.round(meta.ascent * scale),
    descent: Math.round(meta.descent * scale),
    glyphs,
  };
}

function encodeFont(font) {
  const u16 = (n) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  };
  const i16 = (n) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setInt16(0, n, true);
    return b;
  };
  const id = new TextEncoder().encode(font.id);
  const parts = [Uint8Array.of(1, id.length), id, i16(font.ascent), i16(font.descent), u16(font.glyphs.length)];
  for (const g of font.glyphs) {
    parts.push(u16(g.code), u16(g.advance), i16(g.bearingX), i16(g.bearingY), Uint8Array.of(g.width, g.height), u16(g.runs.length / 4));
    if (g.runs.length) parts.push(Uint8Array.from(g.runs));
  }
  const size = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const wasm = readFileSync(new URL('../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url));
await initWasm(wasm);

const built = [];
for (const font of FONTS) {
  const ttf = woffToTtf(readFileSync(new URL('../' + font.file, import.meta.url)));
  const map = cmap(ttf);
  for (const ch of ['A', 'a', '0', ' ']) if (!map.has(ch.charCodeAt(0))) throw new Error(`${font.id} is missing ${ch}`);
  if (font.family !== 'Stamp') {
    for (const ch of ['Ä', 'ö', 'ß']) if (!map.has(ch.charCodeAt(0))) throw new Error(`${font.id} is missing ${ch}`);
  }
  const raster = await rasterise(font, ttf, map);
  const runs = raster.glyphs.reduce((s, g) => s + g.runs.length / 4, 0);
  console.log(`${font.id}: ${raster.glyphs.length} glyphs, ${runs} runs, ascent ${raster.ascent}`);
  built.push(raster);
}

const encoded = built.map((font) => [font.id, encodeFont(font)]);
const lines = encoded.map(([id, bytes]) => `  '${id}': '${Buffer.from(bytes).toString('base64')}',`);
const total = encoded.reduce((s, [, bytes]) => s + bytes.length, 0);
const source = `// Generated by scripts/generate-og-font.mjs — do not edit.
// Glyph bitmaps rasterised with @resvg/resvg-wasm from the OFL fonts shipped by @fontsource:
// Playfair Display (Claus Eggers Sørensen), IBM Plex Sans (IBM), Special Elite (Astigmatic).
// One entry per font so a card only decodes the sizes it draws. Rebuild with: npm run og:font
export const ATLAS_B64: Record<string, string> = {
${lines.join('\n')}
};
`;
writeFileSync(OUT, source);
console.log(`wrote ${OUT.pathname} (${total} bytes, ${source.length} chars)`);
