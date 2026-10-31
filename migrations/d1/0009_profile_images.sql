-- Profile pictures and banners get their own table: they are public at once (no review), and
-- animated GIFs are allowed for accounts an editor unlocks (users.allow_animated).
-- D1 rows are limited to 2 MB, so a single image is capped at 1.5 MB here.
CREATE TABLE profile_images (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('avatar', 'banner')),
  mime TEXT NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg', 'image/png', 'image/gif')),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 4096),
  size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 1572864),
  sha256 TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, slot)
);
CREATE INDEX idx_profile_images_created ON profile_images(created_at DESC);

-- Existing profile images move over (they become public; there is no review step any more).
INSERT INTO profile_images (public_id, user_id, slot, mime, width, height, size, sha256, data, created_at)
  SELECT public_id, user_id, CASE WHEN alt = 'banner' THEN 'banner' ELSE 'avatar' END, mime, width, height, size, sha256, data, created_at
  FROM images WHERE user_id IS NOT NULL
  AND public_id IN (SELECT avatar_image FROM users WHERE avatar_image IS NOT NULL UNION SELECT banner_image FROM users WHERE banner_image IS NOT NULL);
DELETE FROM images WHERE user_id IS NOT NULL;

-- Animated GIF profile images only for accounts an editor allows (the site owner).
ALTER TABLE users ADD COLUMN allow_animated INTEGER NOT NULL DEFAULT 0 CHECK (allow_animated IN (0, 1));
