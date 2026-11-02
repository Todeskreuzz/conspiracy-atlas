-- Cases the site owner has already posted to the subreddit. They drop out of the draft queue.
-- The row stores no Reddit account, token or post id: posting stays manual.
CREATE TABLE reddit_posts (
  theory_id INTEGER PRIMARY KEY REFERENCES theories(id) ON DELETE CASCADE,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 80)
);
