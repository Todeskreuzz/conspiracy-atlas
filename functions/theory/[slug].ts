// Pages Function for /theory/<slug>: serves the normal app page with link-preview tags for that case.
// Only case pages invoke a Function (public/_routes.json); every other page stays a plain static asset.
import { serveCasePage, type PagesEnv } from '../../server/casePage';

export const onRequestGet: PagesFunction<PagesEnv, 'slug'> = ({ request, env, params }) => serveCasePage(request, env, String(params.slug), 'en');
