import { useState } from 'react';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api, ApiFailure } from '../api/client';
import { useFeature } from '../api/status';
import type { CaseNote } from '../../shared/types';
import { TurnstileWidget } from './Turnstile';
import { Unavailable } from './Unavailable';

/** Community notes on a case: approved comments and sources, plus a form that sends new ones to moderation. */
export function CaseNotes({ slug }: { slug: string }) {
  const { t, locale } = useI18n();
  const feature = useFeature('community_submissions');
  const notes = useAsync((signal) => api<{ items: CaseNote[] }>(`/theories/${encodeURIComponent(slug)}/notes`, { signal, localized: false }), [slug]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'source' as CaseNote['kind'], body: '', sourceUrl: '', sourceTitle: '', displayMode: 'anonymous' as 'anonymous' | 'named', displayName: '' });
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<ApiFailure | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const send = async () => {
    setState('sending');
    setError(null);
    try {
      await api(`/theories/${encodeURIComponent(slug)}/notes`, {
        method: 'POST',
        localized: false,
        body: { ...form, sourceUrl: form.sourceUrl.trim() || null, sourceTitle: form.sourceTitle.trim() || null, language: locale, turnstileToken: token },
      });
      setState('sent');
    } catch (e) {
      setError(e instanceof ApiFailure ? e : null);
      setState('idle');
    }
  };

  const items = notes.data?.items ?? [];
  const ready = form.body.trim().length >= 10 && (form.kind === 'comment' || /^https?:\/\/\S+\.\S+/.test(form.sourceUrl.trim())) && (form.displayMode === 'anonymous' || form.displayName.trim()) && token;

  return (
    <section className="paper case-notes" data-testid="case-notes">
      <h2>{t('notes.title')}</h2>
      <p className="muted small">{t('notes.intro')}</p>
      {items.length === 0 && !notes.loading && <p className="muted">{t('notes.empty')}</p>}
      <ul className="list-plain case-notes__list">
        {items.map((n) => (
          <li key={n.id} className="case-note">
            <div className="small muted">
              <span className="tag">{t(`notes.kinds.${n.kind}`)}</span> {n.authorName} · {formatDate(n.createdAt, locale)}
            </div>
            <p>{n.body}</p>
            {n.sourceUrl && (
              <a href={n.sourceUrl} target="_blank" rel="nofollow ugc noopener noreferrer" className="small">
                {n.sourceTitle || n.sourceUrl} ↗
              </a>
            )}
          </li>
        ))}
      </ul>

      {!open && state !== 'sent' && (
        <button type="button" className="btn btn--small" onClick={() => setOpen(true)}>
          + {t('notes.add')}
        </button>
      )}
      {state === 'sent' && <p className="notice notice--ok">{t('notes.sent')}</p>}
      {open && state !== 'sent' && !feature.available && <Unavailable feature="community_submissions" state={feature.state} compact />}
      {open && state !== 'sent' && feature.available && (
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="note-kind">{t('notes.kind')}</label>
            <select id="note-kind" value={form.kind} onChange={(e) => set('kind', e.target.value as CaseNote['kind'])}>
              <option value="source">{t('notes.kinds.source')}</option>
              <option value="comment">{t('notes.kinds.comment')}</option>
            </select>
          </div>
          {form.kind === 'source' && (
            <>
              <div className="field">
                <label htmlFor="note-url">{t('notes.sourceUrl')}</label>
                <input id="note-url" type="url" placeholder="https://" maxLength={2000} value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="note-source-title">{t('notes.sourceTitle')}</label>
                <input id="note-source-title" type="text" maxLength={300} value={form.sourceTitle} onChange={(e) => set('sourceTitle', e.target.value)} />
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="note-body">{form.kind === 'source' ? t('notes.sourceBody') : t('notes.body')}</label>
            <textarea id="note-body" maxLength={2000} value={form.body} onChange={(e) => set('body', e.target.value)} />
          </div>
          <div className="field">
            <label className="checkbox">
              <input type="radio" name="note-display" checked={form.displayMode === 'anonymous'} onChange={() => set('displayMode', 'anonymous')} /> {t('notes.anonymous')}
            </label>
            <label className="checkbox">
              <input type="radio" name="note-display" checked={form.displayMode === 'named'} onChange={() => set('displayMode', 'named')} /> {t('notes.named')}
            </label>
            {form.displayMode === 'named' && (
              <input type="text" aria-label={t('notes.displayName')} placeholder={t('notes.displayName')} maxLength={60} value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
            )}
          </div>
          <p className="small muted">{t('notes.moderationHint')}</p>
          <TurnstileWidget onToken={setToken} />
          {error && (error.unavailable ? <Unavailable state={error.state!} feature="community_submissions" /> : <p className="notice notice--error">{error.message}</p>)}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn--primary btn--small" disabled={state === 'sending' || !ready} onClick={send}>
              {t('notes.send')}
            </button>
            <button className="btn btn--ghost btn--small" onClick={() => setOpen(false)}>
              {t('app.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
