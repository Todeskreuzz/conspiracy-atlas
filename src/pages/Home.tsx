import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Paged, TheorySummary } from '../../shared/types';
import { TheoryCard } from '../components/TheoryCard';
import { LoadState } from '../components/Unavailable';
import { TallySheet } from '../components/TallySheet';
import { useCountUp } from '../hooks/useCountUp';
import { useI18n } from '../i18n';

interface CategoryRow {
  slug: string;
  theoryCount: number;
}

// Red thread between the pins of the case file and the tally sheet, measured from the live layout.
function useThread(ready: boolean) {
  const grid = useRef<HTMLDivElement>(null);
  const [d, setD] = useState('');
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el || !ready) return;
    const measure = () => {
      const [a, b] = el.querySelectorAll(':scope > .hero__file > .pin, :scope > .hero__side .tally > .pin');
      if (!a || !b) return setD('');
      const o = el.getBoundingClientRect();
      const p = a.getBoundingClientRect();
      const q = b.getBoundingClientRect();
      const x1 = p.left + p.width / 2 - o.left;
      const y1 = p.top + p.height / 2 - o.top;
      const x2 = q.left + q.width / 2 - o.left;
      const y2 = q.top + q.height / 2 - o.top;
      const sag = Math.max(30, Math.abs(x2 - x1) * 0.35);
      setD(`M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.3} ${y1 + sag}, ${x1 + (x2 - x1) * 0.7} ${y2 + sag}, ${x2} ${y2}`);
    };
    measure();
    // entrance animations move the pins, so measure again once they settle
    el.addEventListener('animationend', measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      el.removeEventListener('animationend', measure);
      ro?.disconnect();
    };
  }, [ready]);
  return { grid, d };
}

export function HomePage() {
  const t = useT();
  const { locale } = useI18n();
  const latest = useAsync((signal) => api<Paged<TheorySummary>>('/theories?pageSize=6', { signal }), [locale]);
  const cats = useAsync((signal) => api<{ items: CategoryRow[] }>('/categories', { signal }), []);
  const total = cats.data?.items.reduce((s, c) => s + c.theoryCount, 0);
  const shownTotal = useCountUp(total);
  const shownCats = useCountUp(cats.data?.items.length);
  const thread = useThread(!!cats.data);

  return (
    <>
      <section className="hero">
        <div className="hero__grid" ref={thread.grid}>
          {thread.d && (
            <svg className="hero__thread" aria-hidden="true">
              <path d={thread.d} />
            </svg>
          )}
          <div className="hero__file" data-tab={t('home.fileTab')}>
            <span className="pin" aria-hidden="true" />
            <span className="stamp hero__stamp">{t('home.stamp')}</span>
            <div className="hero__kicker">{t('home.kicker')}</div>
            <h1>
              The Conspiracy <em>Atlas</em>
            </h1>
            <p className="hero__lead">{t('app.tagline')}</p>
            <p className="hero__lead" style={{ fontSize: '1rem' }}>
              {t('home.lead')}
            </p>
            <div className="btn-row" style={{ marginTop: 22 }}>
              <Link to="/wall" className="btn btn--primary" viewTransition>
                {t('home.openWall')}
              </Link>
              <Link to="/archive" className="btn btn--paper" viewTransition>
                {t('home.browseArchive')}
              </Link>
            </div>
            {total !== undefined && (
              <div className="hero__stats">
                <div>
                  <strong>{shownTotal}</strong>
                  {t('home.statsTheories')}
                </div>
                <div>
                  <strong>{shownCats}</strong>
                  {t('home.categories')}
                </div>
              </div>
            )}
          </div>
          <div className="hero__side">
            {cats.data && <TallySheet rows={cats.data.items} />}
            <div className="sticky" aria-hidden="true">
              {t('home.sticky')}
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-title">
          <h2>{t('home.latest')}</h2>
          <Link to="/archive" viewTransition>
            {t('app.more')} →
          </Link>
        </div>
        <LoadState loading={latest.loading} error={latest.error} onRetry={latest.reload} />
        {latest.data && (
          <div className="grid grid--cards">
            {latest.data.items.map((th) => (
              <TheoryCard key={th.id} theory={th} />
            ))}
          </div>
        )}
      </section>

      <section className="section container">
        <h2>{t('home.categories')}</h2>
        <LoadState loading={cats.loading} error={cats.error} onRetry={cats.reload} />
        {cats.data && (
          <div className="category-tiles">
            {cats.data.items.map((c, i) => (
              <Link key={c.slug} to={`/archive?category=${c.slug}`} className="category-tile" style={{ ['--i' as string]: i }}>
                <span>{t(`categories.${c.slug}`)}</span>
                <span>{c.theoryCount}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section container">
        <h2>{t('home.principles')}</h2>
        <div className="grid grid--3 principles">
          {(['p1', 'p2', 'p3'] as const).map((p) => (
            <div className="panel" key={p}>
              <h3>{t(`home.${p}Title`)}</h3>
              <p className="muted">{t(`home.${p}Text`)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
