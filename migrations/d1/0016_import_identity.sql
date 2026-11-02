-- Stable identity for the automatic import.
-- theories.wikidata_qid is unique, so the same Wikidata item cannot be stored twice.
-- community_submissions.wikidata_qid is unique, so a borderline item is queued for review only once.
-- theory_aliases keeps extra titles (translations, Wikidata aliases) for the next run.
-- Nothing is deleted. A QID that already sits on more than one case is left empty, so the
-- unique index can be created; scripts/report-duplicates.ts lists those cases for a person to review.

ALTER TABLE theories ADD COLUMN wikidata_qid TEXT;
ALTER TABLE community_submissions ADD COLUMN wikidata_qid TEXT;

CREATE TABLE theory_aliases (
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  match_key TEXT NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (theory_id, match_key)
);
CREATE INDEX idx_theory_aliases_key ON theory_aliases(match_key);

-- Backfill from the note written by the importer: "Imported automatically from Wikidata item Q123. ..."
UPDATE theories
SET wikidata_qid = (
  SELECT substr(
    s.notes,
    length('Imported automatically from Wikidata item ') + 1,
    instr(substr(s.notes, length('Imported automatically from Wikidata item ') + 1), '.') - 1
  )
  FROM evidence e
  JOIN sources s ON s.id = e.source_id
  WHERE e.theory_id = theories.id
    AND e.claim_id IS NULL
    AND s.notes LIKE 'Imported automatically from Wikidata item Q%'
    AND instr(substr(s.notes, length('Imported automatically from Wikidata item ') + 1), '.') > 1
  ORDER BY s.id
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM evidence e
  JOIN sources s ON s.id = e.source_id
  WHERE e.theory_id = theories.id
    AND e.claim_id IS NULL
    AND s.notes LIKE 'Imported automatically from Wikidata item Q%'
);

-- Drop values that are not a single QID, and drop a QID that is already shared (the report script shows those).
UPDATE theories SET wikidata_qid = NULL
WHERE wikidata_qid IS NOT NULL
  AND NOT (
    length(wikidata_qid) BETWEEN 2 AND 12
    AND substr(wikidata_qid, 1, 1) = 'Q'
    AND substr(wikidata_qid, 2) GLOB '[0-9]*'
    AND substr(wikidata_qid, 2) NOT GLOB '*[^0-9]*'
  );

UPDATE theories SET wikidata_qid = NULL
WHERE wikidata_qid IN (
  SELECT wikidata_qid FROM theories
  WHERE wikidata_qid IS NOT NULL
  GROUP BY wikidata_qid
  HAVING COUNT(*) > 1
);

CREATE UNIQUE INDEX idx_theories_wikidata_qid ON theories(wikidata_qid);
CREATE UNIQUE INDEX idx_submissions_wikidata_qid ON community_submissions(wikidata_qid);
