// Central availability system. The public status text is fixed and is never translated.

export const UNAVAILABLE_MESSAGE = 'Currently unavailable!' as const;

export const FEATURE_KEYS = [
  'database',
  'community_submissions',
  'community_uploads',
  'turnstile',
  'admin_panel',
  'map_data',
  'automatic_import',
  'investigations',
  'reports',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const SERVICE_STATES = [
  'available',
  'not_configured',
  'disabled',
  'limit_reached',
  'temporary_error',
  'not_activated',
  'backend_unavailable',
] as const;
export type ServiceState = (typeof SERVICE_STATES)[number];

export interface FeatureStatus {
  key: FeatureKey;
  available: boolean;
  state: ServiceState;
  /** Always "Currently unavailable!" (plus explanation) when not available. */
  message: string | null;
}

export type FeatureStatusMap = Record<FeatureKey, FeatureStatus>;

/** English explanations per feature. These follow the fixed status text. */
const FEATURE_EXPLANATIONS_EN: Partial<Record<FeatureKey, string>> = {
  community_uploads: 'File storage is intentionally disabled in the free-only configuration.',
  turnstile: 'Anti-spam verification has not been configured.',
  database: 'The database service is temporarily unavailable.',
  automatic_import: 'Automatic import is not activated.',
};

const FEATURE_EXPLANATIONS_DE: Partial<Record<FeatureKey, string>> = {
  community_uploads:
    'Bild-Uploads sind in dieser Konfiguration ausgeschaltet.',
  turnstile: 'Die Anti-Spam-Prüfung (Turnstile) ist nicht eingerichtet.',
  database: 'Die Datenbank ist vorübergehend nicht erreichbar.',
  automatic_import: 'Der automatische Import ist nicht aktiviert.',
};

const STATE_EXPLANATIONS_EN: Record<ServiceState, string> = {
  available: '',
  not_configured: 'The required service is not configured.',
  disabled: 'This feature has been disabled.',
  limit_reached: 'This feature is temporarily unavailable because its free service limit has been reached.',
  temporary_error: 'A temporary service error occurred. Please try again later.',
  not_activated: 'This feature has not been activated.',
  backend_unavailable: 'The backend service is currently unavailable.',
};

const STATE_EXPLANATIONS_DE: Record<ServiceState, string> = {
  available: '',
  not_configured: 'Der benötigte Dienst ist nicht eingerichtet.',
  disabled: 'Diese Funktion wurde deaktiviert.',
  limit_reached: 'Das kostenlose Kontingent dieses Dienstes ist erreicht. Die Funktion ist nach dem Zurücksetzen wieder verfügbar.',
  temporary_error: 'Ein vorübergehender Dienstfehler ist aufgetreten. Bitte später erneut versuchen.',
  not_activated: 'Diese Funktion ist nicht aktiviert.',
  backend_unavailable: 'Der Backend-Dienst ist derzeit nicht erreichbar.',
};

export const GENERIC_UNAVAILABLE_EXPLANATION =
  'This feature is temporarily unavailable because its free service limit has been reached or the required service is not configured.';

/** English explanation shown after "Currently unavailable!". */
export function explainEn(feature: FeatureKey | null, state: ServiceState): string {
  if (feature === 'community_uploads' && state === 'limit_reached') return 'The free storage space for images is used up.';
  if (feature === 'database' && (state === 'backend_unavailable' || state === 'temporary_error')) return FEATURE_EXPLANATIONS_EN.database!;
  if (state === 'limit_reached' || state === 'backend_unavailable' || state === 'temporary_error') {
    return STATE_EXPLANATIONS_EN[state];
  }
  return (feature && FEATURE_EXPLANATIONS_EN[feature]) || STATE_EXPLANATIONS_EN[state] || GENERIC_UNAVAILABLE_EXPLANATION;
}

/** Optional additional German explanation. The English status text stays visible. */
export function explainDe(feature: FeatureKey | null, state: ServiceState): string {
  if (feature === 'community_uploads' && state === 'limit_reached') return 'Der kostenlose Speicherplatz für Bilder ist aufgebraucht. Neue Bilder können erst wieder hochgeladen werden, wenn Platz frei wird.';
  if (feature === 'database' && (state === 'backend_unavailable' || state === 'temporary_error')) return FEATURE_EXPLANATIONS_DE.database!;
  if (state === 'limit_reached' || state === 'backend_unavailable' || state === 'temporary_error') {
    return STATE_EXPLANATIONS_DE[state];
  }
  return (feature && FEATURE_EXPLANATIONS_DE[feature]) || STATE_EXPLANATIONS_DE[state];
}

export function unavailableMessage(feature: FeatureKey | null, state: ServiceState): string {
  return `${UNAVAILABLE_MESSAGE} ${explainEn(feature, state)}`.trim();
}

export function makeStatus(key: FeatureKey, state: ServiceState): FeatureStatus {
  const available = state === 'available';
  return { key, available, state, message: available ? null : unavailableMessage(key, state) };
}

/** Status map used when the backend cannot be reached at all. */
export function backendUnavailableMap(): FeatureStatusMap {
  const map = {} as FeatureStatusMap;
  for (const key of FEATURE_KEYS) {
    map[key] = makeStatus(key, 'backend_unavailable');
  }
  return map;
}
