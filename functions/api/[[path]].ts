// Cloudflare Pages Functions entry: every request under /api/* is handled by the Hono app.
// Static assets are served by Pages directly and never invoke a Function (see public/_routes.json).
import { handle } from 'hono/cloudflare-pages';
import { app } from '../../server/app';

export const onRequest = handle(app);
