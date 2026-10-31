import { Link, useSearchParams } from 'react-router-dom';
import { CommunityBadge } from '../components/Badges';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Paged, TheorySummary } from '../../shared/types';
import { CATEGORY_SLUGS } from '../../shared/constants';
import { Pagination, TheoryCard } from '../components/TheoryCard';
import { LoadState } from '../components/Unavailable';
import { useEffect, useState } from 'react';

export function ArchivePage() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const origin = params.get('origin') ?? '';
  const sort = params.get('sort') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [query, setQuery] = useState(q);
  useEffect(() => {
    setQuery(q);
  }, [q]);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const qs = new URLSearchParams({ pageSize: '12', page: String(page) });
  if (category) qs.set('category', category);
  if (origin) qs.set('origin', origin);
  if (sort) qs.set('sort', sort);
  if (q) qs.set('q', q);
  const list = useAsync((signal) => api<Paged<TheorySummary>>(`/theories?${qs}`, { signal }), [qs.toString(), locale]);

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.archive')}</div>
        <h1>{t('archive.title')}</h1>
        <p>{t('archive.intro')}</p>
        <p className="small muted archive-community-hint">
          <CommunityBadge /> {t('archive.communityHint')} <Link to="/community">{t('archive.communityLink')}</Link>
        </p>
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
          <label htmlFor="archive-q">{t('app.search')}</label>
          <input id="archive-q" type="search" value={query} placeholder={t('app.searchPlaceholder')} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="archive-cat">{t('archive.filterCategory')}</label>
          <select id="archive-cat" value={category} onChange={(e) => set('category', e.target.value)}>
            <option value="">{t('app.all')}</option>
            {CATEGORY_SLUGS.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="archive-origin">{t('archive.filterOrigin')}</label>
          <select id="archive-origin" value={origin} onChange={(e) => set('origin', e.target.value)}>
            <option value="">{t('app.all')}</option>
            <option value="editorial">{t('archive.originEditorial')}</option>
            <option value="community">{t('archive.originCommunity')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="archive-sort">↕</label>
          <select id="archive-sort" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="">{t('archive.sortNewest')}</option>
            <option value="title">{t('archive.sortTitle')}</option>
          </select>
        </div>
      </form>
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
      {list.data && list.data.items.length === 0 && <p className="muted">{t('archive.empty')}</p>}
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
  );
}
