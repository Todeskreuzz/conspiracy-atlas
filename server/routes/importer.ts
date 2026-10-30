import { Hono } from 'hono';
import type { AppEnv } from '../http';
import { Db } from '../db';
import { requireFeature } from '../features';
import { ApiError } from '../errors';
import { IMPORT_INTERVAL_MIN, claimRun, lastImportResult, runImport } from '../importer';

export const importRoutes = new Hono<AppEnv>();

/**
 * Trigger for the scheduled import (GitHub Actions calls it every few hours).
 * Needs no secret: it only pulls from a fixed public source and runs at most once per IMPORT_INTERVAL_MIN.
 */
importRoutes.post('/import/run', async (c) => {
  requireFeature(c.env, 'automatic_import');
  const db = Db.from(c.env);
  if (!(await claimRun(db))) {
    throw new ApiError(429, 'rate_limited', `The import runs at most every ${IMPORT_INTERVAL_MIN} minutes.`);
  }
  const result = await runImport(db);
  return c.json(result, result.error ? 502 : 200);
});

importRoutes.get('/import/status', async (c) => {
  requireFeature(c.env, 'automatic_import');
  return c.json({ last: await lastImportResult(Db.from(c.env)) });
});
