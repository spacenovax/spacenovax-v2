import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};

function pointAhead(origin, heading = 0, metersAhead = 30) {
  const d = metersAhead / 6371000, a = heading * Math.PI / 180, lat1 = origin.lat * Math.PI / 180, lon1 = origin.lon * Math.PI / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(a));
  const lon2 = lon1 + Math.atan2(Math.sin(a) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}

function bearingBetween(from, to) {
  if (!from || !to) return 0;
  const lat1 = from.lat * Math.PI / 180, lat2 = to.lat * Math.PI / 180, deltaLon = (to.lon - from.lon) * Math.PI / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function routeHeading(route, progress, current) {
  const points = route?.points || [];
  if (points.length < 2) return 0;
  const lastSegment = points.length - 2;
  const index = Math.max(0, Math.min(lastSegment, Math.floor((Number(progress) || 0) * (points.length - 1))));
  // Use the live GPS point as the start so the heading stays stable even when
  // the routing geometry begins a few metres behind the vehicle.
  return bearingBetween(current || points[index], points[index + 1]);
}

function navigationHeading(current, route, progress) {
  const matchedRouteHeading = routeHeading(route, progress, current);
  // GPS heading can lag, flip, or follow the phone rather than the car. The
  // next matched route segment is therefore the camera's source of truth.
  if (Number.isFinite(matchedRouteHeading) && !(matchedRouteHeading === 0 && (route?.points || []).length < 2)) return matchedRouteHeading;
  const deviceHeading = Number(current?.heading);
  return Number.isFinite(deviceHeading) ? (deviceHeading + 360) % 360 : 0;
}

function vehicleElement() {
  const element = document.createElement('div');
  element.className = 'nova-maplibre-vehicle';
  // A neutral navigation-direction marker: original artwork, never a copied
  // third-party map icon. The map camera keeps it pointed straight ahead.
  element.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#fff" fill-opacity=".96"/><path d="M32 11c2.1 0 4 1.1 5.1 3l14.2 27.2c1.7 3.3-1.6 6.9-5.1 5.4L32 40.5l-14.2 6.1c-3.5 1.5-6.8-2.1-5.1-5.4L26.9 14c1.1-1.9 3-3 5.1-3Z" fill="#1688ff"/><path d="M32 18v17.8" stroke="#dff4ff" stroke-width="3.5" stroke-linecap="round"/><path d="m24.8 35.8 7.2 4.7 7.2-4.7" fill="none" stroke="#0d62cf" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return element;
}

function destinationElement() {
  const element = document.createElement('div');
  element.className = 'nova-maplibre-destination';
  element.innerHTML = '◆';
  return element;
}

function remainingLine(route, progress, current) {
  const points = route?.points || [];
  if (points.length < 2) return [];
  const index = Math.max(0, Math.min(points.length - 1, Math.floor((Number(progress) || 0) * (points.length - 1))));
  const livePoint = current && Number.isFinite(current.lat) && Number.isFinite(current.lon) ? [current.lon, current.lat] : [points[index].lon, points[index].lat];
  // The first coordinate is always the vehicle. Completed geometry is never
  // included, so blue paint cannot remain behind the vehicle.
  const upcoming = points.slice(Math.min(points.length, index + 1)).map((point) => [point.lon, point.lat]);
  return [livePoint, ...upcoming];
}

export default function NovaDriveMap({ current, destination, route, progress }) {
  const containerRef = useRef(null), mapRef = useRef(null), readyRef = useRef(false), vehicleRef = useRef(null), destinationRef = useRef(null);
  const liveRef = useRef({ current, destination, route, progress });
  liveRef.current = { current, destination, route, progress };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [current.lon, current.lat],
      zoom: 17,
      bearing: 0,
      pitch: 0,
      attributionControl: true,
      maxZoom: 19,
      minZoom: 2
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    const vehicle = new maplibregl.Marker({ element: vehicleElement(), anchor: 'center', rotationAlignment: 'viewport' }).setLngLat([current.lon, current.lat]).addTo(map);
    vehicleRef.current = vehicle;
    if (destination) destinationRef.current = new maplibregl.Marker({ element: destinationElement(), anchor: 'center' }).setLngLat([destination.lon, destination.lat]).addTo(map);
    map.on('load', () => {
      map.addSource('nova-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
      map.addLayer({ id: 'nova-route-casing', type: 'line', source: 'nova-route', paint: { 'line-color': '#071a31', 'line-width': 15, 'line-opacity': 0.92 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'nova-route-line', type: 'line', source: 'nova-route', paint: { 'line-color': '#1b8cff', 'line-width': 8, 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      readyRef.current = true;
      const state = liveRef.current;
      const line = remainingLine(state.route, state.progress, state.current);
      map.getSource('nova-route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } });
    });
    mapRef.current = map;
    return () => { readyRef.current = false; map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !current) return;
    vehicleRef.current?.setLngLat([current.lon, current.lat]);
    if (destination) {
      if (!destinationRef.current) destinationRef.current = new maplibregl.Marker({ element: destinationElement(), anchor: 'center' }).addTo(map);
      destinationRef.current.setLngLat([destination.lon, destination.lat]);
    }
    const line = remainingLine(route, progress, current);
    if (readyRef.current) map.getSource('nova-route')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } });
    const heading = navigationHeading(current, route, progress);
    const forward = pointAhead(current, heading, 30);
    // Map bearing follows the travel direction; the viewport-aligned arrow
    // therefore remains at the 12 o'clock position.
    map.easeTo({ center: [forward.lon, forward.lat], zoom: Math.max(map.getZoom(), 17), bearing: -heading, duration: 420, essential: true });
  }, [current, destination, route, progress]);

  return <div ref={containerRef} className="nova-maplibre" aria-label="NOVA driving map" />;
}
