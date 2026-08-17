// Device-local offline region route packs for NOVA Guided Navigation Lite.
// They contain captain-selected routes only — never downloaded public map tiles.
export const OFFLINE_REGION_PACK_LIMIT = 3;
export const OFFLINE_REGION_PACK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const KEY = 'spnx_orbit_offline_region_packs_v1';
const DESTINATION_MATCH_M = 750;
const ORIGIN_MATCH_M = 3000;

function distanceMeters(a, b) {
  if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lon) || !Number.isFinite(b?.lat) || !Number.isFinite(b?.lon)) return Infinity;
  const toRadians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRadians;
  const dLon = (b.lon - a.lon) * toRadians;
  const lat1 = a.lat * toRadians;
  const lat2 = b.lat * toRadians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function store() { try { return window.localStorage; } catch { return null; } }
function point(value) {
  return Number.isFinite(value?.lat) && Number.isFinite(value?.lon)
    ? { lat: Number(value.lat.toFixed(6)), lon: Number(value.lon.toFixed(6)) }
    : null;
}
function routeValue(route) {
  if (!Array.isArray(route?.points)) return null;
  const points = route.points.map(point).filter(Boolean).slice(0, 720);
  if (points.length < 2) return null;
  return {
    distanceM: Number(route.distanceM || 0), durationSec: Number(route.durationSec || 0), points,
    steps: (route.steps || []).slice(0, 90),
  };
}
function valid(pack, now) {
  return Boolean(pack?.id && Number.isFinite(pack.savedAt) && now - pack.savedAt <= OFFLINE_REGION_PACK_MAX_AGE_MS
    && point(pack.origin) && point(pack.destination) && routeValue(pack.route));
}

export function listOfflineRegionPacks(now = Date.now()) {
  const storage = store();
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(KEY) || '[]');
    const packs = (Array.isArray(raw) ? raw : []).filter((pack) => valid(pack, now)).sort((a, b) => b.savedAt - a.savedAt);
    if (!Array.isArray(raw) || packs.length !== raw.length) storage.setItem(KEY, JSON.stringify(packs));
    return packs;
  } catch { return []; }
}

export function saveOfflineRegionPack({ route, origin, destination, savedAt = Date.now() }) {
  const storage = store();
  const safeRoute = routeValue(route); const safeOrigin = point(origin); const safeDestination = point(destination);
  if (!storage || !safeRoute || !safeOrigin || !safeDestination) return null;
  const pack = {
    id: `region-${safeDestination.lat.toFixed(4)}-${safeDestination.lon.toFixed(4)}-${savedAt}`,
    savedAt, origin: safeOrigin,
    destination: { ...safeDestination, id: String(destination.id || ''), label: String(destination.label || '').slice(0, 120) },
    route: safeRoute,
  };
  try {
    const previous = listOfflineRegionPacks(savedAt).filter((item) => distanceMeters(item.destination, safeDestination) > DESTINATION_MATCH_M);
    storage.setItem(KEY, JSON.stringify([pack, ...previous].slice(0, OFFLINE_REGION_PACK_LIMIT)));
    return pack;
  } catch { return null; }
}

export function removeOfflineRegionPack(id) {
  const storage = store(); if (!storage) return false;
  try { storage.setItem(KEY, JSON.stringify(listOfflineRegionPacks().filter((pack) => pack.id !== id))); return true; } catch { return false; }
}

export function loadCompatibleOfflineRegionPack({ current, destination, now = Date.now() } = {}) {
  const safeCurrent = point(current); const safeDestination = point(destination);
  if (!safeCurrent || !safeDestination) return null;
  const pack = listOfflineRegionPacks(now).find((item) => distanceMeters(item.destination, safeDestination) <= DESTINATION_MATCH_M
    && distanceMeters(item.origin, safeCurrent) <= ORIGIN_MATCH_M);
  return pack ? { ...pack, route: { ...routeValue(pack.route), source: 'offline-pack', savedAt: pack.savedAt } } : null;
}

export function formatOfflinePackAge(ageMs, ko) {
  const minutes = Math.max(0, Math.round(Number(ageMs || 0) / 60000));
  if (minutes < 60) return ko ? `${minutes}분 전` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? (ko ? `${hours}시간 전` : `${hours}h ago`) : (ko ? `${Math.round(hours / 24)}일 전` : `${Math.round(hours / 24)}d ago`);
}
