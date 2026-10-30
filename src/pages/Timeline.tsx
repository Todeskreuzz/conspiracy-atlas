import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { EventSummary, TimelineCase } from '../../shared/types';
import { CATEGORY_SLUGS, type CategorySlug, type EvidenceStatus } from '../../shared/constants';
import { LoadState } from '../components/Unavailable';
import { CATEGORY_COLORS, CategoryBadge } from '../components/Badges';
import { eventDate } from './Events';
import '../styles/timeline.css';

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

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/** Smallest tick step that leaves at least `minPx` pixels between two labels. */
export function tickStep(span: number, width = 1000, minPx = 74): number {
  return STEPS.find((s) => (s / span) * width >= minPx) ?? 1000;
}

/** One entry on the tape: a historical event (above the thread) or a case file (below it). */
export interface TimelineItem {
  key: string;
  kind: 'event' | 'case';
  id: number;
  slug: string;
  title: string;
  start: number;
  end: number;
  period: boolean;
  category: CategorySlug | null;
  evidenceStatus: EvidenceStatus;
  /** Events: the cases they belong to. Cases: their own id. */
  theoryIds: number[];
  imagePath: string | null;
  text: string | null;
  event?: EventSummary;
  case?: TimelineCase;
}

export function eventItem(ev: EventSummary): TimelineItem {
  const start = fractionalYear(ev.startDate, ev.startYear);
  const end = ev.endDate ? fractionalYear(ev.endDate, ev.endYear ?? ev.startYear) + (ev.endDate.length === 4 ? 1 : 0) : start;
  return {
    key: `e${ev.id}`,
    kind: 'event',
    id: ev.id,
    slug: ev.slug,
    title: ev.title,
    start,
    end,
    period: ev.isPeriod && end > start,
    category: ev.category,
    evidenceStatus: ev.evidenceStatus,
    theoryIds: ev.theoryIds,
    imagePath: null,
    text: ev.description,
    event: ev,
  };
}

export function caseItem(c: TimelineCase): TimelineItem {
  const end = c.endYear !== null ? c.endYear + 1 : c.startYear;
  return {
    key: `c${c.id}`,
    kind: 'case',
    id: c.id,
    slug: c.slug,
    title: c.title,
    start: c.startYear,
    end,
    period: end > c.startYear,
    category: c.category,
    evidenceStatus: c.evidenceStatus,
    theoryIds: [c.id],
    imagePath: c.imagePath,
    text: c.subtitle,
    case: c,
  };
}

export interface LaidOutItem {
  item: TimelineItem;
  lane: number;
  /** True when no free lane was left: the item is drawn as a notch on the thread (zoom in to read it). */
  compact: boolean;
}

/** Average glyph width of the label fonts (typewriter for events, sans for case folders). */
const glyph = (kind: TimelineItem['kind']) => (kind === 'event' ? 7.4 : 6.4);

/** The label as drawn (shortened to fit `max` pixels) and its width including the pin or folder edge. */
export function itemLabel(item: TimelineItem, max: number): { text: string; width: number } {
  const chars = Math.max(8, Math.floor((max - 26) / glyph(item.kind)));
  const text = item.title.length > chars ? `${item.title.slice(0, chars - 1)}…` : item.title;
  return { text, width: text.length * glyph(item.kind) + 26 };
}

/**
 * Assigns items to lanes so that labels do not overlap at the current scale. Labels that would run past
 * `maxX` are drawn to the left of their pin, and the lane check uses that side.
 */
export function layoutLanes(items: TimelineItem[], x: (year: number) => number, maxLabel = 240, maxLanes = 14, maxX = Infinity): LaidOutItem[] {
  const laneEnds: number[] = [];
  const out: LaidOutItem[] = [];
  const sorted = [...items].sort((a, b) => a.start - b.start);
  for (const item of sorted) {
    const left = x(item.start);
    const { width } = itemLabel(item, maxLabel);
    const flip = left + width > maxX;
    const from = flip ? left - width : left;
    let lane = laneEnds.findIndex((e) => e < from);
    if (lane === -1 && laneEnds.length < maxLanes) lane = laneEnds.length;
    if (lane === -1) {
      out.push({ item, lane: -1, compact: true });
      continue;
    }
    laneEnds[lane] = Math.max(x(item.end), flip ? left : left + width) + 10;
    out.push({ item, lane, compact: false });
  }
  return out;
}

const PAD = 36;
const EVENT_LANE = 30;
const CASE_LANE = 32;
const AXIS_BAND = 64;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A split-flap year display: each digit flips when it changes. */
function FlipYear({ year, label }: { year: number; label: string }) {
  const text = String(Math.abs(Math.round(year))).padStart(4, '0');
  return (
    <div className="flipyear" role="img" aria-label={`${label}: ${Math.round(year)}`}>
      {year < 0 && <span className="flipyear__sign">−</span>}
      {[...text].map((d, i) => (
        <span className="flipyear__cell" key={i} aria-hidden="true">
          <span className="flipyear__digit" key={d}>
            {d}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Mirrored density strip of the whole archive with a brush for the visible window. */
function Overview({
  items,
  full,
  domain,
  onMove,
  label,
}: {
  items: TimelineItem[];
  full: [number, number];
  domain: [number, number];
  onMove: (center: number) => void;
  label: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(1000);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 64;
  const bins = Math.max(40, Math.min(160, Math.floor(w / 7)));
  const span = full[1] - full[0];
  const { ev, cs, max } = useMemo(() => {
    const ev = new Array<number>(bins).fill(0);
    const cs = new Array<number>(bins).fill(0);
    for (const it of items) {
      const b = Math.min(bins - 1, Math.max(0, Math.floor(((it.start - full[0]) / span) * bins)));
      (it.kind === 'event' ? ev : cs)[b]++;
    }
    return { ev, cs, max: Math.max(1, ...ev, ...cs) };
  }, [items, full, span, bins]);
  const bw = w / bins;
  const sx = (y: number) => ((y - full[0]) / span) * w;
  const bx0 = Math.max(0, sx(domain[0]));
  const bx1 = Math.min(w, sx(domain[1]));
  const drag = useRef(false);
  const move = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    onMove(full[0] + ((clientX - r.left) / r.width) * span);
  };
  return (
    <div className="chron-overview">
      <span className="chron-overview__label">{label}</span>
      <svg
        ref={ref}
        className="chron-overview__svg"
        viewBox={`0 0 ${w} ${H}`}
        preserveAspectRatio="none"
        height={H}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={Math.round(full[0])}
        aria-valuemax={Math.round(full[1])}
        aria-valuenow={Math.round((domain[0] + domain[1]) / 2)}
        onKeyDown={(e) => {
          const c = (domain[0] + domain[1]) / 2;
          const d = (domain[1] - domain[0]) / 4;
          if (e.key === 'ArrowLeft') onMove(c - d);
          if (e.key === 'ArrowRight') onMove(c + d);
        }}
        onPointerDown={(e) => {
          drag.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => drag.current && move(e.clientX)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
      >
        <line x1={0} x2={w} y1={H / 2} y2={H / 2} className="chron-overview__mid" />
        {ev.map((n, i) =>
          n ? <rect key={`e${i}`} className="chron-overview__ev" x={i * bw + 0.5} width={Math.max(1, bw - 1)} y={H / 2 - 2 - (n / max) * (H / 2 - 6)} height={(n / max) * (H / 2 - 6)} /> : null,
        )}
        {cs.map((n, i) =>
          n ? <rect key={`c${i}`} className="chron-overview__cs" x={i * bw + 0.5} width={Math.max(1, bw - 1)} y={H / 2 + 2} height={(n / max) * (H / 2 - 6)} /> : null,
        )}
        <rect className="chron-overview__brush" x={bx0} width={Math.max(6, bx1 - bx0)} y={1} height={H - 2} rx={3} />
      </svg>
      <span className="chron-overview__ends mono">
        <span>{Math.round(full[0])}</span>
        <span>{Math.round(full[1])}</span>
      </span>
    </div>
  );
}

export function TimelinePage() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const res = useAsync(
    (signal) =>
      Promise.all([
        api<{ items: EventSummary[] }>('/events', { signal }),
        api<{ items: TimelineCase[] }>('/timeline/cases', { signal }).catch(() => ({ items: [] as TimelineCase[] })),
      ]),
    [locale],
  );
  const [category, setCategory] = useState('');
  const [showEvents, setShowEvents] = useState(true);
  const [showCases, setShowCases] = useState(true);
  const [width, setWidth] = useState(1000);
  const [domain, setDomainState] = useState<[number, number] | null>(null);
  const [hover, setHover] = useState<{ item: TimelineItem; x: number; y: number } | null>(null);
  const [hint, setHint] = useState(false);
  const [intro, setIntro] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, number>());
  const gesture = useRef<{ x: number; dist: number; domain: [number, number] } | null>(null);
  const tween = useRef(0);
  const hintTimer = useRef(0);

  const allItems = useMemo(() => {
    if (!res.data) return [];
    const [events, cases] = res.data;
    return [...events.items.map(eventItem), ...cases.items.map(caseItem)];
  }, [res.data]);
  const visible = useMemo(
    () => allItems.filter((i) => (!category || i.category === category) && (i.kind === 'event' ? showEvents : showCases)),
    [allItems, category, showEvents, showCases],
  );
  const full = useMemo<[number, number]>(() => {
    if (!allItems.length) return [1700, 2030];
    const min = Math.min(...allItems.map((i) => i.start));
    const max = Math.max(new Date().getFullYear(), ...allItems.map((i) => i.end));
    const pad = Math.max(5, (max - min) * 0.04);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [allItems]);
  const [d0, d1] = domain ?? full;
  const span = d1 - d0;
  const maxSpan = full[1] - full[0] + 200;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(300, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [res.data]);
  useEffect(() => {
    if (!res.data) return;
    const id = window.setTimeout(() => setIntro(false), 2200);
    return () => window.clearTimeout(id);
  }, [res.data]);
  useEffect(() => () => {
    cancelAnimationFrame(tween.current);
    window.clearTimeout(hintTimer.current);
  }, []);

  const narrow = width < 640;
  const maxLabel = narrow ? 190 : 250;
  const x = useCallback((year: number) => PAD + ((year - d0) / span) * (width - PAD * 2), [d0, span, width]);
  const yearAt = (px: number) => d0 + ((px - PAD) / (width - PAD * 2)) * span;

  const clampSpan = (s: number) => Math.min(Math.max(s, 3), maxSpan);
  const setDomain = (next: [number, number] | null) => {
    cancelAnimationFrame(tween.current);
    setDomainState(next);
  };
  /** Eases the visible window to `target` (instant with reduced motion). */
  const animateTo = (target: [number, number]) => {
    cancelAnimationFrame(tween.current);
    if (reducedMotion()) return setDomainState(target);
    const from: [number, number] = [d0, d1];
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 520);
      const e = 1 - Math.pow(1 - p, 3);
      setDomainState([from[0] + (target[0] - from[0]) * e, from[1] + (target[1] - from[1]) * e]);
      if (p < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  };
  const zoomAround = (factor: number, focus = (d0 + d1) / 2, animate = true) => {
    const ns = clampSpan(span * factor);
    const ratio = (focus - d0) / span;
    const next: [number, number] = [focus - ratio * ns, focus - ratio * ns + ns];
    if (animate) animateTo(next);
    else setDomain(next);
  };

  const evLaid = useMemo(
    () => layoutLanes(visible.filter((i) => i.kind === 'event'), x, maxLabel, narrow ? 6 : 9, width - 6),
    [visible, x, narrow, maxLabel, width],
  );
  const csLaid = useMemo(
    () => layoutLanes(visible.filter((i) => i.kind === 'case'), x, maxLabel, narrow ? 6 : 9, width - 6),
    [visible, x, narrow, maxLabel, width],
  );
  const evLanes = Math.max(2, ...evLaid.map((l) => l.lane + 1));
  const csLanes = Math.max(showCases ? 2 : 0, ...csLaid.map((l) => l.lane + 1));
  const top = 34;
  const axisY = top + evLanes * EVENT_LANE + AXIS_BAND / 2;
  const height = axisY + AXIS_BAND / 2 + csLanes * CASE_LANE + 26;
  const evY = (lane: number) => axisY - AXIS_BAND / 2 - 4 - lane * EVENT_LANE;
  const csY = (lane: number) => axisY + AXIS_BAND / 2 + 8 + lane * CASE_LANE;
  const step = tickStep(span, width - PAD * 2);
  const major = step * (step >= 100 ? 5 : step >= 10 ? 5 : 10);
  const ticks: number[] = [];
  for (let y = Math.ceil(d0 / step) * step; y <= d1; y += step) ticks.push(y);
  const bands: number[] = [];
  for (let y = Math.floor(d0 / major) * major; y <= d1; y += major) bands.push(y);

  const selectedSlug = params.get('event') ?? params.get('case');
  const selectedKind = params.get('event') ? 'event' : params.get('case') ? 'case' : null;
  const selected = allItems.find((i) => i.kind === selectedKind && i.slug === selectedSlug) ?? null;
  const related = useMemo(() => {
    if (!selected) return [];
    return allItems.filter((i) => i.key !== selected.key && i.theoryIds.some((id) => selected.theoryIds.includes(id)));
  }, [allItems, selected]);
  const relatedKeys = new Set(related.map((i) => i.key));

  const select = (item: TimelineItem | null) => {
    const next = new URLSearchParams(params);
    next.delete('event');
    next.delete('case');
    if (item) next.set(item.kind, item.slug);
    setParams(next, { replace: true });
  };
  const focusItem = (item: TimelineItem) => {
    select(item);
    const c = (item.start + item.end) / 2;
    const s = Math.min(span, Math.max(30, (item.end - item.start) * 3));
    animateTo([c - s / 2, c + s / 2]);
  };

  const preset = (mode: 'centuries' | 'decades' | 'years') => {
    const center = selected ? selected.start : (d0 + d1) / 2;
    if (mode === 'centuries') animateTo(full);
    else animateTo(mode === 'decades' ? [center - 30, center + 30] : [center - 6, center + 6]);
  };

  // Wheel: horizontal scroll pans; Ctrl/⌘ + wheel (and trackpad pinch) zooms. Plain wheel only zooms once the
  // tape has focus, so scrolling down the page never gets trapped.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      const rect = svg.getBoundingClientRect();
      const engaged = e.ctrlKey || e.metaKey || !!wrapRef.current?.contains(document.activeElement);
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const dy = (e.deltaX / rect.width) * span;
        setDomain([d0 + dy, d1 + dy]);
        return;
      }
      if (!engaged) {
        setHint(true);
        window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHint(false), 1600);
        return;
      }
      e.preventDefault();
      const focus = yearAt(((e.clientX - rect.left) / rect.width) * width);
      zoomAround(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), focus, false);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-item]')) return;
    pointers.current.set(e.pointerId, e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
    const xs = [...pointers.current.values()];
    gesture.current = { x: xs.reduce((a, b) => a + b, 0) / xs.length, dist: xs.length > 1 ? Math.abs(xs[0] - xs[1]) : 0, domain: [d0, d1] };
    cancelAnimationFrame(tween.current);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, e.clientX);
    const rect = e.currentTarget.getBoundingClientRect();
    const xs = [...pointers.current.values()];
    const g = gesture.current;
    const gSpan = g.domain[1] - g.domain[0];
    const perPx = gSpan / (rect.width * ((width - PAD * 2) / width));
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    // Position of a screen x inside the plotted range (0 = left end, 1 = right end).
    const frac = (clientX: number) => (((clientX - rect.left) / rect.width) * width - PAD) / (width - PAD * 2);
    if (xs.length > 1 && g.dist > 10) {
      // pinch: the year under the starting midpoint stays under the fingers
      const ns = clampSpan(gSpan * (g.dist / Math.max(10, Math.abs(xs[0] - xs[1]))));
      const focus = g.domain[0] + frac(g.x) * gSpan;
      const start = focus - frac(cx) * ns;
      setDomainState([start, start + ns]);
    } else {
      const dyears = (cx - g.x) * perPx;
      setDomainState([g.domain[0] - dyears, g.domain[1] - dyears]);
    }
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    const xs = [...pointers.current.values()];
    gesture.current = xs.length ? { x: xs[0], dist: 0, domain: [d0, d1] } : null;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('[data-item]') && e.key !== 'Escape') return;
    const d = span / 8;
    if (e.key === 'ArrowLeft') setDomain([d0 - d, d1 - d]);
    else if (e.key === 'ArrowRight') setDomain([d0 + d, d1 + d]);
    else if (e.key === '+' || e.key === '=') zoomAround(1 / 1.5);
    else if (e.key === '-' || e.key === '_') zoomAround(1.5);
    else if (e.key === 'Escape') select(null);
    else return;
    e.preventDefault();
  };

  const showHover = (item: TimelineItem, e: React.PointerEvent | React.FocusEvent) => {
    if ('pointerType' in e && e.pointerType === 'touch') return;
    const wrap = wrapRef.current!.getBoundingClientRect();
    const target = (e.currentTarget as Element).getBoundingClientRect();
    setHover({ item, x: target.left + target.width / 2 - wrap.left, y: target.top - wrap.top });
  };

  const inView = visible.filter((i) => i.end >= d0 && i.start <= d1);
  const inViewEvents = inView.filter((i) => i.kind === 'event').length;
  const today = new Date().getFullYear();
  const selLaid = selected ? [...evLaid, ...csLaid].find((l) => l.item.key === selected.key) : null;
  const itemY = (l: LaidOutItem) => (l.item.kind === 'event' ? (l.compact ? axisY - 6 : evY(l.lane)) : l.compact ? axisY + 6 : csY(l.lane) + 9);
  const cases = res.data?.[1].items.length ?? 0;
  const dateLabel = (i: TimelineItem) =>
    i.event ? eventDate(i.event, locale) : i.case!.endYear ? `${i.case!.startYear} – ${i.case!.endYear}` : String(i.case!.startYear);

  const renderItem = (l: LaidOutItem, order: number) => {
    const { item } = l;
    const isSel = selected?.key === item.key;
    const isRel = relatedKeys.has(item.key);
    const dim = !!selected && !isSel && !isRel;
    const cx = x(item.start);
    if (x(item.end) < -260 || cx > width + 40) return null;
    const color = item.kind === 'case' ? (item.category ? CATEGORY_COLORS[item.category] : '#8a5a2b') : undefined;
    const { text: label, width: lw } = itemLabel(item, maxLabel);
    const flip = cx + lw > width - 6;
    const cls = `chron-item chron-item--${item.kind}${isSel ? ' is-selected' : ''}${isRel ? ' is-related' : ''}${dim ? ' is-dim' : ''}${l.compact ? ' is-compact' : ''}`;
    const common = {
      'data-item': item.key,
      className: cls,
      tabIndex: l.compact ? -1 : 0,
      role: 'button',
      'aria-pressed': isSel,
      'aria-label': `${item.kind === 'case' ? t('timeline.case') : t('timeline.event')}: ${item.title}, ${dateLabel(item)}`,
      onClick: () => select(isSel ? null : item),
      onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(isSel ? null : item)),
      onPointerEnter: (e: React.PointerEvent) => showHover(item, e),
      onPointerLeave: () => setHover(null),
      onFocus: (e: React.FocusEvent) => showHover(item, e),
      onBlur: () => setHover(null),
      style: { '--i': Math.min(order, 40), '--cat': color } as React.CSSProperties,
    };
    if (l.compact) {
      return (
        <g key={item.key} {...common}>
          <line className="chron-notch" x1={cx} x2={cx} y1={item.kind === 'event' ? axisY - 12 : axisY + 4} y2={item.kind === 'event' ? axisY - 4 : axisY + 12} />
        </g>
      );
    }
    if (item.kind === 'event') {
      const y = evY(l.lane);
      return (
        <g key={item.key} {...common}>
          <line className="chron-drop" x1={cx} x2={cx} y1={y} y2={axisY} />
          {item.period && <rect className="chron-ribbon" x={cx} y={y - 5} width={Math.max(6, x(item.end) - cx)} height={10} rx={2} />}
          <text className="chron-label" x={flip ? cx - 12 : cx + 12} y={y + 4} textAnchor={flip ? 'end' : 'start'}>
            {label}
          </text>
          <circle className="chron-pin__shadow" cx={cx + 2} cy={y + 3} r={7} />
          <circle className="chron-pin" cx={cx} cy={y} r={7} />
          <circle className="chron-pin__shine" cx={cx - 2.2} cy={y - 2.4} r={2.2} />
        </g>
      );
    }
    const y = csY(l.lane);
    const bw = Math.max(lw, x(item.end) - cx);
    const fx = flip ? cx - lw : cx;
    return (
      <g key={item.key} {...common}>
        <line className="chron-drop chron-drop--case" x1={cx} x2={cx} y1={axisY} y2={y} />
        {item.period && <rect className="chron-span" x={cx} y={y + 22} width={Math.max(4, x(item.end) - cx)} height={4} rx={2} />}
        <path
          className="chron-folder"
          d={`M${fx} ${y + 4} h10 l3 -4 h${Math.min(46, lw / 3)} l3 4 H${fx + (flip ? lw : Math.min(bw, lw))} v16 H${fx} Z`}
        />
        <rect className="chron-folder__edge" x={fx} y={y + 4} width={3} height={16} />
        <text className="chron-label chron-label--case" x={fx + 9} y={y + 16}>
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="container page chronicle">
      <header className="page-header">
        <div className="kicker">{t('nav.timeline')}</div>
        <h1>{t('timeline.title')}</h1>
        <p>{t('timeline.intro')}</p>
      </header>

      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {res.data && (
        <>
          <section className="chron-console" aria-label={t('timeline.controls')}>
            <div className="chron-readout">
              <FlipYear year={(d0 + d1) / 2} label={t('timeline.centerYear')} />
              <div className="chron-readout__meta">
                <span className="chron-readout__range mono">
                  {Math.round(d0)} — {Math.round(d1)}
                </span>
                <span className="chron-readout__count" aria-live="polite">
                  {t('timeline.inView', { events: inViewEvents, cases: inView.length - inViewEvents })}
                </span>
              </div>
            </div>
            <div className="chron-controls">
              <div className="chron-seg" role="group" aria-label={t('timeline.zoom')}>
                <button type="button" onClick={() => preset('centuries')}>
                  {t('timeline.centuries')}
                </button>
                <button type="button" onClick={() => preset('decades')}>
                  {t('timeline.decades')}
                </button>
                <button type="button" onClick={() => preset('years')}>
                  {t('timeline.years')}
                </button>
                <button type="button" className="chron-seg__icon" aria-label={t('timeline.zoomIn')} onClick={() => zoomAround(1 / 1.6)}>
                  +
                </button>
                <button type="button" className="chron-seg__icon" aria-label={t('timeline.zoomOut')} onClick={() => zoomAround(1.6)}>
                  −
                </button>
              </div>
              <div className="chron-layers" role="group" aria-label={t('timeline.layers')}>
                <button type="button" className="chron-toggle chron-toggle--event" aria-pressed={showEvents} onClick={() => setShowEvents((v) => !v)}>
                  <span aria-hidden="true" /> {t('timeline.events')}
                </button>
                <button type="button" className="chron-toggle chron-toggle--case" aria-pressed={showCases} onClick={() => setShowCases((v) => !v)}>
                  <span aria-hidden="true" /> {t('timeline.cases')} <small>{cases}</small>
                </button>
              </div>
              <label className="chron-select">
                <span className="sr-only">{t('archive.filterCategory')}</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('archive.filterCategory')}>
                  <option value="">{t('timeline.allCategories')}</option>
                  {CATEGORY_SLUGS.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <div
            className={`chron-tape${intro ? ' is-intro' : ''}`}
            ref={wrapRef}
            tabIndex={0}
            role="region"
            aria-label={`${t('timeline.title')}. ${t('timeline.keys')}`}
            onKeyDown={onKeyDown}
          >
            <svg
              ref={svgRef}
              className="chron-svg"
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              data-testid="timeline"
            >
              <defs>
                <linearGradient id="chron-thread" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#e2554a" />
                  <stop offset="0.5" stopColor="#a3221a" />
                  <stop offset="1" stopColor="#6e140f" />
                </linearGradient>
                <radialGradient id="chron-pin" cx="0.35" cy="0.3" r="0.8">
                  <stop offset="0" stopColor="#ff8a7a" />
                  <stop offset="0.45" stopColor="#d23a2f" />
                  <stop offset="1" stopColor="#7c150e" />
                </radialGradient>
              </defs>
              {bands.map((y, i) => {
                const bx = x(y);
                const bw = x(y + major) - bx;
                return (
                  <g key={`band${y}`} className="chron-band">
                    {i % 2 === 0 && <rect x={bx} y={0} width={bw} height={height} className="chron-band__fill" />}
                    {bw > 120 && (
                      <text className="chron-band__mark" x={bx + 10} y={height - 14}>
                        {y}
                      </text>
                    )}
                  </g>
                );
              })}
              {ticks.map((year) => {
                const isMajor = year % major === 0;
                return (
                  <g key={year} className={`chron-tick${isMajor ? ' is-major' : ''}`} transform={`translate(${x(year)},0)`}>
                    <line className="chron-tick__grid" y1={12} y2={height - 8} />
                    <line className="chron-tick__mark" y1={axisY - (isMajor ? 9 : 5)} y2={axisY + (isMajor ? 9 : 5)} />
                    <text y={axisY + 23} textAnchor="middle">
                      {year}
                    </text>
                  </g>
                );
              })}
              {today >= d0 && today <= d1 && (
                <g className="chron-today" transform={`translate(${x(today)},0)`}>
                  <line y1={14} y2={height - 10} />
                  <text y={24} x={-5} textAnchor="end">
                    {t('timeline.today')}
                  </text>
                </g>
              )}
              <path className="chron-thread__shadow" d={`M0 ${axisY + 3} Q ${width / 2} ${axisY + 6} ${width} ${axisY + 3}`} />
              <path className="chron-thread" d={`M0 ${axisY} Q ${width / 2} ${axisY + 3} ${width} ${axisY}`} />
              <text className="chron-side chron-side--top" x={12} y={22}>
                {t('timeline.events')}
              </text>
              {showCases && (
                <text className="chron-side chron-side--bottom" x={12} y={height - 8}>
                  {t('timeline.cases')}
                </text>
              )}
              {selected &&
                selLaid &&
                [...evLaid, ...csLaid]
                  .filter((l) => relatedKeys.has(l.item.key))
                  .map((l) => {
                    const x1 = x(selected.start);
                    const x2 = x(l.item.start);
                    const y1 = itemY(selLaid);
                    const y2 = itemY(l);
                    const lift = Math.min(90, Math.abs(x2 - x1) / 3 + 20);
                    const cy = selected.kind === l.item.kind ? Math.min(y1, y2) - lift * (selected.kind === 'event' ? 1 : -1) : (y1 + y2) / 2;
                    return <path key={`s${l.item.key}`} className="chron-string" pathLength={1} d={`M${x1},${y1} Q${(x1 + x2) / 2},${cy} ${x2},${y2}`} />;
                  })}
              {csLaid.map((l, i) => renderItem(l, i))}
              {evLaid.map((l, i) => renderItem(l, i))}
            </svg>
            {hover && (
              <div
                className={`chron-hovercard chron-hovercard--${hover.item.kind}`}
                style={{ left: Math.min(Math.max(hover.x, 130), width - 130), top: hover.y }}
                aria-hidden="true"
              >
                {hover.item.imagePath && <img src={hover.item.imagePath} alt="" loading="lazy" />}
                <div className="chron-hovercard__date">{dateLabel(hover.item)}</div>
                <div className="chron-hovercard__title">{hover.item.title}</div>
                {hover.item.text && <div className="chron-hovercard__text">{hover.item.text}</div>}
              </div>
            )}
            <div className={`chron-hint${hint ? ' is-on' : ''}`} aria-hidden="true">
              {t('timeline.wheelHint')}
            </div>
          </div>

          <Overview items={visible} full={full} domain={[d0, d1]} label={t('timeline.overview')} onMove={(c) => setDomain([c - span / 2, c + span / 2])} />

          <div className="chron-detail">
            <article className={`indexcard${selected ? ' is-filled' : ''}`} data-testid="timeline-detail" key={selected?.key ?? 'none'}>
              {!selected && <p className="indexcard__empty">{t('timeline.selectEvent')}</p>}
              {selected && (
                <>
                  <div className="indexcard__head">
                    <span className="indexcard__kind">{selected.kind === 'case' ? t('timeline.case') : t('timeline.event')}</span>
                    <span className="indexcard__date">{dateLabel(selected)}</span>
                  </div>
                  {selected.imagePath && <img className="indexcard__img" src={selected.imagePath} alt="" loading="lazy" />}
                  <h2>
                    <Link to={selected.kind === 'case' ? `/theory/${selected.slug}` : `/events/${selected.slug}`}>{selected.title}</Link>
                  </h2>
                  <div className="btn-row indexcard__badges">
                    <CategoryBadge category={selected.category} />
                  </div>
                  {selected.text && <p>{selected.text}</p>}
                  {selected.event?.location && <p className="small muted">⌖ {selected.event.location.name}</p>}
                  {selected.case && <p className="small muted indexcard__source">{t(selected.case.yearSource === 'wikidata' ? 'timeline.yearWikidata' : 'timeline.yearEvents')}</p>}
                  <div className="btn-row">
                    <Link className="btn btn--primary btn--small" to={selected.kind === 'case' ? `/theory/${selected.slug}` : `/events/${selected.slug}`}>
                      {t(selected.kind === 'case' ? 'timeline.openCase' : 'timeline.openEvent')} →
                    </Link>
                    <button type="button" className="btn btn--small" onClick={() => focusItem(selected)}>
                      {t('timeline.focus')}
                    </button>
                  </div>
                </>
              )}
            </article>
            {selected && (
              <aside className="chron-related">
                <h3>{t('timeline.relatedEvents')}</h3>
                <ol className="chron-related__list">
                  {related
                    .sort((a, b) => a.start - b.start)
                    .map((i) => (
                      <li key={i.key} className={`chron-related__item chron-related__item--${i.kind}`}>
                        <span className="mono">{dateLabel(i)}</span>
                        <button type="button" className="linklike" onClick={() => focusItem(i)}>
                          {i.title}
                        </button>
                      </li>
                    ))}
                  {related.length === 0 && <li className="muted">{t('app.none')}</li>}
                </ol>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
