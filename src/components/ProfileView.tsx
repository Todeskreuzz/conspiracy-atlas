import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, useI18n } from '../i18n';
import { RichText } from './RichText';
import { TheoryCard } from './TheoryCard';
import type { ProfileSectionKey, PublicProfile } from '../../shared/profile';

/** Initials shown when no (approved) avatar exists. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ url, name, size = 'large' }: { url: string | null | undefined; name: string; size?: 'small' | 'large' }) {
  return (
    <span className={`avatar avatar--${size}`} aria-hidden={size === 'small' ? true : undefined}>
      {url ? <img src={url} alt="" /> : <span className="avatar__initials">{initials(name)}</span>}
    </span>
  );
}

interface Props {
  data: PublicProfile;
  /** In the editor preview, empty sections show a hint instead of disappearing. */
  preview?: boolean;
}

/**
 * A visitor's profile page. Every design choice is a fixed option (theme, font, layout, pattern) or a
 * validated colour, applied through data attributes and one CSS variable, so no user CSS or HTML is ever rendered.
 */
export function ProfileView({ data, preview }: Props) {
  const { t, locale } = useI18n();
  const p = data.profile;
  const showOwnerHints = preview || data.isOwner;
  const pending = (img: PublicProfile['avatar']) => img?.status === 'pending' && showOwnerHints;

  const sections: Record<ProfileSectionKey, () => ReactNode> = {
    about: () =>
      p.bio ? (
        <RichText doc={p.bio} />
      ) : showOwnerHints ? (
        <p className="profile__empty">{t('profile.empty.about')}</p>
      ) : null,
    favorites: () =>
      data.favorites.length ? (
        <div className="grid grid--cards profile__cards">
          {data.favorites.map((f) => (
            <TheoryCard key={f.id} theory={f} />
          ))}
        </div>
      ) : showOwnerHints ? (
        <p className="profile__empty">{t('profile.empty.favorites')}</p>
      ) : null,
    submissions: () =>
      data.submissions.length ? (
        <ul className="profile__list">
          {data.submissions.map((s) => (
            <li key={s.id}>
              {s.theorySlug ? <Link to={`/theory/${s.theorySlug}`}>{s.title}</Link> : s.title}
              <span className="muted small"> · {formatDate(s.createdAt, locale)}</span>
            </li>
          ))}
        </ul>
      ) : showOwnerHints ? (
        <p className="profile__empty">{t('profile.empty.submissions')}</p>
      ) : null,
    links: () =>
      p.links.length ? (
        <ul className="profile__links">
          {p.links.map((l, i) => (
            <li key={i}>
              <a href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc">
                {l.label} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : showOwnerHints ? (
        <p className="profile__empty">{t('profile.empty.links')}</p>
      ) : null,
    stats: () => (
      <dl className="profile__stats">
        <div>
          <dt>{t('profile.stats.since')}</dt>
          <dd>{formatDate(data.createdAt, locale)}</dd>
        </div>
        <div>
          <dt>{t('profile.stats.submissions')}</dt>
          <dd>{data.stats.publishedSubmissions}</dd>
        </div>
        <div>
          <dt>{t('profile.stats.favorites')}</dt>
          <dd>{data.stats.favorites}</dd>
        </div>
      </dl>
    ),
  };

  const rendered = p.sections
    .filter((s) => s.visible)
    .map((s) => ({ key: s.key, body: sections[s.key]() }))
    .filter((s) => s.body !== null);
  // In the sidebar layout, short sections (links, stats) go next to the main column.
  const side = p.layout === 'sidebar' ? rendered.filter((s) => s.key === 'links' || s.key === 'stats') : [];
  const main = rendered.filter((s) => !side.includes(s));
  const block = (s: (typeof rendered)[number]) => (
    <section key={s.key} className={`profile__section profile__section--${s.key}`} aria-labelledby={`pf-${s.key}`}>
      <h2 id={`pf-${s.key}`}>{t(`profile.sections.${s.key}`)}</h2>
      {s.body}
    </section>
  );

  return (
    <article
      className="profile"
      data-theme={p.theme}
      data-font={p.font}
      data-layout={p.layout}
      data-pattern={p.pattern}
      style={{ '--pf-accent': p.accent } as CSSProperties}
      data-testid="profile"
    >
      <div className="profile__banner">
        {data.banner && <img src={data.banner.url} alt="" />}
        {pending(data.banner) && <span className="profile__pending">{t('profile.pendingImage')}</span>}
      </div>
      <header className="profile__head">
        <div className="profile__avatar">
          <Avatar url={data.avatar?.url} name={data.displayName} />
          {pending(data.avatar) && <span className="profile__pending">{t('profile.pendingImage')}</span>}
        </div>
        <div className="profile__id">
          <h1 className="profile__name">{data.displayName}</h1>
          <div className="profile__handle mono">@{data.username}</div>
          {p.tagline && <p className="profile__tagline">{p.tagline}</p>}
          {p.location && <p className="profile__location small">⌖ {p.location}</p>}
        </div>
        {p.visibility === 'private' && showOwnerHints && <span className="profile__private stamp">{t('profile.privateStamp')}</span>}
      </header>
      <div className="profile__body">
        <div className="profile__main">{main.map(block)}</div>
        {side.length > 0 && <aside className="profile__side">{side.map(block)}</aside>}
      </div>
    </article>
  );
}
