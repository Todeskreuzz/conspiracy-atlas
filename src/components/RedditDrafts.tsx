import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { ApiFailure } from '../api/client';
import type { adminApi } from '../api/admin';
import { LoadState } from './Unavailable';
import type { CategorySlug, EvidenceStatus } from '../../shared/constants';
import { REDDIT_DRAFTS_PER_DAY, REDDIT_ENGAGED_POOL, REDDIT_RECENT_POOL, type RedditDraft, type RedditPosted } from '../../shared/reddit';

type Api = ReturnType<typeof adminApi>;

interface Queue {
  subreddit: string;
  subredditInvalid: boolean;
  perDay: number;
  drafts: RedditDraft[];
  caseOfTheDay: { day: string; posted: boolean; draft: RedditDraft } | null;
  posted: RedditPosted[];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function RedditDrafts({ a }: { a: Api }) {
  const { t, locale } = useI18n();
  const queue = useAsync(() => a.get<Queue>('/reddit'), []);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const data = queue.data;

  const flash = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 2000);
  };

  const onCopy = async (key: string, text: string) => {
    setMessage(null);
    if (await copyText(text)) flash(key);
    else setMessage(t('admin.reddit.copyFailed'));
  };

  const mark = async (key: string, posted: boolean) => {
    setBusy(key);
    setMessage(null);
    try {
      if (key === 'cotd') {
        if (posted) await a.post('/reddit/daily/posted');
        else await a.del('/reddit/daily/posted');
      } else if (posted) await a.post(`/reddit/${key}/posted`);
      else await a.del(`/reddit/${key}/posted`);
      setMessage(posted ? t(key === 'cotd' ? 'admin.reddit.casePosted' : 'admin.reddit.marked') : t('admin.reddit.restored'));
      queue.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('admin.reddit.copyFailed'));
    } finally {
      setBusy(null);
    }
  };

  const forbidden = queue.error instanceof ApiFailure && queue.error.status === 403;
  const migrationRequired = queue.error instanceof ApiFailure && queue.error.code === 'migration_required';

  return (
    <div data-testid="reddit-drafts">
      <p className="reddit-drafts__intro">
        {t('admin.reddit.intro', { n: data?.perDay ?? REDDIT_DRAFTS_PER_DAY, subreddit: data?.subreddit ?? 'ConspiracyAtlas' })}
      </p>
      <p className="small muted">{t('admin.reddit.whyText', { recent: REDDIT_RECENT_POOL, engaged: REDDIT_ENGAGED_POOL, perDay: REDDIT_DRAFTS_PER_DAY })}</p>
      {data?.subredditInvalid && <p className="notice">{t('admin.reddit.invalidSubreddit', { subreddit: data.subreddit })}</p>}
      {message && <p className="notice">{message}</p>}
      {migrationRequired ? (
        <p className="notice notice--error" data-testid="reddit-migration-required">{t('admin.reddit.migrationRequired')}</p>
      ) : forbidden ? (
        <p className="notice notice--error">{t('admin.reddit.forbidden')}</p>
      ) : (
        <LoadState loading={queue.loading} error={queue.error} onRetry={queue.reload} />
      )}
      {data?.caseOfTheDay && (
        <article className="paper reddit-draft reddit-draft--daily" data-testid="reddit-case-of-the-day">
          <div className="reddit-draft__meta">
            <span className="typewriter">{t('admin.reddit.caseKicker', { day: data.caseOfTheDay.day })} · r/{data.subreddit}</span>
            {data.caseOfTheDay.posted && <span className="small">{t('admin.reddit.casePosted')}</span>}
          </div>
          <p className="small muted">{t('admin.reddit.caseNote')}</p>
          <h3>{data.caseOfTheDay.draft.title}</h3>
          <p className="small">
            <span className="reddit-draft__flair">{t('admin.reddit.flair')}: {data.caseOfTheDay.draft.flair}</span>
            {' · '}
            {t(`categories.${data.caseOfTheDay.draft.category as CategorySlug}`)}
          </p>
          <pre className="reddit-draft__body">{data.caseOfTheDay.draft.body}</pre>
          {data.caseOfTheDay.draft.submitMode === 'title-only' && <p className="small muted">{t('admin.reddit.submitShort')}</p>}
          <div className="btn-row">
            <button type="button" className="btn btn--small" onClick={() => onCopy('cotd:title', data.caseOfTheDay!.draft.title)}>
              {copied === 'cotd:title' ? t('admin.reddit.copied') : t('admin.reddit.copyTitle')}
            </button>
            <button type="button" className="btn btn--small btn--primary" onClick={() => onCopy('cotd:body', data.caseOfTheDay!.draft.body)}>
              {copied === 'cotd:body' ? t('admin.reddit.copied') : t('admin.reddit.copyBody')}
            </button>
            <a className="btn btn--small" href={data.caseOfTheDay.draft.submitUrl} target="_blank" rel="noopener noreferrer">
              {t('admin.reddit.openReddit')}
            </a>
            <Link className="btn btn--small" to={`/theory/${data.caseOfTheDay.draft.slug}`}>
              {t('admin.reddit.openCase')}
            </Link>
            <button type="button" className="btn btn--small" disabled={busy === 'cotd'} onClick={() => mark('cotd', !data.caseOfTheDay!.posted)}>
              {data.caseOfTheDay.posted ? t('admin.reddit.undo') : t('admin.reddit.markPosted')}
            </button>
          </div>
        </article>
      )}
      {data && data.drafts.length === 0 && <p className="muted">{t('admin.reddit.empty')}</p>}
      <div className="reddit-drafts">
        {data?.drafts.map((d, index) => (
          <article key={d.theoryId} className="paper reddit-draft" data-testid="reddit-draft">
            <div className="reddit-draft__meta">
              <span className="typewriter">
                {t('admin.reddit.draftN', { n: index + 1 })} · r/{data.subreddit}
              </span>
              <span className="small muted">
                {t(d.ageDays === 0 ? 'admin.reddit.rankToday' : 'admin.reddit.rank', {
                  score: String(d.score),
                  days: String(d.ageDays),
                  status: t(`status.${d.evidenceStatus as EvidenceStatus}`),
                  claims: String(d.claimCount),
                  comments: String(d.commentCount),
                })}
              </span>
            </div>
            <h3>{d.title}</h3>
            <p className="small">
              <span className="reddit-draft__flair">{t('admin.reddit.flair')}: {d.flair}</span>
              {' · '}
              {t(`categories.${d.category as CategorySlug}`)}
            </p>
            <p className="small muted">
              {t('admin.reddit.breakdown', {
                recency: String(d.breakdown.recency),
                status: String(d.breakdown.status),
                discussion: String(d.breakdown.discussion),
                interest: String(d.breakdown.interest),
              })}
            </p>
            <pre className="reddit-draft__body">{d.body}</pre>
            {d.submitMode === 'title-only' && <p className="small muted">{t('admin.reddit.submitShort')}</p>}
            <div className="btn-row">
              <button type="button" className="btn btn--small" onClick={() => onCopy(`${d.theoryId}:title`, d.title)}>
                {copied === `${d.theoryId}:title` ? t('admin.reddit.copied') : t('admin.reddit.copyTitle')}
              </button>
              <button type="button" className="btn btn--small btn--primary" onClick={() => onCopy(`${d.theoryId}:body`, d.body)}>
                {copied === `${d.theoryId}:body` ? t('admin.reddit.copied') : t('admin.reddit.copyBody')}
              </button>
              <a className="btn btn--small" href={d.submitUrl} target="_blank" rel="noopener noreferrer">
                {t('admin.reddit.openReddit')}
              </a>
              <Link className="btn btn--small" to={`/theory/${d.slug}`}>
                {t('admin.reddit.openCase')}
              </Link>
              <button type="button" className="btn btn--small" disabled={busy === String(d.theoryId)} onClick={() => mark(String(d.theoryId), true)}>
                {t('admin.reddit.markPosted')}
              </button>
            </div>
          </article>
        ))}
      </div>
      {data && data.posted.length > 0 && (
        <section className="reddit-posted-list">
          <h3 className="adm-h3">{t('admin.reddit.postedTitle')}</h3>
          <ul className="list-plain">
            {data.posted.map((p) => (
              <li key={p.theoryId} className="reddit-posted">
                <span>
                  <Link to={`/theory/${p.slug}`}>{p.title}</Link>
                  <span className="small muted">
                    {' '}
                    · {formatDate(p.postedAt, locale)} · {p.actor}
                  </span>
                </span>
                <button type="button" className="btn btn--small" disabled={busy === String(p.theoryId)} onClick={() => mark(String(p.theoryId), false)}>
                  {t('admin.reddit.undo')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
