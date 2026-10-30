import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';
import { useI18n } from '../i18n';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api/client';
import type { EventSummary, LocationItem, Organization } from '../../shared/types';
import type { CategorySlug } from '../../shared/constants';
import { LoadState, Unavailable } from '../components/Unavailable';
import { CATEGORY_COLORS } from '../components/Badges';
import { useFeature } from '../api/status';
import { ISO_NUMERIC } from './mapData';
import { eventDate } from './Events';
import '../styles/map.css';

type MapCase = { id: number; slug: string; title: string; subtitle: string | null; category: string };
type MapLocation = LocationItem & { events: EventSummary[]; organizations: Array<Organization & { locationId: number }>; theories?: MapCase[] };

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A red push pin with the number of cases at this place (drawn locally, no image requests). */
function casePin(count: number, order: number): L.DivIcon {
  return L.divIcon({
    className: 'case-pin',
    html: `<span class="case-pin__body" style="--i:${Math.min(order, 30)}"><svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><ellipse cx="15" cy="38.5" rx="6" ry="1.8" fill="rgba(30,15,5,.35)"/><path d="M15 38s12-14 12-23.5A12 12 0 0 0 3 14.5C3 24 15 38 15 38z" fill="url(#map-pin-grad)" stroke="#5a0f0a" stroke-width="1"/><circle cx="15" cy="14.5" r="8" fill="#f6edd8" stroke="#7c150e" stroke-width=".8"/><text x="15" y="18.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="700" fill="#5a0f0a">${count}</text></svg></span><span class="case-pin__ping" aria-hidden="true"></span>`,
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    tooltipAnchor: [0, -34],
  });
}

/** Small brass-headed tack for places with only events or organisations. */
function tackPin(kind: 'event' | 'org', count: number, order: number): L.DivIcon {
  const size = 14 + Math.min(8, count * 1.5);
  return L.divIcon({
    className: `tack-pin tack-pin--${kind}`,
    html: `<span class="tack-pin__head" style="--i:${Math.min(order, 30)};--s:${size}px"></span><span class="case-pin__ping" aria-hidden="true"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  });
}

// Country shapes are bundled with the application (Natural Earth via world-atlas, public domain / ISC).
// No tile server or external map service is contacted.
const countries = fixAntimeridian(feature(worldData as unknown as Topology, (worldData as unknown as Topology).objects.countries as GeometryCollection) as GeoJSON.FeatureCollection);

/**
 * Rings that cross the 180° meridian (Russia, Fiji, Antarctica) would be drawn as stripes across
 * the whole map. Shift their western longitudes by +360° so each ring stays continuous.
 */
function fixAntimeridian(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const fixRing = (ring: number[][]) => {
    const crosses = ring.some((p, i) => i > 0 && Math.abs(p[0] - ring[i - 1][0]) > 180);
    return crosses ? ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : ring;
  };
  for (const f of fc.features) {
    const g = f.geometry;
    if (g?.type === 'Polygon') g.coordinates = g.coordinates.map(fixRing);
    else if (g?.type === 'MultiPolygon') g.coordinates = g.coordinates.map((poly) => poly.map(fixRing));
  }
  return fc;
}

/** Lines of latitude and longitude every 15°, drawn like the grid of a printed chart. */
function graticule(): GeoJSON.FeatureCollection {
  const lines: GeoJSON.Feature[] = [];
  for (let lng = -180; lng <= 180; lng += 15) {
    lines.push({ type: 'Feature', properties: { major: lng === 0 }, geometry: { type: 'LineString', coordinates: Array.from({ length: 33 }, (_, i) => [lng, -80 + i * 5]) } });
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    lines.push({ type: 'Feature', properties: { major: lat === 0 }, geometry: { type: 'LineString', coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]) } });
  }
  return { type: 'FeatureCollection', features: lines };
}

/** 38.8977 → 38°53′N (typewriter coordinates for the dossier and the cursor readout). */
export function formatCoord(value: number, axis: 'lat' | 'lng'): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = Math.round((abs - deg) * 60);
  const [d, m] = min === 60 ? [deg + 1, 0] : [deg, min];
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${d}°${String(m).padStart(2, '0')}′${hemi}`;
}

/** Points of a gentle arc between two places (the red string drawn across the chart). */
export function arcPoints(a: L.LatLngExpression, b: L.LatLngExpression, steps = 24): L.LatLng[] {
  const p = L.latLng(a);
  const q = L.latLng(b);
  const dx = q.lng - p.lng;
  const dy = q.lat - p.lat;
  const bend = 0.22;
  const c = L.latLng(p.lat + dy / 2 + dx * bend, p.lng + dx / 2 - dy * bend);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return L.latLng(u * u * p.lat + 2 * u * t * c.lat + t * t * q.lat, u * u * p.lng + 2 * u * t * c.lng + t * t * q.lng);
  });
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function CompassRose() {
  return (
    <svg className="chart-compass" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1 2" />
      <path d="M50 6 L56 50 L50 94 L44 50 Z" fill="currentColor" opacity="0.85" />
      <path d="M6 50 L50 44 L94 50 L50 56 Z" fill="currentColor" opacity="0.45" />
      <path d="M50 6 L56 50 L50 50 Z" fill="#b3261e" />
      <text x="50" y="4.5" textAnchor="middle" fontSize="8" fill="currentColor" fontFamily="var(--font-type)">
        N
      </text>
    </svg>
  );
}

export default function MapPage() {
  const { t, locale } = useI18n();
  const mapFeature = useFeature('map_data');
  const [params, setParams] = useSearchParams();
  const res = useAsync((signal) => api<{ locations: MapLocation[]; caseCount?: number; placedCases?: number }>('/map', { signal }), [locale]);
  const allEvents = useAsync((signal) => api<{ items: EventSummary[] }>('/events', { signal }), [locale]);
  const [showCases, setShowCases] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showOrgs, setShowOrgs] = useState(true);
  const [showRegions, setShowRegions] = useState(true);
  const [cursor, setCursor] = useState<L.LatLng | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const stringRef = useRef<L.LayerGroup | null>(null);
  const regionRef = useRef<L.GeoJSON | null>(null);
  const firstPins = useRef(true);

  const locations = useMemo(() => res.data?.locations ?? [], [res.data]);
  const used = (l: MapLocation) => (l.theories?.length ?? 0) + l.events.length + l.organizations.length > 0;
  const activeCountries = useMemo(() => new Set(locations.filter(used).map((l) => ISO_NUMERIC[l.countryCode ?? ''])), [locations]);
  const selected = locations.find((l) => l.slug === params.get('place')) ?? null;

  /** Places that share a case file with the selected place: the red strings. */
  const linked = useMemo(() => {
    if (!selected?.theories?.length) return [];
    const ids = new Set(selected.theories.map((c) => c.id));
    return locations.filter((l) => l.id !== selected.id && l.theories?.some((c) => ids.has(c.id)));
  }, [locations, selected]);

  const select = (loc: MapLocation | null, fly = true) => {
    const next = new URLSearchParams(params);
    next.delete('lat');
    next.delete('lng');
    if (loc) next.set('place', loc.slug);
    else next.delete('place');
    setParams(next, { replace: true });
    const map = mapRef.current;
    if (loc && fly && map) {
      const z = Math.max(map.getZoom(), 4);
      if (reducedMotion()) map.setView([loc.lat, loc.lng], z);
      else map.flyTo([loc.lat, loc.lng], z, { duration: 1.1 });
    }
  };
  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const renderer = L.svg({ padding: 0.5 });
    const map = L.map(el.current, { renderer, worldCopyJump: true, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, attributionControl: true, zoomControl: false }).setView(
      [30, -10],
      el.current.clientWidth < 600 ? 1 : 2,
    );
    L.control.zoom({ position: 'topleft', zoomInTitle: t('timeline.zoomIn'), zoomOutTitle: t('timeline.zoomOut') }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution('Natural Earth (public domain)');
    L.geoJSON(graticule(), { interactive: false, style: (f) => ({ className: `chart-grid${f?.properties?.major ? ' is-major' : ''}`, weight: 1 }) }).addTo(map);
    regionRef.current = L.geoJSON(countries, { interactive: false, style: () => ({ className: 'chart-land', weight: 0.8 }) }).addTo(map);
    // Hatching for highlighted countries and the gradient of the push pins live in the map's own SVG.
    const svg = (renderer as unknown as { _container?: SVGSVGElement })._container;
    if (svg && !svg.querySelector('#map-hatch')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML =
        '<radialGradient id="map-pin-grad" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ff7d6c"/><stop offset=".5" stop-color="#c92f24"/><stop offset="1" stop-color="#6e140f"/></radialGradient>' +
        '<pattern id="map-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#d6a98c"/><line x1="0" y1="0" x2="0" y2="6" stroke="#a3221a" stroke-width="1.6" stroke-opacity=".55"/></pattern>';
      svg.prepend(defs);
    }
    stringRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on('mousemove', (e: L.LeafletMouseEvent) => setCursor(e.latlng.wrap()));
    map.on('mouseout', () => setCursor(null));
    map.on('click', () => selectRef.current(null, false));
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    if (Number.isFinite(lat) && Number.isFinite(lng) && params.get('lat')) map.setView([lat, lng], 6);
    else if (selected) map.setView([selected.lat, selected.lng], 4);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data]);

  useEffect(() => {
    regionRef.current?.setStyle((f) => {
      const active = showRegions && activeCountries.has(String((f as GeoJSON.Feature).id));
      return { className: `chart-land${active ? ' is-active' : ''}`, fillColor: active ? 'url(#map-hatch)' : '#d9c497', color: active ? '#8a2a20' : '#6b5236', weight: active ? 1.2 : 0.7, fillOpacity: 1 };
    });
  }, [activeCountries, showRegions, res.data]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();
    let order = 0;
    const animate = firstPins.current && !reducedMotion();
    for (const loc of locations) {
      const cases = showCases ? (loc.theories?.length ?? 0) : 0;
      const hasEvents = showEvents && loc.events.length > 0;
      const hasOrgs = showOrgs && loc.organizations.length > 0;
      if (!cases && !hasEvents && !hasOrgs) continue;
      const count = cases || (hasEvents ? loc.events.length : 0) + (hasOrgs ? loc.organizations.length : 0);
      const label = cases ? `${loc.name}: ${t('map.casesHere', { count: cases })}` : `${loc.name} (${count})`;
      const icon = cases ? casePin(cases, animate ? order++ : 0) : tackPin(hasEvents ? 'event' : 'org', count, animate ? order++ : 0);
      const marker = L.marker([loc.lat, loc.lng], { icon, riseOnHover: true, zIndexOffset: cases ? 1000 : 0, title: label, alt: label, keyboard: true });
      marker.bindTooltip(escapeHtml(label), { direction: 'top', className: 'chart-tip' });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        selectRef.current(loc);
      });
      marker.on('keypress', (e) => {
        const key = (e as L.LeafletKeyboardEvent).originalEvent.key;
        if (key === 'Enter' || key === ' ') selectRef.current(loc);
      });
      marker.on('add', () => {
        const node = marker.getElement();
        if (!node) return;
        node.setAttribute('role', 'button');
        node.setAttribute('aria-label', label);
        node.classList.toggle('is-selected', loc.slug === params.get('place'));
        node.classList.toggle('is-animated', animate);
      });
      group.addLayer(marker);
    }
    if (locations.length) firstPins.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, showCases, showEvents, showOrgs, t]);

  // Mark the selected pin and draw the strings to places that share a case.
  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      const m = layer as L.Marker;
      const node = m.getElement?.();
      if (!node) return;
      const ll = m.getLatLng();
      node.classList.toggle('is-selected', !!selected && ll.lat === selected.lat && ll.lng === selected.lng);
      node.classList.toggle('is-linked', linked.some((l) => l.lat === ll.lat && l.lng === ll.lng));
    });
    const strings = stringRef.current;
    if (!strings) return;
    strings.clearLayers();
    if (!selected) return;
    for (const l of linked) {
      strings.addLayer(L.polyline(arcPoints([selected.lat, selected.lng], [l.lat, l.lng]), { className: 'chart-string', interactive: false, weight: 2.2 }));
    }
  }, [selected, linked, showCases, showEvents, showOrgs, locations]);

  const withoutLocation = (allEvents.data?.items ?? []).filter((e) => !e.location).length;
  const index = useMemo(
    () =>
      locations
        .filter(used)
        .map((l) => ({ l, n: (l.theories?.length ?? 0) * 3 + l.events.length + l.organizations.length }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 8)
        .map((x) => x.l),
    [locations],
  );

  if (mapFeature.loaded && !mapFeature.available) {
    return (
      <div className="container page">
        <h1>{t('map.title')}</h1>
        <Unavailable feature="map_data" state={mapFeature.state} />
      </div>
    );
  }

  return (
    <div className="container page situation">
      <header className="page-header">
        <div className="kicker">{t('nav.map')}</div>
        <h1>{t('map.title')}</h1>
        <p>{t('map.intro')}</p>
      </header>
      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {res.data && (
        <div className="situation__grid">
          <div className="chart">
            <div className="chart__frame">
              <div className="map-wrap" ref={el} data-testid="world-map" />
              <div className="chart__cartouche" aria-hidden="true">
                <span>{t('map.chartTitle')}</span>
                <small>{t('map.chartSub', { places: locations.filter(used).length })}</small>
              </div>
              <CompassRose />
              <div className="chart__readout mono" aria-hidden="true">
                {cursor ? `${formatCoord(cursor.lat, 'lat')}  ${formatCoord(cursor.lng, 'lng')}` : t('map.pointer')}
              </div>
            </div>
            <div className="chart__legend" role="group" aria-label={t('map.layers')}>
              <button type="button" className="legend-toggle legend-toggle--case" aria-pressed={showCases} onClick={() => setShowCases((v) => !v)}>
                <span aria-hidden="true" />
                {t('map.showCases')}
              </button>
              <button type="button" className="legend-toggle legend-toggle--event" aria-pressed={showEvents} onClick={() => setShowEvents((v) => !v)}>
                <span aria-hidden="true" />
                {t('map.showEvents')}
              </button>
              <button type="button" className="legend-toggle legend-toggle--org" aria-pressed={showOrgs} onClick={() => setShowOrgs((v) => !v)}>
                <span aria-hidden="true" />
                {t('map.showOrganizations')}
              </button>
              <button type="button" className="legend-toggle legend-toggle--region" aria-pressed={showRegions} onClick={() => setShowRegions((v) => !v)}>
                <span aria-hidden="true" />
                {t('map.showRegions')}
              </button>
              <span className="chart__stats">
                {res.data.caseCount !== undefined && t('map.casesPlaced', { placed: res.data.placedCases ?? 0, total: res.data.caseCount })}
                {withoutLocation > 0 && ` · ${t('map.noLocation', { count: withoutLocation })}`}
              </span>
            </div>
          </div>

          <aside className={`dossier-card${selected ? ' is-open' : ''}`} data-testid="map-detail" key={selected?.slug ?? 'index'} aria-live="polite">
            {!selected && (
              <>
                <div className="dossier-card__tab">{t('map.indexTitle')}</div>
                <p className="dossier-card__hint">{t('map.selectPlace')}</p>
                <ol className="place-index">
                  {index.map((l, i) => (
                    <li key={l.id}>
                      <button type="button" onClick={() => select(l)}>
                        <span className="place-index__no mono">{String(i + 1).padStart(2, '0')}</span>
                        <span className="place-index__name">{l.name}</span>
                        <span className="place-index__count mono">{(l.theories?.length ?? 0) || l.events.length + l.organizations.length}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {selected && (
              <>
                <div className="dossier-card__tab">
                  {t('map.dossier')} {selected.countryCode && <span className="dossier-card__cc">{selected.countryCode}</span>}
                </div>
                <h3 id={selected.slug}>{selected.name}</h3>
                <div className="dossier-card__coords mono">
                  {formatCoord(selected.lat, 'lat')} · {formatCoord(selected.lng, 'lng')}
                </div>
                {selected.description && <p className="small">{selected.description}</p>}
                {(selected.theories?.length ?? 0) > 0 && (
                  <>
                    <h4>{t('map.cases')}</h4>
                    <ul className="dossier-list">
                      {selected.theories!.map((c) => (
                        <li key={c.id} style={{ '--cat': CATEGORY_COLORS[c.category as CategorySlug] ?? '#8a5a2b' } as React.CSSProperties}>
                          <Link to={`/theory/${c.slug}`}>{c.title}</Link>
                          {c.subtitle && <span className="muted"> · {c.subtitle}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {selected.events.length > 0 && showEvents && (
                  <>
                    <h4>{t('nav.events')}</h4>
                    <ul className="dossier-list dossier-list--events">
                      {selected.events.map((e) => (
                        <li key={e.id}>
                          <span className="mono muted">{eventDate(e, locale)}</span>
                          <br />
                          <Link to={`/events/${e.slug}`}>{e.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {selected.organizations.length > 0 && (
                  <>
                    <h4>{t('nav.organizations')}</h4>
                    <ul className="dossier-list dossier-list--orgs">
                      {selected.organizations.map((o) => (
                        <li key={o.id}>
                          <Link to={`/organizations/${o.slug}`}>{o.name}</Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {linked.length > 0 && (
                  <>
                    <h4>{t('map.linkedPlaces')}</h4>
                    <div className="btn-row">
                      {linked.map((l) => (
                        <button key={l.id} type="button" className="chip" onClick={() => select(l)}>
                          {l.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <button type="button" className="btn btn--small dossier-card__close" onClick={() => select(null, false)}>
                  {t('map.backToIndex')}
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
