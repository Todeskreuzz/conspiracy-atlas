import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useFeature } from '../api/status';
import { api, ApiFailure } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import type { Paged, SubmissionSourceInput, TheorySummary } from '../../shared/types';
import { CATEGORY_SLUGS, SOURCE_TYPES, type CategorySlug } from '../../shared/constants';
import { emptyDoc, plainText, type RichNode } from '../../shared/richtext';
import { validateSubmission } from '../../shared/submission';
import { ValidationError } from '../../shared/validation';
import { RichEditor } from '../components/RichEditor';
import { RichText } from '../components/RichText';
import { TurnstileWidget } from '../components/Turnstile';
import { Unavailable } from '../components/Unavailable';
import { CategoryBadge } from '../components/Badges';
import { ImageUploader, toUploads, type PickedImage } from '../components/ImageUploader';
import type { ImageUpload } from '../../shared/images';

export interface Draft {
  title: string;
  subtitle: string;
  summary: string;
  body: RichNode;
  category: CategorySlug;
  tags: string;
  sources: SubmissionSourceInput[];
  documentLinks: string[];
  counterArguments: string[];
  relatedEvents: string[];
  relatedTheoryIds: number[];
  language: 'en' | 'de';
  displayMode: 'named' | 'anonymous';
  displayName: string;
}

export const DRAFT_KEY = 'ca.submit.draft';
export const PREFILL_KEY = 'ca.submit.prefill';

export function emptyDraft(language: 'en' | 'de'): Draft {
  return {
    title: '',
    subtitle: '',
    summary: '',
    body: emptyDoc(),
    category: 'history',
    tags: '',
    sources: [],
    documentLinks: [],
    counterArguments: [],
    relatedEvents: [],
    relatedTheoryIds: [],
    language,
    displayMode: 'anonymous',
    displayName: '',
  };
}

function loadDraft(language: 'en' | 'de'): Draft {
  try {
    const prefill = window.sessionStorage.getItem(PREFILL_KEY);
    if (prefill) {
      window.sessionStorage.removeItem(PREFILL_KEY);
      return { ...emptyDraft(language), ...(JSON.parse(prefill) as Partial<Draft>) };
    }
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyDraft(language), ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    /* ignore */
  }
  return emptyDraft(language);
}

/** Converts the editor state into the API payload (also used for client-side validation). */
export function draftToPayload(d: Draft, turnstileToken: string | null, images: ImageUpload[] = []) {
  return {
    title: d.title,
    subtitle: d.subtitle || null,
    summary: d.summary,
    body: d.body,
    category: d.category,
    tags: d.tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    sources: d.sources.filter((s) => s.title.trim()).map((s) => ({ ...s, url: s.url || null, publisher: s.publisher || null })),
    documentLinks: d.documentLinks.map((s) => s.trim()).filter(Boolean),
    counterArguments: d.counterArguments.map((s) => s.trim()).filter(Boolean),
    relatedEvents: d.relatedEvents.map((s) => s.trim()).filter(Boolean),
    relatedTheoryIds: d.relatedTheoryIds,
    language: d.language,
    displayMode: d.displayMode,
    displayName: d.displayMode === 'named' ? d.displayName : null,
    turnstileToken,
    ...(images.length ? { images } : {}),
  };
}

function StringList({ items, onChange, placeholder, addLabel, multiline }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel: string; multiline?: boolean }) {
  return (
    <div>
      {items.map((v, i) => (
        <div key={i} className="repeat-row">
          {multiline ? (
            <textarea value={v} placeholder={placeholder} maxLength={2000} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          ) : (
            <input type="text" value={v} placeholder={placeholder} maxLength={2000} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          )}
          <button type="button" className="btn btn--small btn--ghost" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--small" onClick={() => onChange([...items, ''])}>
        + {addLabel}
      </button>
    </div>
  );
}

export default function SubmitPage() {
  const { t, locale } = useI18n();
  const submissions = useFeature('community_submissions');
  const uploads = useFeature('community_uploads');
  const [draft, setDraft] = useState<Draft>(() => loadDraft(locale));
  const [preview, setPreview] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<ApiFailure | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ id: number } | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  // Images are kept in memory only; they are never written to the local draft.
  const [images, setImages] = useState<PickedImage[]>([]);
  const theories = useAsync((signal) => api<Paged<TheorySummary>>('/theories?pageSize=50&sort=title', { signal }), [locale]);

  // Autosave the draft locally (never sent anywhere until submitted).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedNote(true);
      } catch {
        /* ignore */
      }
    }, 600);
    return () => clearTimeout(id);
  }, [draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const bodyLength = useMemo(() => plainText(draft.body).length, [draft.body]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    try {
      validateSubmission(draftToPayload(draft, token) as unknown as Record<string, unknown>);
    } catch (e) {
      if (e instanceof ValidationError) {
        const field = e.field.split(/[.[]/)[0];
        next[field] = (t(`submit.errors.${field}`) !== `submit.errors.${field}` ? t(`submit.errors.${field}`) : e.message) as string;
      }
    }
    if (!token) next.turnstile = t('submit.errors.turnstile');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!submissions.available || !validate()) return;
    setSending(true);
    try {
      const r = await api<{ id: number }>('/submissions', { method: 'POST', body: draftToPayload(draft, token, uploads.available ? toUploads(images) : []), localized: false });
      setDone(r);
      window.localStorage.removeItem(DRAFT_KEY);
      setDraft(emptyDraft(locale));
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
    } catch (err) {
      setApiError(err instanceof ApiFailure ? err : new ApiFailure(0, 'error', String(err), 'temporary_error'));
      setResetKey((k) => k + 1);
      setToken(null);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="container page">
        <div className="paper" style={{ maxWidth: 640 }}>
          <span className="stamp" style={{ color: '#4f7a45' }}>
            {t('admin.statuses.pending_review')}
          </span>
          <h1 style={{ marginTop: 16 }}>{t('submit.success')}</h1>
          <p className="mono">{t('submit.successId', { id: done.id })}</p>
          <div className="btn-row">
            <Link to="/community" className="btn">
              {t('nav.community')}
            </Link>
            <button className="btn" onClick={() => setDone(null)}>
              {t('nav.submit')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedTheories = (theories.data?.items ?? []).filter((th) => draft.relatedTheoryIds.includes(th.id));

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.submit')}</div>
        <h1>{t('submit.title')}</h1>
        <p>{t('submit.intro')}</p>
        {submissions.loaded && !submissions.available && (
          <Unavailable feature="community_submissions" state={submissions.state} explanation={submissions.message?.replace('Currently unavailable! ', '')} />
        )}
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>
          {t('submit.edit')}
        </button>
        <button role="tab" aria-selected={preview} onClick={() => setPreview(true)}>
          {t('submit.preview')}
        </button>
      </div>

      {preview ? (
        <article className="paper" data-testid="submission-preview">
          <span className="pin" aria-hidden="true" />
          <h1 style={{ marginTop: 14 }}>{draft.title || t('app.untitled')}</h1>
          {draft.subtitle && <p className="muted">{draft.subtitle}</p>}
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <CategoryBadge category={draft.category} />
            <span className="tag">{t('archive.by', { name: draft.displayMode === 'anonymous' ? 'Anonymous' : draft.displayName || '…' })}</span>
          </div>
          <p>
            <strong>{draft.summary}</strong>
          </p>
          <RichText doc={draft.body} />
          {draft.counterArguments.filter(Boolean).length > 0 && (
            <>
              <h2>{t('theory.counterArguments')}</h2>
              {draft.counterArguments.filter(Boolean).map((c, i) => (
                <div className="counter" key={i}>
                  {c}
                </div>
              ))}
            </>
          )}
          {draft.sources.length > 0 && (
            <>
              <h2>{t('submit.sources')}</h2>
              <ul>
                {draft.sources.map((s, i) => (
                  <li key={i}>
                    {s.title} {s.url && <span className="muted small">({s.url})</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      ) : (
        <form onSubmit={submit} noValidate data-testid="submit-form">
          <div className="grid grid--2" style={{ alignItems: 'start' }}>
            <div>
              <div className="field">
                <label htmlFor="s-title">
                  {t('submit.titleField')} <span className="muted">*</span>
                </label>
                <input id="s-title" type="text" maxLength={160} value={draft.title} onChange={(e) => set('title', e.target.value)} aria-invalid={!!errors.title} />
                {errors.title && <span className="error-text">{errors.title}</span>}
              </div>
              <div className="field">
                <label htmlFor="s-subtitle">{t('submit.subtitle')}</label>
                <input id="s-subtitle" type="text" maxLength={200} value={draft.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="s-summary">
                  {t('submit.summary')} <span className="muted">*</span>
                </label>
                <textarea id="s-summary" maxLength={1000} value={draft.summary} onChange={(e) => set('summary', e.target.value)} aria-invalid={!!errors.summary} />
                {errors.summary && <span className="error-text">{errors.summary}</span>}
              </div>
              <div className="field">
                <span className="label" id="s-body-label">
                  {t('submit.body')} <span className="muted">* ({bodyLength})</span>
                </span>
                <RichEditor value={draft.body} onChange={(doc) => set('body', doc)} labelledBy="s-body-label" />
                {errors.body && <span className="error-text">{errors.body}</span>}
              </div>
              <div className="inline-fields">
                <div className="field">
                  <label htmlFor="s-category">{t('submit.category')}</label>
                  <select id="s-category" value={draft.category} onChange={(e) => set('category', e.target.value as CategorySlug)}>
                    {CATEGORY_SLUGS.map((c) => (
                      <option key={c} value={c}>
                        {t(`categories.${c}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="s-lang">{t('submit.language')}</label>
                  <select id="s-lang" value={draft.language} onChange={(e) => set('language', e.target.value as 'en' | 'de')}>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="s-tags">{t('submit.tags')}</label>
                <input id="s-tags" type="text" maxLength={500} value={draft.tags} onChange={(e) => set('tags', e.target.value)} />
              </div>
            </div>

            <div>
              <fieldset className="panel field">
                <legend className="label">{t('submit.sources')}</legend>
                {draft.sources.map((s, i) => (
                  <div key={i} className="repeat-row">
                    <div className="inline-fields">
                      <input type="text" placeholder={t('submit.sourceTitle')} value={s.title} maxLength={300} onChange={(e) => set('sources', draft.sources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                      <input type="url" placeholder={t('submit.sourceUrl')} value={s.url ?? ''} maxLength={2000} onChange={(e) => set('sources', draft.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                      <input type="text" placeholder={t('submit.sourcePublisher')} value={s.publisher ?? ''} maxLength={200} onChange={(e) => set('sources', draft.sources.map((x, j) => (j === i ? { ...x, publisher: e.target.value } : x)))} />
                      <select aria-label={t('submit.sourceType')} value={s.sourceType} onChange={(e) => set('sources', draft.sources.map((x, j) => (j === i ? { ...x, sourceType: e.target.value as SubmissionSourceInput['sourceType'] } : x)))}>
                        {SOURCE_TYPES.map((st) => (
                          <option key={st} value={st}>
                            {t(`sourceTypes.${st}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="button" className="btn btn--small btn--ghost" aria-label="Remove" onClick={() => set('sources', draft.sources.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn--small" onClick={() => set('sources', [...draft.sources, { title: '', url: '', publisher: '', sourceType: 'other' }])}>
                  + {t('submit.addSource')}
                </button>
                {errors.sources && <span className="error-text">{errors.sources}</span>}
              </fieldset>

              <fieldset className="panel field">
                <legend className="label">{t('submit.documentLinks')}</legend>
                <StringList items={draft.documentLinks} onChange={(v) => set('documentLinks', v)} placeholder="https://" addLabel={t('submit.addLink')} />
                {errors.documentLinks && <span className="error-text">{errors.documentLinks}</span>}
              </fieldset>

              <fieldset className="panel field">
                <legend className="label">{t('submit.uploads')}</legend>
                <ImageUploader images={images} onChange={setImages} disabled={!uploads.available} />
                {!uploads.available && <Unavailable feature="community_uploads" state={uploads.state === 'backend_unavailable' ? 'disabled' : uploads.state} compact />}
              </fieldset>

              <fieldset className="panel field">
                <legend className="label">{t('submit.counterArguments')}</legend>
                <StringList items={draft.counterArguments} onChange={(v) => set('counterArguments', v)} addLabel={t('submit.addCounter')} multiline />
              </fieldset>

              <fieldset className="panel field">
                <legend className="label">{t('submit.relatedEvents')}</legend>
                <StringList items={draft.relatedEvents} onChange={(v) => set('relatedEvents', v)} addLabel={t('submit.addEvent')} />
              </fieldset>

              <fieldset className="panel field">
                <legend className="label">{t('submit.relatedTheories')}</legend>
                <p className="help">{t('submit.relatedHint')}</p>
                <select
                  aria-label={t('submit.relatedTheories')}
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id && !draft.relatedTheoryIds.includes(id)) set('relatedTheoryIds', [...draft.relatedTheoryIds, id]);
                  }}
                >
                  <option value="">—</option>
                  {(theories.data?.items ?? []).map((th) => (
                    <option key={th.id} value={th.id}>
                      {th.title}
                    </option>
                  ))}
                </select>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  {selectedTheories.map((th) => (
                    <button type="button" key={th.id} className="chip" aria-pressed="true" onClick={() => set('relatedTheoryIds', draft.relatedTheoryIds.filter((x) => x !== th.id))}>
                      {th.title} ✕
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          <fieldset className="panel field">
            <legend className="label">{t('submit.publication')}</legend>
            <div className="radio-cards">
              <label className="radio-card">
                <input type="radio" name="displayMode" checked={draft.displayMode === 'named'} onChange={() => set('displayMode', 'named')} />
                <strong>{t('submit.named')}</strong>
                <div className="help">{t('submit.displayNameHelp')}</div>
              </label>
              <label className="radio-card">
                <input type="radio" name="displayMode" checked={draft.displayMode === 'anonymous'} onChange={() => set('displayMode', 'anonymous')} />
                <strong>{t('submit.anonymous')}</strong>
                <div className="help">{t('submit.anonymousHelp')}</div>
              </label>
            </div>
            {draft.displayMode === 'named' && (
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="s-name">{t('submit.displayName')}</label>
                <input id="s-name" type="text" maxLength={40} value={draft.displayName} onChange={(e) => set('displayName', e.target.value)} aria-invalid={!!errors.displayName} />
                {errors.displayName && <span className="error-text">{errors.displayName}</span>}
              </div>
            )}
            <p className="help" style={{ marginTop: 10 }}>
              {t('submit.anonymityDisclaimer')} {t('submit.privacy')}
            </p>
          </fieldset>

          <div className="panel field">
            <span className="label">{t('submit.verification')}</span>
            <TurnstileWidget onToken={setToken} resetKey={resetKey} />
            {errors.turnstile && submissions.available && <span className="error-text">{errors.turnstile}</span>}
          </div>

          {apiError &&
            (apiError.unavailable ? (
              <Unavailable feature={apiError.field === 'turnstile' ? 'turnstile' : 'community_submissions'} state={apiError.state!} explanation={apiError.message.replace('Currently unavailable! ', '')} />
            ) : (
              <p className="notice notice--error">{apiError.message}</p>
            ))}

          <div className="btn-row" style={{ marginTop: 12 }}>
            {submissions.available ? (
              <button type="submit" className="btn btn--primary" disabled={sending}>
                {sending ? t('submit.submitting') : t('submit.submit')}
              </button>
            ) : (
              <Unavailable feature="community_submissions" state={submissions.state} compact explanation={submissions.message?.replace('Currently unavailable! ', '')} />
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                window.localStorage.removeItem(DRAFT_KEY);
                setDraft(emptyDraft(locale));
              }}
            >
              {t('submit.clearDraft')}
            </button>
            {savedNote && <span className="small muted">{t('submit.draftSaved')}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
