// Limits and checks for community image uploads (shared by the editor and the API).

export const IMAGE_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export const IMAGE_LIMITS = {
  perSubmission: 4,
  /** Hard server limit per image after compression. */
  maxBytes: 512 * 1024,
  /** The browser aims for this size when compressing. */
  targetBytes: 300 * 1024,
  /** Longest edge after resizing in the browser. */
  maxEdge: 1600,
  maxDimension: 4096,
  altChars: 300,
  /** Default total budget for all images; the D1 free plan allows 500 MB per database. */
  defaultStorageMb: 250,
  /** Upper bound for IMAGE_STORAGE_LIMIT_MB so the archive itself always keeps room. */
  maxStorageMb: 400,
} as const;

export interface ImageUpload {
  /** Base64 encoded file content (no data: prefix). */
  data: string;
  mime: ImageMime;
  width: number;
  height: number;
  alt: string | null;
}

export interface PublicImage {
  id: string;
  url: string;
  mime: ImageMime;
  width: number;
  height: number;
  size: number;
  alt: string | null;
}

/** Detects the real file type from its first bytes (never trust the declared type alone). */
export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png';
  }
  return null;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
