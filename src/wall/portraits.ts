/** Public, freely reusable person portraits from Wikimedia Commons. */
export interface Portrait {
  dataUrl: string;
  fileTitle: string;
  credit: string;
  license: string;
  sourceUrl: string;
}

const cache = new Map<string, Promise<Portrait | null>>();

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
  const entityResponse = await fetch(`https://query.wikidata.org/sparql?${sparqlQuery}`, { headers: { accept: 'application/sparql-results+json' } });
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
    request = findPortrait(name).catch(() => null);
    cache.set(key, request);
  }
  return request;
}

