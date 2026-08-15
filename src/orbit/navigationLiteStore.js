// Device-local support for NOVA Guided Navigation Lite.  This is deliberately
// not sold as an offline-map product: it stores only the captain's last route
// and preference for a low-data display, and never uploads either one.
import { distanceMeters } from './navigationLite.js';

const ROUTE_KEY = 'spnx_orbit_lite_saved_route_v1';
const LOW_DATA_KEY = 'spnx_orbit_lite_low_data_v1';
const MAX_ROUTE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DESTINATION_MATCH_M = 750;
const ORIGIN_MATCH_M = 3000;

function storage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

function validPoint(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lon);
}

function compactPoint(point) {
  return validPoint(point) ? { lat: Number(point.lat.toFixed(6)), lon: Number(point.lon.toFixed(6)) } : null;
}

function compactRoute(route) {
  if (!route || !Array.isArray(route.points)) return null;
  const points = route.points.map(compactPoint).filter(Boolean).slice(0, 720);
  if (points.length < 2) return null;
  const steps = (route.steps || []).slice(0, 90).map((step) => ({
    name: String(step?.name || '').slice(0, 120),
    distanceM: Number(step?.distanceM || 0),
    durationSec: Number(step?.durationSec || 0),
    maneuver: {
      type: String(step?.maneuver?.type || '').slice(0, 40),
      modifier: String(step?.maneuver?.modifier || '').slice(0, 40),
      location: compactPoint(step?.maneuver?.location),
    },
  }));
  return {
    distanceM: Number(route.distanceM || 0),
    durationSec: Number(route.durationSec || 0),
    points,
    steps,
  };
}

export function getLowDataMode() {
  return storage()?.getItem(LOW_DATA_KEY) === '1';
}

export function setLowDataMode(enabled) {
  const store = storage();
  if (!store) return Boolean(enabled);
  try { store.setItem(LOW_DATA_KEY, enabled ? '1' : '0'); } catch { /* storage can be disabled in private webviews */ }
  return Boolean(enabled);
}

export function saveLiteRoute({ route, origin, destination }) {
  const store = storage();
  const safeRoute = compactRoute(route);
  const safeOrigin = compactPoint(origin);
  const safeDestination = compactPoint(destination);
  if (!store || !safeRoute || !safeOrigin || !safeDestination) return null;
  const saved = {
    version: 1,
    savedAt: Date.now(),
    origin: safeOrigin,
    destination: { ...safeDestination, label: String(destination.label || '').slice(0, 120) },
    route: safeRoute,
  };
  try { store.setItem(ROUTE_KEY, JSON.stringify(saved)); } catch { return null; }
  return saved;
}

export function loadCompatibleLiteRoute({ current, destination, maxAgeMs = MAX_ROUTE_AGE_MS } = {}) {
  const store = storage();
  if (!store || !validPoint(current) || !validPoint(destination)) return null;
  try {
    const saved = JSON.parse(store.getItem(ROUTE_KEY) || 'null');
    if (!saved?.savedAt || Date.now() - Number(saved.savedAt) > maxAgeMs) return null;
    if (!validPoint(saved.origin) || !validPoint(saved.destination) || !compactRoute(saved.route)) return null;
    if (distanceMeters(destination, saved.destination) > DESTINATION_MATCH_M) return null;
    if (distanceMeters(current, saved.origin) > ORIGIN_MATCH_M) return null;
    return { ...saved, route: compactRoute(saved.route) };
  } catch { return null; }
}

