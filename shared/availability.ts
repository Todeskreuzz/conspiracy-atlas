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
  'accounts',
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
  accounts: 'User accounts are switched off.',
};

const FEATURE_EXPLANATIONS_DE: Partial<Record<FeatureKey, string>> = {
  community_uploads:
    'Bild-Uploads sind in dieser Konfiguration ausgeschaltet.',
  turnstile: 'Die Anti-Spam-Prüfung (Turnstile) ist nicht eingerichtet.',
  database: 'Die Datenbank ist vorübergehend nicht erreichbar.',
  automatic_import: 'Der automatische Import ist nicht aktiviert.',
  accounts: 'Benutzerkonten sind ausgeschaltet.',
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

const FEATURE_EXPLANATIONS_FR: Partial<Record<FeatureKey, string>> = {
  community_uploads: 'L’envoi d’images est désactivé dans cette configuration.',
  turnstile: 'La vérification anti-spam (Turnstile) n’est pas configurée.',
  database: 'La base de données est temporairement injoignable.',
  automatic_import: 'L’import automatique n’est pas activé.',
  accounts: 'Les comptes utilisateurs sont désactivés.',
};

const STATE_EXPLANATIONS_FR: Record<ServiceState, string> = {
  available: '',
  not_configured: 'Le service requis n’est pas configuré.',
  disabled: 'Cette fonction a été désactivée.',
  limit_reached: 'Le quota gratuit de ce service est atteint. La fonction redevient disponible après la remise à zéro.',
  temporary_error: 'Une erreur temporaire du service s’est produite. Réessayez plus tard.',
  not_activated: 'Cette fonction n’est pas activée.',
  backend_unavailable: 'Le service dorsal est actuellement injoignable.',
};

const FEATURE_EXPLANATIONS_ES: Partial<Record<FeatureKey, string>> = {
  community_uploads: 'El envío de imágenes está desactivado en esta configuración.',
  turnstile: 'La verificación antispam (Turnstile) no está configurada.',
  database: 'La base de datos no está disponible temporalmente.',
  automatic_import: 'La importación automática no está activada.',
  accounts: 'Las cuentas de usuario están desactivadas.',
};

const STATE_EXPLANATIONS_ES: Record<ServiceState, string> = {
  available: '',
  not_configured: 'El servicio necesario no está configurado.',
  disabled: 'Esta función se ha desactivado.',
  limit_reached: 'Se ha alcanzado el cupo gratuito de este servicio. La función vuelve a estar disponible cuando se reinicia.',
  temporary_error: 'Ha ocurrido un error temporal del servicio. Inténtalo más tarde.',
  not_activated: 'Esta función no está activada.',
  backend_unavailable: 'El servicio de fondo no está disponible ahora.',
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

/** Optional additional French explanation. The English status text stays visible. */
export function explainFr(feature: FeatureKey | null, state: ServiceState): string {
  if (feature === 'community_uploads' && state === 'limit_reached') {
    return 'L’espace gratuit pour les images est plein. De nouvelles images ne pourront être envoyées que lorsqu’il se libérera.';
  }
  if (feature === 'database' && (state === 'backend_unavailable' || state === 'temporary_error')) return FEATURE_EXPLANATIONS_FR.database!;
  if (state === 'limit_reached' || state === 'backend_unavailable' || state === 'temporary_error') {
    return STATE_EXPLANATIONS_FR[state];
  }
  return (feature && FEATURE_EXPLANATIONS_FR[feature]) || STATE_EXPLANATIONS_FR[state];
}

/** Optional additional Spanish explanation. The English status text stays visible. */
export function explainEs(feature: FeatureKey | null, state: ServiceState): string {
  if (feature === 'community_uploads' && state === 'limit_reached') {
    return 'El espacio gratuito para imágenes está lleno. Solo se podrán subir imágenes nuevas cuando se libere sitio.';
  }
  if (feature === 'database' && (state === 'backend_unavailable' || state === 'temporary_error')) return FEATURE_EXPLANATIONS_ES.database!;
  if (state === 'limit_reached' || state === 'backend_unavailable' || state === 'temporary_error') {
    return STATE_EXPLANATIONS_ES[state];
  }
  return (feature && FEATURE_EXPLANATIONS_ES[feature]) || STATE_EXPLANATIONS_ES[state];
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
