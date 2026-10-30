import { describe, it, expect } from 'vitest';
import cytoscape from 'cytoscape';
import { DEFAULT_FILTERS, groupPositions, nodeVisible, syntheticBoard, toElements } from '../../src/wall/model';
import { client, makeEnv } from '../helpers/app';
import { createDb } from '../helpers/d1';

const kindLabel = (k: string) => k;

describe.each([100, 500, 1000])('investigation wall with %i cards', (count) => {
  it('builds, filters, groups and lays out within budget', () => {
    const board = syntheticBoard(count);
    expect(board.nodes).toHaveLength(count);

    const t0 = performance.now();
    const elements = toElements(board, kindLabel as never);
    const cy = cytoscape({ headless: true, elements: elements as never, layout: { name: 'preset' } });
    const tBuild = performance.now() - t0;
    expect(cy.nodes()).toHaveLength(count);
    expect(cy.edges().length).toBe(board.edges.length);

    const t1 = performance.now();
    const filters = { ...DEFAULT_FILTERS, kinds: ['theory', 'event'] as typeof DEFAULT_FILTERS.kinds };
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const node = board.nodes.find((x) => x.id === Number(n.data('nodeId')))!;
        n.toggleClass('hidden', !nodeVisible(node, filters));
      });
    });
    const grouped = groupPositions(board.nodes, 'category');
    cy.batch(() => cy.nodes().forEach((n) => { const p = grouped.get(Number(n.data('nodeId'))); if (p) n.position(p); }));
    const tOps = performance.now() - t1;

    // Generous budgets so the test is stable on CI; real numbers are printed for the record.
    console.log(`[wall perf] ${count} cards / ${board.edges.length} threads: build ${tBuild.toFixed(1)} ms, filter+group ${tOps.toFixed(1)} ms`);
    expect(tBuild).toBeLessThan(count * 5);
    expect(tOps).toBeLessThan(count * 5);
    cy.destroy();
  });
});

describe('board API with 1000 cards (D1 parameter limits)', () => {
  it('saves and loads 1000 positions in chunks', async () => {
    const db = createDb();
    const env = await makeEnv({}, db);
    const admin = client(env);
    await admin.login();
    const raw = db.raw;
    const board = raw.prepare("SELECT id FROM boards WHERE slug = 'main'").get() as { id: number };
    const insert = raw.prepare("INSERT INTO board_nodes (board_id, kind, title) VALUES (?, 'claim', ?)");
    for (let i = 0; i < 1000; i++) insert.run(board.id, `Stress card ${i}`);
    const nodes = raw.prepare('SELECT id FROM board_nodes WHERE board_id = ?').all(board.id) as Array<{ id: number }>;
    const positions = nodes.map((n, i) => ({ id: n.id, x: (i % 40) * 220, y: Math.floor(i / 40) * 160 }));
    const t0 = performance.now();
    const saved = await admin.put('/api/admin/boards/main/positions', { positions });
    expect(saved.json.saved).toBe(nodes.length);
    const loaded = await admin.get('/api/boards/main');
    console.log(`[wall perf] save+load ${nodes.length} positions: ${(performance.now() - t0).toFixed(1)} ms`);
    expect(loaded.json.nodes.length).toBe(nodes.length);
    const last = loaded.json.nodes.find((n: any) => n.id === positions.at(-1)!.id);
    expect([last.x, last.y]).toEqual([positions.at(-1)!.x, positions.at(-1)!.y]);
    // No statement may exceed D1's 100 bound-parameter limit.
    expect(db.maxParams).toBeLessThanOrEqual(100);
  }, 30000);
});
