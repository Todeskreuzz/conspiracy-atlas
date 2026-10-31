import { useEffect, useState } from 'react';
import { api } from './client';
import type { AccountUser } from '../../shared/profile';
import type { ServiceState } from '../../shared/availability';

/**
 * The visitor's own account. The session cookie is HttpOnly, so a small hint in localStorage remembers
 * whether this browser signed in; without it no session request is sent (saves Worker requests).
 */
export interface AccountState {
  loading: boolean;
  available: boolean;
  user: AccountUser | null;
  csrfToken: string | null;
  state?: ServiceState;
}

const HINT_KEY = 'ca.account';
type Listener = (s: AccountState) => void;
let current: AccountState = { loading: true, available: true, user: null, csrfToken: null };
const listeners = new Set<Listener>();
let inflight: Promise<void> | null = null;

function hint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function setHint(on: boolean) {
  try {
    if (on) window.localStorage.setItem(HINT_KEY, '1');
    else window.localStorage.removeItem(HINT_KEY);
  } catch {
    /* storage unavailable */
  }
}

function publish(next: AccountState) {
  current = next;
  listeners.forEach((l) => l(next));
}

interface SessionResponse {
  authenticated: boolean;
  available: boolean;
  user?: AccountUser;
  csrfToken?: string;
  state?: ServiceState;
}

export function applySession(r: SessionResponse) {
  setHint(!!r.authenticated);
  publish({ loading: false, available: r.available !== false, user: r.authenticated ? (r.user ?? null) : null, csrfToken: r.csrfToken ?? null, state: r.state });
}

export function refreshAccount(force = false): Promise<void> {
  if (!force && !hint()) {
    publish({ ...current, loading: false, user: null, csrfToken: null });
    return Promise.resolve();
  }
  inflight ??= api<SessionResponse>('/account/me', { localized: false })
    .then(applySession)
    .catch(() => publish({ ...current, loading: false, user: null, csrfToken: null }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useAccount(): AccountState {
  const [state, setState] = useState(current);
  useEffect(() => {
    listeners.add(setState);
    setState(current);
    if (current.loading) void refreshAccount();
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

export function updateAccountUser(patch: Partial<AccountUser>) {
  if (current.user) publish({ ...current, user: { ...current.user, ...patch } });
}

export async function logout() {
  try {
    await api('/account/logout', { method: 'POST', body: {}, localized: false });
  } finally {
    applySession({ authenticated: false, available: true });
  }
}

/** Requests of the signed-in account; writes carry the CSRF token. */
export function accountApi(csrfToken: string | null) {
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined;
  return {
    get: <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal, localized: false }),
    put: <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body, headers, localized: false }),
    post: <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body, headers, localized: false }),
    del: <T>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body: body ?? {}, headers, localized: false }),
  };
}
