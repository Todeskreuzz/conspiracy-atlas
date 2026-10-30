import { createApp } from '../../server/app';
import type { Env } from '../../server/env';
import { createDb, type FakeD1 } from './d1';
import { hashPassword } from '../../server/crypto';

export const ORIGIN = 'http://localhost';
export const ADMIN_PASSWORD = 'correct horse battery staple';
let cachedHash: string | null = null;

export async function makeEnv(overrides: Partial<Env> = {}, db: FakeD1 | null = createDb()): Promise<Env> {
  cachedHash ??= await hashPassword(ADMIN_PASSWORD, 20000);
  return {
    DB: (db ?? undefined) as unknown as D1Database,
    FEATURE_COMMUNITY_SUBMISSIONS: 'true',
    FEATURE_COMMUNITY_UPLOADS: 'false',
    FEATURE_MAP_DATA: 'true',
    FEATURE_AUTOMATIC_IMPORT: 'false',
    FEATURE_TURNSTILE: 'true',
    FEATURE_ADMIN_PANEL: 'true',
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    ADMIN_USERNAME: 'editor',
    ADMIN_PASSWORD_HASH: cachedHash,
    SESSION_SECRET: 'x'.repeat(40),
    ...overrides,
  };
}

export function client(env: Env) {
  const app = createApp();
  let cookie = '';
  let csrf = '';
  const req = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const h: Record<string, string> = { Origin: ORIGIN, ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (cookie) h.Cookie = cookie;
    if (csrf && method !== 'GET') h['X-CSRF-Token'] ??= csrf;
    const res = await app.request(`${ORIGIN}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }, env);
    const setCookie = res.headers.get('Set-Cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  };
  return {
    req,
    get: (p: string, h?: Record<string, string>) => req('GET', p, undefined, h),
    post: (p: string, b?: unknown, h?: Record<string, string>) => req('POST', p, b ?? {}, h),
    put: (p: string, b?: unknown, h?: Record<string, string>) => req('PUT', p, b ?? {}, h),
    patch: (p: string, b?: unknown, h?: Record<string, string>) => req('PATCH', p, b ?? {}, h),
    del: (p: string, h?: Record<string, string>) => req('DELETE', p, undefined, h),
    async login(username = 'editor', password = ADMIN_PASSWORD) {
      const r = await req('POST', '/api/admin/login', { username, password });
      if (r.status === 200) csrf = r.json.csrfToken;
      return r;
    },
    get cookie() {
      return cookie;
    },
    setCsrf(v: string) {
      csrf = v;
    },
  };
}

export function richDoc(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

export function validSubmission(overrides: Record<string, unknown> = {}) {
  return {
    title: 'The Lost Archive of Example City',
    subtitle: 'A test submission',
    summary: 'A summary that is long enough to pass validation rules.',
    body: richDoc('This is the main body of the submission and it is definitely longer than fifty characters.'),
    category: 'history',
    tags: ['Test', 'Archive'],
    sources: [{ title: 'Example source', url: 'https://example.org/source', publisher: 'Example Press', sourceType: 'book' }],
    documentLinks: ['https://example.org/doc.pdf'],
    counterArguments: ['There is no evidence for this.'],
    relatedEvents: ['1969 Moon landing'],
    relatedTheoryIds: [1],
    language: 'en',
    displayMode: 'anonymous',
    displayName: null,
    turnstileToken: 'XXXX.DUMMY.TOKEN',
    ...overrides,
  };
}
