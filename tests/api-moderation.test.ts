import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { createDb } from './helpers/d1';
import { REPORT_AUTO_HIDE_THRESHOLD } from '../shared/constants';

const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }))) as unknown as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

async function setup() {
  const env = await makeEnv();
  const raw = (env.DB as any).raw;
  const visitor = client(env);
  const admin = client(env);
  await admin.login();
  // A community case written by an account, and an approved community note on case 1.
  raw.exec(`INSERT INTO users (id, username, password_hash, recovery_hash, display_name) VALUES (500, 'troll_account', 'x', 'x', 'Troll')`);
  raw.exec(`INSERT INTO theories (id, slug, title, summary, category_id, evidence_status, origin, is_published)
            VALUES (900, 'community-case', 'Community case', 'A community case.', 1, 'unverified', 'community', 1)`);
  raw.exec(`INSERT INTO community_submissions (title, summary, body_json, category_id, display_mode, status, published_theory_id, user_id)
            VALUES ('Community case', 'A community case.', '{}', 1, 'named', 'published', 900, 500)`);
  raw.exec(`INSERT INTO case_notes (id, theory_id, kind, body, status) VALUES (70, 1, 'comment', 'Buy cheap pills here!', 'approved')`);
  return { env, visitor, admin, raw };
}

const report = (c: ReturnType<typeof client>, targetType: string, targetId: number, ip: string, reason = 'spam') =>
  c.post('/api/reports', { targetType, targetId, reason, turnstileToken: 't' }, { 'CF-Connecting-IP': ip });

describe('reporting', () => {
  it('accepts reports of notes and profiles, rejects unknown items', async () => {
    const { visitor, raw } = await setup();
    expect((await report(visitor, 'case_note', 70, '198.51.100.1')).status).toBe(201);
    expect((await report(visitor, 'profile', 500, '198.51.100.1', 'harassment')).status).toBe(201);
    expect((await report(visitor, 'case_note', 9999, '198.51.100.1')).status).toBe(404);
    expect((await report(visitor, 'comment', 1, '198.51.100.1')).status).toBe(404);
    expect((await report(visitor, 'nonsense', 1, '198.51.100.1')).status).toBe(400);
    const rows = raw.prepare('SELECT target_type, reporter_hash FROM reports ORDER BY id').all();
    expect(rows.map((r: any) => r.target_type)).toEqual(['case_note', 'profile']);
    // Only a salted hash is stored, never the address.
    for (const r of rows) {
      expect(r.reporter_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.reporter_hash).not.toContain('198.51.100.1');
    }
  });

  it('counts one visitor once per item', async () => {
    const { visitor, raw } = await setup();
    for (let i = 0; i < 3; i++) expect((await report(visitor, 'theory', 900, '198.51.100.7')).status).toBe(201);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM reports WHERE target_type = 'theory'").get().n).toBe(1);
    expect(raw.prepare('SELECT is_published FROM theories WHERE id = 900').get().is_published).toBe(1);
  });

  it(`hides community content after ${REPORT_AUTO_HIDE_THRESHOLD} different visitors, but never editorial cases or profiles`, async () => {
    const { visitor, raw } = await setup();
    for (let i = 1; i <= REPORT_AUTO_HIDE_THRESHOLD; i++) {
      await report(visitor, 'theory', 900, `198.51.100.${i}`);
      await report(visitor, 'case_note', 70, `198.51.100.${i}`);
      await report(visitor, 'theory', 1, `198.51.100.${i}`);
      await report(visitor, 'profile', 500, `198.51.100.${i}`);
    }
    expect(raw.prepare('SELECT is_published FROM theories WHERE id = 900').get().is_published).toBe(0);
    expect(raw.prepare('SELECT status FROM case_notes WHERE id = 70').get().status).toBe('pending');
    expect(raw.prepare('SELECT is_published FROM theories WHERE id = 1').get().is_published).toBe(1);
    expect(raw.prepare('SELECT status FROM users WHERE id = 500').get().status).toBe('active');
    expect((await visitor.get('/api/theories/community-case')).status).toBe(404);
    const log = raw.prepare("SELECT action, actor FROM moderation_actions WHERE action LIKE 'auto_hide:%' ORDER BY id").all();
    expect(log).toEqual([
      { action: 'auto_hide:theory:900', actor: 'system' },
      { action: 'auto_hide:case_note:70', actor: 'system' },
    ]);
  });
});

describe('moderation view', () => {
  it('groups reports per item with what the item is', async () => {
    const { visitor, admin } = await setup();
    await report(visitor, 'theory', 900, '198.51.100.1', 'misinformation');
    await report(visitor, 'theory', 900, '198.51.100.2', 'spam');
    await report(visitor, 'case_note', 70, '198.51.100.1');
    const list = await admin.get('/api/admin/reports');
    expect(list.status).toBe(200);
    expect(list.json.items).toHaveLength(2);
    const [first, second] = list.json.items;
    expect(first).toMatchObject({ targetType: 'theory', targetId: 900, count: 2, reasons: { misinformation: 1, spam: 1 } });
    expect(first.target).toMatchObject({ exists: true, title: 'Community case', url: '/theory/community-case', community: true, hideable: true, hidden: false });
    expect(first.target.user).toEqual({ id: 500, username: 'troll_account', locked: false });
    expect(second.target).toMatchObject({ exists: true, excerpt: 'Buy cheap pills here!', hideable: true });
    expect((await admin.get('/api/admin/overview')).json.openReports).toBe(2);
    expect((await visitor.get('/api/admin/reports')).status).toBe(401);
  });

  it('hides, restores, locks the author and closes all reports of an item', async () => {
    const { visitor, admin, raw } = await setup();
    await report(visitor, 'theory', 900, '198.51.100.1');
    await report(visitor, 'theory', 900, '198.51.100.2');

    let r = await admin.post('/api/admin/reports/target', { targetType: 'theory', targetId: 900, action: 'hide' });
    expect(r.json).toMatchObject({ ok: true, changed: true, closedReports: 2 });
    expect(raw.prepare('SELECT is_published FROM theories WHERE id = 900').get().is_published).toBe(0);
    expect((await admin.get('/api/admin/reports')).json.items).toHaveLength(0);

    const resolved = await admin.get('/api/admin/reports?status=resolved');
    expect(resolved.json.items[0].target.hidden).toBe(true);
    r = await admin.post('/api/admin/reports/target', { targetType: 'theory', targetId: 900, action: 'restore' });
    expect(r.json.changed).toBe(true);
    expect((await visitor.get('/api/theories/community-case')).status).toBe(200);

    await report(visitor, 'theory', 900, '198.51.100.3');
    r = await admin.post('/api/admin/reports/target', { targetType: 'theory', targetId: 900, action: 'lock_user' });
    expect(r.json).toMatchObject({ changed: true, closedReports: 1 });
    expect(raw.prepare('SELECT status FROM users WHERE id = 500').get().status).toBe('locked');

    // Editorial cases cannot be hidden from the report view.
    await report(visitor, 'theory', 1, '198.51.100.1');
    expect((await admin.post('/api/admin/reports/target', { targetType: 'theory', targetId: 1, action: 'hide' })).status).toBe(400);
    r = await admin.post('/api/admin/reports/target', { targetType: 'theory', targetId: 1, action: 'dismiss' });
    expect(r.json.closedReports).toBe(1);
    expect(raw.prepare("SELECT status FROM reports WHERE target_id = 1 AND target_type = 'theory'").get().status).toBe('dismissed');

    const log = await admin.get('/api/admin/moderation-log');
    expect(log.json.items.map((e: any) => e.action)).toEqual(
      expect.arrayContaining(['report_hide:theory:900', 'report_restore:theory:900', 'report_lock_user:theory:900', 'report_dismiss:theory:1']),
    );
  });

  it('a hidden note goes back to approved, a reported profile is locked and unlocked', async () => {
    const { visitor, admin, raw } = await setup();
    await report(visitor, 'case_note', 70, '198.51.100.1');
    await admin.post('/api/admin/reports/target', { targetType: 'case_note', targetId: 70, action: 'hide' });
    expect(raw.prepare('SELECT status FROM case_notes WHERE id = 70').get().status).toBe('rejected');
    await admin.post('/api/admin/reports/target', { targetType: 'case_note', targetId: 70, action: 'restore' });
    expect(raw.prepare('SELECT status FROM case_notes WHERE id = 70').get().status).toBe('approved');

    await report(visitor, 'profile', 500, '198.51.100.1');
    await admin.post('/api/admin/reports/target', { targetType: 'profile', targetId: 500, action: 'hide' });
    expect(raw.prepare('SELECT status FROM users WHERE id = 500').get().status).toBe('locked');
    await admin.post('/api/admin/reports/target', { targetType: 'profile', targetId: 500, action: 'restore' });
    expect(raw.prepare('SELECT status FROM users WHERE id = 500').get().status).toBe('active');
  });
});

describe('before migration 0010', () => {
  it('keeps the old report types working and shows "Currently unavailable!" for the new ones', async () => {
    const db = createDb();
    // Recreate the pre-0010 reports table.
    db.raw.exec(`CREATE TABLE moderation_actions_tmp AS SELECT * FROM moderation_actions;
      DROP TABLE reports;
      CREATE TABLE reports (id INTEGER PRIMARY KEY, target_type TEXT NOT NULL CHECK (target_type IN ('theory','submission','event','organization','source')),
        target_id INTEGER NOT NULL, reason TEXT NOT NULL, details TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT (datetime('now')), resolved_at TEXT);`);
    const env = await makeEnv({}, db);
    const visitor = client(env);
    db.raw.exec(`INSERT INTO case_notes (id, theory_id, kind, body, status) VALUES (70, 1, 'comment', 'Some note text', 'approved')`);
    expect((await report(visitor, 'theory', 1, '198.51.100.1')).status).toBe(201);
    const r = await report(visitor, 'case_note', 70, '198.51.100.1');
    expect(r.status).toBe(503);
    expect(r.json.error.message).toMatch(/^Currently unavailable!/);
  });
});
