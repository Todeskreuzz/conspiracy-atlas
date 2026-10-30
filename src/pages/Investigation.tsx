import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { getInvestigationKey, invApi } from '../api/investigations';
import { api } from '../api/client';
import type { Board, BoardEdge, BoardNode, Investigation, InvestigationNote, Paged, TheorySummary } from '../../shared/types';
import { INVESTIGATION_NOTE_KINDS, type InvestigationNoteKind } from '../../shared/constants';
import { textToDoc } from '../../shared/richtext';
import { LoadState } from '../components/Unavailable';
import { InvestigationWall, type WallEditor } from '../wall/InvestigationWall';
import { PREFILL_KEY, emptyDraft } from './Submit';

type Detail = Investigation & { notes: InvestigationNote[] };

const NOTE_COLORS: Record<InvestigationNoteKind, string> = {
  note: '#6f655b',
  hypothesis: '#a8581b',
  source: '#4f7a45',
  counter_argument: '#3f6a94',
  document_link: '#5a4a3a',
  timeline_entry: '#7a1f18',
};

export default function InvestigationPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const key = useMemo(getInvestigationKey, []);
  const client = useMemo(() => invApi(key), [key]);
  const [tab, setTab] = useState<'notes' | 'board' | 'timeline'>('notes');
  const detail = useAsync((signal) => client.get<Detail>(`/${encodeURIComponent(id)}`, signal), [id]);
  const board = useAsync((signal) => (tab === 'board' ? client.get<Board>(`/${encodeURIComponent(id)}/board`, signal) : Promise.resolve(null)), [id, tab]);
  const theories = useAsync((signal) => (tab === 'board' ? api<Paged<TheorySummary>>('/theories?pageSize=50&sort=title', { signal }) : Promise.resolve(null)), [tab, locale]);
  const [form, setForm] = useState<{ kind: InvestigationNoteKind; title: string; body: string; url: string; eventDate: string }>({ kind: 'note', title: '', body: '', url: '', eventDate: '' });
  const [error, setError] = useState<string | null>(null);
  const [archivePick, setArchivePick] = useState('');

  const inv = detail.data;
  const notes = inv?.notes ?? [];

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await client.post(`/${id}/notes`, { ...form, url: form.url || null, eventDate: form.eventDate || null });
      setForm({ ...form, title: '', body: '', url: '', eventDate: '' });
      detail.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const deleteNote = async (noteId: number) => {
    await client.del(`/${id}/notes/${noteId}`);
    detail.reload();
  };
  const deleteInvestigation = async () => {
    if (!window.confirm(t('investigations.deleteConfirm'))) return;
    await client.del(`/${id}`);
    navigate('/investigations');
  };
  const publish = () => {
    if (!inv) return;
    const text = notes
      .filter((n) => n.kind === 'note' || n.kind === 'hypothesis')
      .map((n) => `${n.kind === 'hypothesis' ? `[${t('investigations.hypothesisLabel')}] ` : ''}${n.title}\n\n${n.body ?? ''}`)
      .join('\n\n');
    const draft = {
      ...emptyDraft(locale),
      title: inv.title,
      summary: inv.description ?? '',
      body: textToDoc(text),
      sources: notes.filter((n) => n.kind === 'source').map((n) => ({ title: n.title, url: n.url ?? '', publisher: '', sourceType: 'other' as const })),
      documentLinks: notes.filter((n) => n.kind === 'document_link' && n.url).map((n) => n.url as string),
      counterArguments: notes.filter((n) => n.kind === 'counter_argument').map((n) => `${n.title}${n.body ? `: ${n.body}` : ''}`),
      relatedEvents: notes.filter((n) => n.kind === 'timeline_entry').map((n) => `${n.eventDate ?? ''} ${n.title}`.trim()),
    };
    window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify(draft));
    navigate('/submit');
  };

  const editor: WallEditor = useMemo(
    () => ({
      allowDocumented: false,
      savePositions: (positions) => client.put(`/${id}/board/positions`, { positions }).then(() => undefined),
      createEdge: async (e) => {
        const r = await client.post<{ id: number }>(`/${id}/board/edges`, e);
        return { id: r.id, ...e, verification: 'suggested' } as BoardEdge;
      },
      deleteEdge: (edgeId) => client.del(`/${id}/board/edges/${edgeId}`).then(() => undefined),
      addNode: async (n) => {
        const r = await client.post<{ id: number; x: number; y: number }>(`/${id}/board/nodes`, n);
        return { id: r.id, entityType: null, entityId: null, entitySlug: null, kind: n.kind, title: n.title, summary: n.summary, category: null, evidenceStatus: n.kind === 'claim' ? 'unverified' : null, imagePath: null, tags: [], groupKey: null, x: r.x, y: r.y } as BoardNode;
      },
      deleteNode: (nodeId) => client.del(`/${id}/board/nodes/${nodeId}`).then(() => undefined),
    }),
    [client, id],
  );

  const addArchiveCard = async () => {
    const th = theories.data?.items.find((x) => String(x.id) === archivePick);
    if (!th || !board.data) return;
    await client.post(`/${id}/board/nodes`, {
      kind: 'theory',
      entityType: 'theory',
      entityId: th.id,
      title: th.title,
      summary: th.summary.slice(0, 1000),
      category: th.category,
      evidenceStatus: th.evidenceStatus,
      x: Math.round(Math.random() * 400),
      y: Math.round(Math.random() * 300),
    });
    setArchivePick('');
    board.reload();
  };

  const timeline = notes.filter((n) => n.eventDate).sort((a, b) => (a.eventDate! < b.eventDate! ? -1 : 1));

  if (!inv) {
    return (
      <div className="container page">
        <LoadState loading={detail.loading} error={detail.error} onRetry={detail.reload} />
        <Link to="/investigations">← {t('nav.investigations')}</Link>
      </div>
    );
  }

  return (
    <div className="container page">
      <header className="page-header">
        <Link to="/investigations" className="small">
          ← {t('nav.investigations')}
        </Link>
        <h1>{inv.title}</h1>
        {inv.description && <p>{inv.description}</p>}
        <div className="btn-row">
          <button className="btn btn--paper btn--small" onClick={publish} title={t('investigations.publishHint')}>
            {t('investigations.publish')}
          </button>
          <button className="btn btn--danger btn--small" onClick={deleteInvestigation}>
            {t('app.delete')}
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          {t('investigations.publishHint')}
        </p>
      </header>

      <div className="tabs" role="tablist">
        {(['notes', 'board', 'timeline'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(`investigations.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'notes' && (
        <div className="two-col">
          <form className="panel" onSubmit={addNote}>
            <h3>{t('investigations.addNote')}</h3>
            <div className="field">
              <label htmlFor="n-kind">{t('investigations.noteKind')}</label>
              <select id="n-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as InvestigationNoteKind })}>
                {INVESTIGATION_NOTE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`investigations.kinds.${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="n-title">{t('investigations.noteTitle')}</label>
              <input id="n-title" type="text" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="n-body">{t('investigations.noteBody')}</label>
              <textarea id="n-body" maxLength={20000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="n-url">{t('investigations.noteUrl')}</label>
              <input id="n-url" type="url" maxLength={2000} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="n-date">{t('investigations.noteDate')}</label>
              <input id="n-date" type="text" maxLength={10} value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            </div>
            {error && <p className="notice notice--error">{error}</p>}
            <button className="btn btn--primary btn--small" disabled={!form.title.trim()}>
              {t('investigations.addNote')}
            </button>
          </form>
          <div className="grid" data-testid="investigation-notes">
            {notes.map((n) => (
              <article key={n.id} className="paper" style={{ padding: '16px 18px', borderLeft: `6px solid ${NOTE_COLORS[n.kind]}` }}>
                <div className="typewriter small" style={{ color: NOTE_COLORS[n.kind] }}>
                  {n.kind === 'hypothesis' ? t('investigations.hypothesisLabel') : t(`investigations.kinds.${n.kind}`)}
                  {n.eventDate && <span className="mono"> · {n.eventDate}</span>}
                </div>
                <h3 style={{ margin: '4px 0' }}>{n.title}</h3>
                {n.body && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>}
                {n.url && (
                  <a className="small" href={n.url} target="_blank" rel="noopener noreferrer nofollow">
                    {n.url}
                  </a>
                )}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn--small btn--ghost" style={{ color: 'var(--paper-ink)' }} onClick={() => deleteNote(n.id)}>
                    {t('app.delete')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'board' && (
        <>
          <p className="small muted">{t('investigations.threadsSuggested')}</p>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <select value={archivePick} onChange={(e) => setArchivePick(e.target.value)} aria-label={t('investigations.addArchiveCard')} style={{ maxWidth: 320 }}>
              <option value="">{t('investigations.addArchiveCard')} …</option>
              {theories.data?.items.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.title}
                </option>
              ))}
            </select>
            <button className="btn btn--small" disabled={!archivePick} onClick={addArchiveCard}>
              +
            </button>
          </div>
          <LoadState loading={board.loading} error={board.error} onRetry={board.reload} />
          {board.data && (
            <div style={{ border: '1px solid var(--ink-700)', borderRadius: 6, overflow: 'hidden' }}>
              <InvestigationWall key={`${board.data.slug}-${board.data.nodes.length}`} board={board.data} editor={editor} localLayout={false} height="70vh" />
            </div>
          )}
        </>
      )}

      {tab === 'timeline' && (
        <div className="paper">
          {timeline.length === 0 && <p className="muted">{t('app.none')}</p>}
          <ol className="mini-timeline">
            {timeline.map((n) => (
              <li key={n.id}>
                <div className="date">{formatDate(n.eventDate, locale)}</div>
                <strong>{n.title}</strong>
                {n.kind === 'hypothesis' && <span className="tag"> · {t('investigations.hypothesisLabel')}</span>}
                {n.body && <div className="small">{n.body}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
