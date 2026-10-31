// User accounts and customisable profile pages (shared by the editor and the API).
import { sanitizeRichDoc, plainText, type RichNode } from './richtext';
import { ValidationError, arr, oneOf, optStr, reqStr, url } from './validation';

export const PROFILE_THEMES = ['dossier', 'noir', 'cork', 'blueprint', 'redacted', 'newsprint'] as const;
export type ProfileTheme = (typeof PROFILE_THEMES)[number];

export const PROFILE_FONTS = ['typewriter', 'serif', 'sans', 'mono', 'marker', 'hand'] as const;
export type ProfileFont = (typeof PROFILE_FONTS)[number];

export const PROFILE_LAYOUTS = ['classic', 'sidebar', 'centered'] as const;
export type ProfileLayout = (typeof PROFILE_LAYOUTS)[number];

/** Banner backgrounds drawn with CSS when no banner image is set (or behind it while it waits for review). */
export const PROFILE_PATTERNS = ['plain', 'grid', 'stripes', 'dots', 'strings', 'topo'] as const;
export type ProfilePattern = (typeof PROFILE_PATTERNS)[number];

export const PROFILE_SECTIONS = ['about', 'favorites', 'submissions', 'links', 'stats'] as const;
export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number];

export const PROFILE_VISIBILITIES = ['public', 'private'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export const PROFILE_IMAGE_SLOTS = ['avatar', 'banner'] as const;
export type ProfileImageSlot = (typeof PROFILE_IMAGE_SLOTS)[number];

export const PROFILE_LIMITS = {
  displayName: 60,
  tagline: 120,
  location: 60,
  bioChars: 4000,
  links: 6,
  linkLabel: 40,
  favorites: 12,
  /** Longest edge of profile images after compression in the browser. */
  avatarEdge: 400,
  bannerEdge: 1600,
} as const;

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,22})[a-z0-9]$/;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

/** Names that could be mistaken for staff or system accounts. */
export const RESERVED_USERNAMES = [
  'admin', 'administrator', 'root', 'system', 'editor', 'moderator', 'mod', 'staff', 'support', 'help', 'team',
  'anonymous', 'atlas', 'conspiracy-atlas', 'official', 'api', 'me', 'settings', 'account', 'login', 'register', 'null', 'undefined',
];

export interface ProfileSection {
  key: ProfileSectionKey;
  visible: boolean;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface ProfileSettings {
  tagline: string | null;
  location: string | null;
  bio: RichNode | null;
  links: ProfileLink[];
  theme: ProfileTheme;
  accent: string;
  font: ProfileFont;
  layout: ProfileLayout;
  pattern: ProfilePattern;
  sections: ProfileSection[];
  /** Slugs of favourite case files, in the order chosen by the user. */
  favorites: string[];
  visibility: ProfileVisibility;
}

export const DEFAULT_ACCENT = '#c9372c';

export function defaultProfile(): ProfileSettings {
  return {
    tagline: null,
    location: null,
    bio: null,
    links: [],
    theme: 'dossier',
    accent: DEFAULT_ACCENT,
    font: 'typewriter',
    layout: 'classic',
    pattern: 'strings',
    sections: PROFILE_SECTIONS.map((key) => ({ key, visible: true })),
    favorites: [],
    visibility: 'public',
  };
}

export function normalizeUsername(value: unknown): string {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!USERNAME_RE.test(v)) throw new ValidationError('username', 'must be 3–24 characters: a–z, 0–9, "-" or "_"');
  if (RESERVED_USERNAMES.includes(v)) throw new ValidationError('username', 'is reserved');
  return v;
}

export function validatePassword(value: unknown, field = 'password'): string {
  if (typeof value !== 'string') throw new ValidationError(field, 'is required');
  if (value.length < PASSWORD_MIN) throw new ValidationError(field, `must have at least ${PASSWORD_MIN} characters`);
  if (value.length > PASSWORD_MAX) throw new ValidationError(field, `must have at most ${PASSWORD_MAX} characters`);
  return value;
}

export function validateDisplayName(value: unknown): string {
  const v = reqStr(value, 'displayName', PROFILE_LIMITS.displayName, 2);
  if (/[\u0000-\u001f\u007f‪-‮⁦-⁩]/.test(v)) throw new ValidationError('displayName', 'contains invalid characters');
  return v;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/;

function validateSections(value: unknown): ProfileSection[] {
  if (value === undefined || value === null) return defaultProfile().sections;
  const list = arr(value, 'sections', PROFILE_SECTIONS.length, (v, i) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return { key: oneOf(o.key, `sections[${i}].key`, PROFILE_SECTIONS), visible: o.visible !== false };
  });
  const seen = new Set<string>();
  const out: ProfileSection[] = [];
  for (const s of list) {
    if (seen.has(s.key)) throw new ValidationError('sections', 'each section may appear only once');
    seen.add(s.key);
    out.push(s);
  }
  // Sections missing from the list are appended (visible), so new sections show up for existing profiles.
  for (const key of PROFILE_SECTIONS) if (!seen.has(key)) out.push({ key, visible: true });
  return out;
}

/**
 * Validates a profile coming from the editor. Unknown fields are dropped; the bio is TipTap JSON
 * checked by the shared rich text sanitiser (never HTML).
 */
export function validateProfile(raw: unknown): ProfileSettings {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const def = defaultProfile();
  let bio: RichNode | null = null;
  if (o.bio !== undefined && o.bio !== null) {
    bio = sanitizeRichDoc(o.bio);
    const text = plainText(bio).trim();
    if (text.length > PROFILE_LIMITS.bioChars) throw new ValidationError('bio', `must have at most ${PROFILE_LIMITS.bioChars} characters`);
    if (!text) bio = null;
  }
  const accent = typeof o.accent === 'string' ? o.accent.trim().toLowerCase() : def.accent;
  if (!HEX_COLOR.test(accent)) throw new ValidationError('accent', 'must be a colour like #c9372c');
  const favorites = arr(o.favorites, 'favorites', PROFILE_LIMITS.favorites, (v, i) => {
    if (typeof v !== 'string' || !/^[a-z0-9-]{1,100}$/.test(v)) throw new ValidationError(`favorites[${i}]`, 'invalid case');
    return v;
  });
  return {
    tagline: optStr(o.tagline, 'tagline', PROFILE_LIMITS.tagline),
    location: optStr(o.location, 'location', PROFILE_LIMITS.location),
    bio,
    links: arr(o.links, 'links', PROFILE_LIMITS.links, (v, i) => {
      const l = (v ?? {}) as Record<string, unknown>;
      return { label: reqStr(l.label, `links[${i}].label`, PROFILE_LIMITS.linkLabel), url: url(l.url, `links[${i}].url`, false) as string };
    }),
    theme: o.theme === undefined ? def.theme : oneOf(o.theme, 'theme', PROFILE_THEMES),
    accent,
    font: o.font === undefined ? def.font : oneOf(o.font, 'font', PROFILE_FONTS),
    layout: o.layout === undefined ? def.layout : oneOf(o.layout, 'layout', PROFILE_LAYOUTS),
    pattern: o.pattern === undefined ? def.pattern : oneOf(o.pattern, 'pattern', PROFILE_PATTERNS),
    sections: validateSections(o.sections),
    favorites: [...new Set(favorites)],
    visibility: o.visibility === undefined ? def.visibility : oneOf(o.visibility, 'visibility', PROFILE_VISIBILITIES),
  };
}

/** Reads a stored profile; anything broken falls back to the defaults instead of breaking the page. */
export function parseStoredProfile(json: unknown): ProfileSettings {
  try {
    return validateProfile(typeof json === 'string' ? JSON.parse(json) : {});
  } catch {
    return defaultProfile();
  }
}

/** The signed-in user as the API returns it to its owner. */
export interface AccountUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ProfileImageInfo {
  url: string;
  /** Pending images are visible only to their owner until an editor approves them. */
  status: 'pending' | 'approved';
}

export interface ProfileSubmission {
  id: number;
  title: string;
  status: string;
  theorySlug: string | null;
  createdAt: string;
}

export interface PublicProfile {
  username: string;
  displayName: string;
  createdAt: string;
  isOwner: boolean;
  avatar: ProfileImageInfo | null;
  banner: ProfileImageInfo | null;
  profile: ProfileSettings;
  favorites: import('./types').TheorySummary[];
  submissions: ProfileSubmission[];
  stats: { publishedSubmissions: number; favorites: number };
}
