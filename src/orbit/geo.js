// Orbit Module — Navigation / geodesy helpers (structure for future full routing).
// Only current position, saved Captain Base points, distance, and bearing today —
// no turn-by-turn routing yet, as specified.

const R_KM = 6371;

export function toRad(d) { return (d * Math.PI) / 180; }
export function toDeg(r) { return (r * 180) / Math.PI; }

export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a, b) {
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function positionFromCoordinates(coords) {
  const finite = (value) => (Number.isFinite(value) ? value : null);
  const heading = finite(coords.heading);
  return { lat: coords.latitude, lon: coords.longitude, accuracy: finite(coords.accuracy), altitude: finite(coords.altitude), heading: heading == null ? null : (heading + 360) % 360, speedMps: finite(coords.speed), capturedAt: Date.now() };
}

const GPS_OPTIONS = { enableHighAccuracy: true, timeout: 12_000, maximumAge: 12_000 };
const LOCATION_CACHE_KEY = 'spnx-orbit-last-location-v1';
const SESSION_LOCATION_CACHE_KEY = 'spnx-orbit-session-location-v1';
const LOCATION_CACHE_MAX_AGE_MS = 20 * 60 * 1000;
const SESSION_LOCATION_CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000;

function cachedPosition(key, maxAge) {
  try {
    const parsed = JSON.parse(window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key) || 'null');
    if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon) || !Number.isFinite(parsed.capturedAt)) return null;
    return Date.now() - parsed.capturedAt <= maxAge ? parsed : null;
  } catch { return null; }
}

function readLastPosition() {
  return cachedPosition(SESSION_LOCATION_CACHE_KEY, SESSION_LOCATION_CACHE_MAX_AGE_MS)
    || cachedPosition(LOCATION_CACHE_KEY, LOCATION_CACHE_MAX_AGE_MS);
}

function rememberPosition(position) {
  try {
    const value = JSON.stringify(position);
    window.sessionStorage?.setItem(SESSION_LOCATION_CACHE_KEY, value);
    window.localStorage?.setItem(LOCATION_CACHE_KEY, value);
  } catch {}
  return position;
}

function geoOptions(options) {
  const { force = false, ...nativeOptions } = options || {};
  return { force, nativeOptions };
}

export function getCurrentPosition(options = {}) {
  const { force, nativeOptions } = geoOptions(options);
  const cached = !force ? readLastPosition() : null;
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('geolocation_unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(rememberPosition(positionFromCoordinates(pos.coords))),
      (err) => reject(err),
      { ...GPS_OPTIONS, ...nativeOptions }
    );
  });
}

// Reusing a verified position prevents Telegram WebView from showing the same
// native permission prompt again when a captain returns to the Orbit page.
export function watchCurrentPosition(onPosition, onError = () => {}, options = {}) {
  const { force, nativeOptions } = geoOptions(options);
  const cached = !force ? readLastPosition() : null;
  if (cached) {
    onPosition(cached);
    return () => {};
  }
  if (!navigator.geolocation) { onError(new Error('geolocation_unsupported')); return () => {}; }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onPosition(rememberPosition(positionFromCoordinates(pos.coords))),
    onError,
    { ...GPS_OPTIONS, ...nativeOptions }
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
