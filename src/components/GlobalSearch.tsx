import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../api/client';
import type { TheorySummary } from '../../shared/types';
import { LoadState } from './Unavailable';

interface SearchResponse {
  theories: TheorySummary[];
  people: Array<{ slug: string; name: string; role: string | null }>;
  organizations: Array<{ slug: string; name: string; kind: string }>;
  events: Array<{ slug: string; title: string; start_year: number | null }>;
}
interface Hit {
  key: string;
  group: 'theories' | 'people' | 'organizations' | 'events';
  title: string;
  meta: string | null;
  to: string;
}

const GROUPS = ['theories', 'people', 'organizations', 'events'] as const;

function toHits(r: SearchResponse, t: (k: string) => string): Hit[] {
  return [
    ...r.theories.map((x) => ({ key: `t-${x.slug}`, group: 'theories' as const, title: x.title, meta: t(`categories.${x.category}`), to: `/theory/${x.slug}` })),
    ...r.people.map((x) => ({ key: `p-${x.slug}`, group: 'people' as const, title: x.name, meta: x.role, to: `/people/${x.slug}` })),
    ...r.organizations.map((x) => ({ key: `o-${x.slug}`, group: 'organizations' as const, title: x.name, meta: null, to: `/organizations/${x.slug}` })),
    ...r.events.map((x) => ({ key: `e-${x.slug}`, group: 'events' as const, title: x.title, meta: x.start_year ? String(x.start_year) : null, to: `/events/${x.slug}` })),
  ];
}

/** Marks the query inside a result title (plain text, no HTML). */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function GlobalSearch() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => (result ? toHits(result, t) : []), [result, t]);
  const query = q.trim();

  // Ctrl/Cmd+K or "/" opens the search from anywhere (not while typing in a field).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Debounced query; every request settles into results or a "Currently unavailable!" state.
  useEffect(() => {
    if (!open || query.length < 2) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => {
          setResult(r);
          setError(null);
          setActive(0);
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted) setError(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, locale]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQ('');
    navigate(hit.to, { viewTransition: true });
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[active]);
    }
  };

  return (
    <>
      <button type="button" className="search-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={t('search.button')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5L21 21" />
        </svg>
        <span>{t('search.button')}</span>
        <kbd>{t('search.shortcut')}</kbd>
      </button>
      {open && (
        <div className="search-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="search-panel" role="dialog" aria-modal="true" aria-label={t('search.label')}>
            <div className="search-panel__field">
              <input
                ref={input}
                type="search"
                role="combobox"
                aria-label={t('search.label')}
                aria-expanded={hits.length > 0}
                aria-controls="search-results"
                aria-activedescendant={hits[active] ? `search-${hits[active].key}` : undefined}
                aria-autocomplete="list"
                placeholder={t('search.placeholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
              />
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setOpen(false)}>
                {t('search.close')}
              </button>
            </div>
            <div className="search-panel__body">
              {query.length < 2 && <p className="muted small">{t('search.hint')}</p>}
              {query.length >= 2 && (loading || error) && !result && <LoadState loading={loading} error={error} />}
              {result && hits.length === 0 && !loading && <p className="muted">{t('search.empty', { q: query })}</p>}
              {hits.length > 0 && (
                <ul id="search-results" role="listbox" aria-label={t('search.label')} className="search-results">
                  {GROUPS.filter((g) => hits.some((h) => h.group === g)).map((g) => (
                    <li key={g} role="presentation">
                      <div className="search-results__group" role="presentation">
                        {t(`search.groups.${g}`)}
                      </div>
                      <ul role="presentation">
                        {hits
                          .filter((h) => h.group === g)
                          .map((h) => {
                            const i = hits.indexOf(h);
                            return (
                              <li
                                key={h.key}
                                id={`search-${h.key}`}
                                role="option"
                                aria-selected={i === active}
                                className="search-results__item"
                                onMouseEnter={() => setActive(i)}
                                onClick={() => go(h)}
                              >
                                <span className="search-results__title">
                                  <Highlight text={h.title} q={query} />
                                </span>
                                {h.meta && <span className="search-results__meta">{h.meta}</span>}
                              </li>
                            );
                          })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
