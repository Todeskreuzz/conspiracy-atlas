// Pages Function for /fr/theory/<slug>: the French case page with French link-preview tags.
import { serveCasePage, type PagesEnv } from '../../../server/casePage';

export const onRequestGet: PagesFunction<PagesEnv, 'slug'> = ({ request, env, params }) => serveCasePage(request, env, String(params.slug), 'fr');
