import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Paged, TheoryDetail, TheorySummary } from '../../shared/types';
import { EVIDENCE_STATUSES } from '../../shared/constants';
import { CategoryBadge, StatusBadge, STATUS_COLORS } from '../components/Badges';
import { LoadState } from '../components/Unavailable';
import { Pagination } from '../components/TheoryCard';

/**
 * Editorial evidence ratings ("debunked", "disputed", …). The archive itself stays neutral and only
 * shows content; these assessments are collected here, in a separate section.
 */
export function ExpertsPage() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const qs = new URLSearchParams({ pageSize: '30', page: String(page), sort: 'title' });
  if (status) qs.set('status', status);
  const list = useAsync((signal) => api<Paged<TheorySummary>>(`/theories?${qs}`, { signal }), [qs.toString(), locale]);

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.experts')}</div>
        <h1>{t('experts.title')}</h1>
        <p>{t('experts.intro')}</p>
      </header>

      <section className="section" style={{ paddingTop: 0 }}>
        <h2>{t('experts.scale')}</h2>
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
        <div className="section-title">
          <h2>{t('experts.cases')}</h2>
          <select aria-label={t('experts.filter')} style={{ width: 'auto' }} value={status} onChange={(e) => set('status', e.target.value)}>
            <option value="">{t('app.all')}</option>
            {EVIDENCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
        {list.data && list.data.items.length === 0 && <p className="muted">{t('archive.empty')}</p>}
        {list.data && list.data.items.length > 0 && (
          <div className="paper">
            <ul className="list-plain" data-testid="expert-list">
              {list.data.items.map((th) => (
                <li key={th.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center' }}>
                  <StatusBadge status={th.evidenceStatus} />
                  <Link to={`/experts/${th.slug}`}>{th.title}</Link>
                  <CategoryBadge category={th.category} />
                </li>
              ))}
            </ul>
            <Pagination page={page} hasMore={list.data.hasMore} onPage={(p) => set('page', String(p))} />
          </div>
        )}
      </section>
    </div>
  );
}

/** The ratings for a single case: the overall assessment and one per claim. */
export function ExpertCasePage() {
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
  return (
    <div className="container page">
      <article className="paper" data-testid="expert-case">
        <span className="pin" aria-hidden="true" />
        <div className="kicker">{t('nav.experts')}</div>
        <span className="stamp" style={{ color: STATUS_COLORS[th.evidenceStatus] }}>
          {t(`status.${th.evidenceStatus}`)}
        </span>
        <h1>{th.title}</h1>
        <p className="muted small">{t(`statusHelp.${th.evidenceStatus}`)}</p>
        <p className="notice small">{t('experts.caseNote')}</p>

        <section>
          <h2>{t('experts.claims')}</h2>
          {th.claims.length === 0 && <p className="muted small">{t('app.none')}</p>}
          {th.claims.map((c, i) => (
            <div key={c.id} className="claim" style={{ borderLeftColor: STATUS_COLORS[c.evidenceStatus] }} data-testid="expert-claim">
              <div className="claim__text">
                <span className="mono muted">#{i + 1} </span>
                {c.text}
              </div>
              <StatusBadge status={c.evidenceStatus} />
              <span className="small muted"> {t('experts.sourceCount', { count: c.evidence.length })}</span>
            </div>
          ))}
        </section>

        <div className="btn-row">
          <Link className="btn btn--small" to={`/theory/${th.slug}`}>
            ← {t('experts.backToCase')}
          </Link>
          <Link className="btn btn--small" to="/experts">
            {t('experts.allRatings')}
          </Link>
        </div>
      </article>
    </div>
  );
}
