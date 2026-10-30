import { useState } from 'react';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { DocumentItem, Paged, Source } from '../../shared/types';
import { EVIDENCE_STATUSES } from '../../shared/constants';
import { LoadState } from '../components/Unavailable';
import { SourceItem } from '../components/SourceItem';
import { Pagination } from '../components/TheoryCard';
import { StatusBadge } from '../components/Badges';

export function KnowledgePage() {
  const { t, locale } = useI18n();
  const [primary, setPrimary] = useState('');
  const [page, setPage] = useState(1);
  const docs = useAsync((signal) => api<Paged<DocumentItem>>('/documents?pageSize=50', { signal }), []);
  const sources = useAsync(
    (signal) => api<Paged<Source>>(`/sources?pageSize=20&page=${page}${primary ? `&primary=${primary}` : ''}`, { signal }),
    [page, primary],
  );
  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.knowledge')}</div>
        <h1>{t('knowledge.title')}</h1>
        <p>{t('knowledge.intro')}</p>
      </header>

      <section className="section" style={{ paddingTop: 0 }}>
        <h2>{t('knowledge.method')}</h2>
        <div className="grid grid--3">
          <div className="panel">
            <h3>{t('knowledge.primaryVsSecondary')}</h3>
            <p className="muted small">{t('knowledge.primaryText')}</p>
          </div>
          <div className="panel">
            <h3>{t('knowledge.qualityTitle')}</h3>
            <p className="muted small">{t('knowledge.qualityText')}</p>
          </div>
          <div className="panel">
            <h3>{t('knowledge.linkingTitle')}</h3>
            <p className="muted small">{t('knowledge.linkingText')}</p>
          </div>
        </div>
        <h3 style={{ marginTop: 24 }}>{t('knowledge.statuses')}</h3>
        <dl className="kv" style={{ gap: '10px 18px' }}>
          {EVIDENCE_STATUSES.map((s) => (
            <div key={s} style={{ display: 'contents' }}>
              <dt>
                <StatusBadge status={s} dark />
              </dt>
              <dd className="small">{t(`statusHelp.${s}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="section">
        <h2>{t('knowledge.documents')}</h2>
        <LoadState loading={docs.loading} error={docs.error} onRetry={docs.reload} />
        <div className="grid grid--2">
          {docs.data?.items.map((d) => (
            <div key={d.id} id={`doc-${d.slug}`} className="paper" style={{ padding: '16px 18px' }}>
              <div className="typewriter small muted">
                {d.documentType} · {formatDate(d.publishedDate, locale)}
              </div>
              <h3 style={{ margin: '4px 0 6px' }}>{d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer">{d.title}</a> : d.title}</h3>
              <p className="small" style={{ margin: 0 }}>
                {d.description}
              </p>
              <p className="small muted" style={{ margin: '6px 0 0' }}>
                {d.archiveName} · {t('knowledge.license')}: {d.licenseNote}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>{t('knowledge.sources')}</h2>
          <select
            aria-label={t('knowledge.sources')}
            style={{ width: 'auto' }}
            value={primary}
            onChange={(e) => {
              setPrimary(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('app.all')}</option>
            <option value="1">{t('knowledge.filterPrimary')}</option>
            <option value="0">{t('knowledge.filterSecondary')}</option>
          </select>
        </div>
        <LoadState loading={sources.loading} error={sources.error} onRetry={sources.reload} />
        {sources.data && (
          <div className="paper">
            {sources.data.items.map((s) => (
              <SourceItem key={s.id} source={s} />
            ))}
            <Pagination page={page} hasMore={sources.data.hasMore} onPage={setPage} />
          </div>
        )}
      </section>
    </div>
  );
}
