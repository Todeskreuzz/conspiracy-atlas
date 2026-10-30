import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Organization, Paged, Relationship } from '../../shared/types';
import { LoadState } from '../components/Unavailable';
import { Pagination } from '../components/TheoryCard';
import { RelationshipList } from './Theory';

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
              <Link key={o.id} to={`/organizations/${o.slug}`} className="panel" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="typewriter small" style={{ color: 'var(--yellow)' }}>
                  {o.kind}
                </div>
                <h3 style={{ marginTop: 4 }}>{o.name}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {o.description}
                </p>
                <div className="small muted" style={{ marginTop: 8 }}>
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
