import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { usePageMeta } from '../hooks/usePageMeta';
import { api, ApiFailure } from '../api/client';
import { useFeature } from '../api/status';
import { LoadState, Unavailable } from '../components/Unavailable';
import { ProfileView } from '../components/ProfileView';
import type { PublicProfile } from '../../shared/profile';

export default function ProfilePage() {
  const { t } = useI18n();
  const { username = '' } = useParams();
  const feature = useFeature('accounts');
  const profile = useAsync((signal) => api<PublicProfile>(`/users/${encodeURIComponent(username)}`, { signal }), [username]);
  const data = profile.data;
  usePageMeta(data ? data.displayName : undefined, data ? (data.profile.tagline ?? t('profile.metaDescription', { name: data.displayName })) : undefined);

  if (feature.loaded && !feature.available) {
    return (
      <div className="container page">
        <Unavailable feature="accounts" state={feature.state} />
      </div>
    );
  }
  if (profile.error instanceof ApiFailure && profile.error.status === 404) {
    return (
      <div className="container page">
        <header className="page-header">
          <h1>{t('profile.notFound')}</h1>
          <p>{t('profile.notFoundText')}</p>
        </header>
      </div>
    );
  }
  return (
    <div className="container page profile-page">
      {!data ? (
        <LoadState loading={profile.loading} error={profile.error} onRetry={profile.reload} />
      ) : (
        <>
          {data.isOwner && (
            <div className="profile-owner-bar">
              <span className="small">{t('profile.ownerHint')}</span>
              <Link to="/account" className="btn btn--small btn--primary">
                {t('profile.edit')}
              </Link>
            </div>
          )}
          <ProfileView data={data} />
        </>
      )}
    </div>
  );
}
