-- Discussion under case files and community theories: comments and votes from signed-in accounts.
-- Accounts are protected by Turnstile at sign-up, so comments appear at once (rate-limited);
-- editors and the report system can hide them ('hidden'). 'deleted' = removed by the author:
-- the text is cleared and the row stays only as a placeholder while replies hang off it.
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  -- One level of replies: a reply always points at a top-level comment.
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) <= 2000),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'de')),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT
);
CREATE INDEX idx_comments_theory ON comments(theory_id, status, created_at);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_user ON comments(user_id, created_at DESC);
CREATE INDEX idx_comments_recent ON comments(status, created_at DESC);

-- One vote per account and case / comment: +1 (convincing / helpful) or -1.
CREATE TABLE theory_votes (
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (theory_id, user_id)
);
CREATE INDEX idx_theory_votes_user ON theory_votes(user_id);

CREATE TABLE comment_votes (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX idx_comment_votes_user ON comment_votes(user_id);
