import type { CategorySlug } from '../../shared/constants';
import { useT } from '../i18n';

// Generated title image for cases without a (freely licensed) photo: a case-file cover with a
// motif for the category, the title and the file number. Drawn in the browser, nothing is stored.

const MOTIFS: Record<CategorySlug, string> = {
  'space-ufos': 'M8 34c0-6 10-10 22-10s22 4 22 10-10 9-22 9S8 40 8 34zM20 26c0-6 4-11 10-11s10 5 10 11M22 44l-6 13M38 44l6 13M30 45v13',
  'secret-organizations': 'M30 6L54 52H6zM18 36c4-5 8-7 12-7s8 2 12 7c-4 5-8 7-12 7s-8-2-12-7zM30 33a3 3 0 1 0 0.01 0',
  'intelligence-agencies': 'M14 40a10 10 0 1 0 0.01 0M46 40a10 10 0 1 0 0.01 0M24 40c2-3 10-3 12 0M8 34l6-20h8l2 16M52 34l-6-20h-8l-2 16',
  'secret-operations': 'M30 8a22 22 0 1 0 0.01 0M30 20a10 10 0 1 0 0.01 0M30 2v14M30 44v14M2 30h14M44 30h14',
  'science-technology': 'M30 27a3 3 0 1 0 0.01 0M6 30c0-6 11-10 24-10s24 4 24 10-11 10-24 10S6 36 6 30zM18 9c5-3 15 5 21 16s7 22 3 25-15-5-21-16-7-22-3-25zM42 9c4 3 3 14-3 25s-16 19-21 16-3-14 3-25 16-19 21-16z',
  history: 'M10 54h40M14 48h32M16 48V18M24 48V18M36 48V18M44 48V18M12 18h36L30 6z',
  'economy-finance': 'M12 46c0-3 8-5 18-5s18 2 18 5-8 5-18 5-18-2-18-5zM12 46v6c0 3 8 5 18 5s18-2 18-5v-6M12 34c0-3 8-5 18-5s18 2 18 5-8 5-18 5-18-2-18-5zM12 34v6M48 34v6M16 22c0-3 6-5 14-5s14 2 14 5-6 5-14 5-14-2-14-5zM16 22v6M44 22v6',
  'media-society': 'M8 18h44v30H8zM14 24h32v18H14zM22 18l-8-10M38 18l8-10M20 54h20',
  'internet-modern-myths': 'M30 6a24 24 0 1 0 0.01 0M6 30h48M30 6c-8 7-12 15-12 24s4 17 12 24M30 6c8 7 12 15 12 24s-4 17-12 24M10 18h40M10 42h40',
  'politics-power': 'M8 54h44M12 48h36M16 48V34M24 48V34M36 48V34M44 48V34M12 34h36M16 34c0-9 6-16 14-16s14 7 14 16M30 18V8M30 8h8v4h-8',
};

/** Splits the title into at most three lines of about 18 characters. */
export function coverLines(title: string, width = 15, max = 3): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of title.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + word).length > width) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    lines.length = max;
    lines[max - 1] = `${lines[max - 1].slice(0, width - 1)}…`;
  }
  return lines.map((l) => (l.length > width + 4 ? `${l.slice(0, width + 3)}…` : l));
}

export function CaseCover({ id, title, category }: { id: number; title: string; category: CategorySlug }) {
  const t = useT();
  const lines = coverLines(title);
  const tilt = ((id * 7) % 9) - 4;
  return (
    <svg className="case-cover" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet" role="img" aria-label={title} data-testid="case-cover">
      <defs>
        <radialGradient id={`cc-bg-${id}`} cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor="#3a312a" />
          <stop offset="1" stopColor="#16120f" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#cc-bg-${id})`} />
      <rect x="8" y="8" width="304" height="184" fill="none" stroke="#5a4a3a" />
      <g transform="translate(22 30) scale(1.5)" fill="none" stroke="#d9c9a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
        <path d={MOTIFS[category] ?? MOTIFS.history} />
      </g>
      <text x="130" y="40" fill="#b9a98a" fontFamily="'Special Elite', 'Courier New', monospace" fontSize="12" letterSpacing="2">
        {t('cover.file', { n: String(id).padStart(4, '0') })}
      </text>
      {lines.map((line, i) => (
        <text key={i} x="130" y={78 + i * 24} fill="#efe3c6" fontFamily="'Special Elite', 'Courier New', monospace" fontSize="17">
          {line}
        </text>
      ))}
      <g transform={`rotate(${tilt} 240 166)`}>
        <rect x="178" y="150" width="124" height="30" rx="3" fill="none" stroke="#b3261e" strokeWidth="2.5" opacity="0.85" />
        <text x="240" y="171" textAnchor="middle" fill="#b3261e" fontFamily="'Special Elite', 'Courier New', monospace" fontSize="15" letterSpacing="3" opacity="0.85">
          {t('cover.stamp')}
        </text>
      </g>
    </svg>
  );
}
