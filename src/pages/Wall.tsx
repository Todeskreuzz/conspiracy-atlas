import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { Board, BoardEdge, BoardNode } from '../../shared/types';
import { LoadState } from '../components/Unavailable';
import { InvestigationWall, type WallEditor } from '../wall/InvestigationWall';
import { syntheticBoard } from '../wall/model';
import { useAdminSession, adminApi } from '../api/admin';

const MAIN = 'main';

export default function WallPage() {
  const { t, locale } = useI18n();
  const [params] = useSearchParams();
  const stress = Math.min(2000, Math.max(0, parseInt(params.get('stress') ?? '0', 10) || 0));
  const focusParam = params.get('focus');
  const focus = useMemo(() => {
    const m = focusParam?.match(/^(\w+):(\d+)$/);
    return m ? { type: m[1], id: Number(m[2]) } : null;
  }, [focusParam]);
  const session = useAdminSession();
  const editMode = params.get('edit') === '1' && session.authenticated;

  const res = useAsync<Board>(
    async (signal) => {
      if (stress) return { id: 0, slug: `stress-${stress}`, title: 'Stress test', description: null, ...syntheticBoard(stress) };
      return api<Board>(`/boards/${MAIN}`, { signal });
    },
    [stress, locale],
  );

  const editor: WallEditor | null = useMemo(() => {
    if (!editMode || stress || !session.csrfToken) return null;
    const a = adminApi(session.csrfToken);
    return {
      allowDocumented: true,
      savePositions: (positions) => a.put(`/boards/${MAIN}/positions`, { positions }).then(() => undefined),
      createEdge: async (e) => {
        const r = await a.post<{ id: number }>(`/boards/${MAIN}/edges`, e);
        return { id: r.id, ...e } as BoardEdge;
      },
      deleteEdge: (id) => a.del(`/boards/${MAIN}/edges/${id}`).then(() => undefined),
      addNode: async (n) => {
        const r = await a.post<{ id: number; x: number; y: number }>(`/boards/${MAIN}/nodes`, n);
        return { id: r.id, entityType: null, entityId: null, entitySlug: null, kind: n.kind, title: n.title, summary: n.summary, category: null, evidenceStatus: null, imagePath: null, tags: [], groupKey: null, x: r.x, y: r.y } as BoardNode;
      },
      deleteNode: (id) => a.del(`/boards/${MAIN}/nodes/${id}`).then(() => undefined),
    };
  }, [editMode, stress, session.csrfToken]);

  if (!res.data) {
    return (
      <div className="container page">
        <h1>{t('wall.title')}</h1>
        <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      </div>
    );
  }
  return (
    <>
      <h1 className="sr-only">{t('wall.title')}</h1>
      <p className="sr-only">{t('wall.intro')}</p>
      <InvestigationWall
        key={`${res.data.slug}-${editor ? 'edit' : 'view'}`}
        board={res.data}
        editor={editor}
        focus={focus}
        localLayout={!stress}
        banner={stress ? t('wall.stressTest', { count: stress }) : null}
      />
    </>
  );
}
