/** Public, freely reusable person portraits from Wikimedia Commons. */
export interface Portrait {
  dataUrl: string;
  fileTitle: string;
  credit: string;
  license: string;
  sourceUrl: string;
}

const cache = new Map<string, Promise<Portrait | null>>();

const reviewedFallbacks: Record<string, Omit<Portrait, 'dataUrl'>> = {
  'martin luther king jr.': {
    fileTitle: 'Martin Luther King, Jr - NARA - 559202.jpg',
    credit: 'Betsy Graves Reyneau · U.S. National Archives and Records Administration',
    license: 'Public Domain (U.S. Government work)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Martin_Luther_King,_Jr_-_NARA_-_559202.jpg',
  },
};

async function loadReviewedFallback(name: string): Promise<Portrait | null> {
  const fallback = reviewedFallbacks[name.trim().toLocaleLowerCase()];
  if (!fallback) return null;
  try {
    const filePageTitle = `File:${fallback.fileTitle}`;
    const query = new URLSearchParams({ action: 'query', titles: filePageTitle, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '240', format: 'json', origin: '*' });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${query}`);
    if (!response.ok) return null;
    const payload = await response.json() as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
    };
    const info = Object.values(payload.query?.pages ?? {})[0]?.imageinfo?.[0];
    const imageUrl = info?.thumburl ?? info?.url;
    if (!imageUrl) return null;
    return { ...fallback, dataUrl: await asDataUrl(imageUrl) };
  } catch {
    return null;
  }
}


function plain(value?: string): string {
  return (value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function asDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Portrait request failed: ${response.status}`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function findPortrait(name: string): Promise<Portrait | null> {
  const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const sparql = `SELECT ?image WHERE { ?person wdt:P18 ?image . { ?person rdfs:label "${escapedName}"@en . } UNION { ?person skos:altLabel "${escapedName}"@en . } } LIMIT 1`;
  const sparqlQuery = new URLSearchParams({ query: sparql, format: 'json' });
  const entityResponse = await fetch(`https://query.wikidata.org/sparql?${sparqlQuery}`, );
  if (!entityResponse.ok) return null;
  const entityPayload = await entityResponse.json() as { results?: { bindings?: Array<{ image?: { value?: string } }> } };
  const imageValue = entityPayload.results?.bindings?.[0]?.image?.value;
  if (!imageValue) return null;
  const file = decodeURIComponent(new URL(imageValue).pathname.split('/').pop() ?? '');
  if (!file) return null;

  const filePageTitle = `File:${file}`;
  const commonsQuery = new URLSearchParams({ action: 'query', titles: filePageTitle, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '240', format: 'json', origin: '*' });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${commonsQuery}`);
  if (!response.ok) return null;
  const payload = await response.json() as {
    query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl?: string; url?: string; extmetadata?: Record<string, { value?: string }> }> }> };
  };
  const page = Object.values(payload.query?.pages ?? {}).find((item) => !('missing' in item));
  const info = page?.imageinfo?.[0];
  const imageUrl = info?.thumburl ?? info?.url;
  if (!page || !info || !imageUrl) return null;
  const meta = info.extmetadata ?? {};
  const fileTitle = page.title.replace(/^File:/, '');
  const sourceUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
  return {
    dataUrl: await asDataUrl(imageUrl),
    fileTitle,
    credit: plain(meta.Credit?.value || meta.Artist?.value || 'Wikimedia Commons'),
    license: plain(meta.LicenseShortName?.value || 'Lizenzangabe auf Wikimedia Commons'),
    sourceUrl,
  };
}

export function loadPersonPortrait(name: string): Promise<Portrait | null> {
  const key = name.trim().toLocaleLowerCase();
  let request = cache.get(key);
  if (!request) {
    request = findPortrait(name).then((portrait) => portrait ?? loadReviewedFallback(name)).catch(() => null);
    cache.set(key, request);
  }
  return request;
}

