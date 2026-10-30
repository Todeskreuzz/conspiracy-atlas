import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Paged, TheorySummary } from '../../shared/types';
import { LoadState, Unavailable } from '../components/Unavailable';
import { Pagination, TheoryCard } from '../components/TheoryCard';
import { useFeature } from '../api/status';

export function CommunityPage() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const submissions = useFeature('community_submissions');
  const list = useAsync((signal) => api<Paged<TheorySummary>>(`/theories?origin=community&pageSize=12&page=${page}`, { signal }), [page, locale]);
  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.community')}</div>
        <h1>{t('community.title')}</h1>
        <p>{t('community.intro')}</p>
        <p className="muted small">{t('community.anonymity')}</p>
        <div className="btn-row">
          <Link to="/submit" className="btn btn--primary">
            {t('community.submitCta')}
          </Link>
        </div>
        {submissions.loaded && !submissions.available && (
          <div style={{ marginTop: 12 }}>
            <Unavailable feature="community_submissions" state={submissions.state} explanation={submissions.message?.replace('Currently unavailable! ', '')} compact />
          </div>
        )}
      </header>
      <div className="two-col">
        <aside className="panel">
          <h3>{t('community.process')}</h3>
          <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>{t('community.step1')}</li>
            <li>{t('community.step2')}</li>
            <li>{t('community.step3')}</li>
            <li>{t('community.step4')}</li>
          </ol>
        </aside>
        <div>
          <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          {list.data && list.data.items.length === 0 && <p className="muted">{t('community.empty')}</p>}
          {list.data && (
            <>
              <div className="grid grid--cards">
                {list.data.items.map((th) => (
                  <TheoryCard key={th.id} theory={th} />
                ))}
              </div>
              <Pagination page={page} hasMore={list.data.hasMore} onPage={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
