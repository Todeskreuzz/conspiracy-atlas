import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { IMAGE_LIMITS, bytesToBase64, type ImageMime, type ImageUpload } from '../../shared/images';

export interface PickedImage extends ImageUpload {
  key: string;
  previewUrl: string;
  size: number;
}

const QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42];

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Re-encodes an image in the browser: longest edge at most 1600 px, WebP (JPEG where WebP is not
 * supported), lowering quality and size until it fits. Metadata such as GPS data is dropped.
 */
export async function compressImage(file: File): Promise<Omit<PickedImage, 'key' | 'alt'>> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    let scale = Math.min(1, IMAGE_LIMITS.maxEdge / Math.max(bitmap.width, bitmap.height));
    for (let round = 0; round < 4; round++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      let best: Blob | null = null;
      for (const q of QUALITIES) {
        let blob = await canvasBlob(canvas, 'image/webp', q);
        if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', q);
        if (!blob) continue;
        best = blob;
        if (blob.size <= IMAGE_LIMITS.targetBytes) break;
      }
      if (best && best.size <= IMAGE_LIMITS.maxBytes) {
        const bytes = new Uint8Array(await best.arrayBuffer());
        return { data: bytesToBase64(bytes), mime: best.type as ImageMime, width, height, size: bytes.length, previewUrl: URL.createObjectURL(best) };
      }
      scale *= 0.75;
    }
    throw new Error('too_large');
  } finally {
    bitmap.close();
  }
}

interface Props {
  images: PickedImage[];
  onChange: (images: PickedImage[]) => void;
  disabled?: boolean;
}

export function ImageUploader({ images, onChange, disabled }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(images);
  latest.current = images;

  useEffect(() => () => latest.current.forEach((img) => URL.revokeObjectURL(img.previewUrl)), []);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const free = IMAGE_LIMITS.perSubmission - images.length;
    const chosen = Array.from(files).slice(0, free);
    if (files.length > free) setError(t('submit.images.tooMany', { max: IMAGE_LIMITS.perSubmission }));
    setBusy(true);
    const added: PickedImage[] = [];
    for (const file of chosen) {
      if (!file.type.startsWith('image/')) {
        setError(t('submit.images.notImage', { name: file.name }));
        continue;
      }
      try {
        const c = await compressImage(file);
        added.push({ ...c, alt: '', key: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
      } catch {
        setError(t('submit.images.failed', { name: file.name }));
      }
    }
    setBusy(false);
    if (input.current) input.current.value = '';
    if (added.length) onChange([...latest.current, ...added]);
  };

  const remove = (key: string) => {
    const img = images.find((i) => i.key === key);
    if (img) URL.revokeObjectURL(img.previewUrl);
    onChange(images.filter((i) => i.key !== key));
  };

  const full = images.length >= IMAGE_LIMITS.perSubmission;
  return (
    <div className="image-uploader">
      <p className="muted small">{t('submit.images.hint', { max: IMAGE_LIMITS.perSubmission })}</p>
      <label className={`btn btn--small${disabled || full || busy ? ' is-disabled' : ''}`}>
        {busy ? t('submit.images.compressing') : t('submit.uploadButton')}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={disabled || full || busy}
          data-testid="upload-input"
          onChange={(e) => void pick(e.target.files)}
        />
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {images.length > 0 && (
        <ul className="image-uploader__list">
          {images.map((img, i) => (
            <li key={img.key} className="image-uploader__item">
              <img src={img.previewUrl} alt="" width={img.width} height={img.height} />
              <span className="mono small muted">
                {img.width}×{img.height} · {Math.round(img.size / 1024)} KB
              </span>
              <input
                type="text"
                maxLength={IMAGE_LIMITS.altChars}
                placeholder={t('submit.images.alt')}
                aria-label={`${t('submit.images.alt')} ${i + 1}`}
                value={img.alt ?? ''}
                onChange={(e) => onChange(images.map((x) => (x.key === img.key ? { ...x, alt: e.target.value } : x)))}
              />
              <button type="button" className="btn btn--small btn--ghost" onClick={() => remove(img.key)}>
                {t('submit.images.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function toUploads(images: PickedImage[]): ImageUpload[] {
  return images.map(({ data, mime, width, height, alt }) => ({ data, mime, width, height, alt: alt?.trim() || null }));
}
