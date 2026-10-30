import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { usePageMeta } from '../hooks/usePageMeta';
import { api } from '../api/client';
import type { Organization, Paged, Relationship } from '../../shared/types';
import { LoadState } from '../components/Unavailable';
import { Pagination } from '../components/TheoryCard';
import { RelationshipList } from './Theory';

/** Initials for the badge: the acronym in brackets if the name has one, otherwise the first letters. */
export function monogram(name: string): string {
  const acronym = name.match(/\(([A-Z]{2,6})\)/)?.[1];
  if (acronym) return acronym;
  const words = name.replace(/\(.*?\)/g, '').split(/[\s-]+/).filter((w) => /^[A-ZÄÖÜ]/.test(w));
  return (words.length ? words : name.split(/\s+/)).slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

export function OrganizationsPage() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const list = useAsync((signal) => api<Paged<Organization>>(`/organizations?page=${page}&pageSize=24`, { signal }), [page, locale]);
  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.organizations')}</div>
        <h1>{t('orgs.title')}</h1>
        <p>{t('orgs.intro')}</p>
      </header>
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
      {list.data && (
        <>
          <div className="grid grid--3">
            {list.data.items.map((o) => (
              <Link key={o.id} to={`/organizations/${o.slug}`} className="panel org-badge">
                <span className="org-badge__kind">{o.kind}</span>
                <div className="org-badge__id">
                  <span className="org-badge__seal" aria-hidden="true">
                    {monogram(o.name)}
                  </span>
                  <h3>{o.name}</h3>
                </div>
                <p className="muted small">{o.description}</p>
                <div className="org-badge__meta mono small">
                  {o.founded && `${t('orgs.founded')}: ${o.founded}`} {o.country && `· ${o.country}`}
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} hasMore={list.data.hasMore} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export function OrganizationPage() {
  const { slug = '' } = useParams();
  const { t, locale } = useI18n();
  const res = useAsync((signal) => api<Organization & { relationships: Relationship[] }>(`/organizations/${encodeURIComponent(slug)}`, { signal }), [slug, locale]);
  const o = res.data;
  usePageMeta(o?.name, o?.description);
  return (
    <div className="container page">
      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {o && (
        <div className="dossier">
          <article className="paper">
            <span className="pin" aria-hidden="true" />
            <div className="typewriter small muted">{o.kind}</div>
            <h1>{o.name}</h1>
            <p>{o.description}</p>
            <dl className="kv">
              {o.founded && (
                <>
                  <dt>{t('orgs.founded')}</dt>
                  <dd>{o.founded}</dd>
                </>
              )}
              {o.country && (
                <>
                  <dt>{t('orgs.country')}</dt>
                  <dd>{o.country}</dd>
                </>
              )}
              {o.location && (
                <>
                  <dt>{t('events.location')}</dt>
                  <dd>{o.location.name}</dd>
                </>
              )}
            </dl>
          </article>
          <aside className="panel">
            <h3>{t('theory.connections')}</h3>
            <RelationshipList items={o.relationships} />
            <Link className="btn btn--small" style={{ marginTop: 12 }} to={`/wall?focus=organization:${o.id}`}>
              {t('theory.showOnWall')}
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
