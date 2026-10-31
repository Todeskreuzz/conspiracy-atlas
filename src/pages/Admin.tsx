import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api, ApiFailure } from '../api/client';
import { adminApi, refreshAdminSession, setAdminSession, useAdminSession } from '../api/admin';
import { BACKUP_TABLES } from '../../shared/backup-core.mjs';
import {
  CATEGORY_SLUGS,
  EVIDENCE_RELATIONS,
  EVIDENCE_STATUSES,
  SOURCE_TYPES,
  SUBMISSION_STATUSES,
  type CategorySlug,
  type EvidenceStatus,
  type SubmissionStatus,
} from '../../shared/constants';
import type { AdminCaseNote, Paged, Source, TheoryDetail, TheorySummary } from '../../shared/types';
import type { RichNode } from '../../shared/richtext';
import { LoadState, Unavailable } from '../components/Unavailable';
import { RichText } from '../components/RichText';
import { RichEditor } from '../components/RichEditor';
import { StatusBadge } from '../components/Badges';
import { SourceItem } from '../components/SourceItem';
import { Pagination } from '../components/TheoryCard';
import { ImageGallery } from '../components/ImageGallery';
import { Avatar } from '../components/ProfileView';
import { ImageUploader, toUploads, type PickedImage } from '../components/ImageUploader';
import type { PublicImage } from '../../shared/images';

type Api = ReturnType<typeof adminApi>;

function LoginForm() {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ csrfToken: string; username: string }>('/admin/login', { method: 'POST', body: { username, password }, localized: false });
      setPassword('');
      setAdminSession({ authenticated: true, available: true, csrfToken: r.csrfToken, username: r.username, viaAccount: false, canManageOwners: true });
    } catch (err) {
      setError(err instanceof ApiFailure ? err : null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="paper" style={{ maxWidth: 420 }} onSubmit={submit} data-testid="admin-login">
      <h2>{t('admin.login')}</h2>
      <div className="field">
        <label htmlFor="a-user">{t('admin.username')}</label>
        <input id="a-user" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="a-pass">{t('admin.password')}</label>
        <input id="a-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && (error.unavailable ? <Unavailable feature="admin_panel" state={error.state!} /> : <p className="notice notice--error">{error.status === 429 ? error.message : t('admin.loginFailed')}</p>)}
      <button className="btn btn--primary" disabled={busy || !username || !password}>
        {t('admin.login')}
      </button>
    </form>
  );
}

// ----------------------------------------------------------------------------------- moderation

interface SubmissionView {
  id: number;
  title: string;
  subtitle: string | null;
  summary: string;
  body: RichNode;
  category: CategorySlug;
  tags: string[];
  sources: Array<{ title: string; url: string | null; publisher: string | null; sourceType: string }>;
  documentLinks: string[];
  counterArguments: string[];
  relatedEvents: string[];
  relatedTheoryIds: number[];
  language: 'en' | 'de';
  displayMode: 'named' | 'anonymous';
  authorName: string;
  status: SubmissionStatus;
  moderatorNote: string | null;
  publishedTheorySlug: string | null;
  createdAt: string;
  history?: Array<{ action: string; note: string | null; actor: string; created_at: string }>;
  images?: PublicImage[];
}

const ACTIONS_FOR: Record<SubmissionStatus, string[]> = {
  draft: [],
  pending_review: ['approve', 'request_changes', 'reject', 'withdraw'],
  changes_requested: ['approve', 'reject'],
  approved: ['publish', 'request_changes', 'reject', 'withdraw'],
  rejected: [],
  published: ['withdraw'],
  withdrawn: [],
};

function Moderation({ a }: { a: Api }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<SubmissionStatus>('pending_review');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<SubmissionView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const overview = useAsync(() => a.get<{ submissions: Record<string, number>; openReports: number }>('/overview'), [selectedId, status]);
  const list = useAsync(() => a.get<Paged<SubmissionView>>(`/submissions?status=${status}&page=${page}`), [status, page, selectedId]);
  const detail = useAsync(() => (selectedId ? a.get<SubmissionView>(`/submissions/${selectedId}`) : Promise.resolve(null)), [selectedId]);
  const s = detail.data;

  const act = async (action: string) => {
    if (!s) return;
    setMessage(null);
    try {
      const r = await a.post<{ status: string; publishedSlug: string | null }>(`/submissions/${s.id}/action`, { action, note: note || null });
      setNote('');
      setMessage(`${t(`admin.actions.${action}`)} ✓${r.publishedSlug ? ` → /theory/${r.publishedSlug}` : ''}`);
      detail.reload();
      list.reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const saveEdit = async () => {
    if (!editing) return;
    try {
      await a.patch(`/submissions/${editing.id}`, editing);
      setEditing(null);
      detail.reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div className="two-col" style={{ gridTemplateColumns: '320px minmax(0,1fr)' }}>
      <aside className="panel">
        <div className="field">
          <label htmlFor="m-status">{t('admin.queue')}</label>
          <select
            id="m-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as SubmissionStatus);
              setPage(1);
            }}
          >
            {SUBMISSION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {t(`admin.statuses.${st}`)} {overview.data?.submissions[st] ? `(${overview.data.submissions[st]})` : ''}
              </option>
            ))}
          </select>
        </div>
        <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
        {list.data?.items.length === 0 && <p className="muted small">{t('admin.noItems')}</p>}
        <ul className="list-plain small" data-testid="moderation-list">
          {list.data?.items.map((it) => (
            <li key={it.id}>
              <button className="linklike" onClick={() => setSelectedId(it.id)} style={{ fontWeight: it.id === selectedId ? 700 : 400 }}>
                #{it.id} {it.title}
              </button>
              <div className="muted">
                {it.authorName} · {formatDate(it.createdAt, locale)}
              </div>
            </li>
          ))}
        </ul>
        {list.data && <Pagination page={page} hasMore={list.data.hasMore} onPage={setPage} />}
      </aside>
      <section>
        {message && <p className="notice">{message}</p>}
        {!s && !detail.loading && <p className="muted">{t('admin.noItems')}</p>}
        {s && !editing && (
          <article className="paper" data-testid="submission-detail">
            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <span className="typewriter">{t(`admin.statuses.${s.status}`)}</span>
              <span className="small muted">
                {t('admin.author')}: {s.authorName} ({s.displayMode}) · {s.language.toUpperCase()}
              </span>
            </div>
            <h2 style={{ marginTop: 10 }}>{s.title}</h2>
            {s.subtitle && <p className="muted">{s.subtitle}</p>}
            <p>
              <strong>{s.summary}</strong>
            </p>
            <RichText doc={s.body} />
            {s.images && s.images.length > 0 && (
              <>
                <h4>{t('submit.uploads')}</h4>
                <ImageGallery images={s.images} />
              </>
            )}
            <h4>{t('submit.sources')}</h4>
            <ul className="small">
              {s.sources.map((src, i) => (
                <li key={i}>
                  {src.title} {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer nofollow">{src.url}</a>} <span className="muted">({src.sourceType})</span>
                </li>
              ))}
              {s.documentLinks.map((l) => (
                <li key={l}>
                  <a href={l} target="_blank" rel="noopener noreferrer nofollow">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
            {s.counterArguments.length > 0 && (
              <>
                <h4>{t('theory.counterArguments')}</h4>
                {s.counterArguments.map((c, i) => (
                  <div className="counter small" key={i}>
                    {c}
                  </div>
                ))}
              </>
            )}
            {s.relatedEvents.length > 0 && <p className="small">{t('submit.relatedEvents')}: {s.relatedEvents.join(' · ')}</p>}
            {s.relatedTheoryIds.length > 0 && <p className="small">{t('submit.relatedTheories')}: #{s.relatedTheoryIds.join(', #')}</p>}
            {s.publishedTheorySlug && (
              <p>
                <Link to={`/theory/${s.publishedTheorySlug}`}>/theory/{s.publishedTheorySlug}</Link>
              </p>
            )}
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="m-note">{t('admin.note')}</label>
              <textarea id="m-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="btn-row">
              {ACTIONS_FOR[s.status].map((action) => (
                <button key={action} className={`btn btn--small ${action === 'publish' || action === 'approve' ? 'btn--primary' : ''}`} onClick={() => act(action)}>
                  {t(`admin.actions.${action}`)}
                </button>
              ))}
              {['pending_review', 'changes_requested', 'approved'].includes(s.status) && (
                <button className="btn btn--small btn--ghost" style={{ color: 'var(--paper-ink)' }} onClick={() => setEditing(s)}>
                  {t('admin.editSubmission')}
                </button>
              )}
            </div>
            {s.history && s.history.length > 0 && (
              <>
                <h4 style={{ marginTop: 16 }}>{t('admin.history')}</h4>
                <ul className="small">
                  {s.history.map((h, i) => (
                    <li key={i}>
                      {formatDate(h.created_at, locale)} · {h.action} · {h.actor} {h.note && `– ${h.note}`}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>
        )}
        {editing && (
          <div className="panel">
            <div className="field">
              <label>{t('submit.titleField')}</label>
              <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('submit.subtitle')}</label>
              <input type="text" value={editing.subtitle ?? ''} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value || null })} />
            </div>
            <div className="field">
              <label>{t('submit.summary')}</label>
              <textarea value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('submit.category')}</label>
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as CategorySlug })}>
                {CATEGORY_SLUGS.map((c) => (
                  <option key={c} value={c}>
                    {t(`categories.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <RichEditor value={editing.body} onChange={(body) => setEditing({ ...editing, body })} />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn--primary btn--small" onClick={saveEdit}>
                {t('admin.saveChanges')}
              </button>
              <button className="btn btn--small" onClick={() => setEditing(null)}>
                {t('app.cancel')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------------- reports

function Reports({ a }: { a: Api }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const list = useAsync(() => a.get<Paged<Record<string, string | number>>>(`/reports?status=${status}`), [status]);
  const resolve = async (id: number, s: 'resolved' | 'dismissed') => {
    await a.post(`/reports/${id}`, { status: s });
    list.reload();
  };
  return (
    <div>
      <div className="adm-toolbar">
        <label className="adm-control">
          <span>{t('admin.status')}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {(['open', 'resolved', 'dismissed'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`admin.reportStatus.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <p className="muted">{t('admin.noItems')}</p>}
      <div className="table-wrap">
        <table className="data">
          {!!list.data?.items.length && (
            <thead>
              <tr>
                <th>#</th>
                <th>{t('admin.target')}</th>
                <th>{t('admin.reportCols.reason')}</th>
                <th>{t('admin.reportCols.details')}</th>
                <th>{t('admin.reportCols.date')}</th>
                <th />
              </tr>
            </thead>
          )}
          <tbody>
            {list.data?.items.map((r) => (
              <tr key={r.id}>
                <td className="mono">#{r.id}</td>
                <td>
                  {r.target_type} #{r.target_id}
                </td>
                <td>{t(`report.reasons.${r.reason}`)}</td>
                <td>{r.details}</td>
                <td>{formatDate(String(r.created_at), locale)}</td>
                <td>
                  {status === 'open' && (
                    <div className="btn-row">
                      <button className="btn btn--small" onClick={() => resolve(Number(r.id), 'resolved')}>
                        {t('admin.resolve')}
                      </button>
                      <button className="btn btn--small btn--ghost" onClick={() => resolve(Number(r.id), 'dismissed')}>
                        {t('admin.dismiss')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------- community notes

function Notes({ a }: { a: Api }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<AdminCaseNote['status']>('pending');
  const list = useAsync(() => a.get<Paged<AdminCaseNote>>(`/notes?status=${status}`), [status]);
  const decide = async (id: number, s: AdminCaseNote['status']) => {
    await a.post(`/notes/${id}`, { status: s });
    list.reload();
  };
  const remove = async (id: number) => {
    await a.del(`/notes/${id}`);
    list.reload();
  };
  return (
    <div data-testid="admin-notes">
      <div className="adm-toolbar">
        <label className="adm-control">
          <span>{t('admin.status')}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {(['pending', 'approved', 'rejected'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`admin.noteStatus.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <p className="muted">{t('admin.noItems')}</p>}
      {list.data?.items.map((n) => (
        <div key={n.id} className="panel" style={{ marginBottom: 10 }}>
          <div className="small muted">
            #{n.id} · <span className="tag">{t(`notes.kinds.${n.kind}`)}</span> · <Link to={`/theory/${n.theory.slug}`}>{n.theory.title}</Link> · {n.authorName} · {n.language.toUpperCase()} ·{' '}
            {formatDate(n.createdAt, locale)}
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
          {n.sourceUrl && (
            <p className="small">
              {n.sourceTitle && <strong>{n.sourceTitle}: </strong>}
              <a href={n.sourceUrl} target="_blank" rel="nofollow noopener noreferrer">
                {n.sourceUrl}
              </a>
            </p>
          )}
          <div className="btn-row">
            {status !== 'approved' && (
              <button className="btn btn--small btn--primary" onClick={() => decide(n.id, 'approved')}>
                {t('admin.approve')}
              </button>
            )}
            {status !== 'rejected' && (
              <button className="btn btn--small" onClick={() => decide(n.id, 'rejected')}>
                {t('admin.reject')}
              </button>
            )}
            <button className="btn btn--small btn--ghost" onClick={() => remove(n.id)}>
              {t('admin.deleteNote')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------------- accounts

interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  status: 'active' | 'locked';
  createdAt: string;
  allowAnimated: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  avatarUrl: string | null;
  submissions: number;
}
interface AdminProfileImage {
  id: string;
  url: string;
  slot: 'avatar' | 'banner';
  mime: string;
  size: number;
  userId: number;
  username: string;
  userStatus: string;
  createdAt: string;
}

type Rank = 'member' | 'admin' | 'owner';
const rankOf = (u: AdminUser): Rank => (u.isOwner ? 'owner' : u.isAdmin ? 'admin' : 'member');

/** Actions that move an account from one rank to another (owners are admins implicitly). */
function rankActions(from: Rank, to: Rank): string[] {
  if (from === to) return [];
  if (to === 'owner') return ['make_owner'];
  if (to === 'admin') return from === 'owner' ? ['remove_owner', 'make_admin'] : ['make_admin'];
  return from === 'owner' ? ['remove_owner', 'remove_admin'] : ['remove_admin'];
}

function Users({ a, canManageOwners }: { a: Api; canManageOwners: boolean }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [imagePage, setImagePage] = useState(1);
  const [showImages, setShowImages] = useState(true);
  const images = useAsync(() => (showImages ? a.get<Paged<AdminProfileImage>>(`/profile-images?page=${imagePage}`) : Promise.resolve(null)), [imagePage, showImages]);
  const users = useAsync(() => a.get<Paged<AdminUser>>(`/users?page=${page}&q=${encodeURIComponent(q)}`), [page, q]);
  const [error, setError] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
    images.reload();
    users.reload();
  };
  const changeRank = (u: AdminUser, to: Rank) => {
    const from = rankOf(u);
    if (from === to) return;
    if (to !== 'member' && !window.confirm(t(to === 'owner' ? 'admin.users.confirmOwner' : 'admin.users.confirmAdmin', { name: u.username }))) return;
    void act(async () => {
      for (const action of rankActions(from, to)) await a.post(`/users/${u.id}`, { action });
    });
  };

  return (
    <div data-testid="admin-users">
      <ul className="adm-legend">
        <li>
          <strong>{t('admin.users.rank')}:</strong> {t('admin.users.legendRank')}
        </li>
        <li>
          <strong>{t('admin.users.gif')}:</strong> {t('admin.users.legendGif')}
        </li>
        <li>
          <strong>{t('admin.users.lock')}:</strong> {t('admin.users.legendLock')}
        </li>
      </ul>
      {error && <p className="notice notice--error">{error}</p>}

      <div className="adm-toolbar">
        <input type="search" placeholder={t('admin.users.search')} aria-label={t('admin.users.search')} value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        {users.data && <span className="small muted">{t('admin.users.count', { n: users.data.items.length })}</span>}
      </div>
      <LoadState loading={users.loading} error={users.error} onRetry={users.reload} />
      {users.data?.items.length === 0 && <p className="adm-empty">{t('admin.noItems')}</p>}
      <div className="adm-users">
        {users.data?.items.map((u) => {
          const rank = rankOf(u);
          const protectedOwner = u.isOwner && !canManageOwners;
          return (
            <article key={u.id} className={`adm-user${u.status === 'locked' ? ' adm-user--locked' : ''}`} data-testid="admin-user">
              <div className="adm-user__who">
                <Avatar url={u.avatarUrl} name={u.displayName} size="small" />
                <div>
                  <div className="adm-user__name">
                    {u.displayName}
                    <span className={`adm-pill adm-pill--${rank}`}>{t(`admin.users.ranks.${rank}`)}</span>
                    <span className={`adm-pill adm-pill--${u.status}`}>{t(`admin.users.status.${u.status}`)}</span>
                  </div>
                  <div className="small muted">
                    <Link to={`/u/${u.username}`}>@{u.username}</Link> · {t('admin.users.joined')} {formatDate(u.createdAt, locale)} · {t('admin.users.submissionsN', { n: u.submissions })}
                  </div>
                </div>
              </div>
              <div className="adm-user__controls">
                <label className="adm-control">
                  <span>{t('admin.users.rank')}</span>
                  <select value={rank} disabled={protectedOwner} onChange={(e) => changeRank(u, e.target.value as Rank)} title={protectedOwner ? t('admin.users.ownerOnly') : undefined}>
                    <option value="member">{t('admin.users.ranks.member')}</option>
                    <option value="admin">{t('admin.users.ranks.admin')}</option>
                    <option value="owner" disabled={!canManageOwners}>
                      {t('admin.users.ranks.owner')}
                    </option>
                  </select>
                </label>
                <label className="adm-control adm-control--switch" title={u.isAdmin ? t('admin.users.gifAdmin') : undefined}>
                  <span>{t('admin.users.gif')}</span>
                  <span className="adm-switch">
                    <input
                      type="checkbox"
                      role="switch"
                      disabled={u.isAdmin}
                      checked={u.allowAnimated || u.isAdmin}
                      onChange={(e) => void act(() => a.post(`/users/${u.id}`, { action: e.target.checked ? 'allow_gif' : 'disallow_gif' }))}
                    />
                    <span className="small">{u.isAdmin ? t('admin.users.gifAlways') : u.allowAnimated ? t('admin.users.allowed') : t('admin.users.notAllowed')}</span>
                  </span>
                </label>
                <div className="adm-user__buttons">
                  <button className="btn btn--small" disabled={protectedOwner} onClick={() => void act(() => a.post(`/users/${u.id}`, { action: u.status === 'active' ? 'lock' : 'unlock' }))}>
                    {u.status === 'active' ? t('admin.users.lock') : t('admin.users.unlock')}
                  </button>
                  <button
                    className="btn btn--small adm-danger"
                    disabled={protectedOwner}
                    onClick={() => {
                      if (window.confirm(t('admin.users.confirmDelete', { name: u.username }))) void act(() => a.del(`/users/${u.id}`));
                    }}
                  >
                    {t('admin.users.delete')}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {users.data && <Pagination page={users.data.page} hasMore={users.data.hasMore} onPage={setPage} />}

      <section className="adm-subsection">
        <div className="adm-subsection__head">
          <div>
            <h3>{t('admin.users.imagesTitle')}</h3>
            <p className="small muted">{t('admin.users.imagesIntro')}</p>
          </div>
          <button className="btn btn--small" onClick={() => setShowImages((v) => !v)} aria-expanded={showImages}>
            {showImages ? t('admin.users.hideImages') : t('admin.users.showImages')}
          </button>
        </div>
        {showImages && (
          <>
            <LoadState loading={images.loading} error={images.error} onRetry={images.reload} />
            {images.data?.items.length === 0 && <p className="adm-empty">{t('admin.noItems')}</p>}
            <div className="adm-images">
              {images.data?.items.map((img) => (
                <figure key={img.id} className="adm-image">
                  <img src={img.url} alt="" loading="lazy" />
                  <figcaption className="small">
                    <Link to={`/u/${img.username}`}>@{img.username}</Link> · {t(`profileEditor.${img.slot}`)}
                    {img.mime === 'image/gif' ? ' · GIF' : ''}
                    {img.userStatus === 'locked' ? ` · ${t('admin.users.status.locked')}` : ''}
                    <div className="muted">{formatDate(img.createdAt, locale)}</div>
                  </figcaption>
                  <button
                    className="btn btn--small adm-danger"
                    onClick={() => {
                      if (window.confirm(t('admin.users.confirmDeleteImage'))) void act(() => a.del(`/profile-images/${img.id}`));
                    }}
                  >
                    {t('admin.users.deleteImage')}
                  </button>
                </figure>
              ))}
            </div>
            {images.data && <Pagination page={images.data.page} hasMore={images.data.hasMore} onPage={setImagePage} />}
          </>
        )}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------------- archive

interface TheoryFormState {
  title: string;
  subtitle: string;
  summary: string;
  background: string;
  originStory: string;
  category: CategorySlug;
  evidenceStatus: EvidenceStatus;
  imagePath: string;
  imageCredit: string;
  tags: string;
  isPublished: boolean;
}

const emptyTheory: TheoryFormState = {
  title: '',
  subtitle: '',
  summary: '',
  background: '',
  originStory: '',
  category: 'history',
  evidenceStatus: 'under_investigation',
  imagePath: '/media/cards/theory.svg',
  imageCredit: '',
  tags: '',
  isPublished: true,
};

function TheoryEditor({ a, slug, onDone }: { a: Api; slug: string | null; onDone: () => void }) {
  const { t } = useI18n();
  const detail = useAsync(() => (slug ? a.get<TheoryDetail & { isPublished: boolean }>(`/theories/${slug}`) : Promise.resolve(null)), [slug]);
  const sources = useAsync(() => a.get<Paged<Source>>('/sources?pageSize=100'), []);
  const [form, setForm] = useState<TheoryFormState | null>(null);
  const [claim, setClaim] = useState({ text: '', evidenceStatus: 'unverified' as EvidenceStatus });
  const [counter, setCounter] = useState({ text: '', claimId: '' });
  const [ev, setEv] = useState({ sourceId: '', target: '', relation: 'supports' });
  const [src, setSrc] = useState({ title: '', publisher: '', author: '', publishedDate: '', sourceType: 'book', isPrimary: false, url: '', qualityNote: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedImage[]>([]);
  const d = detail.data;
  const f: TheoryFormState =
    form ??
    (d
      ? {
          title: d.title,
          subtitle: d.subtitle ?? '',
          summary: d.summary,
          background: d.background ?? '',
          originStory: d.originStory ?? '',
          category: d.category,
          evidenceStatus: d.evidenceStatus,
          imagePath: d.imagePath ?? '',
          imageCredit: d.imageCredit ?? '',
          tags: d.tags.join(', '),
          isPublished: d.isPublished,
        }
      : emptyTheory);
  const set = (patch: Partial<TheoryFormState>) => setForm({ ...f, ...patch });
  const wrap = async (fn: () => Promise<unknown>, ok = '✓') => {
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      detail.reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const payload = () => ({ ...f, subtitle: f.subtitle || null, background: f.background || null, originStory: f.originStory || null, imagePath: f.imagePath || null, imageCredit: f.imageCredit || null, tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean) });
  const save = () =>
    wrap(async () => {
      if (d) await a.put(`/theories/${d.id}`, payload());
      else {
        await a.post('/theories', payload());
        onDone();
      }
    });

  if (slug && !d) return <LoadState loading={detail.loading} error={detail.error} onRetry={detail.reload} />;

  return (
    <div className="grid" data-testid="theory-editor">
      <div className="panel">
        <h3>{t('admin.theoryForm')}</h3>
        <div className="inline-fields">
          <div className="field">
            <label>{t('submit.titleField')}</label>
            <input type="text" value={f.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('submit.subtitle')}</label>
            <input type="text" value={f.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>{t('theory.summary')}</label>
          <textarea value={f.summary} onChange={(e) => set({ summary: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('theory.background')}</label>
          <textarea value={f.background} onChange={(e) => set({ background: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('theory.origin')}</label>
          <textarea value={f.originStory} onChange={(e) => set({ originStory: e.target.value })} />
        </div>
        <div className="inline-fields">
          <div className="field">
            <label>{t('submit.category')}</label>
            <select value={f.category} onChange={(e) => set({ category: e.target.value as CategorySlug })}>
              {CATEGORY_SLUGS.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('archive.filterStatus')}</label>
            <select value={f.evidenceStatus} onChange={(e) => set({ evidenceStatus: e.target.value as EvidenceStatus })}>
              {EVIDENCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('admin.images.cover')}</label>
            <input type="text" value={f.imagePath} onChange={(e) => set({ imagePath: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('theory.imageCredit')}</label>
            <input type="text" maxLength={500} value={f.imageCredit} onChange={(e) => set({ imageCredit: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('submit.tags')}</label>
            <input type="text" value={f.tags} onChange={(e) => set({ tags: e.target.value })} />
          </div>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={f.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} /> {t('admin.published')}
        </label>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn--primary btn--small" onClick={save}>
            {t('app.save')}
          </button>
          <button className="btn btn--small" onClick={onDone}>
            {t('app.back')}
          </button>
          {message && <span className="small">{message}</span>}
        </div>
      </div>

      {d && (
        <>
          <div className="panel" data-testid="theory-images">
            <h3>{t('theory.images')}</h3>
            <p className="muted small">{t('admin.images.hint')}</p>
            {d.images.length > 0 && (
              <ul className="image-uploader__list">
                {d.images.map((img) => (
                  <li key={img.id} className="image-uploader__item">
                    <img src={img.url} alt={img.alt ?? ''} width={img.width} height={img.height} loading="lazy" />
                    <span className="mono small muted">
                      {img.width}×{img.height} · {Math.round(img.size / 1024)} KB{d.imagePath === img.url ? ` · ${t('admin.images.isCover')}` : ''}
                    </span>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn--small"
                        disabled={d.imagePath === img.url}
                        onClick={() =>
                          wrap(async () => {
                            await a.put(`/theories/${d.id}`, { ...payload(), imagePath: img.url });
                            setForm(null);
                          })
                        }
                      >
                        {t('admin.images.setCover')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--small btn--danger"
                        onClick={() =>
                          wrap(async () => {
                            await a.del(`/images/${img.id}`);
                            setForm(null);
                          })
                        }
                      >
                        {t('app.delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ImageUploader images={picked} onChange={setPicked} />
            {picked.length > 0 && (
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn--primary btn--small"
                  onClick={() =>
                    wrap(async () => {
                      await a.post(`/theories/${d.id}/images`, { images: toUploads(picked) });
                      picked.forEach((img) => URL.revokeObjectURL(img.previewUrl));
                      setPicked([]);
                    })
                  }
                >
                  {t('admin.images.upload', { count: picked.length })}
                </button>
              </div>
            )}
          </div>

          <div className="panel">
            <h3>{t('theory.claims')}</h3>
            {d.claims.map((c) => (
              <div key={c.id} className="claim" style={{ background: 'transparent' }}>
                <div>
                  #{c.id} {c.text}
                </div>
                <div className="btn-row">
                  <StatusBadge status={c.evidenceStatus} dark />
                  <select value={c.evidenceStatus} style={{ maxWidth: 220 }} onChange={(e) => wrap(() => a.patch(`/claims/${c.id}`, { text: c.text, evidenceStatus: e.target.value }))}>
                    {EVIDENCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`status.${s}`)}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn--small btn--danger" onClick={() => wrap(() => a.del(`/claims/${c.id}`))}>
                    {t('app.delete')}
                  </button>
                </div>
                {c.evidence.map((e) => (
                  <div key={e.id} className="small">
                    ↳ {e.relation}: {e.source.title}{' '}
                    <button className="linklike" onClick={() => wrap(() => a.del(`/evidence/${e.id}`))}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))}
            <div className="inline-fields">
              <textarea placeholder={t('admin.addClaim')} value={claim.text} onChange={(e) => setClaim({ ...claim, text: e.target.value })} />
              <select value={claim.evidenceStatus} onChange={(e) => setClaim({ ...claim, evidenceStatus: e.target.value as EvidenceStatus })}>
                {EVIDENCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn--small" disabled={!claim.text.trim()} onClick={() => wrap(async () => { await a.post(`/theories/${d.id}/claims`, { ...claim, position: d.claims.length }); setClaim({ ...claim, text: '' }); })}>
              + {t('admin.addClaim')}
            </button>
          </div>

          <div className="panel">
            <h3>{t('theory.counterArguments')}</h3>
            {d.counterArguments.map((c) => (
              <div key={c.id} className="counter small">
                #{c.id} {c.text}{' '}
                <button className="linklike" onClick={() => wrap(() => a.del(`/counter-arguments/${c.id}`))}>
                  ✕
                </button>
              </div>
            ))}
            <div className="inline-fields">
              <textarea placeholder={t('admin.addCounter')} value={counter.text} onChange={(e) => setCounter({ ...counter, text: e.target.value })} />
              <select value={counter.claimId} onChange={(e) => setCounter({ ...counter, claimId: e.target.value })}>
                <option value="">—</option>
                {d.claims.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} {c.text.slice(0, 50)}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn--small" disabled={!counter.text.trim()} onClick={() => wrap(async () => { await a.post(`/theories/${d.id}/counter-arguments`, { text: counter.text, claimId: counter.claimId || null }); setCounter({ text: '', claimId: '' }); })}>
              + {t('admin.addCounter')}
            </button>
          </div>

          <div className="panel">
            <h3>{t('admin.attachSource')}</h3>
            <div className="inline-fields">
              <select value={ev.sourceId} onChange={(e) => setEv({ ...ev, sourceId: e.target.value })}>
                <option value="">{t('app.sources')} …</option>
                {sources.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} {s.title.slice(0, 70)}
                  </option>
                ))}
              </select>
              <select value={ev.target} onChange={(e) => setEv({ ...ev, target: e.target.value })} aria-label={t('admin.attachTo')}>
                <option value="">{t('admin.theoryLevel')}</option>
                {d.claims.map((c) => (
                  <option key={`c${c.id}`} value={`c${c.id}`}>
                    {t('kinds.claim')} #{c.id}
                  </option>
                ))}
                {d.counterArguments.map((c) => (
                  <option key={`a${c.id}`} value={`a${c.id}`}>
                    {t('relations.counter')} #{c.id}
                  </option>
                ))}
              </select>
              <select value={ev.relation} onChange={(e) => setEv({ ...ev, relation: e.target.value })}>
                {EVIDENCE_RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`evidenceRelations.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn--small"
              disabled={!ev.sourceId}
              onClick={() =>
                wrap(() =>
                  a.post('/evidence', {
                    theoryId: d.id,
                    sourceId: Number(ev.sourceId),
                    claimId: ev.target.startsWith('c') ? Number(ev.target.slice(1)) : null,
                    counterArgumentId: ev.target.startsWith('a') ? Number(ev.target.slice(1)) : null,
                    relation: ev.relation,
                  }),
                )
              }
            >
              {t('admin.attachSource')}
            </button>
            {d.generalSources.map((e) => (
              <div key={e.id} className="small">
                <SourceItem source={e.source} relation={e.relation} />
                <button className="linklike" onClick={() => wrap(() => a.del(`/evidence/${e.id}`))}>
                  ✕
                </button>
              </div>
            ))}
            <details style={{ marginTop: 12 }}>
              <summary>{t('admin.newSource')}</summary>
              <div className="inline-fields" style={{ marginTop: 8 }}>
                <input type="text" placeholder={t('submit.sourceTitle')} value={src.title} onChange={(e) => setSrc({ ...src, title: e.target.value })} />
                <input type="text" placeholder="Publisher" value={src.publisher} onChange={(e) => setSrc({ ...src, publisher: e.target.value })} />
                <input type="text" placeholder="Author" value={src.author} onChange={(e) => setSrc({ ...src, author: e.target.value })} />
                <input type="text" placeholder="YYYY-MM-DD" value={src.publishedDate} onChange={(e) => setSrc({ ...src, publishedDate: e.target.value })} />
                <input type="url" placeholder="https://" value={src.url} onChange={(e) => setSrc({ ...src, url: e.target.value })} />
                <select value={src.sourceType} onChange={(e) => setSrc({ ...src, sourceType: e.target.value })}>
                  {SOURCE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {t(`sourceTypes.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <textarea placeholder={t('theory.quality')} value={src.qualityNote} onChange={(e) => setSrc({ ...src, qualityNote: e.target.value })} />
              <label className="checkbox">
                <input type="checkbox" checked={src.isPrimary} onChange={(e) => setSrc({ ...src, isPrimary: e.target.checked })} /> {t('admin.isPrimary')}
              </label>
              <button
                className="btn btn--small"
                disabled={!src.title.trim()}
                onClick={() =>
                  wrap(async () => {
                    await a.post('/sources', { ...src, url: src.url || null, publishedDate: src.publishedDate || null, publisher: src.publisher || null, author: src.author || null, qualityNote: src.qualityNote || null });
                    sources.reload();
                  })
                }
              >
                {t('app.save')}
              </button>
            </details>
          </div>
        </>
      )}
    </div>
  );
}

function Archive({ a }: { a: Api }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const list = useAsync(() => a.get<Paged<TheorySummary>>(`/theories?page=${page}&q=${encodeURIComponent(q)}`), [page, q, editing]);
  if (editing !== undefined) return <TheoryEditor a={a} slug={editing} onDone={() => setEditing(undefined)} />;
  return (
    <div>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <input type="search" placeholder={t('app.search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 300 }} />
        <button className="btn btn--primary btn--small" onClick={() => setEditing(null)}>
          + {t('admin.newTheory')}
        </button>
        <Link className="btn btn--small" to="/wall?edit=1">
          {t('wall.editMode')}: {t('nav.wall')}
        </Link>
      </div>
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
      <div className="table-wrap">
        <table className="data">
          <tbody>
            {list.data?.items.map((th) => (
              <tr key={th.id}>
                <td>
                  <button className="linklike" onClick={() => setEditing(th.slug)}>
                    {th.title}
                  </button>
                </td>
                <td>
                  <StatusBadge status={th.evidenceStatus} dark />
                </td>
                <td>{t(`categories.${th.category}`)}</td>
                <td className="small muted">{th.origin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && <Pagination page={page} hasMore={list.data.hasMore} onPage={setPage} />}
    </div>
  );
}

// ----------------------------------------------------------------------------------- services & backup

interface ServiceRow {
  service: string;
  enabled: boolean;
  state: string;
  test: string;
  lastOk: string | null;
  freeLimit: string;
  usage: string;
  tableCounts?: Record<string, number> | null;
}

function Services({ a }: { a: Api }) {
  const { t, locale } = useI18n();
  const [counts, setCounts] = useState(false);
  const res = useAsync(() => a.get<{ services: ServiceRow[]; usageNote: string }>(`/services${counts ? '?counts=1' : ''}`), [counts]);
  return (
    <div>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className="btn btn--small" onClick={res.reload}>
          {t('admin.services.refresh')}
        </button>
        <button className="btn btn--small btn--ghost" onClick={() => setCounts(true)}>
          {t('admin.services.counts')}
        </button>
      </div>
      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {res.data && (
        <>
          <p className="notice">{res.data.usageNote}</p>
          <div className="table-wrap">
            <table className="data" data-testid="services-table">
              <thead>
                <tr>
                  <th>{t('admin.services.service')}</th>
                  <th>{t('admin.services.enabled')}</th>
                  <th>{t('admin.services.state')}</th>
                  <th>{t('admin.services.test')}</th>
                  <th>{t('admin.services.lastOk')}</th>
                  <th>{t('admin.services.limit')}</th>
                  <th>{t('admin.services.usage')}</th>
                </tr>
              </thead>
              <tbody>
                {res.data.services.map((s) => (
                  <tr key={s.service}>
                    <td>{s.service}</td>
                    <td>{s.enabled ? '✓' : '✕'}</td>
                    <td className="mono small">{s.state}</td>
                    <td className="small">{s.test}</td>
                    <td className="small">{s.lastOk ? formatDate(s.lastOk, locale) + ' ' + s.lastOk.slice(11, 19) : '—'}</td>
                    <td className="small">{s.freeLimit}</td>
                    <td className="small">
                      {s.usage}
                      {s.tableCounts && (
                        <div className="mono">
                          {Object.entries(s.tableCounts).map(([k, v]) => (
                            <div key={k}>
                              {k}: {v}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Backup() {
  const { t } = useI18n();
  const [table, setTable] = useState('theories');
  return (
    <div className="panel">
      <p>{t('admin.backup.intro')}</p>
      <div className="btn-row">
        <a className="btn btn--primary" href="/api/admin/export?format=json" download>
          {t('admin.backup.json')}
        </a>
        <select value={table} onChange={(e) => setTable(e.target.value)} style={{ maxWidth: 240 }}>
          {BACKUP_TABLES.map((tb) => (
            <option key={tb} value={tb}>
              {tb}
            </option>
          ))}
        </select>
        <a className="btn" href={`/api/admin/export?format=csv&table=${table}`} download>
          {t('admin.backup.csv')}
        </a>
      </div>
      <p className="mono small" style={{ marginTop: 12 }}>
        {t('admin.backup.restore')}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------------- page

type SectionKey = 'overview' | 'moderation' | 'notes' | 'reports' | 'users' | 'archive' | 'services' | 'backup';
interface Overview {
  submissions: Record<string, number>;
  openReports: number;
  pendingNotes: number;
  accounts?: { total: number; locked: number; newImages: number };
}

const SECTION_GROUPS: readonly { group: string; items: readonly SectionKey[] }[] = [
  { group: 'start', items: ['overview'] },
  { group: 'review', items: ['moderation', 'notes', 'reports'] },
  { group: 'manage', items: ['users', 'archive'] },
  { group: 'system', items: ['services', 'backup'] },
];
const SECTION_KEYS = SECTION_GROUPS.flatMap((g) => g.items);
const SECTION_ICONS: Record<SectionKey, string> = {
  overview: '⌂',
  moderation: '✉',
  notes: '✎',
  reports: '⚑',
  users: '☺',
  archive: '▤',
  services: '⚙',
  backup: '⇩',
};

/** Open work per section; only the review sections have a queue. */
function pendingCount(key: SectionKey, o: Overview | null | undefined): number {
  if (!o) return 0;
  if (key === 'moderation') return o.submissions.pending_review ?? 0;
  if (key === 'notes') return o.pendingNotes;
  if (key === 'reports') return o.openReports;
  return 0;
}

function OverviewPanel({ data, onOpen, who }: { data: Overview | null | undefined; onOpen: (k: SectionKey) => void; who: string | null }) {
  const { t } = useI18n();
  const queues = (['moderation', 'notes', 'reports'] as const).map((k) => ({ k, n: pendingCount(k, data) }));
  const open = queues.filter((q) => q.n > 0);
  return (
    <div data-testid="admin-overview">
      <p className="adm-welcome">{t('admin.overview.welcome', { name: who ?? 'Admin' })}</p>
      <h3 className="adm-h3">{t('admin.overview.todo')}</h3>
      {data && open.length === 0 && <p className="adm-allclear">✓ {t('admin.overview.allClear')}</p>}
      <div className="adm-tiles">
        {queues.map(({ k, n }) => (
          <button key={k} type="button" className={`adm-tile${n > 0 ? ' adm-tile--hot' : ''}`} data-flag={t('admin.overview.urgent')} onClick={() => onOpen(k)}>
            <span className="adm-tile__icon" aria-hidden="true">
              {SECTION_ICONS[k]}
            </span>
            <span className="adm-tile__count">{data ? n : '…'}</span>
            <span className="adm-tile__label">{t(`admin.overview.queue.${k}`)}</span>
            <span className="adm-tile__go">{n > 0 ? t('admin.overview.review') : t('admin.overview.open')} →</span>
          </button>
        ))}
        <button type="button" className="adm-tile" onClick={() => onOpen('users')}>
          <span className="adm-tile__icon" aria-hidden="true">
            {SECTION_ICONS.users}
          </span>
          <span className="adm-tile__count">{data?.accounts ? data.accounts.total : '…'}</span>
          <span className="adm-tile__label">{t('admin.overview.accounts', { locked: data?.accounts?.locked ?? 0, images: data?.accounts?.newImages ?? 0 })}</span>
          <span className="adm-tile__go">{t('admin.overview.open')} →</span>
        </button>
      </div>
      <h3 className="adm-h3">{t('admin.overview.all')}</h3>
      <div className="adm-guide">
        {SECTION_KEYS.filter((k) => k !== 'overview').map((k) => (
          <button key={k} type="button" className="adm-guide__item" onClick={() => onOpen(k)}>
            <span className="adm-guide__icon" aria-hidden="true">
              {SECTION_ICONS[k]}
            </span>
            <span>
              <strong>{t(`admin.tabs.${k}`)}</strong>
              <span className="small">{t(`admin.sections.${k}`)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useI18n();
  const session = useAdminSession();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as SectionKey | null;
  const tab: SectionKey = requested && SECTION_KEYS.includes(requested) ? requested : 'overview';
  const setTab = (k: SectionKey) => {
    setParams(k === 'overview' ? {} : { tab: k }, { replace: false });
    window.scrollTo({ top: 0 });
  };
  const authed = session.authenticated && !!session.csrfToken;
  const overview = useAsync(
    () => (authed && session.csrfToken ? adminApi(session.csrfToken).get<Overview>('/overview') : Promise.resolve(null)),
    [authed, tab],
  );

  const logout = async () => {
    try {
      await api('/admin/logout', { method: 'POST', body: {}, localized: false });
    } finally {
      setAdminSession({ authenticated: false, csrfToken: null });
      void refreshAdminSession();
    }
  };

  return (
    <div className="container page">
      <header className="page-header adm-header">
        <div>
          <div className="kicker">{t('nav.admin')}</div>
          <h1>{t('admin.title')}</h1>
        </div>
        {session.authenticated && (
          <div className="adm-session">
            <span className="small">
              {t('admin.signedInAs')} <strong>{session.username}</strong>
            </span>
            {!session.viaAccount && (
              <button className="btn btn--small" onClick={logout}>
                {t('admin.logout')}
              </button>
            )}
          </div>
        )}
      </header>
      {session.loading && <p className="muted loading">{t('app.loading')}</p>}
      {!session.loading && !session.available && (
        <Unavailable feature="admin_panel" state={(session.state as never) ?? 'not_configured'} explanation={session.message?.replace('Currently unavailable! ', '') ?? undefined} />
      )}
      {!session.loading && session.available && !session.authenticated && <LoginForm />}
      {authed && session.csrfToken && (
        <div className="adm-shell">
          <nav className="adm-nav" aria-label={t('admin.title')} role="tablist">
            <div className="adm-nav__tab" aria-hidden="true">
              {t('admin.folderLabel')}
            </div>
            {SECTION_GROUPS.map((g) => (
              <div key={g.group} className="adm-nav__group">
                {g.group !== 'start' && <div className="adm-nav__label">{t(`admin.groups.${g.group}`)}</div>}
                {g.items.map((k) => {
                  const n = pendingCount(k, overview.data);
                  return (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} className="adm-nav__item" onClick={() => setTab(k)}>
                      <span className="adm-nav__icon" aria-hidden="true">
                        {SECTION_ICONS[k]}
                      </span>
                      <span className="adm-nav__text">{t(`admin.tabs.${k}`)}</span>
                      {n > 0 && <span className="adm-count">{n}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <section className="adm-main" role="tabpanel">
            <span className="adm-stamp" aria-hidden="true">
              {t('admin.stamp')}
            </span>
            <div className="adm-fileno" aria-hidden="true">
              {t('admin.fileNo', { n: String(SECTION_KEYS.indexOf(tab) + 1).padStart(2, '0') })}
            </div>
            {tab !== 'overview' && (
              <header className="adm-section-head">
                <h2>
                  <span aria-hidden="true">{SECTION_ICONS[tab]}</span> {t(`admin.tabs.${tab}`)}
                </h2>
                <p>{t(`admin.sections.${tab}`)}</p>
              </header>
            )}
            {tab === 'overview' && <OverviewPanel data={overview.data} onOpen={setTab} who={session.username} />}
            {tab === 'moderation' && <Moderation a={adminApi(session.csrfToken)} />}
            {tab === 'notes' && <Notes a={adminApi(session.csrfToken)} />}
            {tab === 'reports' && <Reports a={adminApi(session.csrfToken)} />}
            {tab === 'users' && <Users a={adminApi(session.csrfToken)} canManageOwners={!!session.canManageOwners} />}
            {tab === 'archive' && <Archive a={adminApi(session.csrfToken)} />}
            {tab === 'services' && <Services a={adminApi(session.csrfToken)} />}
            {tab === 'backup' && <Backup />}
          </section>
        </div>
      )}
    </div>
  );
}
