// Bitmap fonts for the preview cards. The bytes are produced by scripts/generate-og-font.mjs
// (resvg rasterises the OFL fonts; the Worker only blits runs, which fits the free-plan CPU limit).
import { ATLAS_B64 } from './atlas.generated';

export interface Glyph {
  advance: number;
  bearingX: number;
  bearingY: number;
  /** Packed runs: y, x, length, level (1..3) relative to the glyph bitmap. */
  runs: Uint8Array;
}

export interface AtlasFont {
  id: string;
  ascent: number;
  descent: number;
  glyphs: Map<number, Glyph>;
  /** Advance used when a character is not in the atlas. */
  missing: number;
}

const cache = new Map<string, AtlasFont>();

function decodeB64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeFont(id: string, b64: string): AtlasFont {
  const buf = decodeB64(b64);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 0;
  const u8 = () => buf[o++];
  const u16 = () => {
    const n = view.getUint16(o, true);
    o += 2;
    return n;
  };
  const i16 = () => {
    const n = view.getInt16(o, true);
    o += 2;
    return n;
  };
  if (u8() !== 1) throw new Error(`preview font ${id} has an unknown atlas version`);
  const idLen = u8();
  const stored = new TextDecoder().decode(buf.subarray(o, o + idLen));
  o += idLen;
  if (stored !== id) throw new Error(`preview font ${id} is stored as ${stored}`);
  const ascent = i16();
  const descent = i16();
  const count = u16();
  const glyphs = new Map<number, Glyph>();
  for (let i = 0; i < count; i++) {
    const code = u16();
    const advance = u16();
    const bearingX = i16();
    const bearingY = i16();
    u8();
    u8();
    const runCount = u16();
    const bytes = runCount * 4;
    const runs = buf.subarray(o, o + bytes);
    o += bytes;
    glyphs.set(code, { advance, bearingX, bearingY, runs });
  }
  const missing = glyphs.get(63)?.advance ?? glyphs.get(32)?.advance ?? 8;
  return { id, ascent, descent, glyphs, missing };
}

export function font(id: string): AtlasFont {
  let found = cache.get(id);
  if (!found) {
    const b64 = ATLAS_B64[id];
    if (!b64) throw new Error(`preview font ${id} is not in the atlas`);
    found = decodeFont(id, b64);
    cache.set(id, found);
  }
  return found;
}

function glyphFor(font: AtlasFont, code: number): Glyph | undefined {
  return font.glyphs.get(code) ?? font.glyphs.get(63);
}

export function measure(font: AtlasFont, text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    width += glyphFor(font, code)?.advance ?? font.missing;
  }
  return width;
}

export function ellipsize(font: AtlasFont, text: string, maxWidth: number, force = false): string {
  const clean = text.replace(/\s+$/, '');
  if (!force && measure(font, clean) <= maxWidth) return clean;
  let s = clean;
  while (s && measure(font, `${s}...`) > maxWidth) s = s.slice(0, -1).replace(/\s+$/, '');
  return s ? `${s}...` : '...';
}

export function wrap(font: AtlasFont, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length || maxLines < 1) return [];
  const lines: string[] = [];
  let line = '';
  let truncated = false;
  const push = (value: string) => {
    if (lines.length < maxLines) lines.push(value);
    else truncated = true;
  };
  for (const word of words) {
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
    const next = line ? `${line} ${word}` : word;
    if (measure(font, next) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) {
      push(line);
      line = '';
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    }
    if (measure(font, word) <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = '';
    for (const ch of word) {
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      const trial = chunk + ch;
      if (measure(font, trial) <= maxWidth) chunk = trial;
      else {
        if (chunk) push(chunk);
        chunk = ch;
      }
    }
    if (lines.length < maxLines) line = chunk;
    else truncated = true;
  }
  if (line && lines.length < maxLines) lines.push(line);
  else if (line) truncated = true;
  if (truncated && lines.length) lines[lines.length - 1] = ellipsize(font, lines[lines.length - 1]!, maxWidth, true);
  return lines;
}
