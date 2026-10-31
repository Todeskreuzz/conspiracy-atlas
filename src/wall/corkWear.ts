/* Traces of earlier investigations on the cork: bleached outlines of papers that hung there, the pin holes they
   left, scraps of tape and the odd coffee ring. Built once from a fixed seed (identical on every visit), returned as
   a CSS url() and tiled under the cards so it pans and zooms with the board. Kept faint on purpose: it is texture,
   not content. */

export const WEAR_TILE = 1400;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

function pinHole(x: number, y: number, r = 1.7) {
  // dark puncture with a faint lighter rim where the cork was pushed up
  return `<circle cx="${f(x + 0.6)}" cy="${f(y + 0.7)}" r="${f(r + 1.1)}" fill="#f2cf9c" opacity=".1"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#160c05" opacity=".62"/>`;
}

export function buildCorkWear(seed = 1931): string {
  const r = rng(seed);
  const S = WEAR_TILE;
  const parts: string[] = [];
  const inner = (pad: number) => pad + r() * (S - pad * 2);

  // bleached outlines of papers that were taken down, each with pin holes at its corners
  for (let i = 0; i < 7; i++) {
    const w = 150 + r() * 170;
    const h = w * (0.7 + r() * 0.65);
    const x = inner(w * 0.75);
    const y = inner(h * 0.75);
    const rot = (r() - 0.5) * 9;
    const holes = [pinHole(-w / 2 + 12, -h / 2 + 12), pinHole(w / 2 - 12, -h / 2 + 12)];
    if (r() > 0.45) holes.push(pinHole(-w / 2 + 12, h / 2 - 12), pinHole(w / 2 - 12, h / 2 - 12));
    if (r() > 0.6) holes.push(pinHole(-w / 2 + 16 + r() * 8, -h / 2 + 8 + r() * 8, 1.4)); // re-pinned once
    parts.push(
      `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" fill="#f6d9ad" opacity="${(0.028 + r() * 0.022).toFixed(3)}" filter="url(#s)"/>${holes.join('')}</g>`,
    );
  }

  // loose pin holes, mostly in small clusters
  for (let i = 0; i < 26; i++) {
    const cx = inner(30);
    const cy = inner(30);
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) parts.push(pinHole(cx + (r() - 0.5) * 26, cy + (r() - 0.5) * 26, 1.2 + r() * 0.8));
  }

  // torn scraps of masking tape
  for (let i = 0; i < 5; i++) {
    const w = 34 + r() * 30;
    const h = 13 + r() * 6;
    parts.push(
      `<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" fill="#efdfb8" opacity=".13" transform="translate(${f(inner(60))} ${f(inner(60))}) rotate(${f((r() - 0.5) * 70)})" filter="url(#t)"/>`,
    );
  }

  // a half-faded coffee ring
  const rad = 34 + r() * 8;
  parts.push(
    `<circle cx="${f(inner(80))}" cy="${f(inner(80))}" r="${f(rad)}" fill="none" stroke="#2a1508" stroke-width="2.6" opacity=".16" stroke-dasharray="${f(rad * 3.6)} ${f(rad * 2.7)}" filter="url(#t)"/>`,
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    `<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<filter id="t"><feGaussianBlur stdDeviation=".6"/></filter>` +
    parts.join('') +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
