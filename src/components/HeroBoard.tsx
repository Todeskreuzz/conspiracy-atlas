// Decorative investigation board for the home page hero (pure SVG, no data required).
const CARDS = [
  { x: 640, y: 70, r: -4, w: 150, h: 100 },
  { x: 900, y: 150, r: 3, w: 170, h: 110 },
  { x: 760, y: 300, r: -2, w: 160, h: 120 },
  { x: 1080, y: 330, r: 5, w: 140, h: 95 },
  { x: 560, y: 380, r: 2, w: 140, h: 95 },
  { x: 1150, y: 80, r: -3, w: 150, h: 100 },
  { x: 980, y: 470, r: -5, w: 150, h: 95 },
];
const THREADS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 4],
  [1, 3],
  [3, 6],
  [2, 6],
  [1, 5],
  [0, 2],
];

export function HeroBoard() {
  const pin = (i: number) => ({ x: CARDS[i].x + CARDS[i].w / 2, y: CARDS[i].y + 10 });
  return (
    <svg className="hero__board" viewBox="0 0 1300 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="cork">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" />
          <feColorMatrix values="0 0 0 0 0.36  0 0 0 0 0.24  0 0 0 0 0.15  0 0 0 0.9 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <linearGradient id="paperG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe3c8" />
          <stop offset="1" stopColor="#d8c59f" />
        </linearGradient>
        <radialGradient id="pinG" cx="0.35" cy="0.35" r="0.65">
          <stop offset="0" stopColor="#f08a80" />
          <stop offset="0.55" stopColor="#b3261e" />
          <stop offset="1" stopColor="#5a0f0a" />
        </radialGradient>
      </defs>
      <rect width="1300" height="560" fill="#3a2616" />
      <rect width="1300" height="560" fill="#5b3d26" filter="url(#cork)" opacity="0.9" />
      {CARDS.map((c, i) => (
        <g key={i} transform={`rotate(${c.r} ${c.x + c.w / 2} ${c.y + c.h / 2})`}>
          <rect x={c.x + 4} y={c.y + 6} width={c.w} height={c.h} fill="rgba(0,0,0,0.45)" />
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="url(#paperG)" />
          <rect x={c.x + 12} y={c.y + 24} width={c.w * 0.6} height="7" fill="#3b2d20" opacity="0.6" />
          <rect x={c.x + 12} y={c.y + 40} width={c.w * 0.75} height="4" fill="#3b2d20" opacity="0.3" />
          <rect x={c.x + 12} y={c.y + 50} width={c.w * 0.7} height="4" fill="#3b2d20" opacity="0.3" />
          <rect x={c.x + 12} y={c.y + 60} width={c.w * 0.5} height="4" fill="#3b2d20" opacity="0.3" />
          {i % 3 === 0 && <rect x={c.x + 12} y={c.y + 72} width={c.w * 0.4} height="9" fill="#e8c547" opacity="0.45" />}
        </g>
      ))}
      {THREADS.map(([a, b], i) => {
        const p = pin(a);
        const q = pin(b);
        return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#c9372c" strokeWidth="2.2" opacity="0.9" />;
      })}
      {CARDS.map((_, i) => {
        const p = pin(i);
        return <circle key={i} cx={p.x} cy={p.y} r="7" fill="url(#pinG)" />;
      })}
    </svg>
  );
}
