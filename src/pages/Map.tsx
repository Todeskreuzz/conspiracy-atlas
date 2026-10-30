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
import { LoadState, Unavailable } from '../components/Unavailable';
import { useFeature } from '../api/status';
import { ISO_NUMERIC } from './mapData';
import { eventDate } from './Events';

type MapLocation = LocationItem & { events: EventSummary[]; organizations: Array<Organization & { locationId: number }> };

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

export default function MapPage() {
  const { t, locale } = useI18n();
  const mapFeature = useFeature('map_data');
  const [params] = useSearchParams();
  const res = useAsync((signal) => api<{ locations: MapLocation[] }>('/map', { signal }), [locale]);
  const allEvents = useAsync((signal) => api<{ items: EventSummary[] }>('/events', { signal }), [locale]);
  const [showEvents, setShowEvents] = useState(true);
  const [showOrgs, setShowOrgs] = useState(true);
  const [showRegions, setShowRegions] = useState(true);
  const [selected, setSelected] = useState<MapLocation | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const regionRef = useRef<L.GeoJSON | null>(null);

  const locations = useMemo(() => res.data?.locations ?? [], [res.data]);
  const activeCountries = useMemo(() => new Set(locations.filter((l) => l.events.length || l.organizations.length).map((l) => ISO_NUMERIC[l.countryCode ?? ''])), [locations]);

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { worldCopyJump: true, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, attributionControl: true }).setView([30, -20], 2);
    map.attributionControl.setPrefix(false).addAttribution('Natural Earth (public domain)');
    regionRef.current = L.geoJSON(countries, {
      style: () => ({ color: '#4a4038', weight: 0.7, fillColor: '#2a2420', fillOpacity: 1 }),
      interactive: false,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    if (Number.isFinite(lat) && Number.isFinite(lng) && params.get('lat')) map.setView([lat, lng], 6);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data]);

  useEffect(() => {
    regionRef.current?.setStyle((f) => {
      const active = showRegions && activeCountries.has(String((f as GeoJSON.Feature).id));
      return { color: active ? '#8a3a30' : '#4a4038', weight: active ? 1.2 : 0.7, fillColor: active ? '#4a2a22' : '#2a2420', fillOpacity: 1 };
    });
  }, [activeCountries, showRegions]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();
    for (const loc of locations) {
      const hasEvents = showEvents && loc.events.length > 0;
      const hasOrgs = showOrgs && loc.organizations.length > 0;
      if (!hasEvents && !hasOrgs) continue;
      const count = (hasEvents ? loc.events.length : 0) + (hasOrgs ? loc.organizations.length : 0);
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: 6 + Math.min(10, count * 1.5),
        color: '#f1b4ad',
        weight: 1.5,
        fillColor: hasEvents ? '#c9372c' : '#c9a43a',
        fillOpacity: 0.85,
      });
      marker.bindTooltip(`${loc.name} (${count})`, { direction: 'top' });
      marker.on('click', () => setSelected(loc));
      group.addLayer(marker);
    }
  }, [locations, showEvents, showOrgs]);

  const withoutLocation = (allEvents.data?.items ?? []).filter((e) => !e.location).length;

  if (mapFeature.loaded && !mapFeature.available) {
    return (
      <div className="container page">
        <h1>{t('map.title')}</h1>
        <Unavailable feature="map_data" state={mapFeature.state} />
      </div>
    );
  }

  return (
    <div className="container page">
      <header className="page-header">
        <div className="kicker">{t('nav.map')}</div>
        <h1>{t('map.title')}</h1>
        <p>{t('map.intro')}</p>
      </header>
      <LoadState loading={res.loading} error={res.error} onRetry={res.reload} />
      {res.data && (
        <>
          <div className="toolbar">
            <span className="label small">{t('map.layers')}:</span>
            <label className="checkbox">
              <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} /> <span style={{ color: '#e0574b' }}>●</span> {t('map.showEvents')}
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={showOrgs} onChange={(e) => setShowOrgs(e.target.checked)} /> <span style={{ color: '#c9a43a' }}>●</span> {t('map.showOrganizations')}
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} /> {t('map.showRegions')}
            </label>
            <span className="muted small">{t('map.places', { count: locations.filter((l) => l.events.length || l.organizations.length).length })}</span>
            {withoutLocation > 0 && <span className="muted small">· {t('map.noLocation', { count: withoutLocation })}</span>}
          </div>
          <div className="two-col" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
            <div className="map-wrap" ref={el} data-testid="world-map" />
            <aside className="paper" data-testid="map-detail">
              {!selected && <p className="muted">{t('map.selectPlace')}</p>}
              {selected && (
                <>
                  <div className="typewriter small muted">{selected.countryCode}</div>
                  <h3 id={selected.slug}>{selected.name}</h3>
                  {selected.description && <p className="small">{selected.description}</p>}
                  {selected.events.length > 0 && (
                    <>
                      <h4>{t('nav.events')}</h4>
                      <ul className="list-plain small">
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
                      <h4 style={{ marginTop: 12 }}>{t('nav.organizations')}</h4>
                      <ul className="list-plain small">
                        {selected.organizations.map((o) => (
                          <li key={o.id}>
                            <Link to={`/organizations/${o.slug}`}>{o.name}</Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
