import { Link, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { usePageMeta } from '../hooks/usePageMeta';
import { api } from '../api/client';
import type { EventSummary, Relationship } from '../../shared/types';
import { LoadState } from '../components/Unavailable';
import { CategoryBadge } from '../components/Badges';
import { RelationshipList } from './Theory';

export function eventDate(ev: EventSummary, locale: 'en' | 'de') {
  const start = formatDate(ev.startDate ?? String(ev.startYear), locale);
  return ev.endDate ? `${start} – ${formatDate(ev.endDate, locale)}` : start;
}

export function EventsPage() {
  const { t, locale } = useI18n();
  const res = useAsync((signal) => api<{ items: EventSummary[] }>('/events', { signal }), [locale]);
  const byCentury = useMemo(() => {
    const groups = new Map<number, EventSummary[]>();
    for (const e of res.data?.items ?? []) {
      const c = Math.floor(e.startYear / 100) + 1;
      groups.set(c, [...(groups.get(c) ?? []), e]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [res.data]);
  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.events')}</div>
        <h1>{t('events.title')}</h1>
        <p>{t('events.intro')}</p>
        <Link to="/timeline" className="btn btn--small">
          {t('nav.timeline')} →
        </Link>
      </header>
      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {byCentury.map(([century, events]) => (
        <section key={century} style={{ marginBottom: 28 }}>
          <h2 className="typewriter" style={{ fontSize: '1.1rem', color: 'var(--yellow)' }}>
            {locale === 'de' ? `${century}. Jahrhundert` : `${century}th century`}
          </h2>
          <ul className="list-plain">
            {events.map((e) => (
              <li key={e.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 200px) 1fr', gap: 12 }}>
                <span className="mono small muted">{eventDate(e, locale)}</span>
                <span>
                  <Link to={`/events/${e.slug}`}>{e.title}</Link>
                  {e.location && <span className="muted small"> · {e.location.name}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function EventPage() {
  const { slug = '' } = useParams();
  const { t, locale } = useI18n();
  const res = useAsync((signal) => api<EventSummary & { relationships: Relationship[] }>(`/events/${encodeURIComponent(slug)}`, { signal }), [slug, locale]);
  const e = res.data;
  usePageMeta(e?.title, e?.description);
  return (
    <div className="container page">
      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {e && (
        <div className="dossier">
          <article className="paper">
            <span className="pin" aria-hidden="true" />
            <div className="mono small muted">{eventDate(e, locale)}</div>
            <h1>{e.title}</h1>
            <div className="btn-row" style={{ marginBottom: 12 }}>
              <CategoryBadge category={e.category} />
              {e.isPeriod && <span className="badge badge--category">{t('events.period')}</span>}
            </div>
            <p>{e.description}</p>
            {e.location && (
              <p className="small">
                {t('events.location')}: <Link to={`/map?lat=${e.location.lat}&lng=${e.location.lng}`}>{e.location.name}</Link>
              </p>
            )}
          </article>
          <aside className="panel">
            <h3>{t('events.related')}</h3>
            <RelationshipList items={e.relationships} />
            <Link className="btn btn--small" style={{ marginTop: 12 }} to={`/timeline?event=${e.slug}`}>
              {t('nav.timeline')}
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
