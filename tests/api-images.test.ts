import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { client, makeEnv, validSubmission } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { bytesToBase64, IMAGE_LIMITS, sniffImageMime } from '../shared/images';

const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }))) as unknown as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function fakeImage(magic: number[], size: number) {
  const bytes = new Uint8Array(size);
  bytes.set(magic);
  for (let i = magic.length; i < size; i++) bytes[i] = (i * 31) & 0xff;
  return bytes;
}
function upload(bytes: Uint8Array, mime = 'image/webp', extra: Record<string, unknown> = {}) {
  return { data: bytesToBase64(bytes), mime, width: 800, height: 600, alt: 'A test picture', ...extra };
}

async function setup(overrides = {}) {
  const env = await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true', ...overrides });
  const visitor = client(env);
  const admin = client(env);
  await admin.login();
  return { env, visitor, admin, raw: (env.DB as any).raw };
}

describe('community images (stored in D1)', () => {
  it('detects real file types from magic bytes', () => {
    expect(sniffImageMime(fakeImage(WEBP_MAGIC, 20))).toBe('image/webp');
    expect(sniffImageMime(fakeImage(PNG_MAGIC, 20))).toBe('image/png');
    expect(sniffImageMime(fakeImage([0xff, 0xd8, 0xff], 20))).toBe('image/jpeg');
    expect(sniffImageMime(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });

  it('stores images with a submission, hides them until publication, then serves them', async () => {
    const { visitor, admin, raw } = await setup();
    const img = fakeImage(WEBP_MAGIC, 40_000);
    const sub = await visitor.post('/api/submissions', validSubmission({ images: [upload(img), upload(fakeImage(PNG_MAGIC, 1000), 'image/png')] }));
    expect(sub.status).toBe(201);
    expect(sub.json.images).toBe(2);

    const detail = await admin.get(`/api/admin/submissions/${sub.json.id}`);
    expect(detail.json.images).toHaveLength(2);
    const first = detail.json.images[0];
    expect(first.url).toBe(`/api/admin/images/${first.id}`);
    expect(first.size).toBe(40_000);

    // Not public before publication, and the admin route needs a session.
    expect((await visitor.get(`/api/images/${first.id}`)).status).toBe(404);
    expect((await visitor.get(first.url)).status).toBe(401);
    const adminView = await admin.req('GET', first.url);
    expect(adminView.status).toBe(200);
    expect(adminView.headers.get('Content-Type')).toBe('image/webp');
    expect(adminView.headers.get('Cache-Control')).toContain('no-store');

    await admin.post(`/api/admin/submissions/${sub.json.id}/action`, { action: 'approve' });
    const slug = (await admin.post(`/api/admin/submissions/${sub.json.id}/action`, { action: 'publish' })).json.publishedSlug;
    const theory = await visitor.get(`/api/theories/${slug}`);
    expect(theory.json.images.map((i: any) => i.alt)).toEqual(['A test picture', 'A test picture']);
    const pub = await visitor.get(theory.json.images[0].url);
    expect(pub.status).toBe(200);
    expect(pub.headers.get('Cache-Control')).toContain('immutable');
    expect(pub.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(pub.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    // The stored bytes are exactly the uploaded bytes.
    const stored = raw.prepare('SELECT data FROM images WHERE public_id = ?').get(first.id).data as Uint8Array;
    expect(Buffer.from(stored).equals(Buffer.from(img))).toBe(true);

    // Withdrawing removes the images and frees the space.
    await admin.post(`/api/admin/submissions/${sub.json.id}/action`, { action: 'withdraw' });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM images').get().n).toBe(0);
  });

  it('deletes images of rejected submissions', async () => {
    const { visitor, admin, raw } = await setup();
    const sub = await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(WEBP_MAGIC, 500))] }));
    await admin.post(`/api/admin/submissions/${sub.json.id}/action`, { action: 'reject' });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM images').get().n).toBe(0);
  });

  it('rejects disguised, oversized and too many images', async () => {
    const { visitor, raw } = await setup();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
    expect((await visitor.post('/api/submissions', validSubmission({ images: [upload(svg, 'image/png')] }))).status).toBe(400);
    expect((await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(PNG_MAGIC, 100), 'image/webp')] }))).status).toBe(400);
    expect((await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(WEBP_MAGIC, IMAGE_LIMITS.maxBytes + 1))] }))).status).toBe(400);
    expect((await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(WEBP_MAGIC, 100), 'image/webp', { width: 9000 })] }))).status).toBe(400);
    const five = Array.from({ length: 5 }, () => upload(fakeImage(WEBP_MAGIC, 100)));
    expect((await visitor.post('/api/submissions', validSubmission({ images: five }))).status).toBe(400);
    // Nothing was stored, not even the submissions.
    expect(raw.prepare('SELECT COUNT(*) AS n FROM images').get().n).toBe(0);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM community_submissions').get().n).toBe(0);
  });

  it('stops at the storage budget with "Currently unavailable!" and stores nothing', async () => {
    // 1 MB budget: two 400 KB images fit, the third does not.
    const { visitor, raw } = await setup({ IMAGE_STORAGE_LIMIT_MB: '1' });
    const ip = (n: number) => ({ 'CF-Connecting-IP': `203.0.113.${n}` });
    expect((await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(WEBP_MAGIC, 400_000))] }), ip(1))).status).toBe(201);
    expect((await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(WEBP_MAGIC, 400_000))] }), ip(2))).status).toBe(201);
    const full = await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(WEBP_MAGIC, 400_000))] }), ip(3));
    expect(full.status).toBe(429);
    expect(full.json.error.state).toBe('limit_reached');
    expect(full.json.error.message).toBe('Currently unavailable! The free storage space for images is used up.');
    expect(raw.prepare('SELECT COUNT(*) AS n FROM community_submissions').get().n).toBe(2);
    // Submissions without images still work.
    expect((await visitor.post('/api/submissions', validSubmission(), ip(4))).status).toBe(201);
  });

  it('caps IMAGE_STORAGE_LIMIT_MB at 400 MB', async () => {
    const { imageStorageLimitBytes } = await import('../server/images');
    expect(imageStorageLimitBytes({ IMAGE_STORAGE_LIMIT_MB: '5000' })).toBe(400 * 1024 * 1024);
    expect(imageStorageLimitBytes({})).toBe(250 * 1024 * 1024);
  });

  it('refuses images with the exact message when uploads are switched off', async () => {
    const { visitor } = await setup({ FEATURE_COMMUNITY_UPLOADS: 'false' });
    const r = await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(WEBP_MAGIC, 100))] }));
    expect(r.status).toBe(503);
    expect(r.json.error.message).toBe('Currently unavailable! File storage is intentionally disabled in the free-only configuration.');
  });

  it('reports image storage usage in the admin services view', async () => {
    const { visitor, admin } = await setup();
    await visitor.post('/api/submissions', validSubmission({ images: [upload(fakeImage(WEBP_MAGIC, 1_048_576 / 2))].slice(0, 0) }));
    const r = await admin.get('/api/admin/services');
    const row = r.json.services.find((s: any) => s.service === 'Image storage (D1)');
    expect(row.enabled).toBe(true);
    expect(row.test).toMatch(/MB of 250 MB used/);
  });

  it('lets the editors add images to a case file, use one as cover and delete it', async () => {
    const { visitor, admin, raw } = await setup({ FEATURE_COMMUNITY_UPLOADS: 'false' });
    const th = raw.prepare('SELECT id, slug FROM theories WHERE is_published = 1 ORDER BY id LIMIT 1').get() as { id: number; slug: string };
    // Only editors may upload, and only real images.
    expect((await visitor.post(`/api/admin/theories/${th.id}/images`, { images: [upload(fakeImage(WEBP_MAGIC, 2000))] })).status).toBe(401);
    expect((await admin.post(`/api/admin/theories/${th.id}/images`, { images: [upload(fakeImage([0x3c, 0x73, 0x76, 0x67], 2000))] })).status).toBe(400);
    expect((await admin.post('/api/admin/theories/999999/images', { images: [upload(fakeImage(WEBP_MAGIC, 2000))] })).status).toBe(404);

    const up = await admin.post(`/api/admin/theories/${th.id}/images`, { images: [upload(fakeImage(WEBP_MAGIC, 5000)), upload(fakeImage(JPEG_MAGIC, 3000), 'image/jpeg')] });
    expect(up.status).toBe(201);
    expect(up.json.images).toHaveLength(2);
    const [cover] = up.json.images;
    expect(cover.url).toBe(`/api/images/${cover.id}`);
    // Editorial images are public at once.
    expect((await visitor.get(cover.url)).status).toBe(200);
    expect((await visitor.get(`/api/theories/${th.slug}`)).json.images).toHaveLength(2);

    const detail = (await admin.get(`/api/admin/theories/${th.slug}`)).json;
    const put = await admin.put(`/api/admin/theories/${th.id}`, { ...detail, imagePath: cover.url, imageCredit: 'Photo: example, public domain' });
    expect(put.status).toBe(200);
    expect((await visitor.get(`/api/theories/${th.slug}`)).json.imagePath).toBe(cover.url);
    expect((await admin.put(`/api/admin/theories/${th.id}`, { ...detail, imagePath: 'https://evil.example/x.png' })).status).toBe(400);

    expect((await admin.del(`/api/admin/images/${cover.id}`)).status).toBe(200);
    expect((await visitor.get(cover.url)).status).toBe(404);
    const after = (await visitor.get(`/api/theories/${th.slug}`)).json;
    expect(after.imagePath).toBeNull();
    expect(after.images).toHaveLength(1);
  });

  it('applies the storage budget to editorial images too', async () => {
    const { admin, raw } = await setup({ IMAGE_STORAGE_LIMIT_MB: '0.01' });
    const th = raw.prepare('SELECT id FROM theories ORDER BY id LIMIT 1').get() as { id: number };
    const r = await admin.post(`/api/admin/theories/${th.id}/images`, { images: [upload(fakeImage(WEBP_MAGIC, 20_000))] });
    expect(r.status).toBe(429);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM images').get().n).toBe(0);
  });
});
