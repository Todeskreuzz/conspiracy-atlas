import type { Env } from './env';
import type { Db, Row } from './db';
import { ApiError, UnavailableError } from './errors';
import { randomToken, toHex } from './crypto';
import { ValidationError, int, oneOf, optStr } from '../shared/validation';
import { IMAGE_LIMITS, IMAGE_MIME_TYPES, base64ToBytes, sniffImageMime, type ImageMime, type PublicImage } from '../shared/images';

export interface ParsedImage {
  bytes: Uint8Array;
  mime: ImageMime;
  width: number;
  height: number;
  alt: string | null;
}

/** Validates uploaded images: count, size, real file type (magic bytes) and dimensions. */
export function parseImages(raw: unknown): ParsedImage[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ValidationError('images', 'must be a list');
  if (raw.length > IMAGE_LIMITS.perSubmission) throw new ValidationError('images', `at most ${IMAGE_LIMITS.perSubmission} images`);
  return raw.map((item, i) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const field = `images[${i}]`;
    if (typeof o.data !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(o.data)) throw new ValidationError(field, 'invalid image data');
    if (o.data.length > Math.ceil((IMAGE_LIMITS.maxBytes * 4) / 3) + 4) throw new ValidationError(field, 'image too large (max. 512 KB)');
    const bytes = base64ToBytes(o.data);
    if (bytes.length === 0 || bytes.length > IMAGE_LIMITS.maxBytes) throw new ValidationError(field, 'image too large (max. 512 KB)');
    const mime = oneOf(o.mime, `${field}.mime`, IMAGE_MIME_TYPES);
    if (sniffImageMime(bytes) !== mime) throw new ValidationError(field, 'file content does not match an allowed image type');
    return {
      bytes,
      mime,
      width: int(o.width, `${field}.width`, { min: 1, max: IMAGE_LIMITS.maxDimension }) as number,
      height: int(o.height, `${field}.height`, { min: 1, max: IMAGE_LIMITS.maxDimension }) as number,
      alt: optStr(o.alt, `${field}.alt`, IMAGE_LIMITS.altChars),
    };
  });
}

/** Total image budget in bytes (IMAGE_STORAGE_LIMIT_MB, capped so the archive keeps room in the 500 MB free database). */
export function imageStorageLimitBytes(env: Env): number {
  const mb = Number(env.IMAGE_STORAGE_LIMIT_MB);
  const safe = Number.isFinite(mb) && mb > 0 ? Math.min(mb, IMAGE_LIMITS.maxStorageMb) : IMAGE_LIMITS.defaultStorageMb;
  return Math.floor(safe * 1024 * 1024);
}

export async function imageStorageUsed(db: Db): Promise<number> {
  const r = await db.first<{ used: number }>('SELECT COALESCE(SUM(size), 0) AS used FROM images');
  return Number(r?.used ?? 0);
}

/** Refuses new images once the budget would be exceeded ("Currently unavailable!" with limit_reached). */
export async function assertImageQuota(db: Db, env: Env, additionalBytes: number): Promise<void> {
  if (additionalBytes <= 0) return;
  if ((await imageStorageUsed(db)) + additionalBytes > imageStorageLimitBytes(env)) {
    throw new UnavailableError('community_uploads', 'limit_reached');
  }
}

/** Statements inserting images for the submission created earlier in the same batch. */
export async function imageInsertStatements(db: Db, images: ParsedImage[]): Promise<D1PreparedStatement[]> {
  const stmts: D1PreparedStatement[] = [];
  for (const [i, img] of images.entries()) {
    const hash = toHex(await crypto.subtle.digest('SHA-256', img.bytes));
    stmts.push(
      db.stmt(
        `INSERT INTO images (public_id, submission_id, mime, width, height, size, sha256, alt, position, data)
         VALUES (?, (SELECT MAX(id) FROM community_submissions), ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomToken(12),
        img.mime,
        img.width,
        img.height,
        img.bytes.length,
        hash,
        img.alt,
        i,
        // D1 stores ArrayBuffer values as BLOB.
        img.bytes.buffer.slice(img.bytes.byteOffset, img.bytes.byteOffset + img.bytes.byteLength),
      ),
    );
  }
  return stmts;
}

export function mapImage(r: Row, base: string): PublicImage {
  return {
    id: String(r.public_id),
    url: `${base}/${r.public_id}`,
    mime: r.mime as ImageMime,
    width: Number(r.width),
    height: Number(r.height),
    size: Number(r.size),
    alt: (r.alt as string) ?? null,
  };
}

/** D1 returns BLOBs as number arrays; the local test database returns Uint8Array. */
export function blobToBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  throw new ApiError(500, 'invalid_blob', 'Stored image could not be read');
}

/** Serves an image with strict headers; content is immutable, so browsers cache it for a year. */
export function imageResponse(row: Row, cache: 'public' | 'private'): Response {
  const bytes = blobToBytes(row.data);
  return new Response(bytes, {
    headers: {
      'Content-Type': String(row.mime),
      'Content-Length': String(bytes.length),
      'Cache-Control': cache === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
    },
  });
}

