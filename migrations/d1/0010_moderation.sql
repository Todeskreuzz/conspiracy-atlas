-- Reporting and moderation for community content.
-- Reports can now also target community notes on a case, comments and profiles, and remember a salted
-- per-target hash of the reporter so that one visitor counts only once (never the IP address itself).
-- SQLite cannot change a CHECK constraint in place, so the table is rebuilt. Dropping the old table would
-- cascade into moderation_actions, so those rows are kept aside and put back afterwards.
CREATE TABLE moderation_actions_keep AS SELECT * FROM moderation_actions WHERE report_id IS NOT NULL;

CREATE TABLE reports_new (
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('theory','submission','event','organization','source','case_note','comment','profile')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('misinformation','missing_source','copyright','harassment','spam','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  reporter_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
INSERT INTO reports_new (id, target_type, target_id, reason, details, status, created_at, resolved_at)
  SELECT id, target_type, target_id, reason, details, status, created_at, resolved_at FROM reports;
DROP TABLE reports;
ALTER TABLE reports_new RENAME TO reports;
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_reports_target ON reports(target_type, target_id, status);
-- One open report per visitor and target.
CREATE UNIQUE INDEX idx_reports_once ON reports(target_type, target_id, reporter_hash) WHERE reporter_hash IS NOT NULL AND status = 'open';

INSERT INTO moderation_actions (id, submission_id, report_id, action, note, actor, created_at)
  SELECT id, submission_id, report_id, action, note, actor, created_at FROM moderation_actions_keep WHERE id NOT IN (SELECT id FROM moderation_actions);
DROP TABLE moderation_actions_keep;
CREATE INDEX idx_moderation_created ON moderation_actions(created_at DESC);
