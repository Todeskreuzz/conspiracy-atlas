// API client with timeouts and availability classification.
// The UI never waits forever: every request ends in data or a "Currently unavailable!" state.
import { UNAVAILABLE_MESSAGE, type ServiceState } from '../../shared/availability';

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public state: ServiceState | null,
    public field?: string,
  ) {
    super(message);
  }
  /** True when the failure means a service is unavailable (not a client mistake). */
  get unavailable(): boolean {
    return this.state !== null && this.state !== 'available';
  }
}

const TIMEOUT_MS = 10_000;
let currentLocale = 'en';
export function setApiLocale(locale: string) {
  currentLocale = locale;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Append ?lang= for localised content. */
  localized?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => controller.abort());
  let url = `/api${path}`;
  if (opts.localized !== false && currentLocale !== 'en') url += `${url.includes('?') ? '&' : '?'}lang=${currentLocale}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { Accept: 'application/json', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (opts.signal?.aborted) throw err;
    throw new ApiFailure(0, 'network', `${UNAVAILABLE_MESSAGE} The backend service is currently unavailable.`, 'backend_unavailable');
  }
  clearTimeout(timer);
  const contentType = res.headers.get('Content-Type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (res.ok && isJson) return data as T;
  if (res.ok && !isJson) {
    // e.g. the SPA fallback answered because no Functions are running (static preview).
    throw new ApiFailure(res.status, 'no_backend', `${UNAVAILABLE_MESSAGE} The backend service is currently unavailable.`, 'backend_unavailable');
  }
  const err = (data as { error?: { code?: string; message?: string; state?: ServiceState; field?: string } } | null)?.error;
  if (err) throw new ApiFailure(res.status, err.code ?? 'error', err.message ?? 'Error', err.state ?? null, err.field);
  // Non-JSON error: Cloudflare limit pages (429 / 1027) or platform errors.
  const state: ServiceState = res.status === 429 ? 'limit_reached' : res.status >= 500 ? 'backend_unavailable' : 'temporary_error';
  throw new ApiFailure(res.status, 'http_error', `${UNAVAILABLE_MESSAGE}`, state);
}
