// Read-only report of cases that look like duplicates. It never updates or deletes anything.
//
//   npm run import:duplicates:local
//   npm run import:duplicates:remote
//
// On Windows PowerShell, `npm run import:duplicates -- --remote` is eaten by npm
// ("Unknown cli config --remote"). Use the :local and :remote scripts.
//
// --remote reads the live D1 database (needs `npx wrangler login`). Apply migration
// 0016_import_identity.sql first if the QID column is still missing; the report still runs without it.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { findDuplicateGroups, qidFromNote, type DuplicateEntry } from '../shared/import-match.ts';
import { DB_NAME, ROOT } from './lib.mjs';

const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local');
if (remote === local) {
  console.error('Bitte --local oder --remote angeben. Es wird nichts gelöscht.');
  process.exit(2);
}

const WRANGLER_BIN = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function query(sql: string): { ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string } {
  const res = spawnSync(process.execPath, [WRANGLER_BIN, 'd1', 'execute', DB_NAME, remote ? '--remote' : '--local', '--json', '--command', sql], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${res.stdout ?? ''}`;
  const start = out.indexOf('[');
  if (res.status !== 0 || start < 0) {
    const err = `${res.stderr ?? ''}\n${out}`.trim();
    return { ok: false, error: err.slice(0, 500) };
  }
  try {
    const parsed = JSON.parse(out.slice(start)) as { results?: Record<string, unknown>[] }[];
    return { ok: true, rows: parsed[0]?.results ?? [] };
  } catch (err) {
    return { ok: false, error: String((err as Error).message ?? err) };
  }
}

function must(sql: string): Record<string, unknown>[] {
  const result = query(sql);
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  return result.rows;
}

const theories = query('SELECT id, slug, title, wikidata_qid AS qid FROM theories ORDER BY id');
const qidColumn = theories.ok;
const theoryRows = qidColumn ? theories.rows : must('SELECT id, slug, title FROM theories ORDER BY id');
if (!qidColumn) {
  console.log('Hinweis: Spalte theories.wikidata_qid fehlt noch. Migration ausführen: npm run db:migrate:remote');
}

const translations = must("SELECT entity_id, value FROM translations WHERE entity_type = 'theory' AND field = 'title'");
const aliasResult = query('SELECT theory_id, label FROM theory_aliases');
const aliases = aliasResult.ok ? aliasResult.rows : [];
const sources = must(
  "SELECT e.theory_id AS id, s.url, s.notes FROM evidence e JOIN sources s ON s.id = e.source_id WHERE e.claim_id IS NULL AND (s.url LIKE '%wikipedia.org/wiki/%' OR s.notes LIKE 'Imported automatically from Wikidata item Q%')",
);

const byId = new Map<number, DuplicateEntry>();
for (const row of theoryRows) {
  const id = Number(row.id);
  byId.set(id, { id, slug: String(row.slug), title: String(row.title), qid: typeof row.qid === 'string' ? row.qid : null, titles: [String(row.title)], urls: [] });
}
for (const row of translations) {
  byId.get(Number(row.entity_id))?.titles.push(String(row.value));
}
for (const row of aliases) {
  byId.get(Number(row.theory_id))?.titles.push(String(row.label));
}
for (const row of sources) {
  const entry = byId.get(Number(row.id));
  if (!entry) continue;
  if (typeof row.url === 'string') entry.urls.push(row.url);
  if (!entry.qid) entry.qid = qidFromNote(typeof row.notes === 'string' ? row.notes : null);
}

const links = must("SELECT from_id, to_id FROM relationships WHERE from_type = 'theory' AND to_type = 'theory'");
const linkedIds = links.map((row) => [Number(row.from_id), Number(row.to_id)] as [number, number]);
const groups = findDuplicateGroups([...byId.values()], linkedIds);
console.log(`Geprüfte Fälle: ${byId.size}. Es wurde nichts gelöscht.`);
if (!groups.length) {
  console.log('Keine Duplikate und keine knappen Titel-Ähnlichkeiten.');
  process.exit(0);
}

const label = { qid: 'Gleicher Wikidata-Eintrag', title: 'Gleicher normalisierter Titel', url: 'Gleicher Wikipedia-Artikel', fuzzy: 'Ähnlicher Titel (bitte prüfen, nicht automatisch gleich)' } as const;
for (const group of groups) {
  console.log(`\n${label[group.kind]}${group.score ? ` (${group.score.toFixed(2)})` : ''}:`);
  for (const item of group.items) console.log(`  #${item.id} ${item.slug} — ${item.title} [${item.detail}]`);
}
console.log(`\n${groups.length} Gruppe(n). Bitte von Hand prüfen. Das Skript löscht nichts.`);
