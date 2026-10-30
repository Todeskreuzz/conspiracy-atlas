import { useEffect, useState } from 'react';
import { api } from './client';

export interface AdminSessionState {
  loading: boolean;
  available: boolean;
  authenticated: boolean;
  csrfToken: string | null;
  username: string | null;
  state?: string;
  message?: string | null;
}

type Listener = (s: AdminSessionState) => void;
let current: AdminSessionState = { loading: true, available: false, authenticated: false, csrfToken: null, username: null };
const listeners = new Set<Listener>();
let inflight: Promise<void> | null = null;

function publish(next: AdminSessionState) {
  current = next;
  listeners.forEach((l) => l(next));
}

export function refreshAdminSession(): Promise<void> {
  inflight ??= api<{ authenticated: boolean; available: boolean; csrfToken?: string; username?: string; state?: string; message?: string }>('/admin/session', { localized: false })
    .then((r) =>
      publish({
        loading: false,
        available: r.available,
        authenticated: r.authenticated,
        csrfToken: r.csrfToken ?? null,
        username: r.username ?? null,
        state: r.state,
        message: r.message ?? null,
      }),
    )
    .catch((e: { state?: string; message?: string }) =>
      publish({ loading: false, available: false, authenticated: false, csrfToken: null, username: null, state: e.state ?? 'backend_unavailable', message: e.message ?? null }),
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function setAdminSession(s: Partial<AdminSessionState>) {
  publish({ ...current, ...s, loading: false });
}

/** Shared admin session state (one request per page load). */
export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState(current);
  useEffect(() => {
    listeners.add(setState);
    if (current.loading) void refreshAdminSession();
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

/** Admin API helpers that attach the CSRF token to every state-changing request. */
export function adminApi(csrfToken: string) {
  const h = { 'X-CSRF-Token': csrfToken };
  return {
    get: <T>(path: string) => api<T>(`/admin${path}`, { localized: false }),
    post: <T = { ok: boolean }>(path: string, body: unknown = {}) => api<T>(`/admin${path}`, { method: 'POST', body, headers: h, localized: false }),
    put: <T = { ok: boolean }>(path: string, body: unknown = {}) => api<T>(`/admin${path}`, { method: 'PUT', body, headers: h, localized: false }),
    patch: <T = { ok: boolean }>(path: string, body: unknown = {}) => api<T>(`/admin${path}`, { method: 'PATCH', body, headers: h, localized: false }),
    del: <T = { ok: boolean }>(path: string) => api<T>(`/admin${path}`, { method: 'DELETE', headers: h, localized: false }),
  };
}
