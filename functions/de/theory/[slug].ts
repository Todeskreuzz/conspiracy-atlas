// Pages Function for /de/theory/<slug>: the German case page with German link-preview tags.
import { serveCasePage, type PagesEnv } from '../../../server/casePage';

export const onRequestGet: PagesFunction<PagesEnv, 'slug'> = ({ request, env, params }) => serveCasePage(request, env, String(params.slug), 'de');
