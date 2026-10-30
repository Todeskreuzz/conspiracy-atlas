import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import cytoscape, { type Core, type EdgeSingular, type NodeSingular, type StylesheetJson } from 'cytoscape';
import type { Board, BoardEdge, BoardNode } from '../../shared/types';
import { CATEGORY_SLUGS, NODE_KINDS, RELATION_KINDS, type NodeKind, type RelationKind, type RelationVerification } from '../../shared/constants';
import { useI18n } from '../i18n';
import { entityPath } from '../pages/Theory';
import { CategoryBadge } from '../components/Badges';
import {
  CARD_H,
  CARD_W,
  DEFAULT_FILTERS,
  RELATION_STYLE,
  groupPositions,
  localPositions,
  savedViews,
  toElements,
  type GroupMode,
  type Position,
  type SavedView,
  type WallFilters,
} from './model';
import { Minimap } from './Minimap';

export interface WallEditor {
  /** Admin may create documented threads; private boards only allow "suggested". */
  allowDocumented: boolean;
  savePositions: (positions: Array<{ id: number; x: number; y: number }>) => Promise<void>;
  createEdge: (e: { source: number; target: number; kind: RelationKind; verification: RelationVerification; label: string | null }) => Promise<BoardEdge>;
  deleteEdge: (id: number) => Promise<void>;
  addNode?: (n: { kind: NodeKind; title: string; summary: string | null; x: number; y: number }) => Promise<BoardNode>;
  deleteNode?: (id: number) => Promise<void>;
}

interface Props {
  board: Pick<Board, 'slug' | 'nodes' | 'edges'>;
  editor?: WallEditor | null;
  focus?: { type: string; id: number } | null;
  /** Store visitor arrangements locally (public wall). Editors persist to D1 instead. */
  localLayout?: boolean;
  height?: string;
  banner?: string | null;
}

function buildStyle(): StylesheetJson {
  const edgeKinds = RELATION_KINDS.map((k) => ({
    selector: `edge.rel-${k}`,
    style: {
      'line-color': RELATION_STYLE[k].color,
      width: RELATION_STYLE[k].width,
      'line-style': RELATION_STYLE[k].dash ? 'dashed' : 'solid',
      ...(RELATION_STYLE[k].dash ? { 'line-dash-pattern': RELATION_STYLE[k].dash } : {}),
    },
  }));
  return [
    {
      selector: 'node',
      style: {
        shape: 'rectangle',
        width: CARD_W,
        height: CARD_H,
        'background-color': '#e9dcc0',
        'background-image': 'data(img)',
        'background-fit': 'cover',
        'background-clip': 'node',
        'border-width': 0,
        label: 'data(label)',
        'text-wrap': 'wrap',
        'text-max-width': `${CARD_W - 30}px`,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-margin-y': 14,
        'font-family': 'IBM Plex Sans, system-ui, sans-serif',
        'font-weight': 600,
        'font-size': 13,
        'line-height': 1.25,
        color: '#2b2118',
        'underlay-color': '#000',
        'underlay-opacity': 0.32,
        'underlay-padding': 5,
        'underlay-shape': 'rectangle',
        'min-zoomed-font-size': 5,
        'transition-property': 'opacity',
        'transition-duration': 0.2,
      },
    },
    { selector: 'node[kind = "theory"]', style: { width: CARD_W + 30, height: CARD_H + 16, 'font-size': 15, 'font-family': 'Playfair Display, Georgia, serif', 'font-weight': 700 } },
    { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#e8c547', 'underlay-color': '#e8c547', 'underlay-opacity': 0.25, 'underlay-padding': 10 } },
    { selector: 'node.match', style: { 'border-width': 4, 'border-color': '#e8c547' } },
    {
      selector: 'edge',
      style: {
        'curve-style': 'straight',
        'line-cap': 'round',
        // Threads are tied to the pins at the top of each card.
        'source-endpoint': '0% -42%',
        'target-endpoint': '0% -42%',
        opacity: 0.92,
        'transition-property': 'opacity',
        'transition-duration': 0.2,
      },
    },
    ...edgeKinds,
    { selector: 'edge.suggested', style: { opacity: 0.6 } },
    {
      selector: 'edge.show-label, edge:selected',
      style: {
        label: 'data(label)',
        'font-size': 11,
        color: '#2b2118',
        'text-background-color': '#e9dcc0',
        'text-background-opacity': 0.95,
        'text-background-padding': '3px',
        'text-rotation': 'autorotate',
      },
    },
    { selector: 'edge:selected', style: { width: 4.5, opacity: 1 } },
    { selector: '.faded', style: { opacity: 0.18 } },
    { selector: '.hidden', style: { display: 'none' } },
  ] as StylesheetJson;
}

export function InvestigationWall({ board, editor, focus, localLayout = true, height = 'calc(100vh - var(--header-h))', banner }: Props) {
  const { t, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<HTMLDivElement>(null);
  const [cy, setCy] = useState<Core | null>(null);
  const [selected, setSelected] = useState<{ node?: BoardNode; edge?: BoardEdge } | null>(null);
  const [multi, setMulti] = useState<number[]>([]);
  const [filters, setFilters] = useState<WallFilters>(DEFAULT_FILTERS);
  const [group, setGroup] = useState<GroupMode>('none');
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1700);
  const [isFullscreen, setFullscreen] = useState(false);
  const [views, setViews] = useState<SavedView[]>(() => savedViews.load(board.slug));
  const [viewName, setViewName] = useState('');
  const [dirty, setDirty] = useState<Map<number, Position>>(new Map());
  const [animate, setAnimate] = useState(board.edges.length <= 400);
  const [message, setMessage] = useState<string | null>(null);
  const [edgeForm, setEdgeForm] = useState<{ kind: RelationKind; verification: RelationVerification; label: string }>({
    kind: 'documented',
    verification: 'suggested',
    label: '',
  });
  const [cardForm, setCardForm] = useState<{ kind: NodeKind; title: string; summary: string }>({ kind: 'claim', title: '', summary: '' });

  const nodesById = useMemo(() => new Map(board.nodes.map((n) => [n.id, n])), [board.nodes]);
  const edgesById = useMemo(() => new Map(board.edges.map((e) => [e.id, e])), [board.edges]);
  const kindLabel = useCallback((k: NodeKind) => t(`kinds.${k}`), [t]);

  // ---------------------------------------------------------------- create / destroy
  useEffect(() => {
    if (!cyRef.current) return;
    const many = board.nodes.length;
    const local = localLayout && !editor ? localPositions.load(board.slug) : {};
    const instance = cytoscape({
      container: cyRef.current,
      elements: toElements(board, kindLabel, local),
      style: buildStyle(),
      layout: { name: 'preset' },
      minZoom: 0.04,
      maxZoom: 2.5,
      wheelSensitivity: 0.25,
      boxSelectionEnabled: !!editor,
      selectionType: 'additive',
      textureOnViewport: many > 300,
      hideEdgesOnViewport: many > 700,
      motionBlur: many > 300,
      pixelRatio: many > 500 ? 1 : 'auto',
    });
    instance.fit(undefined, 60);
    // Keep the cards readable on first load; the minimap and "Fit to screen" give the overview.
    if (many <= 300 && instance.zoom() < 0.62) instance.zoom({ level: 0.62, renderedPosition: { x: instance.width() / 2, y: instance.height() / 2 } });
    setCy(instance);
    return () => {
      instance.destroy();
      setCy(null);
    };
    // Rebuild only when the board identity or its size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, locale]);

  // ---------------------------------------------------------------- events
  useEffect(() => {
    if (!cy) return;
    const highlight = (node: NodeSingular | null) => {
      cy.batch(() => {
        cy.elements().removeClass('faded show-label');
        if (!node) return;
        const hood = node.closedNeighborhood();
        cy.elements().not(hood).addClass('faded');
        hood.edges().addClass('show-label');
      });
    };
    const onSelect = () => {
      const nodes = cy.$('node:selected');
      const edges = cy.$('edge:selected');
      setMulti(nodes.map((n) => Number(n.data('nodeId'))));
      if (nodes.length === 1) {
        const n = nodesById.get(Number(nodes[0].data('nodeId')));
        setSelected(n ? { node: n } : null);
        highlight(nodes[0]);
      } else if (edges.length === 1 && nodes.length === 0) {
        const e = edgesById.get(Number(edges[0].data('edgeId')));
        setSelected(e ? { edge: e } : null);
        highlight(null);
      } else {
        setSelected(null);
        highlight(null);
      }
    };
    const onDbl = (evt: cytoscape.EventObject) => {
      const node = evt.target as NodeSingular;
      cy.animate({ fit: { eles: node.closedNeighborhood(), padding: 90 }, duration: 450, easing: 'ease-in-out-cubic' });
    };
    const onDragFree = (evt: cytoscape.EventObject) => {
      const moved = cy.$('node:selected').union(evt.target as NodeSingular);
      const updates: Array<[number, Position]> = moved.map((n: NodeSingular) => [Number(n.data('nodeId')), { ...n.position() }]);
      if (editor) {
        setDirty((d) => {
          const next = new Map(d);
          for (const [id, p] of updates) next.set(id, p);
          return next;
        });
      } else if (localLayout) {
        const stored = localPositions.load(board.slug);
        for (const [id, p] of updates) stored[id] = { x: Math.round(p.x), y: Math.round(p.y) };
        localPositions.save(board.slug, stored);
      }
    };
    const onBgTap = (evt: cytoscape.EventObject) => {
      if (evt.target === cy) highlight(null);
    };
    const syncBackground = () => {
      const el = wrapRef.current;
      if (!el) return;
      const pan = cy.pan();
      const z = cy.zoom();
      el.style.backgroundPosition = `${pan.x}px ${pan.y}px`;
      el.style.backgroundSize = `${Math.max(60, 420 * z)}px ${Math.max(60, 420 * z)}px`;
    };
    cy.on('select unselect', onSelect);
    cy.on('dbltap', 'node', onDbl);
    cy.on('dragfree', 'node', onDragFree);
    cy.on('tap', onBgTap);
    cy.on('viewport', syncBackground);
    syncBackground();
    return () => {
      cy.off('select unselect', onSelect);
      cy.off('dbltap', 'node', onDbl);
      cy.off('dragfree', 'node', onDragFree);
      cy.off('tap', onBgTap);
      cy.off('viewport', syncBackground);
    };
  }, [cy, nodesById, edgesById, editor, localLayout, board.slug]);

  // ---------------------------------------------------------------- filters
  useEffect(() => {
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const visible =
          filters.kinds.includes(n.data('kind')) &&
          filters.statuses.includes(n.data('status')) &&
          (!filters.category || n.data('kind') !== 'theory' || n.data('category') === filters.category);
        n.toggleClass('hidden', !visible);
      });
      cy.edges().forEach((e) => {
        e.toggleClass('hidden', !filters.relations.includes(e.data('kind')));
      });
    });
  }, [cy, filters]);

  // ---------------------------------------------------------------- search
  useEffect(() => {
    if (!cy) return;
    const q = search.trim().toLowerCase();
    cy.batch(() => cy.nodes().removeClass('match'));
    if (q.length < 2) return;
    const matches = cy.nodes().filter((n) => String(n.data('label')).toLowerCase().includes(q));
    matches.addClass('match');
    if (matches.length) cy.animate({ fit: { eles: matches, padding: 120 }, duration: 350 });
  }, [cy, search]);

  // ---------------------------------------------------------------- focus from URL
  useEffect(() => {
    if (!cy || !focus) return;
    const target = cy.nodes().filter((n) => n.data('entityType') === focus.type && Number(n.data('entityId')) === focus.id);
    if (target.length) {
      cy.$(':selected').unselect();
      target[0].select();
      cy.animate({ fit: { eles: target[0].closedNeighborhood(), padding: 90 }, duration: 500 });
    }
  }, [cy, focus]);

  // ---------------------------------------------------------------- thread animation (marching dashes)
  useEffect(() => {
    if (!cy || !animate) return;
    const dashed = cy.edges('.rel-claimed, .rel-unresolved, .rel-thematic');
    if (!dashed.length) return;
    let offset = 0;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      if (time - last > 70) {
        offset = (offset + 1) % 60;
        dashed.style('line-dash-offset', -offset);
        last = time;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cy, animate]);

  // ---------------------------------------------------------------- fullscreen
  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === wrapRef.current?.parentElement);
      setTimeout(() => cy?.resize(), 50);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [cy]);

  const toggleFullscreen = () => {
    const el = wrapRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  // ---------------------------------------------------------------- grouping
  const applyGroup = (mode: GroupMode) => {
    setGroup(mode);
    if (!cy) return;
    let positions: Map<number, Position>;
    if (mode === 'none') {
      const local = localLayout && !editor ? localPositions.load(board.slug) : {};
      positions = new Map(board.nodes.map((n) => [n.id, local[n.id] ?? { x: n.x, y: n.y }]));
    } else {
      positions = groupPositions(board.nodes, mode);
    }
    const layout = cy.layout({
      name: 'preset',
      positions: (n: NodeSingular) => positions.get(Number(n.data('nodeId'))) ?? n.position(),
      animate: board.nodes.length <= 300,
      animationDuration: 500,
      fit: true,
      padding: 60,
    } as cytoscape.LayoutOptions);
    layout.run();
  };

  // ---------------------------------------------------------------- views
  const saveView = () => {
    if (!cy) return;
    const view: SavedView = { name: viewName.trim() || `${t('wall.views')} ${views.length + 1}`, zoom: cy.zoom(), pan: { ...cy.pan() }, filters, group, savedAt: new Date().toISOString() };
    const next = [...views.filter((v) => v.name !== view.name), view];
    setViews(next);
    savedViews.save(board.slug, next);
    setViewName('');
  };
  const loadView = (v: SavedView) => {
    setFilters(v.filters);
    if (v.group !== group) applyGroup(v.group);
    cy?.animate({ zoom: v.zoom, pan: v.pan, duration: 400 });
  };
  const deleteView = (name: string) => {
    const next = views.filter((v) => v.name !== name);
    setViews(next);
    savedViews.save(board.slug, next);
  };

  // ---------------------------------------------------------------- editing
  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 3500);
  };
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      flash((e as Error).message);
    }
  };
  const saveLayout = () =>
    run(async () => {
      if (!editor || !dirty.size) return;
      await editor.savePositions([...dirty.entries()].map(([id, p]) => ({ id, x: Math.round(p.x), y: Math.round(p.y) })));
      setDirty(new Map());
      flash(t('wall.layoutSaved'));
    });
  const connect = () =>
    run(async () => {
      if (!editor || !cy || multi.length !== 2) return;
      const verification = editor.allowDocumented ? edgeForm.verification : 'suggested';
      const e = await editor.createEdge({ source: multi[0], target: multi[1], kind: edgeForm.kind, verification, label: edgeForm.label.trim() || null });
      board.edges.push(e);
      edgesById.set(e.id, e);
      cy.add({
        group: 'edges',
        data: { id: `e${e.id}`, edgeId: e.id, source: `n${e.source}`, target: `n${e.target}`, kind: e.kind, verification: e.verification, label: e.label ?? '' },
        classes: `rel-${e.kind}${e.verification === 'suggested' ? ' suggested' : ''}`,
      });
      setEdgeForm((f) => ({ ...f, label: '' }));
    });
  const removeEdge = (id: number) =>
    run(async () => {
      if (!editor || !cy) return;
      await editor.deleteEdge(id);
      cy.$id(`e${id}`).remove();
      const idx = board.edges.findIndex((e) => e.id === id);
      if (idx >= 0) board.edges.splice(idx, 1);
      setSelected(null);
    });
  const removeNode = (id: number) =>
    run(async () => {
      if (!editor?.deleteNode || !cy) return;
      await editor.deleteNode(id);
      cy.$id(`n${id}`).remove();
      const idx = board.nodes.findIndex((n) => n.id === id);
      if (idx >= 0) board.nodes.splice(idx, 1);
      setSelected(null);
    });
  const addCard = () =>
    run(async () => {
      if (!editor?.addNode || !cy || !cardForm.title.trim()) return;
      const ext = cy.extent();
      const n = await editor.addNode({
        kind: cardForm.kind,
        title: cardForm.title.trim(),
        summary: cardForm.summary.trim() || null,
        x: Math.round((ext.x1 + ext.x2) / 2),
        y: Math.round((ext.y1 + ext.y2) / 2),
      });
      board.nodes.push(n);
      nodesById.set(n.id, n);
      cy.add(toElements({ nodes: [n], edges: [] }, kindLabel)[0]);
      setCardForm((f) => ({ ...f, title: '', summary: '' }));
    });

  // ---------------------------------------------------------------- render helpers
  const toggleIn = <T extends string>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const connectionsOf = (nodeId: number) =>
    board.edges
      .filter((e) => e.source === nodeId || e.target === nodeId)
      .map((e) => ({ edge: e, other: nodesById.get(e.source === nodeId ? e.target : e.source) }))
      .filter((c) => c.other);

  const selectNode = (id: number) => {
    if (!cy) return;
    cy.$(':selected').unselect();
    const el = cy.$id(`n${id}`);
    el.select();
    cy.animate({ center: { eles: el }, duration: 350 });
  };

  return (
    <div className="wall" style={{ height }} data-testid="investigation-wall">
      <div className="wall__canvas" ref={wrapRef}>
        <div ref={cyRef} className="wall__cy" aria-label={t('wall.title')} role="application" />
      </div>

      {banner && <div className="wall__banner typewriter">{banner}</div>}
      {message && <div className="wall__toast">{message}</div>}

      <div className="wall__topbar">
        <input className="wall__search" type="search" placeholder={t('wall.searchCards')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('wall.searchCards')} />
        <span className="wall__count mono">
          {t('wall.cards', { count: board.nodes.length })} · {t('wall.threads', { count: board.edges.length })}
        </span>
        <button className="btn btn--small" onClick={() => cy?.animate({ fit: { eles: cy.elements(':visible'), padding: 60 }, duration: 400 })}>
          ⤢ {t('wall.fit')}
        </button>
        <button className="btn btn--small" onClick={toggleFullscreen}>
          {isFullscreen ? t('wall.exitFullscreen') : t('wall.fullscreen')}
        </button>
        <button className="btn btn--small" aria-expanded={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
          ☰ {t('wall.filters')}
        </button>
      </div>

      {panelOpen && (
        <aside className="wall__panel" aria-label={t('wall.filters')}>
          {editor && (
            <section className="wall__section wall__section--edit">
              <h4>{t('wall.editMode')}</h4>
              <button className="btn btn--primary btn--small" disabled={!dirty.size} onClick={saveLayout}>
                {t('wall.saveLayout')} {dirty.size ? `(${dirty.size})` : ''}
              </button>
              <p className="small muted">{t('wall.connectHint')}</p>
              {multi.length === 2 && (
                <div className="wall__form">
                  <label className="small">
                    {t('wall.threadKind')}
                    <select value={edgeForm.kind} onChange={(e) => setEdgeForm({ ...edgeForm, kind: e.target.value as RelationKind })}>
                      {RELATION_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t(`relations.${k}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {editor.allowDocumented && (
                    <label className="small">
                      {t('wall.threadVerification')}
                      <select value={edgeForm.verification} onChange={(e) => setEdgeForm({ ...edgeForm, verification: e.target.value as RelationVerification })}>
                        <option value="suggested">{t('verification.suggested')}</option>
                        <option value="documented">{t('verification.documented')}</option>
                      </select>
                    </label>
                  )}
                  <input type="text" placeholder={t('wall.threadLabel')} value={edgeForm.label} maxLength={200} onChange={(e) => setEdgeForm({ ...edgeForm, label: e.target.value })} />
                  <button className="btn btn--small btn--primary" onClick={connect}>
                    {t('wall.connect')}
                  </button>
                </div>
              )}
              {editor.addNode && (
                <details>
                  <summary className="small">{t('wall.addCard')}</summary>
                  <div className="wall__form">
                    <select value={cardForm.kind} onChange={(e) => setCardForm({ ...cardForm, kind: e.target.value as NodeKind })} aria-label={t('wall.cardKind')}>
                      {NODE_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t(`kinds.${k}`)}
                        </option>
                      ))}
                    </select>
                    <input type="text" placeholder={t('wall.cardTitle')} value={cardForm.title} maxLength={200} onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })} />
                    <textarea placeholder={t('wall.cardSummary')} value={cardForm.summary} maxLength={1000} onChange={(e) => setCardForm({ ...cardForm, summary: e.target.value })} />
                    <button className="btn btn--small" onClick={addCard} disabled={!cardForm.title.trim()}>
                      {t('wall.addCard')}
                    </button>
                  </div>
                </details>
              )}
            </section>
          )}

          <section className="wall__section">
            <h4>{t('wall.group')}</h4>
            <select value={group} onChange={(e) => applyGroup(e.target.value as GroupMode)} aria-label={t('wall.group')}>
              <option value="none">{t('wall.groupNone')}</option>
              <option value="category">{t('wall.groupCategory')}</option>
              <option value="kind">{t('wall.groupKind')}</option>
            </select>
          </section>

          <section className="wall__section">
            <h4>{t('wall.relations')}</h4>
            {RELATION_KINDS.map((k) => (
              <label key={k} className="checkbox small">
                <input type="checkbox" checked={filters.relations.includes(k)} onChange={() => setFilters({ ...filters, relations: toggleIn(filters.relations, k) })} />
                <svg width="34" height="8" aria-hidden="true">
                  <line x1="0" y1="4" x2="34" y2="4" stroke={RELATION_STYLE[k].color} strokeWidth={RELATION_STYLE[k].width} strokeDasharray={RELATION_STYLE[k].dash?.join(' ')} />
                </svg>
                {t(`relations.${k}`)}
              </label>
            ))}
            <label className="checkbox small" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
              {t('wall.animate')}
            </label>
          </section>

          <section className="wall__section">
            <h4>{t('wall.kinds')}</h4>
            <div className="wall__chips">
              {NODE_KINDS.map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={filters.kinds.includes(k)} onClick={() => setFilters({ ...filters, kinds: toggleIn(filters.kinds, k) })}>
                  {t(`kinds.${k}`)}
                </button>
              ))}
            </div>
          </section>

          <section className="wall__section">
            <h4>{t('wall.category')}</h4>
            <label className="small" style={{ display: 'block' }}>
              <select value={filters.category} aria-label={t('wall.category')} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                <option value="">{t('app.all')}</option>
                {CATEGORY_SLUGS.map((c) => (
                  <option key={c} value={c}>
                    {t(`categories.${c}`)}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="wall__section">
            <h4>{t('wall.views')}</h4>
            {views.length === 0 && <p className="small muted">{t('wall.noViews')}</p>}
            <ul className="list-plain small">
              {views.map((v) => (
                <li key={v.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '4px 0' }}>
                  <button className="linklike" onClick={() => loadView(v)}>
                    {v.name}
                  </button>
                  <button className="linklike muted" aria-label={t('wall.deleteView')} onClick={() => deleteView(v.name)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input type="text" value={viewName} maxLength={40} placeholder={t('wall.viewName')} onChange={(e) => setViewName(e.target.value)} />
              <button className="btn btn--small" onClick={saveView}>
                {t('app.save')}
              </button>
            </div>
            {localLayout && !editor && (
              <>
                <p className="small muted" style={{ marginTop: 8 }}>
                  {t('wall.localNote')}
                </p>
                <button
                  className="btn btn--small btn--ghost"
                  onClick={() => {
                    localPositions.clear(board.slug);
                    applyGroup('none');
                  }}
                >
                  {t('wall.resetLayout')}
                </button>
              </>
            )}
          </section>
        </aside>
      )}

      {selected && (
        <aside className="wall__detail paper" aria-live="polite" data-testid="wall-detail">
          <button className="wall__close" aria-label={t('app.close')} onClick={() => cy?.$(':selected').unselect()}>
            ✕
          </button>
          {selected.node && (
            <>
              <div className="typewriter small muted">{t(`kinds.${selected.node.kind}`)}</div>
              <h3 style={{ margin: '4px 0 8px' }}>{selected.node.title}</h3>
              <div className="btn-row" style={{ marginBottom: 8 }}>
                <CategoryBadge category={selected.node.category} />
              </div>
              {selected.node.summary && <p className="small">{selected.node.summary}</p>}
              {selected.node.entityType && entityPath(selected.node.entityType, selected.node.entitySlug) && (
                <Link className="btn btn--small" to={entityPath(selected.node.entityType, selected.node.entitySlug)!}>
                  {t('wall.openEntry')} →
                </Link>
              )}
              <h4 style={{ marginTop: 14 }}>{t('wall.connections')}</h4>
              <ul className="list-plain small">
                {connectionsOf(selected.node.id).map(({ edge, other }) => (
                  <li key={edge.id}>
                    <span className={`rel-kind rel-kind--${edge.kind}`}>{t(`relations.${edge.kind}`)}</span>
                    {edge.verification === 'suggested' && <span className="muted"> · {t('verification.suggested')}</span>}
                    <br />
                    <button className="linklike" onClick={() => selectNode(other!.id)}>
                      {other!.title}
                    </button>
                    {edge.label && <span className="muted"> – {edge.label}</span>}
                  </li>
                ))}
              </ul>
              {editor?.deleteNode && (
                <button className="btn btn--small btn--danger" style={{ marginTop: 10 }} onClick={() => removeNode(selected.node!.id)}>
                  {t('wall.deleteCard')}
                </button>
              )}
            </>
          )}
          {selected.edge && (
            <>
              <div className={`rel-kind rel-kind--${selected.edge.kind}`}>{t(`relations.${selected.edge.kind}`)}</div>
              <p className="small">
                {nodesById.get(selected.edge.source)?.title} ↔ {nodesById.get(selected.edge.target)?.title}
              </p>
              <p className="small">
                {t('wall.threadVerification')}: {t(`verification.${selected.edge.verification}`)}
              </p>
              {selected.edge.label && <p className="small">{selected.edge.label}</p>}
              {editor && (
                <button className="btn btn--small btn--danger" onClick={() => removeEdge(selected.edge!.id)}>
                  {t('wall.deleteThread')}
                </button>
              )}
            </>
          )}
        </aside>
      )}

      {cy && <Minimap cy={cy} />}

      <div className="wall__legend small" aria-label={t('wall.legend')}>
        {RELATION_KINDS.map((k) => (
          <span key={k}>
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="22" y2="3" stroke={RELATION_STYLE[k].color} strokeWidth={RELATION_STYLE[k].width} strokeDasharray={RELATION_STYLE[k].dash?.join(' ')} />
            </svg>{' '}
            {t(`relations.${k}`)}
          </span>
        ))}
      </div>
      {editor && dirty.size > 0 && <div className="wall__dirty typewriter">{t('wall.unsaved')}</div>}
    </div>
  );
}

export type { EdgeSingular };
