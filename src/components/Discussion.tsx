import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api, ApiFailure } from '../api/client';
import { accountApi, useAccount } from '../api/account';
import { useFeature } from '../api/status';
import type { Discussion as DiscussionData, DiscussionComment, VoteTally, VoteValue } from '../../shared/types';
import { COMMENT_LIMITS } from '../../shared/comments';
import { Avatar } from './ProfileView';
import { Unavailable } from './Unavailable';
import { ReportForm } from './ReportForm';

type Sort = 'top' | 'new';

/**
 * Discussion under a case file or community theory: thumbs up / down for the case and threaded comments
 * from signed-in accounts. Everything is plain text (rendered as text, never as HTML).
 */
export function Discussion({ slug }: { slug: string }) {
  const { t, locale } = useI18n();
  const feature = useFeature('accounts');
  const account = useAccount();
  const location = useLocation();
  const [sort, setSort] = useState<Sort>('top');
  const signedIn = !!account.user;
  const data = useAsync(
    (signal) => api<DiscussionData>(`/theories/${encodeURIComponent(slug)}/discussion?sort=${sort}`, { signal, localized: false }),
    [slug, sort, account.user?.id ?? 0],
  );
  const [error, setError] = useState<ApiFailure | null>(null);
  const a = accountApi(account.csrfToken);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      data.reload();
      return true;
    } catch (e) {
      setError(e instanceof ApiFailure ? e : new ApiFailure(0, 'error', String(e), null));
      return false;
    }
  };

  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`;

  if (feature.loaded && !feature.available) {
    return (
      <section className="paper discussion" data-testid="discussion">
        <h2>{t('discussion.title')}</h2>
        <Unavailable feature="accounts" state={feature.state} compact />
      </section>
    );
  }

  const d = data.data;
  return (
    <section className="paper discussion" data-testid="discussion">
      <div className="discussion__head">
        <h2>
          {t('discussion.title')} {d && <span className="discussion__count">({d.total})</span>}
        </h2>
        {d && (
          <VoteBar
            tally={d.votes}
            label={t('discussion.caseVote')}
            disabled={!signedIn}
            disabledHint={t('discussion.signInToVote')}
            onVote={(v) => run(() => a.put(`/theories/${encodeURIComponent(slug)}/vote`, { value: v }))}
          />
        )}
      </div>
      <p className="muted small">{t('discussion.intro')}</p>

      {signedIn ? (
        <CommentForm
          placeholder={t('discussion.placeholder')}
          submitLabel={t('discussion.post')}
          onSubmit={(body) => run(() => a.post(`/theories/${encodeURIComponent(slug)}/comments`, { body, language: locale }))}
        />
      ) : (
        !account.loading && (
          <p className="discussion__signin">
            <Link to={loginLink} className="btn btn--small btn--primary">
              {t('discussion.signIn')}
            </Link>{' '}
            <span className="muted small">{t('discussion.signInHint')}</span>
          </p>
        )
      )}

      {error && (error.unavailable ? <Unavailable state={error.state!} feature="accounts" compact /> : <p className="notice notice--error">{error.message}</p>)}

      {data.error && (data.error instanceof ApiFailure && data.error.unavailable ? <Unavailable state={data.error.state!} feature="database" compact onRetry={data.reload} /> : <p className="notice notice--error">{data.error.message}</p>)}

      {d && d.comments.length > 0 && (
        <div className="discussion__sort" role="group" aria-label={t('discussion.sort')}>
          {(['top', 'new'] as const).map((s) => (
            <button key={s} type="button" className="discussion__sort-btn" aria-pressed={sort === s} onClick={() => setSort(s)}>
              {t(`discussion.sorts.${s}`)}
            </button>
          ))}
        </div>
      )}
      {d && d.comments.length === 0 && <p className="muted">{t('discussion.empty')}</p>}
      <ul className="list-plain discussion__list">
        {d?.comments.map((cm) => (
          <CommentItem key={cm.id} comment={cm} signedIn={signedIn} run={run} a={a} slug={slug} />
        ))}
      </ul>
    </section>
  );
}

type Run = (fn: () => Promise<unknown>) => Promise<boolean>;

function CommentItem({ comment, signedIn, run, a, slug, isReply }: { comment: DiscussionComment; signedIn: boolean; run: Run; a: ReturnType<typeof accountApi>; slug: string; isReply?: boolean }) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<'view' | 'edit' | 'reply' | 'confirm-delete'>('view');
  const replyTo = comment.parentId ?? comment.id;

  return (
    <li className={`comment${isReply ? ' comment--reply' : ''}`} data-testid="comment">
      {comment.deleted ? (
        <p className="comment__deleted muted small">{t('discussion.deleted')}</p>
      ) : (
        <>
          <div className="comment__meta small">
            {comment.author && (
              <Link to={`/u/${comment.author.username}`} className="comment__author">
                <Avatar url={comment.author.avatarUrl} name={comment.author.displayName} size="small" />
                <span>{comment.author.displayName}</span>
              </Link>
            )}
            <span className="muted">
              · {formatDate(comment.createdAt, locale)}
              {comment.editedAt && ` · ${t('discussion.edited')}`}
            </span>
          </div>
          {mode === 'edit' ? (
            <CommentForm
              initial={comment.body}
              submitLabel={t('discussion.save')}
              onCancel={() => setMode('view')}
              onSubmit={async (body) => {
                const ok = await run(() => a.patch(`/comments/${comment.id}`, { body }));
                if (ok) setMode('view');
                return ok;
              }}
            />
          ) : (
            <p className="comment__body">{comment.body}</p>
          )}
          <div className="comment__actions small">
            <VoteBar
              tally={comment.votes}
              compact
              label={t('discussion.commentVote')}
              disabled={!signedIn || comment.mine}
              disabledHint={comment.mine ? t('discussion.ownComment') : t('discussion.signInToVote')}
              onVote={(v) => run(() => a.put(`/comments/${comment.id}/vote`, { value: v }))}
            />
            {signedIn && mode === 'view' && (
              <button type="button" className="link-button" onClick={() => setMode('reply')}>
                {t('discussion.reply')}
              </button>
            )}
            {comment.mine && mode === 'view' && (
              <>
                <button type="button" className="link-button" onClick={() => setMode('edit')}>
                  {t('discussion.edit')}
                </button>
                <button type="button" className="link-button" onClick={() => setMode('confirm-delete')}>
                  {t('discussion.delete')}
                </button>
              </>
            )}
            {!comment.mine && mode === 'view' && <ReportForm targetType="comment" targetId={comment.id} compact />}
            {mode === 'confirm-delete' && (
              <span className="comment__confirm">
                {t('discussion.deleteConfirm')}{' '}
                <button type="button" className="link-button link-button--danger" onClick={() => run(() => a.del(`/comments/${comment.id}`))}>
                  {t('discussion.deleteYes')}
                </button>{' '}
                <button type="button" className="link-button" onClick={() => setMode('view')}>
                  {t('app.cancel')}
                </button>
              </span>
            )}
          </div>
        </>
      )}
      {mode === 'reply' && (
        <CommentForm
          placeholder={t('discussion.replyPlaceholder')}
          submitLabel={t('discussion.post')}
          onCancel={() => setMode('view')}
          onSubmit={async (body) => {
            const ok = await run(() => a.post(`/theories/${encodeURIComponent(slug)}/comments`, { body, parentId: replyTo, language: locale }));
            if (ok) setMode('view');
            return ok;
          }}
        />
      )}
      {comment.replies.length > 0 && (
        <ul className="list-plain comment__replies">
          {comment.replies.map((r) => (
            <CommentItem key={r.id} comment={r} signedIn={signedIn} run={run} a={a} slug={slug} isReply />
          ))}
        </ul>
      )}
    </li>
  );
}

function CommentForm({
  initial = '',
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [body, setBody] = useState(initial);
  const [sending, setSending] = useState(false);
  const length = body.trim().length;
  const ready = length >= COMMENT_LIMITS.minChars && length <= COMMENT_LIMITS.maxChars && !sending;
  return (
    <form
      className="comment-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        setSending(true);
        const ok = await onSubmit(body.trim());
        setSending(false);
        if (ok && !initial) setBody('');
      }}
    >
      <textarea
        aria-label={placeholder ?? submitLabel}
        placeholder={placeholder}
        maxLength={COMMENT_LIMITS.maxChars}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={initial ? 4 : 3}
      />
      <div className="btn-row comment-form__row">
        <span className="muted small">{t('discussion.chars', { count: length, max: COMMENT_LIMITS.maxChars })}</span>
        {onCancel && (
          <button type="button" className="btn btn--ghost btn--small" onClick={onCancel}>
            {t('app.cancel')}
          </button>
        )}
        <button type="submit" className="btn btn--primary btn--small" disabled={!ready}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Thumbs up / down with counts. Clicking the active vote again takes it back. */
function VoteBar({
  tally,
  label,
  disabled,
  disabledHint,
  onVote,
  compact,
}: {
  tally: VoteTally;
  label: string;
  disabled: boolean;
  disabledHint: string;
  onVote: (v: VoteValue) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const vote = (v: 1 | -1) => onVote(tally.myVote === v ? 0 : v);
  return (
    <div className={`vote-bar${compact ? ' vote-bar--compact' : ''}`} role="group" aria-label={label} title={disabled ? disabledHint : undefined}>
      {!compact && <span className="vote-bar__label small">{label}</span>}
      <button
        type="button"
        className={`vote-bar__btn vote-bar__btn--up${tally.myVote === 1 ? ' is-active' : ''}`}
        aria-pressed={tally.myVote === 1}
        aria-label={t('discussion.voteUp')}
        disabled={disabled}
        onClick={() => vote(1)}
      >
        <span aria-hidden="true">▲</span> {tally.up}
      </button>
      <button
        type="button"
        className={`vote-bar__btn vote-bar__btn--down${tally.myVote === -1 ? ' is-active' : ''}`}
        aria-pressed={tally.myVote === -1}
        aria-label={t('discussion.voteDown')}
        disabled={disabled}
        onClick={() => vote(-1)}
      >
        <span aria-hidden="true">▼</span> {tally.down}
      </button>
    </div>
  );
}
