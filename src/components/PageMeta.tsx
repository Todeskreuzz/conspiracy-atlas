import { useLocation } from 'react-router-dom';
import { useT } from '../i18n';
import { usePageMeta } from '../hooks/usePageMeta';
import { NAV_ITEMS } from './Layout';

/** Default title and description per overview page; detail pages override them once their data has loaded. */
export function PageMeta() {
  const t = useT();
  const { pathname } = useLocation();
  const item = NAV_ITEMS.find(([to]) => to === pathname);
  const page = item && item[0] !== '/' ? item[1].slice(4) : null;
  usePageMeta(page ? t(item![1]) : null, page ? t(`meta.${page}`) : t('meta.home'));
  return null;
}
