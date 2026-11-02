-- One row per UTC date the owner has posted that day's Case of the Day.
-- The case itself stays in the normal queue on other days. Existing rows are never removed by this migration.
CREATE TABLE reddit_daily_posts (
  day TEXT PRIMARY KEY CHECK (length(day) = 10),
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 80)
);
CREATE INDEX idx_reddit_daily_theory ON reddit_daily_posts(theory_id);
