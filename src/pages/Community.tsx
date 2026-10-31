import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Paged, TheorySummary } from '../../shared/types';
import { CATEGORY_SLUGS } from '../../shared/constants';
import { LoadState, Unavailable } from '../components/Unavailable';
import { Pagination, TheoryCard } from '../components/TheoryCard';
import { CommunityBadge } from '../components/Badges';
import { useFeature } from '../api/status';

/** "Community theories": only conspiracy theories submitted by visitors (origin = community). */
export function CommunityPage() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [query, setQuery] = useState(q);
  useEffect(() => {
    setQuery(q);
  }, [q]);
  const submissions = useFeature('community_submissions');

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const qs = new URLSearchParams({ origin: 'community', pageSize: '12', page: String(page) });
  if (category) qs.set('category', category);
  if (sort) qs.set('sort', sort);
  if (q) qs.set('q', q);
  const list = useAsync((signal) => api<Paged<TheorySummary>>(`/theories?${qs}`, { signal }), [qs.toString(), locale]);
  const filtered = Boolean(category || q);

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.community')}</div>
        <h1>{t('community.title')}</h1>
        <p>{t('community.intro')}</p>
        <p className="notice notice--community">
          <CommunityBadge /> {t('community.disclaimer')}
        </p>
        <p className="muted small">{t('community.anonymity')}</p>
        <div className="btn-row">
          <Link to="/submit" className="btn btn--primary">
            {t('community.submitCta')}
          </Link>
          <Link to="/archive" className="btn">
            {t('community.archiveLink')}
          </Link>
        </div>
        {submissions.loaded && !submissions.available && (
          <div style={{ marginTop: 12 }}>
            <Unavailable feature="community_submissions" state={submissions.state} explanation={submissions.message?.replace('Currently unavailable! ', '')} compact />
          </div>
        )}
      </header>
      <form
        className="toolbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set('q', query.trim());
        }}
      >
        <div className="field" style={{ flex: '2 1 240px' }}>
          <label htmlFor="community-q">{t('app.search')}</label>
          <input id="community-q" type="search" value={query} placeholder={t('community.searchPlaceholder')} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="community-cat">{t('archive.filterCategory')}</label>
          <select id="community-cat" value={category} onChange={(e) => set('category', e.target.value)}>
            <option value="">{t('app.all')}</option>
            {CATEGORY_SLUGS.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="community-sort">↕</label>
          <select id="community-sort" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="">{t('archive.sortNewest')}</option>
            <option value="title">{t('archive.sortTitle')}</option>
          </select>
        </div>
      </form>
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
          {list.data && list.data.items.length === 0 && <p className="muted">{t(filtered ? 'archive.empty' : 'community.empty')}</p>}
          {list.data && (
            <>
              <div className="grid grid--cards">
                {list.data.items.map((th) => (
                  <TheoryCard key={th.id} theory={th} />
                ))}
              </div>
              <Pagination page={page} hasMore={list.data.hasMore} onPage={(p) => set('page', String(p))} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
