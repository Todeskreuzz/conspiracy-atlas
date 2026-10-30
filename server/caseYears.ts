// Years of imported case files for the timeline, read from the case's own Wikidata item.
// Only dates stated on the item are used (never guessed from the article text).
import type { Db } from './db';

/** Imported cases checked per import run; one SPARQL request covers all of them. */
export const YEAR_BATCH = 80;

/** point in time, start time, inception, publication date, earliest date — the earliest one is the start. */
export const caseYearQuery = (qids: string[]) => `SELECT ?item (MIN(YEAR(?s)) AS ?start) (MAX(YEAR(?e)) AS ?end) WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?item wdt:P585|wdt:P580|wdt:P571|wdt:P577|wdt:P1319 ?s }
  OPTIONAL { ?item wdt:P582 ?e }
} GROUP BY ?item`;

type Binding = Record<string, { value?: string } | undefined>;

/** Wikidata QID → [start, end]; implausible years are dropped. */
export function parseCaseYears(data: unknown, now = new Date()): Map<string, [number, number | null]> {
  const out = new Map<string, [number, number | null]>();
  const rows = ((data as { results?: { bindings?: Binding[] } })?.results?.bindings ?? []) as Binding[];
  const max = now.getUTCFullYear();
  const year = (v: string | undefined) => {
    const n = v === undefined ? NaN : Math.trunc(Number(v));
    return Number.isFinite(n) && n >= -3000 && n <= max ? n : null;
  };
  for (const r of rows) {
    const qid = r.item?.value?.match(/(Q\d+)$/)?.[1];
    const start = year(r.start?.value);
    if (!qid || start === null) continue;
    const end = year(r.end?.value);
    out.set(qid, [start, end !== null && end > start ? end : null]);
  }
  return out;
}

/**
 * Looks up the years of imported cases that were not checked yet. Cases whose item has no date are
 * marked 'none' so they are not asked again. Returns the number of cases that got a year.
 */
export async function addCaseYears(db: Db, sparql: (query: string) => Promise<unknown>, batch = YEAR_BATCH): Promise<number> {
  const rows = await db.all<{ id: number; notes: string }>(
    `SELECT t.id, MIN(s.notes) AS notes FROM theories t
     JOIN evidence e ON e.theory_id = t.id JOIN sources s ON s.id = e.source_id
     WHERE t.year_source IS NULL AND s.notes LIKE 'Imported automatically from Wikidata item %'
     GROUP BY t.id ORDER BY t.id LIMIT ?`,
    batch,
  );
  const qidOf = new Map<number, string>();
  for (const r of rows) {
    const qid = r.notes.match(/Wikidata item (Q\d+)/)?.[1];
    if (qid) qidOf.set(Number(r.id), qid);
  }
  if (!qidOf.size) return 0;
  const years = parseCaseYears(await sparql(caseYearQuery([...new Set(qidOf.values())])));
  let found = 0;
  await db.batch(
    [...qidOf].map(([id, qid]) => {
      const y = years.get(qid);
      if (y) found++;
      return y
        ? db.stmt("UPDATE theories SET year_start = ?, year_end = ?, year_source = 'wikidata', updated_at = updated_at WHERE id = ?", y[0], y[1], id)
        : db.stmt("UPDATE theories SET year_source = 'none', updated_at = updated_at WHERE id = ?", id);
    }),
  );
  return found;
}
