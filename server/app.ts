import { Hono } from 'hono';
import type { AppEnv } from './http';
import { ApiError } from './errors';
import { ValidationError } from '../shared/validation';
import { RichTextError } from '../shared/richtext';
import { LOCALES, type Locale } from '../shared/constants';
import { publicRoutes } from './routes/public';
import { communityRoutes } from './routes/community';
import { investigationRoutes } from './routes/investigations';
import { adminRoutes } from './routes/admin';
import { importRoutes } from './routes/importer';
import { accountRoutes } from './routes/account';

export type { AppEnv, Ctx } from './http';

export function createApp() {
  const app = new Hono<AppEnv>().basePath('/api');

  app.use('*', async (c, next) => {
    const lang = c.req.query('lang');
    c.set('locale', (LOCALES as readonly string[]).includes(lang ?? '') ? (lang as Locale) : 'en');
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!c.res.headers.get('Cache-Control')) c.header('Cache-Control', 'no-store');
  });

  app.route('/', publicRoutes);
  app.route('/', communityRoutes);
  app.route('/', investigationRoutes);
  app.route('/', importRoutes);
  app.route('/', accountRoutes);
  app.route('/admin', adminRoutes);

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Endpoint not found' } }, 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { error: { code: err.code, message: err.message, state: err.state, field: err.field } },
        err.status as 400,
      );
    }
    if (err instanceof ValidationError) {
      return c.json({ error: { code: 'invalid', message: err.message, field: err.field } }, 400);
    }
    if (err instanceof RichTextError) {
      return c.json({ error: { code: 'invalid', message: err.message, field: 'body' } }, 400);
    }
    if (err instanceof SyntaxError) {
      return c.json({ error: { code: 'invalid_json', message: 'Malformed JSON body' } }, 400);
    }
    console.error('Unhandled error:', String((err as Error)?.message ?? err).slice(0, 200));
    return c.json(
      { error: { code: 'unavailable', state: 'temporary_error', message: 'Currently unavailable! A temporary service error occurred.' } },
      503,
    );
  });

  return app;
}

export const app = createApp();
