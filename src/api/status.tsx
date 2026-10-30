import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { backendUnavailableMap, type FeatureKey, type FeatureStatus, type FeatureStatusMap } from '../../shared/availability';
import { api, ApiFailure } from './client';

interface StatusValue {
  loaded: boolean;
  features: FeatureStatusMap;
  turnstileSiteKey: string | null;
  refresh: () => void;
}

const StatusContext = createContext<StatusValue>({
  loaded: false,
  features: backendUnavailableMap(),
  turnstileSiteKey: null,
  refresh: () => {},
});

export function StatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<StatusValue, 'refresh'>>({ loaded: false, features: backendUnavailableMap(), turnstileSiteKey: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api<{ features: FeatureStatusMap; turnstileSiteKey: string | null }>('/status', { localized: false })
      .then((r) => alive && setState({ loaded: true, features: r.features, turnstileSiteKey: r.turnstileSiteKey }))
      .catch((e: unknown) => {
        if (!alive) return;
        const map = backendUnavailableMap();
        if (e instanceof ApiFailure && e.state === 'limit_reached') {
          for (const k of Object.keys(map) as FeatureKey[]) if (k !== 'community_uploads') map[k] = { ...map[k], state: 'limit_reached' };
        }
        setState({ loaded: true, features: map, turnstileSiteKey: null });
      });
    return () => {
      alive = false;
    };
  }, [tick]);
  return <StatusContext.Provider value={{ ...state, refresh: () => setTick((t) => t + 1) }}>{children}</StatusContext.Provider>;
}

export const useStatus = () => useContext(StatusContext);
export function useFeature(key: FeatureKey): FeatureStatus & { loaded: boolean } {
  const { features, loaded } = useStatus();
  return { ...features[key], loaded };
}
