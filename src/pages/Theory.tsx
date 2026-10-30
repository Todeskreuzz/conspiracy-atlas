import { Link, useParams } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Relationship, TheoryDetail } from '../../shared/types';
import { CategoryBadge } from '../components/Badges';
import { LoadState } from '../components/Unavailable';
import { RichText } from '../components/RichText';
import { SourceItem } from '../components/SourceItem';
import { ReportForm } from '../components/ReportForm';
import { ImageGallery } from '../components/ImageGallery';
import { SaveButton } from '../components/SaveButton';

export function entityPath(type: string, slug: string | null): string | null {
  if (!slug) return null;
  switch (type) {
    case 'theory':
      return `/theory/${slug}`;
    case 'event':
      return `/events/${slug}`;
    case 'organization':
      return `/organizations/${slug}`;
    case 'person':
      return `/people/${slug}`;
    case 'document':
      return `/knowledge#doc-${slug}`;
    case 'location':
      return `/map#${slug}`;
    default:
      return null;
  }
}

export function RelationshipList({ items }: { items: Relationship[] }) {
  const { t } = useI18n();
  if (!items.length) return <p className="muted small">{t('app.none')}</p>;
  return (
    <ul className="rel-list">
      {items.map((r) => {
        const path = entityPath(r.other.type, r.other.slug);
        return (
          <li key={`${r.id}-${r.direction}`}>
            <span className={`rel-kind rel-kind--${r.kind}`}>
              {t(`relations.${r.kind}`)} · {t(`verification.${r.verification}`)}
            </span>
            <span>
              <span className="muted small">{t(`kinds.${r.other.type}`)}: </span>
              {path ? <Link to={path}>{r.other.title}</Link> : r.other.title}
            </span>
            {r.label && <span className="muted small">{r.label}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function TheoryPage() {
  const { slug = '' } = useParams();
  const { t, locale } = useI18n();
  const res = useAsync((signal) => api<TheoryDetail>(`/theories/${encodeURIComponent(slug)}`, { signal }), [slug, locale]);
  const th = res.data;

  if (!th) {
    return (
      <div className="container page">
        <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      </div>
    );
  }

  const claimIndex = new Map(th.claims.map((c, i) => [c.id, i + 1]));
  const docs = th.relationships.filter((r) => r.other.type === 'document');
  const nonDocs = th.relationships.filter((r) => r.other.type !== 'document' && r.other.type !== 'event');

  return (
    <div className="container page">
      <div className="dossier">
        <article className="paper" data-testid="theory-detail">
          <span className="pin" aria-hidden="true" />
          <header className="dossier__head">
            {th.imagePath && !th.imagePath.endsWith('.svg') && (
              <figure className="dossier__photo">
                <span className="pin" aria-hidden="true" />
                <img src={th.imagePath} alt={th.imageCredit ?? ''} />
              </figure>
            )}
            <h1>{th.title}</h1>
            {th.subtitle && <p className="muted" style={{ fontSize: '1.1rem', margin: 0 }}>{th.subtitle}</p>}
            <div className="btn-row">
              <SaveButton theory={th} small />
              <CategoryBadge category={th.category} />
              {th.tags.map((tag) => (
                <span key={tag} className="tag">
                  #{tag}
                </span>
              ))}
            </div>
            {th.origin === 'community' && (
              <p className="notice">
                {t('theory.communityNote')} {t('archive.by', { name: th.authorName ?? 'Anonymous' })}
              </p>
            )}
          </header>

          <section>
            <h2>{t('theory.summary')}</h2>
            <p className="highlight-first">{th.summary}</p>
          </section>

          {th.background && (
            <section>
              <h2>{t('theory.background')}</h2>
              <p>{th.background}</p>
            </section>
          )}
          {th.originStory && (
            <section>
              <h2>{t('theory.origin')}</h2>
              <p>{th.originStory}</p>
            </section>
          )}
          {th.body && th.origin === 'community' && (
            <section>
              <h2>{t('theory.body')}</h2>
              <RichText doc={th.body} />
            </section>
          )}

          {th.images.length > 0 && (
            <section>
              <h2>{t('theory.images')}</h2>
              <ImageGallery images={th.images} />
            </section>
          )}

          <section>
            <h2>{t('theory.claims')}</h2>
            <p className="muted small">{t('theory.claimHint')}</p>
            {th.claims.map((c, i) => (
              <div key={c.id} className="claim" data-testid="claim">
                <div className="claim__text">
                  <span className="mono muted">#{i + 1} </span>
                  {c.text}
                </div>
                {c.evidence.length ? (
                  <ul className="claim__evidence">
                    {c.evidence.map((e) => (
                      <li key={e.id}>
                        <SourceItem source={e.source} relation={e.relation} note={e.note} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="small muted" style={{ margin: '6px 0 0' }}>
                    {t('theory.noEvidence')}
                  </p>
                )}
              </div>
            ))}
          </section>

          {th.counterArguments.length > 0 && (
            <section>
              <h2>{t('theory.counterArguments')}</h2>
              {th.counterArguments.map((c) => (
                <div key={c.id} className="counter" data-testid="counter-argument">
                  {c.claimId && claimIndex.has(c.claimId) && (
                    <div className="small muted">
                      {t('theory.relatesTo')} #{claimIndex.get(c.claimId)}
                    </div>
                  )}
                  <div>{c.text}</div>
                  {c.evidence.map((e) => (
                    <SourceItem key={e.id} source={e.source} relation={e.relation} note={e.note} />
                  ))}
                </div>
              ))}
            </section>
          )}

          {th.generalSources.length > 0 && (
            <section>
              <h2>{t('theory.generalSources')}</h2>
              {th.generalSources.map((e) => (
                <SourceItem key={e.id} source={e.source} relation={e.relation} note={e.note} />
              ))}
            </section>
          )}

          {th.events.length > 0 && (
            <section>
              <h2>{t('theory.timeline')}</h2>
              <ol className="mini-timeline">
                {th.events.map((ev) => (
                  <li key={ev.id}>
                    <div className="date">
                      {formatDate(ev.startDate ?? String(ev.startYear), locale)}
                      {ev.endDate ? ` – ${formatDate(ev.endDate, locale)}` : ''}
                    </div>
                    <Link to={`/events/${ev.slug}`}>{ev.title}</Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <footer className="small muted" style={{ borderTop: '1px dashed rgba(0,0,0,0.2)', paddingTop: 12 }}>
            {t('theory.permalink')}: <span className="mono">/theory/{th.slug}</span>
            {th.imageCredit && (
              <div>
                {t('theory.imageCredit')}: {th.imageCredit}
              </div>
            )}
          </footer>
        </article>

        <aside className="sidebar-panel">
          <div className="panel">
            <Link className="btn btn--primary" style={{ width: '100%' }} to={`/wall?focus=theory:${th.id}`}>
              {t('theory.showOnWall')}
            </Link>
            <Link className="btn btn--small" style={{ width: '100%', marginTop: 8 }} to={`/experts/${th.slug}`} data-testid="expert-link">
              {t('experts.forCase')}
            </Link>
          </div>
          <div className="panel">
            <h3>{t('theory.connections')}</h3>
            <RelationshipList items={nonDocs} />
          </div>
          {docs.length > 0 && (
            <div className="panel">
              <h3>{t('theory.documents')}</h3>
              <RelationshipList items={docs} />
            </div>
          )}
          <div className="panel">
            <ReportForm targetType="theory" targetId={th.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
