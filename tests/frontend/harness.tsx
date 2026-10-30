import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../src/App';
import { createApp } from '../../server/app';
import type { Env } from '../../server/env';

/**
 * Renders the real application and routes its fetch() calls to the real API (Hono + in-memory D1).
 * Pass env = null to simulate an unreachable backend.
 */
export function renderApp(path: string, env: Env | null) {
  const api = createApp();
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost');
    calls.push(url.pathname + url.search);
    if (!env) throw new TypeError('Failed to fetch');
    if (!url.pathname.startsWith('/api/')) throw new Error(`Unexpected external request: ${url.href}`);
    const headers = new Headers(init?.headers);
    headers.set('Origin', 'http://localhost');
    return api.request(`http://localhost${url.pathname}${url.search}`, { ...init, headers }, env);
  }) as typeof fetch;
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return { ...utils, calls };
}
