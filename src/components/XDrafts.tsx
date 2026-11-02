import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { ApiFailure } from '../api/client';
import type { adminApi } from '../api/admin';
import { LoadState } from './Unavailable';
import type { CategorySlug, EvidenceStatus } from '../../shared/constants';
import { X_DRAFTS_PER_DAY, X_LIMIT, type XDraft, type XPiece } from '../../shared/x';

type Api = ReturnType<typeof adminApi>;

interface Posted {
  theoryId: number;
  slug: string;
  title: string;
  postedAt: string;
  actor: string;
}

interface Queue {
  handle: string;
  handleInvalid: boolean;
  perDay: number;
  drafts: XDraft[];
  caseOfTheDay: { day: string; posted: boolean; draft: XDraft } | null;
  posted: Posted[];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Count({ n }: { n: number }) {
  return (
    <span className={`x-count${n > X_LIMIT ? ' x-count--over' : ''}`} data-testid="x-count">
      {n}/{X_LIMIT}
    </span>
  );
}

function PostBlock({ label, piece }: { label: string; piece: XPiece }) {
  return (
    <div className="x-post">
      <div className="x-post__head">
        <span className="small">{label}</span>
        <Count n={piece.length} />
      </div>
      <pre className="reddit-draft__body">{piece.composed}</pre>
    </div>
  );
}

export function XDrafts({ a }: { a: Api }) {
  const { t, locale } = useI18n();
  const queue = useAsync(() => a.get<Queue>('/x'), []);
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
    else setMessage(t('admin.x.copyFailed'));
  };
  const mark = async (key: string, posted: boolean) => {
    setBusy(key);
    setMessage(null);
    try {
      if (key === 'cotd') {
        if (posted) await a.post('/x/daily/posted');
        else await a.del('/x/daily/posted');
      } else if (posted) await a.post(`/x/${key}/posted`);
      else await a.del(`/x/${key}/posted`);
      setMessage(posted ? t(key === 'cotd' ? 'admin.x.casePosted' : 'admin.x.marked') : t('admin.x.restored'));
      queue.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('admin.x.copyFailed'));
    } finally {
      setBusy(null);
    }
  };

  const forbidden = queue.error instanceof ApiFailure && queue.error.status === 403;
  const migrationRequired = queue.error instanceof ApiFailure && queue.error.code === 'migration_required';

  const card = (d: XDraft, key: string, kicker: string, posted: boolean) => (
    <article key={key} className={`paper reddit-draft${key === 'cotd' ? ' reddit-draft--daily' : ''}`} data-testid={key === 'cotd' ? 'x-case-of-the-day' : 'x-draft'}>
      <div className="reddit-draft__meta">
        <span className="typewriter">
          {kicker} · @{data?.handle}
        </span>
        {posted && <span className="small">{t('admin.x.casePosted')}</span>}
      </div>
      <p className="small">
        <span className="reddit-draft__flair">{t(`status.${d.evidenceStatus as EvidenceStatus}`)}</span>
        {' · '}
        {t(`categories.${d.category as CategorySlug}`)}
      </p>
      <PostBlock label={t('admin.x.hook')} piece={d.post} />
      <PostBlock label={t('admin.x.reply')} piece={d.reply} />
      <PostBlock label={t('admin.x.withLink')} piece={d.withLink} />
      <div className="btn-row">
        <button type="button" className="btn btn--small btn--primary" onClick={() => onCopy(`${key}:post`, d.post.composed)}>
          {copied === `${key}:post` ? t('admin.x.copied') : t('admin.x.copyPost')}
        </button>
        <button type="button" className="btn btn--small" onClick={() => onCopy(`${key}:reply`, d.reply.composed)}>
          {copied === `${key}:reply` ? t('admin.x.copied') : t('admin.x.copyReply')}
        </button>
        <a className="btn btn--small" href={d.intentUrl} target="_blank" rel="noopener noreferrer">
          {t('admin.x.openX')}
        </a>
        <button type="button" className="btn btn--small" onClick={() => onCopy(`${key}:link`, d.withLink.composed)}>
          {copied === `${key}:link` ? t('admin.x.copied') : t('admin.x.copyWithLink')}
        </button>
        <a className="btn btn--small" href={d.intentWithLinkUrl} target="_blank" rel="noopener noreferrer">
          {t('admin.x.openXLink')}
        </a>
        <Link className="btn btn--small" to={`/theory/${d.slug}`}>
          {t('admin.x.openCase')}
        </Link>
        <button type="button" className="btn btn--small" disabled={busy === key} onClick={() => mark(key, key === 'cotd' ? !posted : true)}>
          {key === 'cotd' && posted ? t('admin.x.undo') : t('admin.x.markPosted')}
        </button>
      </div>
    </article>
  );

  return (
    <div data-testid="x-drafts">
      <p className="x-drafts__intro">{t('admin.x.intro', { n: data?.perDay ?? X_DRAFTS_PER_DAY, handle: data?.handle ?? 'ConspAtlas' })}</p>
      <p className="small muted">{t('admin.x.why')}</p>
      {data?.handleInvalid && <p className="notice">{t('admin.x.invalidHandle', { handle: data.handle })}</p>}
      {message && <p className="notice">{message}</p>}
      {migrationRequired ? (
        <p className="notice notice--error" data-testid="x-migration-required">
          {t('admin.x.migrationRequired')}
        </p>
      ) : forbidden ? (
        <p className="notice notice--error">{t('admin.x.forbidden')}</p>
      ) : (
        <LoadState loading={queue.loading} error={queue.error} onRetry={queue.reload} />
      )}
      {data?.caseOfTheDay && card(data.caseOfTheDay.draft, 'cotd', t('admin.x.caseKicker', { day: data.caseOfTheDay.day }), data.caseOfTheDay.posted)}
      {data && data.drafts.length === 0 && <p className="muted">{t('admin.x.empty')}</p>}
      <div className="reddit-drafts">
        {data?.drafts.map((d, index) => card(d, String(d.theoryId), t('admin.x.draftN', { n: index + 1 }), false))}
      </div>
      {data && data.posted.length > 0 && (
        <section className="reddit-posted-list">
          <h3 className="adm-h3">{t('admin.x.postedTitle')}</h3>
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
                  {t('admin.x.undo')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
