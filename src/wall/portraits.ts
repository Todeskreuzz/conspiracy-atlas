import { api } from '../api/client';

export interface Portrait {
  dataUrl: string;
  fileTitle: string;
  credit: string;
  license: string;
  sourceUrl: string;
}

const cache = new Map<string, Promise<Portrait | null>>();

export function loadPersonPortrait(slug: string): Promise<Portrait | null> {
  let request = cache.get(slug);
  if (!request) {
    request = api<Portrait | null>(`/people/${encodeURIComponent(slug)}/portrait`, { localized: false })
      .catch(() => null);
    cache.set(slug, request);
    void request.then((portrait) => { if (!portrait) cache.delete(slug); });
  }
  return request;
}
