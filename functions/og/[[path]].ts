// Preview cards for shared links: /og/home.png, /og/theory/<slug>.png and the /og/de/… versions.
import { serveOg } from '../../server/preview/serve';
import type { PagesEnv } from '../../server/casePage';

export const onRequestGet: PagesFunction<PagesEnv> = (ctx) => serveOg(ctx);
