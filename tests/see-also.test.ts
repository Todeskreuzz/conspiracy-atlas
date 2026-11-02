import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { createDb } from './helpers/d1';

const SEE_ALSO = readFileSync(new URL('../migrations/d1/0017_see_also.sql', import.meta.url), 'utf8');
const SLUGS = [
  'stab-in-the-back-myth',
  'vietnam-stab-in-the-back-myth',
  'deep-state',
  'deep-state-in-turkey',
  'deep-state-conspiracy-theory-in-the-united-states',
];

function insertCases(db: ReturnType<typeof createDb>) {
  for (const slug of SLUGS) {
    db.raw
      .prepare("INSERT INTO theories (slug, title, summary, category_id, evidence_status) VALUES (?, ?, 'A distinct case.', 1, 'unverified')")
      .run(slug, slug);
  }
}

describe('see also links', () => {
  it('inserts the three pairs by slug, is idempotent, and shows them on both case pages', async () => {
    const db = createDb();
    insertCases(db);
    db.raw.exec(SEE_ALSO);
    db.raw.exec(SEE_ALSO);
    const n = db.raw.prepare("SELECT COUNT(*) AS n FROM relationships WHERE from_type = 'theory' AND to_type = 'theory' AND kind = 'thematic' AND verification = 'suggested'").get() as { n: number };
    expect(n.n).toBe(3);

    const env = await makeEnv({}, db);
    const visitor = client(env);
    const stab = await visitor.get('/api/theories/stab-in-the-back-myth');
    const vietnam = await visitor.get('/api/theories/vietnam-stab-in-the-back-myth');
    expect(stab.json.relationships.map((r: { other: { slug: string }; kind: string; verification: string }) => [r.other.slug, r.kind, r.verification])).toEqual([
      ['vietnam-stab-in-the-back-myth', 'thematic', 'suggested'],
    ]);
    expect(vietnam.json.relationships.map((r: { other: { slug: string } }) => r.other.slug)).toEqual(['stab-in-the-back-myth']);

    const deep = await visitor.get('/api/theories/deep-state');
    expect(deep.json.relationships.map((r: { other: { slug: string } }) => r.other.slug).sort()).toEqual([
      'deep-state-conspiracy-theory-in-the-united-states',
      'deep-state-in-turkey',
    ]);
  });

  it('skips a pair when one of the slugs is not in the archive', () => {
    const db = createDb();
    db.raw.prepare("INSERT INTO theories (slug, title, summary, category_id, evidence_status) VALUES ('deep-state', 'Deep state', 'A distinct case.', 1, 'unverified')").run();
    db.raw.exec(SEE_ALSO);
    expect((db.raw.prepare('SELECT COUNT(*) AS n FROM relationships').get() as { n: number }).n).toBeGreaterThan(0);
    const added = db.raw
      .prepare("SELECT COUNT(*) AS n FROM relationships r JOIN theories t ON t.id = r.from_id AND r.from_type = 'theory' WHERE r.to_type = 'theory' AND t.slug = 'deep-state'")
      .get() as { n: number };
    expect(added.n).toBe(0);
  });
});
