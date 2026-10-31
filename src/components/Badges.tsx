import type { EvidenceStatus, CategorySlug } from '../../shared/constants';
import { useT } from '../i18n';

export const STATUS_COLORS: Record<EvidenceStatus, string> = {
  historically_documented: '#4f7a45',
  supported_by_evidence: '#6b8a3a',
  partially_supported: '#9a7a14',
  disputed: '#a8581b',
  unverified: '#6f655b',
  debunked: '#9e2f25',
  under_investigation: '#3f6a94',
};

/** Ink colours of the categories (folder edges on the timeline, map threads, filter chips). */
export const CATEGORY_COLORS: Record<CategorySlug, string> = {
  'politics-power': '#b3261e',
  'secret-organizations': '#6b4c9a',
  'intelligence-agencies': '#2f5d8a',
  'space-ufos': '#23786a',
  'science-technology': '#4d7d32',
  history: '#8a5a2b',
  'economy-finance': '#a8800f',
  'media-society': '#c0581f',
  'internet-modern-myths': '#9a3a74',
  'secret-operations': '#3d4a52',
};

export function StatusBadge({ status, dark }: { status: EvidenceStatus | null | undefined; dark?: boolean }) {
  const t = useT();
  if (!status) return null;
  return (
    <span
      className="badge badge--status"
      style={{ color: dark ? `var(--status-${status})` : STATUS_COLORS[status] }}
      title={t(`statusHelp.${status}`)}
      data-status={status}
    >
      <span className="status-dot" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}

export function CategoryBadge({ category, dark }: { category: CategorySlug | null | undefined; dark?: boolean }) {
  const t = useT();
  if (!category) return null;
  return <span className={`badge ${dark ? 'badge--dark' : 'badge--category'}`}>{t(`categories.${category}`)}</span>;
}

/** Marks content written by the community (not editorially verified). */
export function CommunityBadge() {
  const t = useT();
  return (
    <span className="badge badge--community" title={t('community.badgeHelp')} data-testid="community-badge">
      {t('community.badge')}
    </span>
  );
}
