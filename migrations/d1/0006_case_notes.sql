-- Community notes on case files: a comment or an additional source, published only after an editor approves it.
-- Only the freely chosen display name is stored (via authors), never e-mail or IP addresses.
CREATE TABLE case_notes (
  id INTEGER PRIMARY KEY,
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('comment', 'source')),
  body TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'de')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderator_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  CHECK (kind = 'comment' OR source_url IS NOT NULL)
);
CREATE INDEX idx_case_notes_theory ON case_notes(theory_id, status, created_at);
CREATE INDEX idx_case_notes_status ON case_notes(status, created_at DESC);
