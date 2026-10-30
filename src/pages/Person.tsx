import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Person, Relationship } from '../../shared/types';
import { LoadState } from '../components/Unavailable';
import { RelationshipList } from './Theory';

export function PersonPage() {
  const { slug = '' } = useParams();
  const { t, locale } = useI18n();
  const res = useAsync((signal) => api<Person & { relationships: Relationship[] }>(`/people/${encodeURIComponent(slug)}`, { signal }), [slug, locale]);
  const p = res.data;
  return (
    <div className="container page">
      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {p && (
        <div className="dossier">
          <article className="paper">
            <span className="pin" aria-hidden="true" />
            <div className="typewriter small muted">{t('kinds.person')}</div>
            <h1>{p.name}</h1>
            {p.role && <p className="muted">{p.role}</p>}
            <p>{p.description}</p>
            <p className="mono small">
              {p.born ?? '?'} – {p.died ?? ''}
            </p>
          </article>
          <aside className="panel">
            <h3>{t('theory.connections')}</h3>
            <RelationshipList items={p.relationships} />
            <Link className="btn btn--small" style={{ marginTop: 12 }} to={`/wall?focus=person:${p.id}`}>
              {t('theory.showOnWall')}
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
