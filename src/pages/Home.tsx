import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Paged, TheorySummary } from '../../shared/types';
import { TheoryCard } from '../components/TheoryCard';
import { LoadState } from '../components/Unavailable';
import { HeroBoard } from '../components/HeroBoard';
import { useI18n } from '../i18n';

interface CategoryRow {
  slug: string;
  theoryCount: number;
}

export function HomePage() {
  const t = useT();
  const { locale } = useI18n();
  const latest = useAsync((signal) => api<Paged<TheorySummary>>('/theories?pageSize=6', { signal }), [locale]);
  const cats = useAsync((signal) => api<{ items: CategoryRow[] }>('/categories', { signal }), []);
  const total = cats.data?.items.reduce((s, c) => s + c.theoryCount, 0);

  return (
    <>
      <section className="hero">
        <HeroBoard />
        <div className="hero__shade" />
        <div className="hero__content">
          <div className="typewriter" style={{ color: 'var(--yellow)', letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: '0.85rem' }}>
            {t('home.kicker')}
          </div>
          <h1>
            The Conspiracy <em>Atlas</em>
          </h1>
          <p className="hero__lead">{t('app.tagline')}</p>
          <p className="hero__lead" style={{ fontSize: '1rem' }}>
            {t('home.lead')}
          </p>
          <div className="btn-row" style={{ marginTop: 22 }}>
            <Link to="/wall" className="btn btn--primary">
              {t('home.openWall')}
            </Link>
            <Link to="/archive" className="btn btn--paper">
              {t('home.browseArchive')}
            </Link>
          </div>
          {total !== undefined && (
            <div className="hero__stats">
              <div>
                <strong>{total}</strong>
                {t('home.statsTheories')}
              </div>
              <div>
                <strong>{cats.data?.items.length}</strong>
                {t('home.categories')}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section container">
        <div className="section-title">
          <h2>{t('home.latest')}</h2>
          <Link to="/archive">{t('app.more')} →</Link>
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
            {cats.data.items.map((c) => (
              <Link key={c.slug} to={`/archive?category=${c.slug}`} className="category-tile">
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
