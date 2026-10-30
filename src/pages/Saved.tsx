import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { BoardEdge, BoardNode } from '../../shared/types';
import { TheoryCard } from '../components/TheoryCard';
import { SaveButton } from '../components/SaveButton';
import { InvestigationWall, type WallEditor } from '../wall/InvestigationWall';
import { CARD_H, CARD_W } from '../wall/model';
import { EDGE_ID_BASE, NOTE_ID_BASE, loadMyBoard, saveMyBoard, unsaveCase, useSaved, type SavedCase } from '../saved/store';

/** Builds the personal wall from the saved cases, the own notes and threads, and the automatic threads. */
function buildBoard(saved: SavedCase[], auto: BoardEdge[]) {
  const stored = loadMyBoard();
  const cols = Math.max(2, Math.ceil(Math.sqrt(saved.length + stored.notes.length)));
  const place = (id: number, i: number) => stored.positions[id] ?? { x: (i % cols) * (CARD_W + 90), y: Math.floor(i / cols) * (CARD_H + 110) };
  const nodes: BoardNode[] = [
    ...saved.map((c, i) => ({
      id: c.id,
      entityType: 'theory' as const,
      entityId: c.id,
      entitySlug: c.slug,
      kind: 'theory' as const,
      title: c.title,
      summary: c.summary,
      category: c.category,
      evidenceStatus: null,
      imagePath: c.imagePath,
      tags: [],
      groupKey: c.category,
      ...place(c.id, i),
    })),
    ...stored.notes.map((n, i) => ({
      id: n.id,
      entityType: null,
      entityId: null,
      entitySlug: null,
      kind: n.kind,
      title: n.title,
      summary: n.summary,
      category: null,
      evidenceStatus: null,
      imagePath: null,
      tags: [],
      groupKey: n.kind,
      ...place(n.id, saved.length + i),
    })),
  ];
  const ids = new Set(nodes.map((n) => n.id));
  const own = stored.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const ownPairs = new Set(own.map((e) => [e.source, e.target].sort().join('-')));
  const derived = auto.filter((e) => ids.has(e.source) && ids.has(e.target) && !ownPairs.has([e.source, e.target].sort().join('-')));
  return { id: 0, slug: 'my-wall', title: 'My wall', description: null, nodes, edges: [...own, ...derived] };
}

const localEditor = (saveLabel: string): WallEditor => ({
  allowDocumented: false,
  saveLabel,
  savePositions: async (positions) => {
    const b = loadMyBoard();
    for (const p of positions) b.positions[p.id] = { x: p.x, y: p.y };
    saveMyBoard(b);
  },
  createEdge: async (e) => {
    const b = loadMyBoard();
    const edge: BoardEdge = { ...e, verification: 'suggested', id: Math.max(EDGE_ID_BASE, ...b.edges.map((x) => x.id)) + 1 };
    saveMyBoard({ ...b, edges: [...b.edges, edge] });
    return edge;
  },
  deleteEdge: async (id) => {
    const b = loadMyBoard();
    saveMyBoard({ ...b, edges: b.edges.filter((e) => e.id !== id) });
  },
  addNode: async (n) => {
    const b = loadMyBoard();
    const id = Math.max(NOTE_ID_BASE, ...b.notes.map((x) => x.id)) + 1;
    saveMyBoard({ ...b, notes: [...b.notes, { id, kind: n.kind, title: n.title, summary: n.summary }], positions: { ...b.positions, [id]: { x: n.x, y: n.y } } });
    return { id, entityType: null, entityId: null, entitySlug: null, kind: n.kind, title: n.title, summary: n.summary, category: null, evidenceStatus: null, imagePath: null, tags: [], groupKey: null, x: n.x, y: n.y };
  },
  deleteNode: async (id) => {
    if (id < NOTE_ID_BASE) return unsaveCase(id);
    const b = loadMyBoard();
    saveMyBoard({ ...b, notes: b.notes.filter((n) => n.id !== id), edges: b.edges.filter((e) => e.source !== id && e.target !== id) });
  },
});

export default function SavedPage() {
  const { t } = useI18n();
  const saved = useSaved();
  const [tab, setTab] = useState<'list' | 'wall'>('list');
  const editor = useMemo(() => localEditor(t('saved.saveLayout')), [t]);
  const idList = saved.map((c) => c.id).sort((a, b) => a - b).join(',');
  const auto = useAsync(
    (signal) => (tab === 'wall' && saved.length > 1 ? api<{ edges: BoardEdge[] }>(`/shared-threads?ids=${idList}`, { signal }) : Promise.resolve({ edges: [] })),
    [tab, idList],
  );
  // The wall is rebuilt only when the set of saved cases changes; edits are written straight to storage.
  const board = useMemo(() => (auto.data ? buildBoard(saved, auto.data.edges) : null), [auto.data, idList]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.saved')}</div>
        <h1>{t('saved.title')}</h1>
        <p>{t('saved.intro')}</p>
      </header>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>
          {t('saved.list')} ({saved.length})
        </button>
        <button role="tab" aria-selected={tab === 'wall'} onClick={() => setTab('wall')}>
          {t('saved.wall')}
        </button>
      </div>

      {saved.length === 0 && (
        <p className="notice">
          {t('saved.empty')} <Link to="/archive">{t('home.browseArchive')} →</Link>
        </p>
      )}

      {tab === 'list' && saved.length > 0 && (
        <div className="grid grid--cards" data-testid="saved-list">
          {saved.map((c) => (
            <div key={c.id} className="saved-item">
              <TheoryCard theory={{ ...c, evidenceStatus: 'unverified', origin: 'editorial', authorName: null, tags: [], updatedAt: c.savedAt }} />
              <SaveButton theory={c} small />
            </div>
          ))}
        </div>
      )}

      {tab === 'wall' && saved.length > 0 && board && (
        <>
          <p className="small muted">
            {t('saved.wallHint')}
          </p>
          <div style={{ border: '1px solid var(--ink-700)', borderRadius: 6, overflow: 'hidden' }} data-testid="my-wall">
            <InvestigationWall key={idList} board={board} editor={editor} localLayout={false} height="72vh" />
          </div>
        </>
      )}
    </div>
  );
}

