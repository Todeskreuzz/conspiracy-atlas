import { Link } from 'react-router-dom';
import { useT } from '../i18n';

const INKS = ['#1f4e8c', '#b3261e', '#c2621a', '#2f7d4a', '#6b3fa0', '#1f6f7a'];

const GROUP_WIDTH = 34;

// Hand-drawn tally marks: groups of four strokes crossed by a fifth. The drawing always fits its fixed
// column (it scales down when there are many marks), so every row keeps the same layout.
function Marks({ count, delay }: { count: number; delay: number }) {
  const groups = Math.ceil(count / 5);
  const width = Math.max(groups * GROUP_WIDTH - 8, 26);
  const lines = [];
  for (let i = 0; i < count; i++) {
    const g = Math.floor(i / 5);
    const k = i % 5;
    const x = g * GROUP_WIDTH;
    const j = ((i * 7) % 5) * 0.4 - 0.8; // slight hand wobble, deterministic
    lines.push(
      k < 4 ? (
        <line key={i} x1={x + k * 6 + 2 + j} y1={3} x2={x + k * 6 + 1} y2={20} style={{ ['--d' as string]: delay + i }} />
      ) : (
        <line key={i} x1={x - 3} y1={16} x2={x + 25} y2={6} style={{ ['--d' as string]: delay + i }} />
      ),
    );
  }
  return (
    <svg className="tally__marks" viewBox={`-4 0 ${width + 4} 22`} preserveAspectRatio="xMinYMid meet" aria-hidden="true">
      {lines}
    </svg>
  );
}

export function TallySheet({ rows }: { rows: Array<{ slug: string; theoryCount: number }> }) {
  const t = useT();
  const total = rows.reduce((s, r) => s + r.theoryCount, 0);
  let delay = 0;
  return (
    <div className="tally">
      <span className="pin" aria-hidden="true" />
      <h2 className="tally__title">{t('home.tallyTitle')}</h2>
      <div className="tally__sub">{t('home.tallySub', { count: total })}</div>
      <ul className="tally__rows">
        {rows.map((r, i) => {
          // Drawing delay is capped so a big category does not make the others appear late.
          const d = Math.min(delay, 60);
          delay += r.theoryCount;
          return (
            <li key={r.slug} className="tally__row" style={{ color: INKS[i % INKS.length] }}>
              <Link to={`/archive?category=${r.slug}`}>{t(`categories.${r.slug}`)}</Link>
              <Marks count={r.theoryCount} delay={d} />
              <span className="tally__num">{r.theoryCount}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
