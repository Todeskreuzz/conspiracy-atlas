-- Visitor accounts with customisable profile pages (free plan: everything lives in D1).
-- Passwords and recovery codes are stored only as PBKDF2 hashes; sessions only as SHA-256 hashes.
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 24),
  password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  -- Layout, colours, bio, links and favourites; validated by shared/profile.ts.
  profile_json TEXT NOT NULL DEFAULT '{}',
  -- public_id of the avatar / banner in images (pending until an editor approves it).
  avatar_image TEXT,
  banner_image TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_sessions (
  id_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expiry ON user_sessions(expires_at);

-- Profile images share the image budget (IMAGE_STORAGE_LIMIT_MB) with community images.
ALTER TABLE images ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_images_user ON images(user_id, status);

-- Submissions sent while signed in appear on the author's profile (named and published ones only).
ALTER TABLE community_submissions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_submissions_user ON community_submissions(user_id, status);
