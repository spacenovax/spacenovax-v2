// Orbit Module — shared location adapter.
// Telegram Mini Apps use Telegram's native LocationManager. Standard web/PWA
// sessions use only the browser Geolocation API. Both providers are normalized
// before being passed to World Navigation and the globe.

const R_KM = 6371;
const GPS_OPTIONS = { enableHighAccuracy: true, timeout: 12_000, maximumAge: 12_000 };
const TELEGRAM_POLL_MS = 6_000;

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

const finite = (value) => (Number.isFinite(value) ? value : null);

function positionFromCoordinates(coords, provider = 'web') {
  const heading = finite(coords.heading);
  return {
    lat: Number(coords.latitude),
    lon: Number(coords.longitude),
    accuracy: finite(coords.accuracy),
    altitude: finite(coords.altitude),
    heading: heading == null ? null : (heading + 360) % 360,
    speedMps: finite(coords.speed),
    capturedAt: Date.now(),
    provider,
  };
}

function telegramApp() {
  return window.Telegram?.WebApp || null;
}

function telegramLocationManager() {
  const app = telegramApp();
  return app?.LocationManager || app?.locationManager || null;
}

export function locationProvider() {
  return telegramApp()?.initData ? 'telegram' : 'web';
}

function initTelegramLocationManager(manager) {
  return new Promise((resolve, reject) => {
    if (!manager?.init || !manager?.getLocation) return reject(new Error('telegram_location_unsupported'));
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve();
    };
    try {
      manager.init(() => {
        if (manager.isLocationAvailable === false) finish(new Error('telegram_location_unavailable'));
        else finish();
      });
      window.setTimeout(() => finish(new Error('telegram_location_timeout')), 8_000);
    } catch { finish(new Error('telegram_location_unavailable')); }
  });
}

async function getTelegramPosition() {
  const manager = telegramLocationManager();
  await initTelegramLocationManager(manager);
  return new Promise((resolve, reject) => {
    try {
      manager.getLocation((location) => {
        if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
          reject(new Error(manager.isAccessGranted === false ? 'telegram_location_denied' : 'telegram_location_unavailable'));
          return;
        }
        resolve(positionFromCoordinates({
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          accuracy: Number(location.horizontal_accuracy ?? location.accuracy),
          altitude: Number(location.altitude),
          heading: Number(location.course ?? location.heading),
          speed: Number(location.speed),
        }, 'telegram'));
      });
    } catch { reject(new Error('telegram_location_unavailable')); }
  });
}

function getBrowserPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('geolocation_unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(positionFromCoordinates(pos.coords, 'web')),
      reject,
      { ...GPS_OPTIONS, ...options }
    );
  });
}

export function getCurrentPosition(options = {}) {
  // Do not mix browser and Telegram permissions within a Mini App. This keeps
  // Telegram-only World Navigation permission behaviour predictable.
  return locationProvider() === 'telegram' ? getTelegramPosition() : getBrowserPosition(options);
}

// Telegram LocationManager provides discrete native location requests, whereas
// browsers expose watchPosition. Poll Telegram at a restrained interval and
// normalize both pathways to the same callback contract.
export function watchCurrentPosition(onPosition, onError = () => {}, options = {}) {
  if (locationProvider() === 'telegram') {
    let active = true;
    let busy = false;
    const poll = async () => {
      if (!active || busy) return;
      busy = true;
      try { onPosition(await getTelegramPosition()); }
      catch (error) { if (active) onError(error); }
      finally { busy = false; }
    };
    poll();
    const timer = window.setInterval(poll, TELEGRAM_POLL_MS);
    return () => { active = false; window.clearInterval(timer); };
  }
  if (!navigator.geolocation) { onError(new Error('geolocation_unsupported')); return () => {}; }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onPosition(positionFromCoordinates(pos.coords, 'web')),
    onError,
    { ...GPS_OPTIONS, ...options }
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
