import { api } from './client';

const KEY_STORAGE = 'ca.investigation.key';

export function isValidKey(key: string): boolean {
  return /^[0-9a-f]{64}$/.test(key);
}

export function generateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The private key lives only in this browser. The server stores just its hash. */
export function getInvestigationKey(): string {
  try {
    const existing = window.localStorage.getItem(KEY_STORAGE);
    if (existing && isValidKey(existing)) return existing;
    const key = generateKey();
    window.localStorage.setItem(KEY_STORAGE, key);
    return key;
  } catch {
    return generateKey();
  }
}

export function setInvestigationKey(key: string) {
  window.localStorage.setItem(KEY_STORAGE, key);
}

export function invApi(key: string) {
  const headers = { 'X-Investigation-Key': key };
  return {
    get: <T>(path: string, signal?: AbortSignal) => api<T>(`/investigations${path}`, { headers, signal }),
    post: <T>(path: string, body: unknown) => api<T>(`/investigations${path}`, { method: 'POST', body, headers, localized: false }),
    put: <T>(path: string, body: unknown) => api<T>(`/investigations${path}`, { method: 'PUT', body, headers, localized: false }),
    patch: <T>(path: string, body: unknown) => api<T>(`/investigations${path}`, { method: 'PATCH', body, headers, localized: false }),
    del: <T>(path: string) => api<T>(`/investigations${path}`, { method: 'DELETE', headers, localized: false }),
  };
}
