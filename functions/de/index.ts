// /de for crawlers: the German homepage with German preview tags. The app itself is unchanged.
import { serveHome } from '../../server/homePage';
import type { PagesEnv } from '../../server/casePage';

export const onRequestGet: PagesFunction<PagesEnv> = ({ request, env }) => serveHome(request, env, 'de');
