import type { PublicImage } from '../../shared/images';

/** Images are served by our own API as plain image files; alt text is user text rendered as text. */
export function ImageGallery({ images }: { images: PublicImage[] }) {
  if (!images.length) return null;
  return (
    <ul className="image-gallery" data-testid="image-gallery">
      {images.map((img) => (
        <li key={img.id}>
          <a href={img.url} target="_blank" rel="noopener noreferrer">
            <img src={img.url} alt={img.alt ?? ''} width={img.width} height={img.height} loading="lazy" decoding="async" />
          </a>
          {img.alt && <span className="small muted">{img.alt}</span>}
        </li>
      ))}
    </ul>
  );
}
