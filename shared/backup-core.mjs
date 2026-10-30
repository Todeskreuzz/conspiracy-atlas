// Backup helpers shared by the API (export) and the local Node scripts (backup / restore).
// Plain JavaScript so it runs in Node without a build step.

/** Tables in foreign-key dependency order (parents first). Sessions and rate limits are not backed up. */
export const BACKUP_TABLES = [
  'categories',
  'authors',
  'tags',
  'sources',
  'locations',
  'theories',
  'theory_tags',
  'claims',
  'counter_arguments',
  'evidence',
  'organizations',
  'people',
  'events',
  'documents',
  'relationships',
  'investigations',
  'investigation_notes',
  'boards',
  'board_nodes',
  'board_positions',
  'board_edges',
  'community_submissions',
  'reports',
  'case_notes',
  'moderation_actions',
  'translations',
  'settings',
];

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

/** Validates the structure of a JSON backup produced by GET /api/admin/export. */
export function validateBackup(data) {
  if (!data || data.format !== 'conspiracy-atlas-backup' || data.version !== 1 || typeof data.tables !== 'object') {
    throw new Error('Not a Conspiracy Atlas backup file (format/version mismatch)');
  }
  for (const [table, rows] of Object.entries(data.tables)) {
    if (!BACKUP_TABLES.includes(table)) throw new Error(`Unknown table in backup: ${table}`);
    if (!Array.isArray(rows)) throw new Error(`Table ${table} must be an array`);
    for (const row of rows) {
      for (const col of Object.keys(row)) if (!IDENT.test(col)) throw new Error(`Invalid column name: ${col}`);
    }
  }
  return data;
}

/**
 * Converts a JSON backup into SQL that replaces the current content.
 * Children are deleted first, parents inserted first.
 */
export function backupToSql(data) {
  validateBackup(data);
  const lines = ['PRAGMA defer_foreign_keys = true;'];
  for (const table of [...BACKUP_TABLES].reverse()) {
    if (data.tables[table]) lines.push(`DELETE FROM ${table};`);
  }
  for (const table of BACKUP_TABLES) {
    const rows = data.tables[table];
    if (!rows) continue;
    for (const row of rows) {
      const cols = Object.keys(row);
      if (!cols.length) continue;
      lines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => sqlLiteral(row[c])).join(', ')});`);
    }
  }
  return lines.join('\n') + '\n';
}
