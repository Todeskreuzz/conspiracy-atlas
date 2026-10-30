-- Community image uploads stored in D1 (free plan: hard limits, never billed).
-- Images are compressed in the browser (WebP/JPEG, max. 512 KB each) and the total
-- size is capped by IMAGE_STORAGE_LIMIT_MB so the database stays below the 500 MB free limit.
CREATE TABLE images (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  submission_id INTEGER REFERENCES community_submissions(id) ON DELETE CASCADE,
  theory_id INTEGER REFERENCES theories(id) ON DELETE SET NULL,
  mime TEXT NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg', 'image/png')),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 4096),
  size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 524288),
  sha256 TEXT NOT NULL,
  alt TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_images_submission ON images(submission_id);
CREATE INDEX idx_images_theory ON images(theory_id, status);
