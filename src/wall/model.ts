// Pure, framework-independent logic for the Investigation Wall (testable without a browser).
import type { Board, BoardEdge, BoardNode } from '../../shared/types';
import { EVIDENCE_STATUSES, NODE_KINDS, RELATION_KINDS, type NodeKind, type RelationKind } from '../../shared/constants';

export const CARD_W = 190;
export const CARD_H = 124;

export type GroupMode = 'none' | 'category' | 'kind' | 'status';

export interface WallFilters {
  kinds: NodeKind[];
  relations: RelationKind[];
  statuses: string[]; // evidence statuses + 'none' for cards without status
  category: string; // '' = all
}

export const DEFAULT_FILTERS: WallFilters = {
  kinds: [...NODE_KINDS],
  relations: [...RELATION_KINDS],
  statuses: [...EVIDENCE_STATUSES, 'none'],
  category: '',
};

export interface Position {
  x: number;
  y: number;
}

export const KIND_COLORS: Record<NodeKind, string> = {
  theory: '#7a1f18',
  event: '#2f3e4f',
  organization: '#2c3a2e',
  person: '#4a3a2a',
  institution: '#253238',
  location: '#3d2f45',
  document: '#3a3329',
  technology: '#26343f',
  claim: '#4f2a24',
  source: '#33302b',
};

export const STATUS_STRIPE: Record<string, string> = {
  historically_documented: '#4f7a45',
  supported_by_evidence: '#6b8a3a',
  partially_supported: '#c49a1a',
  disputed: '#c46a24',
  unverified: '#8b8178',
  debunked: '#b3261e',
  under_investigation: '#3f6a94',
  none: '#b9a983',
};

export const RELATION_STYLE: Record<RelationKind, { color: string; width: number; dash: number[] | null }> = {
  documented: { color: '#c9372c', width: 2.6, dash: null },
  claimed: { color: '#e0574b', width: 2.2, dash: [9, 6] },
  thematic: { color: '#b5675d', width: 1.8, dash: [2, 6] },
  temporal: { color: '#d9a33a', width: 2.1, dash: null },
  unresolved: { color: '#9a8e85', width: 2, dash: [4, 7] },
  counter: { color: '#6d93bb', width: 2.3, dash: null },
};

const EMBLEMS: Record<NodeKind, string> = {
  theory: '<circle cx="0" cy="0" r="7"/><circle cx="0" cy="0" r="2.5"/><path d="M5 5l5 5"/>',
  event: '<rect x="-7" y="-6" width="14" height="13" rx="1"/><path d="M-7 -2h14M-3 -8v3M3 -8v3"/>',
  organization: '<path d="M-9 8h18M-7 8V-1M-2 8V-1M2 8V-1M7 8V-1M-9 -1l9-7 9 7z"/>',
  person: '<circle cx="0" cy="-3" r="4"/><path d="M-8 9c1-5 4-7 8-7s7 2 8 7"/>',
  institution: '<path d="M0 -9l8 3v5c0 5-4 8-8 10-4-2-8-5-8-10v-5z"/>',
  location: '<path d="M0 9s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z"/><circle cx="0" cy="-3" r="2.5"/>',
  document: '<path d="M-6 -9h8l4 4v14h-12z"/><path d="M-3 -2h6M-3 2h6M-3 5h4"/>',
  technology: '<rect x="-6" y="-6" width="12" height="12"/><path d="M-3 -6v-3M3 -6v-3M-3 6v3M3 6v3M-6 -2h-3M6 -2h3M-6 2h-3M6 2h3"/>',
  claim: '<path d="M-9 -7h18v11h-9l-5 4v-4h-4z"/>',
  source: '<path d="M-9 -6c3-1 6-1 9 1v12c-3-2-6-2-9-1zM9 -6c-3-1-6-1-9 1v12c3-2 6-2 9-1z"/>',
};

const imageCache = new Map<string, string>();

/** Card face as an SVG data URI (paper, coloured header band, status stripe, emblem, pin). */
export function cardImage(kind: NodeKind, status: string | null, label: string): string {
  const key = `${kind}|${status ?? 'none'}|${label}`;
  const hit = imageCache.get(key);
  if (hit) return hit;
  const band = KIND_COLORS[kind] ?? '#333';
  const stripe = STATUS_STRIPE[status ?? 'none'] ?? STATUS_STRIPE.none;
  const safeLabel = label.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1e6cd"/><stop offset="1" stop-color="#dcc9a2"/></linearGradient>
<radialGradient id="g" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#f5958b"/><stop offset="0.55" stop-color="#b3261e"/><stop offset="1" stop-color="#5a0f0a"/></radialGradient></defs>
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#p)"/>
<rect width="${CARD_W}" height="30" fill="${band}"/>
<rect x="0" y="30" width="6" height="${CARD_H - 30}" fill="${stripe}"/>
<g transform="translate(18 16)" fill="none" stroke="#e9dcc0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${EMBLEMS[kind] ?? ''}</g>
<text x="34" y="20" font-family="Courier New, monospace" font-size="10.5" letter-spacing="1.2" fill="#e9dcc0">${safeLabel.toUpperCase()}</text>
<path d="M14 ${CARD_H - 12}h${CARD_W - 28}" stroke="#3b2d20" stroke-opacity="0.15"/>
<circle cx="${CARD_W / 2}" cy="9" r="6.5" fill="url(#g)"/><circle cx="${CARD_W / 2 - 2}" cy="7" r="1.6" fill="#ffd2cc"/>
</svg>`;
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  imageCache.set(key, uri);
  return uri;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export interface ElementData {
  group: 'nodes' | 'edges';
  data: Record<string, unknown>;
  position?: Position;
  classes?: string;
}

/** Converts a board into Cytoscape element definitions. Local positions override stored ones. */
export function toElements(board: Pick<Board, 'nodes' | 'edges'>, kindLabel: (k: NodeKind) => string, local: Record<string, Position> = {}): ElementData[] {
  const nodeIds = new Set(board.nodes.map((n) => n.id));
  const els: ElementData[] = board.nodes.map((n) => ({
    group: 'nodes',
    data: {
      id: `n${n.id}`,
      nodeId: n.id,
      label: truncate(n.title, 70),
      kind: n.kind,
      status: n.evidenceStatus ?? 'none',
      category: n.category ?? '',
      img: cardImage(n.kind, n.evidenceStatus, kindLabel(n.kind)),
      entityType: n.entityType,
      entityId: n.entityId,
    },
    position: local[n.id] ?? { x: n.x, y: n.y },
  }));
  for (const e of board.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    els.push({
      group: 'edges',
      data: { id: `e${e.id}`, edgeId: e.id, source: `n${e.source}`, target: `n${e.target}`, kind: e.kind, verification: e.verification, label: e.label ?? '' },
      classes: `rel-${e.kind}${e.verification === 'suggested' ? ' suggested' : ''}`,
    });
  }
  return els;
}

export function nodeVisible(n: Pick<BoardNode, 'kind' | 'evidenceStatus' | 'category'>, f: WallFilters): boolean {
  if (!f.kinds.includes(n.kind)) return false;
  if (!f.statuses.includes(n.evidenceStatus ?? 'none')) return false;
  if (f.category && n.category !== f.category && n.kind === 'theory') return false;
  return true;
}

export function edgeVisible(e: Pick<BoardEdge, 'kind'>, f: WallFilters): boolean {
  return f.relations.includes(e.kind);
}

export function groupKey(n: Pick<BoardNode, 'kind' | 'category' | 'evidenceStatus'>, mode: GroupMode): string {
  switch (mode) {
    case 'category':
      return n.category ?? `~${n.kind}`;
    case 'kind':
      return n.kind;
    case 'status':
      return n.evidenceStatus ?? '~none';
    default:
      return '';
  }
}

/** Arranges cards into labelled clusters (grid of grids). Returns positions by node id. */
export function groupPositions(nodes: Array<Pick<BoardNode, 'id' | 'kind' | 'category' | 'evidenceStatus'>>, mode: GroupMode): Map<number, Position> {
  const groups = new Map<string, number[]>();
  for (const n of nodes) {
    const k = groupKey(n, mode);
    groups.set(k, [...(groups.get(k) ?? []), n.id]);
  }
  const keys = [...groups.keys()].sort();
  const gx = CARD_W + 50;
  const gy = CARD_H + 60;
  const clusterCols = Math.ceil(Math.sqrt(keys.length));
  const out = new Map<number, Position>();
  // Cluster size depends on the largest group so clusters never overlap.
  const largest = Math.max(1, ...[...groups.values()].map((g) => g.length));
  const inner = Math.ceil(Math.sqrt(largest));
  const clusterW = inner * gx + 260;
  const clusterH = inner * gy + 260;
  keys.forEach((k, i) => {
    const ids = groups.get(k)!;
    const cols = Math.ceil(Math.sqrt(ids.length));
    const ox = (i % clusterCols) * clusterW;
    const oy = Math.floor(i / clusterCols) * clusterH;
    ids.forEach((id, j) => out.set(id, { x: ox + (j % cols) * gx, y: oy + Math.floor(j / cols) * gy }));
  });
  return out;
}

/** Deterministic pseudo-random generator so performance tests are reproducible. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthetic board for performance testing (100 / 500 / 1,000 cards). Never saved. */
export function syntheticBoard(count: number, seed = 42): Pick<Board, 'nodes' | 'edges'> {
  const rnd = mulberry32(seed);
  const cols = Math.ceil(Math.sqrt(count));
  const nodes: BoardNode[] = Array.from({ length: count }, (_, i) => {
    const kind = NODE_KINDS[i % NODE_KINDS.length];
    return {
      id: 100000 + i,
      entityType: null,
      entityId: null,
      entitySlug: null,
      kind,
      title: `Test card ${i + 1}`,
      summary: 'Synthetic performance test data.',
      category: null,
      evidenceStatus: EVIDENCE_STATUSES[i % EVIDENCE_STATUSES.length],
      imagePath: null,
      tags: [],
      groupKey: kind,
      x: (i % cols) * (CARD_W + 60) + Math.round(rnd() * 30),
      y: Math.floor(i / cols) * (CARD_H + 70) + Math.round(rnd() * 30),
    };
  });
  const edges: BoardEdge[] = [];
  const seen = new Set<string>();
  const target = Math.round(count * 1.5);
  for (let i = 0; edges.length < target && i < target * 4; i++) {
    const a = Math.floor(rnd() * count);
    // mostly local connections, like a real wall
    const b = Math.min(count - 1, Math.max(0, a + Math.round((rnd() - 0.5) * cols * 2)));
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ id: 900000 + edges.length, source: 100000 + a, target: 100000 + b, kind: RELATION_KINDS[edges.length % RELATION_KINDS.length], verification: 'documented', label: null });
  }
  return { nodes, edges };
}

// ---------------------------------------------------------------- local persistence (per browser)

export interface SavedView {
  name: string;
  zoom: number;
  pan: Position;
  filters: WallFilters;
  group: GroupMode;
  savedAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const localPositions = {
  key: (slug: string) => `ca.wall.${slug}.positions`,
  load: (slug: string) => readJson<Record<string, Position>>(localPositions.key(slug), {}),
  save: (slug: string, positions: Record<string, Position>) => writeJson(localPositions.key(slug), positions),
  clear: (slug: string) => {
    try {
      window.localStorage.removeItem(localPositions.key(slug));
    } catch {
      /* ignore */
    }
  },
};

export const savedViews = {
  key: (slug: string) => `ca.wall.${slug}.views`,
  load: (slug: string) => readJson<SavedView[]>(savedViews.key(slug), []),
  save: (slug: string, views: SavedView[]) => writeJson(savedViews.key(slug), views.slice(-20)),
};
