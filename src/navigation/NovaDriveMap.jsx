import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const OSM_STYLE = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
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

function snapToRoute(route, current, progress) {
  const points = route?.points || [];
  if (!current || points.length < 2) return { position: current, segment: 0, heading: Number(current?.heading) || 0, deviationM: Infinity };
  const latitudeScale = 111320, longitudeScale = 111320 * Math.cos(current.lat * Math.PI / 180);
  let best = null;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index], b = points[index + 1];
    const ax = (a.lon - current.lon) * longitudeScale, ay = (a.lat - current.lat) * latitudeScale;
    const bx = (b.lon - current.lon) * longitudeScale, by = (b.lat - current.lat) * latitudeScale;
    const dx = bx - ax, dy = by - ay, lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    const x = ax + dx * t, y = ay + dy * t, deviationM = Math.hypot(x, y);
    if (!best || deviationM < best.deviationM) best = { segment: index, t, deviationM, position: { lat: current.lat + y / latitudeScale, lon: current.lon + x / longitudeScale } };
  }
  // Do not pull an off-route vehicle onto a distant parallel road. Off-route
  // handling can then safely request a fresh route instead.
  if (!best || best.deviationM > Math.max(65, Number(current.accuracy || 0) * 3)) return { position: current, segment: Math.max(0, Math.floor((Number(progress) || 0) * (points.length - 1))), heading: Number(current.heading) || 0, deviationM: best?.deviationM ?? Infinity };
  return { ...best, heading: bearingBetween(points[best.segment], points[best.segment + 1]) };
}

function vehicleElement() {
  const element = document.createElement('div');
  element.className = 'nova-maplibre-vehicle';
  element.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#fff" fill-opacity=".96"/><path d="M32 11c2.1 0 4 1.1 5.1 3l14.2 27.2c1.7 3.3-1.6 6.9-5.1 5.4L32 40.5l-14.2 6.1c-3.5 1.5-6.8-2.1-5.1-5.4L26.9 14c1.1-1.9 3-3 5.1-3Z" fill="#1688ff"/><path d="M32 18v17.8" stroke="#dff4ff" stroke-width="3.5" stroke-linecap="round"/><path d="m24.8 35.8 7.2 4.7 7.2-4.7" fill="none" stroke="#0d62cf" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return element;
}
function destinationElement() { const element = document.createElement('div'); element.className = 'nova-maplibre-destination'; element.innerHTML = '◆'; return element; }

function remainingLine(route, snapped) {
  const points = route?.points || [];
  if (points.length < 2 || !snapped?.position) return [];
  return [[snapped.position.lon, snapped.position.lat], ...points.slice(Math.min(points.length, snapped.segment + 1)).map((point) => [point.lon, point.lat])];
}

export default function NovaDriveMap({ current, destination, route, progress }) {
  const containerRef = useRef(null), mapRef = useRef(null), readyRef = useRef(false), vehicleRef = useRef(null), destinationRef = useRef(null);
  const liveRef = useRef({ current, destination, route, progress });
  liveRef.current = { current, destination, route, progress };

  useEffect(() => {
    const map = new maplibregl.Map({ container: containerRef.current, style: OSM_STYLE, center: [current.lon, current.lat], zoom: 18, bearing: 0, pitch: 0, attributionControl: true, maxZoom: 19, minZoom: 2 });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    const vehicle = new maplibregl.Marker({ element: vehicleElement(), anchor: 'center', rotationAlignment: 'viewport' }).setLngLat([current.lon, current.lat]).addTo(map);
    vehicleRef.current = vehicle;
    if (destination) destinationRef.current = new maplibregl.Marker({ element: destinationElement(), anchor: 'center' }).setLngLat([destination.lon, destination.lat]).addTo(map);
    map.on('load', () => {
      map.addSource('nova-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
      map.addLayer({ id: 'nova-route-casing', type: 'line', source: 'nova-route', paint: { 'line-color': '#071a31', 'line-width': 15, 'line-opacity': 0.92 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'nova-route-line', type: 'line', source: 'nova-route', paint: { 'line-color': '#1b8cff', 'line-width': 8, 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      readyRef.current = true;
      const state = liveRef.current, snapped = snapToRoute(state.route, state.current, state.progress);
      map.getSource('nova-route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: remainingLine(state.route, snapped) } });
    });
    mapRef.current = map;
    return () => { readyRef.current = false; map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !current) return;
    const snapped = snapToRoute(route, current, progress);
    const position = snapped.position || current;
    vehicleRef.current?.setLngLat([position.lon, position.lat]);
    if (destination) {
      if (!destinationRef.current) destinationRef.current = new maplibregl.Marker({ element: destinationElement(), anchor: 'center' }).addTo(map);
      destinationRef.current.setLngLat([destination.lon, destination.lat]);
    }
    if (readyRef.current) map.getSource('nova-route')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: remainingLine(route, snapped) } });
    const heading = Number.isFinite(snapped.heading) ? snapped.heading : (Number(current.heading) || 0);
    const forward = pointAhead(position, heading, 30);
    map.easeTo({ center: [forward.lon, forward.lat], zoom: Math.max(map.getZoom(), 18), bearing: -heading, duration: 520, essential: true });
  }, [current, destination, route, progress]);

  return <div ref={containerRef} className="nova-maplibre" aria-label="NOVA driving map" />;
}
