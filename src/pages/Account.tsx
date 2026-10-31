import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { ApiFailure } from '../api/client';
import { accountApi, logout, updateAccountUser, useAccount } from '../api/account';
import { useFeature } from '../api/status';
import { useSaved } from '../saved/store';
import { useAsync } from '../hooks/useAsync';
import { LoadState, Unavailable } from '../components/Unavailable';
import { RichEditor } from '../components/RichEditor';
import { ProfileView } from '../components/ProfileView';
import { compressImage } from '../components/ImageUploader';
import { ANIMATED_IMAGE_MAX_BYTES, bytesToBase64 } from '../../shared/images';
import { RecoveryCodeNotice } from './Login';
import { emptyDoc, type RichNode } from '../../shared/richtext';
import type { TheorySummary } from '../../shared/types';
import {
  PASSWORD_MIN,
  PROFILE_FONTS,
  PROFILE_LAYOUTS,
  PROFILE_LIMITS,
  PROFILE_PATTERNS,
  PROFILE_THEMES,
  type AccountUser,
  type ProfileImageInfo,
  type ProfileImageSlot,
  type ProfileSettings,
  type ProfileSubmission,
  type PublicProfile,
} from '../../shared/profile';

const ACCENTS = ['#c9372c', '#e8c547', '#6f9c63', '#6b8fb3', '#9b6bb3', '#d1813a', '#e8dfcf', '#2b2118'];

interface OwnProfile {
  user: AccountUser;
  profile: ProfileSettings;
  avatar: ProfileImageInfo | null;
  banner: ProfileImageInfo | null;
  /** Animated GIFs are stored as uploaded (only for accounts an editor allowed). */
  allowAnimated: boolean;
}

/** Reads a GIF unchanged (re-encoding would lose the animation). */
async function readGif(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > ANIMATED_IMAGE_MAX_BYTES) throw new Error('too_large');
  return { data: bytesToBase64(bytes), mime: 'image/gif', ...size };
}

function errorText(err: unknown, t: (k: string) => string): string {
  if (err instanceof ApiFailure && err.code === 'wrong_password') return t('account.errors.wrongPassword');
  return (err as Error).message;
}

// ---------------------------------------------------------------------------
// Design editor with live preview
// ---------------------------------------------------------------------------

function ImageField({
  slot,
  value,
  csrf,
  allowAnimated,
  onChange,
}: {
  slot: ProfileImageSlot;
  value: ProfileImageInfo | null;
  csrf: string | null;
  allowAnimated: boolean;
  onChange: (v: ProfileImageInfo | null) => void;
}) {
  const { t } = useI18n();
  const uploads = useFeature('community_uploads');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      let image: { data: string; mime: string; width: number; height: number };
      if (allowAnimated && file.type === 'image/gif') {
        image = await readGif(file).catch((e: Error) => {
          throw new Error(e.message === 'too_large' ? t('profileEditor.gifTooLarge', { max: Math.round(ANIMATED_IMAGE_MAX_BYTES / 1024) }) : t('submit.images.failed', { name: file.name }));
        });
      } else {
        const img = await compressImage(file, slot === 'avatar' ? PROFILE_LIMITS.avatarEdge : PROFILE_LIMITS.bannerEdge);
        URL.revokeObjectURL(img.previewUrl);
        image = { data: img.data, mime: img.mime, width: img.width, height: img.height };
      }
      const r = await accountApi(csrf).put<Record<ProfileImageSlot, ProfileImageInfo>>(`/account/images/${slot}`, { image });
      onChange(r[slot]);
    } catch (err) {
      setError(err instanceof ApiFailure || err instanceof Error ? err.message : t('submit.images.failed', { name: file.name }));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async () => {
    setError(null);
    try {
      await accountApi(csrf).del(`/account/images/${slot}`);
      onChange(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="field">
      <span className="label">{t(`profileEditor.${slot}`)}</span>
      {uploads.loaded && !uploads.available ? (
        <Unavailable feature="community_uploads" state={uploads.state} compact />
      ) : (
        <div className="btn-row">
          <label className={`btn btn--small${busy ? ' is-disabled' : ''}`}>
            {busy ? t('submit.images.compressing') : value ? t('profileEditor.replaceImage') : t('profileEditor.uploadImage')}
            <input ref={input} type="file" accept="image/*" hidden disabled={busy} data-testid={`${slot}-input`} onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          {value && (
            <button type="button" className="btn btn--small btn--ghost" onClick={() => void remove()}>
              {t('profileEditor.removeImage')}
            </button>
          )}
        </div>
      )}
      <span className="help">
        {t(`profileEditor.${slot}Help`)} {allowAnimated ? t('profileEditor.gifAllowed') : t('profileEditor.gifStatic')}
      </span>
      {error && (
        <span className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function DesignEditor({ initial, csrf, publicData }: { initial: OwnProfile; csrf: string | null; publicData: PublicProfile | null }) {
  const { t } = useI18n();
  const saved = useSaved();
  const [displayName, setDisplayName] = useState(initial.user.displayName);
  const [p, setP] = useState<ProfileSettings>(initial.profile);
  const [bio, setBio] = useState<RichNode>(initial.profile.bio ?? emptyDoc());
  const [avatar, setAvatar] = useState(initial.avatar);
  const [banner, setBanner] = useState(initial.banner);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<ProfileSettings>) => {
    setStatus(null);
    setP((cur) => ({ ...cur, ...patch }));
  };

  // Cases that can be pinned: the current favourites plus everything saved in this browser.
  const candidates = useMemo(() => {
    const map = new Map<string, TheorySummary>();
    for (const f of publicData?.favorites ?? []) map.set(f.slug, f);
    for (const c of saved) {
      if (!map.has(c.slug)) map.set(c.slug, { ...c, evidenceStatus: 'unverified', origin: 'editorial', authorName: null, tags: [], updatedAt: c.savedAt });
    }
    return map;
  }, [publicData, saved]);

  const toggleFavorite = (slug: string) => {
    const has = p.favorites.includes(slug);
    if (!has && p.favorites.length >= PROFILE_LIMITS.favorites) return;
    set({ favorites: has ? p.favorites.filter((s) => s !== slug) : [...p.favorites, slug] });
  };
  const moveSection = (i: number, dir: -1 | 1) => {
    const next = [...p.sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ sections: next });
  };

  const preview: PublicProfile = {
    username: initial.user.username,
    displayName: displayName || initial.user.username,
    createdAt: initial.user.createdAt,
    isOwner: true,
    avatar,
    banner,
    profile: { ...p, bio },
    favorites: p.favorites.map((s) => candidates.get(s)).filter((x): x is TheorySummary => !!x),
    submissions: publicData?.submissions ?? [],
    stats: { publishedSubmissions: publicData?.submissions.length ?? 0, favorites: p.favorites.length },
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const links = p.links.filter((l) => l.label.trim() || l.url.trim());
      await accountApi(csrf).put('/account/profile', { displayName, profile: { ...p, links, bio } });
      updateAccountUser({ displayName, avatarUrl: avatar?.url ?? null });
      setStatus({ ok: true, text: t('profileEditor.saved') });
    } catch (err) {
      const field = err instanceof ApiFailure && err.field ? ` (${err.field})` : '';
      setStatus({ ok: false, text: `${(err as Error).message}${field}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-editor">
      <form
        className="profile-editor__form paper"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        data-testid="profile-editor"
      >
        <fieldset>
          <legend>{t('profileEditor.groups.identity')}</legend>
          <div className="field">
            <label htmlFor="pf-name">{t('account.fields.displayName')}</label>
            <input id="pf-name" type="text" value={displayName} maxLength={PROFILE_LIMITS.displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-tagline">{t('profileEditor.tagline')}</label>
            <input id="pf-tagline" type="text" value={p.tagline ?? ''} maxLength={PROFILE_LIMITS.tagline} onChange={(e) => set({ tagline: e.target.value || null })} />
          </div>
          <div className="field">
            <label htmlFor="pf-location">{t('profileEditor.location')}</label>
            <input id="pf-location" type="text" value={p.location ?? ''} maxLength={PROFILE_LIMITS.location} onChange={(e) => set({ location: e.target.value || null })} />
          </div>
          <ImageField slot="avatar" value={avatar} csrf={csrf} allowAnimated={initial.allowAnimated} onChange={setAvatar} />
          <ImageField slot="banner" value={banner} csrf={csrf} allowAnimated={initial.allowAnimated} onChange={setBanner} />
          <div className="field">
            <span className="label" id="pf-bio-label">
              {t('profile.sections.about')}
            </span>
            <RichEditor value={bio} onChange={(d) => { setStatus(null); setBio(d); }} labelledBy="pf-bio-label" />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('profileEditor.groups.look')}</legend>
          <div className="field">
            <span className="label">{t('profileEditor.theme')}</span>
            <div className="theme-picker" role="radiogroup" aria-label={t('profileEditor.theme')}>
              {PROFILE_THEMES.map((th) => (
                <button key={th} type="button" role="radio" aria-checked={p.theme === th} className="theme-chip" data-theme={th} onClick={() => set({ theme: th })}>
                  <span className="theme-chip__swatch" aria-hidden="true" />
                  {t(`profileEditor.themes.${th}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">{t('profileEditor.accent')}</span>
            <div className="accent-picker">
              {ACCENTS.map((c) => (
                <button key={c} type="button" className="accent-swatch" style={{ background: c }} aria-label={c} aria-pressed={p.accent === c} onClick={() => set({ accent: c })} />
              ))}
              <input type="color" value={p.accent} onChange={(e) => set({ accent: e.target.value.toLowerCase() })} aria-label={t('profileEditor.customColor')} />
            </div>
          </div>
          <div className="inline-fields">
            <div className="field">
              <label htmlFor="pf-font">{t('profileEditor.font')}</label>
              <select id="pf-font" value={p.font} onChange={(e) => set({ font: e.target.value as ProfileSettings['font'] })}>
                {PROFILE_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {t(`profileEditor.fonts.${f}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pf-layout">{t('profileEditor.layout')}</label>
              <select id="pf-layout" value={p.layout} onChange={(e) => set({ layout: e.target.value as ProfileSettings['layout'] })}>
                {PROFILE_LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {t(`profileEditor.layouts.${l}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pf-pattern">{t('profileEditor.pattern')}</label>
              <select id="pf-pattern" value={p.pattern} onChange={(e) => set({ pattern: e.target.value as ProfileSettings['pattern'] })}>
                {PROFILE_PATTERNS.map((x) => (
                  <option key={x} value={x}>
                    {t(`profileEditor.patterns.${x}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('profileEditor.groups.sections')}</legend>
          <p className="small muted">{t('profileEditor.sectionsHelp')}</p>
          <ol className="section-order">
            {p.sections.map((s, i) => (
              <li key={s.key}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={s.visible}
                    onChange={(e) => set({ sections: p.sections.map((x) => (x.key === s.key ? { ...x, visible: e.target.checked } : x)) })}
                  />
                  {t(`profile.sections.${s.key}`)}
                </label>
                <span className="btn-row">
                  <button type="button" className="btn btn--small btn--ghost" disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label={t('profileEditor.moveUp')}>
                    ↑
                  </button>
                  <button type="button" className="btn btn--small btn--ghost" disabled={i === p.sections.length - 1} onClick={() => moveSection(i, 1)} aria-label={t('profileEditor.moveDown')}>
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </fieldset>

        <fieldset>
          <legend>{t('profile.sections.favorites')}</legend>
          <p className="small muted">{t('profileEditor.favoritesHelp', { max: PROFILE_LIMITS.favorites })}</p>
          {candidates.size === 0 ? (
            <p className="notice">
              {t('profileEditor.noSaved')} <Link to="/archive">{t('home.browseArchive')} →</Link>
            </p>
          ) : (
            <ul className="favorite-picker">
              {[...candidates.values()].map((c) => (
                <li key={c.slug}>
                  <label className="checkbox">
                    <input type="checkbox" checked={p.favorites.includes(c.slug)} onChange={() => toggleFavorite(c.slug)} />
                    {c.title}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset>
          <legend>{t('profile.sections.links')}</legend>
          {p.links.map((l, i) => (
            <div key={i} className="repeat-row">
              <input
                type="text"
                placeholder={t('profileEditor.linkLabel')}
                aria-label={t('profileEditor.linkLabel')}
                value={l.label}
                maxLength={PROFILE_LIMITS.linkLabel}
                onChange={(e) => set({ links: p.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              />
              <input
                type="url"
                placeholder="https://"
                aria-label={t('profileEditor.linkUrl')}
                value={l.url}
                onChange={(e) => set({ links: p.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
              />
              <button type="button" className="btn btn--small btn--ghost" onClick={() => set({ links: p.links.filter((_, j) => j !== i) })}>
                {t('submit.images.remove')}
              </button>
            </div>
          ))}
          {p.links.length < PROFILE_LIMITS.links && (
            <button type="button" className="btn btn--small" onClick={() => set({ links: [...p.links, { label: '', url: '' }] })}>
              + {t('profileEditor.addLink')}
            </button>
          )}
        </fieldset>

        <fieldset>
          <legend>{t('profileEditor.groups.visibility')}</legend>
          <div className="radio-cards">
            {(['public', 'private'] as const).map((v) => (
              <label key={v} className="radio-card">
                <input type="radio" name="pf-visibility" checked={p.visibility === v} onChange={() => set({ visibility: v })} />
                <strong>{t(`profileEditor.visibility.${v}`)}</strong>
                <span className="small muted">{t(`profileEditor.visibility.${v}Help`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="profile-editor__actions">
          {status && (
            <p className={`notice ${status.ok ? 'notice--ok' : 'notice--error'}`} role="status">
              {status.text}
            </p>
          )}
          <div className="btn-row">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? t('app.loading') : t('profileEditor.save')}
            </button>
            <Link to={`/u/${initial.user.username}`} className="btn btn--ghost">
              {t('profileEditor.viewProfile')}
            </Link>
          </div>
        </div>
      </form>
      <div className="profile-editor__preview">
        <div className="kicker">{t('profileEditor.preview')}</div>
        <ProfileView data={preview} preview />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Own submissions and security settings
// ---------------------------------------------------------------------------

function Submissions({ csrf }: { csrf: string | null }) {
  const { t, locale } = useI18n();
  const list = useAsync((signal) => accountApi(csrf).get<{ items: ProfileSubmission[] }>('/account/submissions', signal), [csrf]);
  if (!list.data) return <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />;
  if (!list.data.items.length) {
    return (
      <p className="notice">
        {t('profileEditor.noSubmissions')} <Link to="/submit">{t('nav.submit')} →</Link>
      </p>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('profileEditor.submissionTitle')}</th>
            <th>{t('profileEditor.submissionStatus')}</th>
            <th>{t('profileEditor.submissionDate')}</th>
          </tr>
        </thead>
        <tbody>
          {list.data.items.map((s) => (
            <tr key={s.id}>
              <td>{s.theorySlug ? <Link to={`/theory/${s.theorySlug}`}>{s.title}</Link> : s.title}</td>
              <td>{t(`admin.statuses.${s.status}`)}</td>
              <td>{formatDate(s.createdAt, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">{t('profileEditor.submissionsHelp')}</p>
    </div>
  );
}

function Security({ csrf, username }: { csrf: string | null; username: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [deletePass, setDeletePass] = useState('');
  const [confirmName, setConfirmName] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, t) });
    }
  };

  if (code) return <RecoveryCodeNotice code={code} onDone={() => setCode(null)} />;
  return (
    <div className="two-col">
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await accountApi(csrf).put('/account/password', { currentPassword: current, newPassword: next });
            setCurrent('');
            setNext('');
            setMsg({ ok: true, text: t('profileEditor.passwordChanged') });
          });
        }}
      >
        <h3>{t('profileEditor.changePassword')}</h3>
        <div className="field">
          <label htmlFor="sec-cur">{t('profileEditor.currentPassword')}</label>
          <input id="sec-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="sec-new">{t('account.fields.newPassword')}</label>
          <input id="sec-new" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} value={next} onChange={(e) => setNext(e.target.value)} required />
          <span className="help">{t('account.fields.passwordHelp', { min: PASSWORD_MIN })}</span>
        </div>
        <div className="btn-row">
          <button type="submit" className="btn btn--primary">
            {t('profileEditor.changePassword')}
          </button>
          <button
            type="button"
            className="btn btn--small"
            disabled={!current}
            onClick={() => void run(async () => setCode((await accountApi(csrf).post<{ recoveryCode: string }>('/account/recovery-code', { currentPassword: current })).recoveryCode))}
          >
            {t('profileEditor.newRecoveryCode')}
          </button>
        </div>
        <p className="small muted">{t('profileEditor.recoveryHelp')}</p>
        {msg && (
          <p className={`notice ${msg.ok ? 'notice--ok' : 'notice--error'}`} role="status">
            {msg.text}
          </p>
        )}
      </form>
      <div className="panel">
        <h3>{t('profileEditor.session')}</h3>
        <button type="button" className="btn" onClick={() => void logout().then(() => navigate('/'))}>
          {t('account.logout')}
        </button>
        <hr />
        <h3>{t('profileEditor.deleteAccount')}</h3>
        <p className="small muted">{t('profileEditor.deleteHelp')}</p>
        <div className="field">
          <label htmlFor="sec-del-name">{t('profileEditor.typeUsername', { name: username })}</label>
          <input id="sec-del-name" type="text" autoComplete="off" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sec-del-pass">{t('profileEditor.currentPassword')}</label>
          <input id="sec-del-pass" type="password" autoComplete="current-password" value={deletePass} onChange={(e) => setDeletePass(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn btn--danger"
          disabled={confirmName.trim().toLowerCase() !== username || !deletePass}
          onClick={() =>
            void run(async () => {
              await accountApi(csrf).del('/account', { currentPassword: deletePass });
              await logout().catch(() => undefined);
              navigate('/');
            })
          }
        >
          {t('profileEditor.deleteAccount')}
        </button>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { t } = useI18n();
  const feature = useFeature('accounts');
  const account = useAccount();
  const [tab, setTab] = useState<'design' | 'submissions' | 'security'>('design');
  const csrf = account.csrfToken;
  const signedIn = !!account.user;
  const own = useAsync((signal) => (signedIn ? accountApi(csrf).get<OwnProfile>('/account/profile', signal) : Promise.resolve(null)), [signedIn, csrf]);
  const username = account.user?.username;
  const pub = useAsync((signal) => (username ? accountApi(csrf).get<PublicProfile>(`/users/${username}`, signal) : Promise.resolve(null)), [username]);
  useEffect(() => {
    if (own.error instanceof ApiFailure && own.error.status === 401) void logout();
  }, [own.error]);

  if (feature.loaded && !feature.available) {
    return (
      <div className="container page">
        <Unavailable feature="accounts" state={feature.state} />
      </div>
    );
  }
  if (!account.loading && !account.user) return <Navigate to="/login?next=/account" replace />;
  return (
    <div className="container page page--wide">
      <header className="page-header">
        <div className="kicker">{t('account.kicker')}</div>
        <h1>{t('profileEditor.title')}</h1>
        <p>{t('profileEditor.intro')}</p>
      </header>
      <div className="tabs" role="tablist">
        {(['design', 'submissions', 'security'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(`profileEditor.tabs.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'design' &&
        (own.data && !pub.loading ? (
          <DesignEditor initial={own.data} csrf={csrf} publicData={pub.data} />
        ) : (
          <LoadState loading={own.loading || pub.loading || account.loading} error={own.error} onRetry={own.reload} />
        ))}
      {tab === 'submissions' && <Submissions csrf={csrf} />}
      {tab === 'security' && account.user && <Security csrf={csrf} username={account.user.username} />}
    </div>
  );
}
