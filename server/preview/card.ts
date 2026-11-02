// Draws the cork-and-paper preview card. Glyphs are pre-rasterised (see scripts/generate-og-font.mjs);
// this file only fills rectangles and copies glyph runs, which stays inside the free-plan CPU limit.
import type { EvidenceStatus, Locale } from '../../shared/constants';
import { SITE_NAME } from '../og';
import { font, measure, wrap, type AtlasFont } from './atlas';
import { homeDescription, homeKicker, statusLabel } from './copy';
import { blankCard, encodeIndexedPng, fillRect, type Rgb } from './png';
import { CARD_H, CARD_W } from './size';

/** Same inks as the status badges on paper (src/components/Badges.tsx). */
export const STATUS_INK: Record<EvidenceStatus, string> = {
  historically_documented: '#4f7a45',
  supported_by_evidence: '#6b8a3a',
  partially_supported: '#9a7a14',
  disputed: '#a8581b',
  unverified: '#6f655b',
  debunked: '#9e2f25',
  under_investigation: '#3f6a94',
};

const CORK: Rgb = [0x4a, 0x2e, 0x1c];
const SHADOW: Rgb = [0x2a, 0x18, 0x0e];
const PAPER: Rgb = [0xe9, 0xdc, 0xc0];
const INK: Rgb = [0x2b, 0x21, 0x18];
const MUTED: Rgb = [0x6b, 0x5a, 0x45];
const CREAM: Rgb = [0xfb, 0xf3, 0xe3];
const RED: Rgb = [0xb3, 0x26, 0x1e];
const BRASS: Rgb = [0xc6, 0xa1, 0x5a];

const STRIDE = CARD_W + 1;
const PAPER_BOX = { x: 34, y: 26, w: 732, h: 368 };
const TEXT_X = 70;
const TEXT_W = 660;

type Pen = [number, number, number];

function hex(value: string): Rgb {
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
}

function mix(bg: Rgb, fg: Rgb, t: number): Rgb {
  return [Math.round(bg[0] + (fg[0] - bg[0]) * t), Math.round(bg[1] + (fg[1] - bg[1]) * t), Math.round(bg[2] + (fg[2] - bg[2]) * t)];
}

/** Palette index 0 is the cork, so a zeroed buffer is already the background (and the PNG filter byte). */
function paletteBase(): Rgb[] {
  return [CORK];
}

function add(palette: Rgb[], color: Rgb): number {
  palette.push(color);
  return palette.length - 1;
}

/** Levels 1 and 2 are the antialiased edge; level 3 is the solid colour. */
function pen(palette: Rgb[], fg: Rgb, bg: Rgb): Pen {
  return [add(palette, mix(bg, fg, 0.4)), add(palette, mix(bg, fg, 0.72)), add(palette, fg)];
}

function disc(pix: Uint8Array, cx: number, cy: number, r: number, color: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(pix, cx - dx, cy + dy, dx * 2 + 1, 1, color);
  }
}

function roundRect(pix: Uint8Array, x: number, y: number, w: number, h: number, r: number, color: number): void {
  fillRect(pix, x + r, y, w - 2 * r, h, color);
  fillRect(pix, x, y + r, r, h - 2 * r, color);
  fillRect(pix, x + w - r, y + r, r, h - 2 * r, color);
  for (let dy = 0; dy < r; dy++) {
    const dx = Math.ceil(Math.sqrt(r * r - (r - dy - 0.5) ** 2));
    fillRect(pix, x + r - dx, y + dy, dx, 1, color);
    fillRect(pix, x + w - r, y + dy, dx, 1, color);
    fillRect(pix, x + r - dx, y + h - 1 - dy, dx, 1, color);
    fillRect(pix, x + w - r, y + h - 1 - dy, dx, 1, color);
  }
}

function blit(pix: Uint8Array, face: AtlasFont, text: string, x: number, baseline: number, ink: Pen): number {
  let penX = Math.round(x);
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const glyph = face.glyphs.get(code) ?? face.glyphs.get(63);
    if (!glyph) {
      penX += face.missing;
      continue;
    }
    const runs = glyph.runs;
    const destX = penX + glyph.bearingX;
    const destY = baseline - glyph.bearingY;
    for (let i = 0; i < runs.length; i += 4) {
      const y = destY + runs[i]!;
      const xx = destX + runs[i + 1]!;
      const len = runs[i + 2]!;
      const color = ink[runs[i + 3]! - 1];
      if (y < 0 || y >= CARD_H || color === undefined) continue;
      let start = xx;
      let end = xx + len;
      if (end <= 0 || start >= CARD_W) continue;
      if (start < 0) start = 0;
      if (end > CARD_W) end = CARD_W;
      const offset = y * STRIDE + 1 + start;
      pix.fill(color, offset, offset + (end - start));
    }
    penX += glyph.advance;
  }
  return penX;
}

function lineHeight(face: AtlasFont): number {
  return face.ascent - face.descent + 8;
}

function drawLines(pix: Uint8Array, face: AtlasFont, lines: string[], x: number, baseline: number, ink: Pen): number {
  const step = lineHeight(face);
  for (let i = 0; i < lines.length; i++) blit(pix, face, lines[i]!, x, baseline + i * step, ink);
  return baseline + lines.length * step;
}

function frame(pix: Uint8Array, palette: Rgb[]): { ink: Pen; muted: Pen } {
  const shadow = add(palette, SHADOW);
  const paper = add(palette, PAPER);
  const red = add(palette, RED);
  const brass = add(palette, BRASS);
  const pin = add(palette, [0x3a, 0x2a, 0x16]);
  const box = PAPER_BOX;
  fillRect(pix, box.x + 8, box.y + 10, box.w, box.h, shadow);
  fillRect(pix, box.x, box.y, box.w, box.h, paper);
  fillRect(pix, box.x, box.y, 12, box.h, red);
  disc(pix, box.x + Math.round(box.w / 2), box.y, 11, brass);
  disc(pix, box.x + Math.round(box.w / 2), box.y, 4, pin);
  return { ink: pen(palette, INK, PAPER), muted: pen(palette, MUTED, PAPER) };
}

function fitsAbove(face: AtlasFont, lines: number, firstBaseline: number, bottom: number): boolean {
  if (lines < 1) return true;
  const last = firstBaseline + (lines - 1) * lineHeight(face);
  return last - face.descent <= bottom;
}

function fitTitle(title: string, firstOf: (face: AtlasFont) => number, bottom: number): { face: AtlasFont; lines: string[] } {
  for (const id of ['display-md', 'display-sm']) {
    const face = font(id);
    const cap = id === 'display-sm' ? 4 : 3;
    for (let n = 1; n <= cap; n++) {
      const lines = wrap(face, title, TEXT_W, n);
      const truncated = wrap(face, title, TEXT_W, n + 1).length > lines.length;
      if (truncated) continue;
      if (fitsAbove(face, lines.length, firstOf(face), bottom)) return { face, lines };
      break;
    }
  }
  const face = font('display-sm');
  return { face, lines: wrap(face, title, TEXT_W, 4) };
}

export interface CaseCardInput {
  locale: Locale;
  title: string;
  summary: string;
  status: EvidenceStatus;
  host: string;
}

export function renderCaseCard(input: CaseCardInput): Uint8Array {
  const palette = paletteBase();
  const pix = blankCard();
  const { ink, muted } = frame(pix, palette);
  const stamp = font('stamp');
  const headerBaseline = PAPER_BOX.y + 42;
  blit(pix, stamp, SITE_NAME, TEXT_X, headerBaseline, muted);

  const label = statusLabel(input.locale, input.status);
  const labelFace = font('label');
  const labelW = measure(labelFace, label);
  const pillH = 36;
  const pillW = Math.min(TEXT_W, labelW + 28);
  const pillX = TEXT_X;
  const pillY = PAPER_BOX.y + PAPER_BOX.h - 16 - pillH;
  const titleBottom = pillY - 12;
  const title = fitTitle(input.title || 'Untitled', (face) => headerBaseline - stamp.descent + 12 + face.ascent, titleBottom - lineHeight(font('body')));
  const titleBaseline = headerBaseline - stamp.descent + 12 + title.face.ascent;
  drawLines(pix, title.face, title.lines, TEXT_X, titleBaseline, ink);
  const titleLast = titleBaseline + (title.lines.length - 1) * lineHeight(title.face);
  const status = hex(STATUS_INK[input.status]);
  const pill = add(palette, status);
  roundRect(pix, pillX, pillY, pillW, pillH, 8, pill);
  const onPill = pen(palette, CREAM, status);
  const em = labelFace.ascent - labelFace.descent;
  const labelBaseline = pillY + Math.round((pillH - em) / 2) + labelFace.ascent;
  blit(pix, labelFace, label, pillX + 16, labelBaseline, onPill);

  const body = font('body');
  const summaryBaseline = titleLast - title.face.descent + 12 + body.ascent;
  let room = 0;
  while (room < 3 && fitsAbove(body, room + 1, summaryBaseline, titleBottom)) room++;
  if (input.summary && room >= 1) {
    drawLines(pix, body, wrap(body, input.summary, TEXT_W, room), TEXT_X, summaryBaseline, muted);
  }

  const host = input.host.replace(/^www\./, '');
  const hostW = measure(body, host);
  if (pillX + pillW + 28 + hostW <= TEXT_X + TEXT_W) {
    blit(pix, body, host, TEXT_X + TEXT_W - hostW, labelBaseline, muted);
  }
  return encodeIndexedPng(pix, palette);
}

export function renderHomeCard(locale: Locale): Uint8Array {
  const palette = paletteBase();
  const pix = blankCard();
  const { ink, muted } = frame(pix, palette);
  const stamp = font('stamp');
  const kickerBaseline = PAPER_BOX.y + 58;
  blit(pix, stamp, homeKicker(locale), TEXT_X, kickerBaseline, muted);

  const display = font('display-md');
  const first = kickerBaseline - stamp.descent + 16 + display.ascent;
  const step = lineHeight(display);
  blit(pix, display, 'The Conspiracy', TEXT_X, first, ink);
  blit(pix, display, 'Atlas', TEXT_X, first + step, ink);

  const body = font('body');
  const summaryBaseline = first + step - display.descent + 12 + body.ascent;
  const bottom = PAPER_BOX.y + PAPER_BOX.h - 18;
  let room = 0;
  while (room < 4 && fitsAbove(body, room + 1, summaryBaseline, bottom)) room++;
  drawLines(pix, body, wrap(body, homeDescription(locale), TEXT_W, Math.max(1, room)), TEXT_X, summaryBaseline, muted);
  return encodeIndexedPng(pix, palette);
}

/** Last line of a title that does not fit, shortened so the tests can see the ellipsis rule. */
export function titleLines(title: string): string[] {
  return fitTitle(title, () => 0, 10_000).lines;
}

export function fittedTitleWidth(title: string): number {
  const fitted = fitTitle(title, () => 0, 10_000);
  return Math.max(0, ...fitted.lines.map((line) => measure(fitted.face, line)));
}
