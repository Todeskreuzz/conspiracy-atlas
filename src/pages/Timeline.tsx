import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { EventSummary } from '../../shared/types';
import { CATEGORY_SLUGS } from '../../shared/constants';
import { LoadState } from '../components/Unavailable';
import { CategoryBadge } from '../components/Badges';
import { eventDate } from './Events';

/** Converts an event date (YYYY, YYYY-MM or YYYY-MM-DD) to a fractional year. */
export function fractionalYear(date: string | null, fallbackYear: number): number {
  if (!date) return fallbackYear;
  const m = date.match(/^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return fallbackYear;
  const y = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : 0;
  const day = m[3] ? Number(m[3]) - 1 : 0;
  return y + (month * 30.4 + day) / 365;
}

export function tickStep(span: number): number {
  if (span > 400) return 100;
  if (span > 150) return 50;
  if (span > 60) return 10;
  if (span > 25) return 5;
  if (span > 8) return 1;
  return 1;
}

export interface LaidOutEvent {
  event: EventSummary;
  start: number;
  end: number;
  lane: number;
  /** True when no free lane was left: lane is -1 and the event is drawn on the axis without its label. */
  compact: boolean;
}

/** Assigns events to lanes so that labels do not overlap at the current scale. */
export function layoutLanes(events: EventSummary[], x: (year: number) => number, labelWidth = 240, maxLanes = 14): LaidOutEvent[] {
  const laneEnds: number[] = [];
  const out: LaidOutEvent[] = [];
  const sorted = [...events].sort((a, b) => fractionalYear(a.startDate, a.startYear) - fractionalYear(b.startDate, b.startYear));
  for (const ev of sorted) {
    const start = fractionalYear(ev.startDate, ev.startYear);
    const end = ev.endDate ? fractionalYear(ev.endDate, ev.endYear ?? ev.startYear) + (ev.endDate.length === 4 ? 1 : 0) : start;
    const left = x(start);
    const textWidth = Math.min(labelWidth, ev.title.length * 6.6 + 22);
    let lane = laneEnds.findIndex((e) => e < left);
    let compact = false;
    if (lane === -1 && laneEnds.length < maxLanes) lane = laneEnds.length;
    if (lane === -1) {
      // All lanes are taken: the event is drawn as a marker on the axis (zoom in to read it).
      compact = true;
    } else {
      laneEnds[lane] = Math.max(x(end), left + textWidth) + 8;
    }
    out.push({ event: ev, start, end, lane, compact });
  }
  return out;
}

const AXIS_PAD = 40;
const EVENT_COLOR = '#c9372c';
const LANE_H = 30;

export function TimelinePage() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const res = useAsync((signal) => api<{ items: EventSummary[] }>('/events', { signal }), [locale]);
  const [category, setCategory] = useState('');
  const [width, setWidth] = useState(1000);
  const [domain, setDomain] = useState<[number, number] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; domain: [number, number] } | null>(null);
  const selectedSlug = params.get('event');

  const events = useMemo(
    () => (res.data?.items ?? []).filter((e) => !category || e.category === category),
    [res.data, category],
  );
  const full = useMemo<[number, number]>(() => {
    const all = res.data?.items ?? [];
    if (!all.length) return [1700, 2030];
    const min = Math.min(...all.map((e) => e.startYear));
    const max = Math.max(...all.map((e) => e.endYear ?? e.startYear));
    const pad = Math.max(5, (max - min) * 0.04);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [res.data]);
  const [d0, d1] = domain ?? full;
  const span = d1 - d0;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [res.data]);

  const x = (year: number) => AXIS_PAD + ((year - d0) / span) * (width - AXIS_PAD * 2);
  const yearAt = (px: number) => d0 + ((px - AXIS_PAD) / (width - AXIS_PAD * 2)) * span;
  const laid = useMemo(() => layoutLanes(events, x), [events, d0, d1, width]); // eslint-disable-line react-hooks/exhaustive-deps
  const lanes = Math.max(1, ...laid.map((l) => l.lane + 1));
  const height = 80 + lanes * LANE_H + 40;
  const axisY = height - 46;
  const step = tickStep(span);
  const ticks: number[] = [];
  for (let y = Math.ceil(d0 / step) * step; y <= d1; y += step) ticks.push(y);

  const selected = (res.data?.items ?? []).find((e) => e.slug === selectedSlug) ?? null;
  const related = selected
    ? (res.data?.items ?? []).filter((e) => e.id !== selected.id && e.theoryIds.some((id) => selected.theoryIds.includes(id)))
    : [];
  const relatedIds = new Set(related.map((e) => e.id));

  const zoomTo = (newSpan: number, center = (d0 + d1) / 2) => {
    const s = Math.min(Math.max(newSpan, 4), full[1] - full[0] + 200);
    setDomain([center - s / 2, center + s / 2]);
  };
  const preset = (mode: 'centuries' | 'decades' | 'years') => {
    const center = selected ? fractionalYear(selected.startDate, selected.startYear) : (d0 + d1) / 2;
    if (mode === 'centuries') setDomain(null);
    else zoomTo(mode === 'decades' ? 60 : 12, center);
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const focusYear = yearAt(((e.clientX - rect.left) / rect.width) * width);
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const ns = Math.min(Math.max(span * factor, 4), full[1] - full[0] + 200);
    const ratio = (focusYear - d0) / span;
    setDomain([focusYear - ratio * ns, focusYear - ratio * ns + ns]);
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-event]')) return;
    drag.current = { x: e.clientX, domain: [d0, d1] };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dyears = ((e.clientX - drag.current.x) / rect.width) * (drag.current.domain[1] - drag.current.domain[0]) * (width / (width - AXIS_PAD * 2));
    setDomain([drag.current.domain[0] - dyears, drag.current.domain[1] - dyears]);
  };
  const select = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug) next.set('event', slug);
    else next.delete('event');
    setParams(next, { replace: true });
  };

  const laneY = (lane: number) => axisY - 34 - lane * LANE_H;

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.timeline')}</div>
        <h1>{t('timeline.title')}</h1>
        <p>{t('timeline.intro')}</p>
      </header>
      <div className="toolbar">
        <div className="field">
          <span className="label">{t('timeline.zoom')}</span>
          <div className="btn-row">
            <button className="btn btn--small" onClick={() => preset('centuries')}>
              {t('timeline.centuries')}
            </button>
            <button className="btn btn--small" onClick={() => preset('decades')}>
              {t('timeline.decades')}
            </button>
            <button className="btn btn--small" onClick={() => preset('years')}>
              {t('timeline.years')}
            </button>
            <button className="btn btn--small" aria-label={t('timeline.zoomIn')} onClick={() => zoomTo(span / 1.6)}>
              +
            </button>
            <button className="btn btn--small" aria-label={t('timeline.zoomOut')} onClick={() => zoomTo(span * 1.6)}>
              −
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="tl-cat">{t('archive.filterCategory')}</label>
          <select id="tl-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('app.all')}</option>
            {CATEGORY_SLUGS.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {res.data && (
        <div className="timeline-wrap" ref={wrapRef}>
          <svg
            className="timeline-svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            data-testid="timeline"
            role="img"
            aria-label={t('timeline.title')}
          >
            <line className="axis-line" x1={0} x2={width} y1={axisY} y2={axisY} />
            {ticks.map((year) => {
              const major = year % (step * 5) === 0 || step >= 50;
              return (
                <g key={year} className={`tick${major ? ' major' : ''}`} transform={`translate(${x(year)},0)`}>
                  <line y1={axisY} y2={axisY + (major ? 10 : 6)} />
                  <line y1={20} y2={axisY} strokeOpacity={major ? 0.25 : 0.1} />
                  <text y={axisY + 24} textAnchor="middle">
                    {year}
                  </text>
                </g>
              );
            })}
            {selected &&
              laid
                .filter((l) => relatedIds.has(l.event.id))
                .map((l) => {
                  const s = laid.find((q) => q.event.id === selected.id);
                  if (!s) return null;
                  const x1 = x(s.start);
                  const x2 = x(l.start);
                  const y1 = laneY(s.lane);
                  const y2 = laneY(l.lane);
                  return <path key={`link-${l.event.id}`} className="link-line" d={`M${x1},${y1} Q${(x1 + x2) / 2},${Math.min(y1, y2) - 40} ${x2},${y2}`} />;
                })}
            {laid.map((l) => {
              const isSel = selected?.id === l.event.id;
              const dim = selected && !isSel && !relatedIds.has(l.event.id);
              const cx = x(l.start);
              const nearEnd = cx + Math.min(240, l.event.title.length * 6.6 + 22) > width;
              const y = laneY(l.lane);
              const color = EVENT_COLOR;
              if (cx < -200 || cx > width + 200) return null;
              return (
                <g
                  key={l.event.id}
                  data-event={l.event.slug}
                  opacity={dim ? 0.3 : 1}
                  onClick={() => select(isSel ? null : l.event.slug)}
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${l.event.title}, ${eventDate(l.event, locale)}`}
                  onKeyDown={(e) => e.key === 'Enter' && select(l.event.slug)}
                >
                  <line x1={cx} x2={cx} y1={y} y2={axisY} stroke={color} strokeOpacity={0.35} />
                  {l.event.isPeriod && l.end > l.start ? (
                    <rect className={`event-period${isSel ? ' selected' : ''}`} x={cx} y={y - 6} width={Math.max(4, x(l.end) - cx)} height={12} rx={3} fill={color} />
                  ) : (
                    <circle className={`event-dot${isSel ? ' selected' : ''}`} cx={cx} cy={y} r={7} fill={color} />
                  )}
                  <title>{l.event.title}</title>
                  {!l.compact && (
                    <text className="event-label" x={nearEnd ? cx - 11 : cx + 11} y={y + 4} textAnchor={nearEnd ? 'end' : 'start'}>
                      {l.event.title.length > 34 ? `${l.event.title.slice(0, 32)}…` : l.event.title}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="grid grid--2" style={{ marginTop: 20 }}>
        <div className="paper" data-testid="timeline-detail">
          {!selected && <p className="muted">{t('timeline.selectEvent')}</p>}
          {selected && (
            <>
              <div className="mono small muted">{eventDate(selected, locale)}</div>
              <h2>
                <Link to={`/events/${selected.slug}`}>{selected.title}</Link>
              </h2>
              <div className="btn-row" style={{ marginBottom: 10 }}>
                <CategoryBadge category={selected.category} />
              </div>
              <p>{selected.description}</p>
              {selected.location && <p className="small muted">{selected.location.name}</p>}
            </>
          )}
        </div>
        {selected && (
          <div className="panel">
            <h3>{t('timeline.relatedEvents')}</h3>
            <ul className="list-plain small">
              {related.map((e) => (
                <li key={e.id}>
                  <span className="mono muted">{eventDate(e, locale)}</span> —{' '}
                  <button className="linklike" onClick={() => select(e.slug)}>
                    {e.title}
                  </button>
                </li>
              ))}
              {related.length === 0 && <li className="muted">{t('app.none')}</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
