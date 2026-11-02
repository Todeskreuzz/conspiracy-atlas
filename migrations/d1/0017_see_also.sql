-- "See also" between distinct cases that share a similar title.
-- Insert only. Ids are looked up by slug, so a missing case skips that pair.
-- INSERT OR IGNORE matches the unique key on relationships, so a second apply adds nothing.
-- Nothing is updated or deleted. One direction is enough: the case page reads both directions.

INSERT OR IGNORE INTO relationships (from_type, from_id, to_type, to_id, kind, verification, label)
SELECT 'theory', a.id, 'theory', b.id, 'thematic', 'suggested', NULL
FROM theories a
JOIN theories b ON b.slug = 'vietnam-stab-in-the-back-myth'
WHERE a.slug = 'stab-in-the-back-myth';

INSERT OR IGNORE INTO relationships (from_type, from_id, to_type, to_id, kind, verification, label)
SELECT 'theory', a.id, 'theory', b.id, 'thematic', 'suggested', NULL
FROM theories a
JOIN theories b ON b.slug = 'deep-state-in-turkey'
WHERE a.slug = 'deep-state';

INSERT OR IGNORE INTO relationships (from_type, from_id, to_type, to_id, kind, verification, label)
SELECT 'theory', a.id, 'theory', b.id, 'thematic', 'suggested', NULL
FROM theories a
JOIN theories b ON b.slug = 'deep-state-conspiracy-theory-in-the-united-states'
WHERE a.slug = 'deep-state';
