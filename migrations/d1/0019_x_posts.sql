-- Cases the owner has already posted on X, kept apart from the Reddit queue.
-- The daily row is one UTC date, so today's Case of the Day can be posted again on a later day.
-- This migration only adds tables. It does not change or delete existing rows.
CREATE TABLE x_posts (
  theory_id INTEGER PRIMARY KEY REFERENCES theories(id) ON DELETE CASCADE,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 80)
);

CREATE TABLE x_daily_posts (
  day TEXT PRIMARY KEY CHECK (length(day) = 10),
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 80)
);
CREATE INDEX idx_x_daily_theory ON x_daily_posts(theory_id);
