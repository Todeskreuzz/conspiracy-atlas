// Pages Function for /es/theory/<slug>: the Spanish case page with Spanish link-preview tags.
import { serveCasePage, type PagesEnv } from '../../../server/casePage';

export const onRequestGet: PagesFunction<PagesEnv, 'slug'> = ({ request, env, params }) => serveCasePage(request, env, String(params.slug), 'es');
