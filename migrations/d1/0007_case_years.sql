-- Year (or span of years) of a case file for the timeline.
-- Imported cases get it from the Wikidata statements of their item (point in time, start/end time, inception,
-- publication date); year_source records where it came from ('wikidata', or 'none' when the item has no date).
-- Cases without a stored year are placed by the years of the events the archive links them to.
ALTER TABLE theories ADD COLUMN year_start INTEGER;
ALTER TABLE theories ADD COLUMN year_end INTEGER;
ALTER TABLE theories ADD COLUMN year_source TEXT;
CREATE INDEX idx_theories_year ON theories(year_start);
