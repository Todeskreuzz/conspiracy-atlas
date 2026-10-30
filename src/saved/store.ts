// Bookmarks and the personal wall live only in this browser (localStorage). Nothing is sent to the server.
import { useSyncExternalStore } from 'react';
import type { BoardEdge, TheorySummary } from '../../shared/types';
import type { NodeKind } from '../../shared/constants';

export type SavedCase = Pick<TheorySummary, 'id' | 'slug' | 'title' | 'subtitle' | 'summary' | 'category' | 'imagePath'> & { savedAt: string };

export interface MyBoardNote {
  id: number;
  kind: NodeKind;
  title: string;
  summary: string | null;
}

export interface MyBoard {
  notes: MyBoardNote[];
  edges: BoardEdge[];
  positions: Record<string, { x: number; y: number }>;
}

export const MAX_SAVED = 200;
/** Id ranges on the personal wall: case cards use the case id, notes and own threads start far above. */
export const NOTE_ID_BASE = 2_000_000;
export const EDGE_ID_BASE = 3_000_000;

const SAVED_KEY = 'ca.saved';
const BOARD_KEY = 'ca.myboard';
const EVENT = 'ca-saved-change';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode): bookmarks then last for this page view only */
  }
  cache = null;
  window.dispatchEvent(new Event(EVENT));
}

let cache: SavedCase[] | null = null;
const EMPTY: SavedCase[] = [];

export function loadSaved(): SavedCase[] {
  if (typeof window === 'undefined') return EMPTY;
  if (!cache) {
    const list = read<SavedCase[]>(SAVED_KEY, []);
    cache = Array.isArray(list) ? list.filter((c) => c && typeof c.id === 'number' && typeof c.slug === 'string') : [];
  }
  return cache;
}

export function isSaved(id: number): boolean {
  return loadSaved().some((c) => c.id === id);
}

export function saveCase(theory: Omit<SavedCase, 'savedAt'>) {
  if (isSaved(theory.id)) return;
  const { id, slug, title, subtitle, summary, category, imagePath } = theory;
  write(SAVED_KEY, [{ id, slug, title, subtitle, summary: summary.slice(0, 400), category, imagePath, savedAt: new Date().toISOString() }, ...loadSaved()].slice(0, MAX_SAVED));
}

export function unsaveCase(id: number) {
  write(SAVED_KEY, loadSaved().filter((c) => c.id !== id));
  const board = loadMyBoard();
  saveMyBoard({ ...board, edges: board.edges.filter((e) => e.source !== id && e.target !== id) });
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useSaved(): SavedCase[] {
  return useSyncExternalStore(subscribe, loadSaved, () => EMPTY);
}

export function loadMyBoard(): MyBoard {
  const b = read<Partial<MyBoard>>(BOARD_KEY, {});
  return { notes: Array.isArray(b.notes) ? b.notes : [], edges: Array.isArray(b.edges) ? b.edges : [], positions: b.positions && typeof b.positions === 'object' ? b.positions : {} };
}

export function saveMyBoard(board: MyBoard) {
  try {
    window.localStorage.setItem(BOARD_KEY, JSON.stringify(board));
  } catch {
    /* storage unavailable */
  }
}
