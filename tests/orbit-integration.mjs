import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const appSource = fs.readFileSync(new URL('../src/V15App.jsx', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const requiredFiles = [
  'src/orbit/EarthEngine.js',
  'src/orbit/SatelliteEngine.js',
  'src/orbit/OrbitV20/OrbitV20.jsx',
  'src/orbit/OrbitV20/OrbitRouteTelemetry.jsx',
  'src/orbit/OrbitV20/OrbitDrivingView.jsx',
  'src/orbit/OrbitV20/OrbitMiningMap.jsx',
  'src/pwa.js',
  'src/orbit/OrbitV20/OrbitSatellite.jsx',
  'src/orbit/OrbitV20/OrbitEvents.jsx',
  'src/orbit/OrbitV20/orbit-v20.css',
  'public/orbit/earth-day-real.webp',
  'public/orbit/earth-day-4k.jpg',
  'public/orbit/earth-day-8k.jpg',
  'public/orbit/earth-night-real.webp',
  'public/orbit/earth-clouds-real.webp',
  'public/manifest.webmanifest',
  'public/sw.js',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(new URL(file, root))) throw new Error(`Orbit integration file missing: ${file}`);
}

if (!appSource.includes("lazy(() => import('./orbit/OrbitV20/OrbitV20.jsx'))")
  || !appSource.includes("tab === 'orbit'")
  || !appSource.includes("tab !== 'orbit'")
  || !appSource.includes("['orbit','globe',orbitLabel,isKorean ? '네비' : 'Orbit']")) {
  throw new Error('Orbit route, lazy loading, or navigation integration is missing.');
}

if (!serverSource.includes("app.get('/api/orbit/satellites'")
  || !serverSource.includes("app.get('/api/orbit/geocode'")
  || !serverSource.includes("app.get('/api/orbit/route'")
  || !serverSource.includes('Orbit Earth Navigation live context')) {
  throw new Error('Orbit server proxy or NOVA context integration is missing.');
}

if (!serverSource.includes("app.get('/api/orbit/satellite-imagery'")
  || !serverSource.includes('MODIS_Terra_CorrectedReflectance_TrueColor')
  || !serverSource.includes('ORBIT_SATELLITE_CACHE_MS')
  || !serverSource.includes('metadataOnly')) {
  throw new Error('Orbit NASA GIBS satellite imagery proxy and cache are missing.');
}

if (!serverSource.includes('geolocation=(self)')) {
  throw new Error('Orbit must permit same-origin device geolocation so Telegram can show the location permission prompt.');
}

if (!serverSource.includes('namedetails=1')
  || !fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitV20.jsx', import.meta.url), 'utf8').includes('searchDestination(q, language, { near })')
  || !fs.readFileSync(new URL('../src/orbit/api.js', import.meta.url), 'utf8').includes('lang=${encodeURIComponent(language)}')) {
  throw new Error('Orbit localized destination search is missing.');
}

if (!packageJson.dependencies?.three || !packageJson.dependencies?.['satellite.js']) {
  throw new Error('Orbit runtime dependencies are missing.');
}

const orbitSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitV20.jsx', import.meta.url), 'utf8');
const earthViewSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitEarthView.jsx', import.meta.url), 'utf8');
const earthEngineSource = fs.readFileSync(new URL('../src/orbit/EarthEngine.js', import.meta.url), 'utf8');
const routeSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitRouteTelemetry.jsx', import.meta.url), 'utf8');
const drivingViewSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitDrivingView.jsx', import.meta.url), 'utf8');
const searchOverlaySource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitSearchOverlay.jsx', import.meta.url), 'utf8');
const satelliteSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitSatellite.jsx', import.meta.url), 'utf8');
const eventSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitEvents.jsx', import.meta.url), 'utf8');
const liteSource = fs.readFileSync(new URL('../src/orbit/navigationLite.js', import.meta.url), 'utf8');
const liteStoreSource = fs.readFileSync(new URL('../src/orbit/navigationLiteStore.js', import.meta.url), 'utf8');
const miningMapSource = fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitMiningMap.jsx', import.meta.url), 'utf8');
const pwaSource = fs.readFileSync(new URL('../src/pwa.js', import.meta.url), 'utf8');
const manifestSource = fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
const serviceWorkerSource = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

if (!orbitSource.includes('setIssPosition')
  || !orbitSource.includes('setSatellites')
  || !orbitSource.includes('markerTargets')
  || !orbitSource.includes("type: 'typhoon'")
  || !orbitSource.includes("type: 'satellite'")
  || !orbitSource.includes('<OrbitRouteTelemetry')) {
  throw new Error('Orbit live satellite and route telemetry UI integration is missing.');
}

if (!orbitSource.includes('fetchDrivingRoute')
  || !earthEngineSource.includes('setRoadRoute')
  || !routeSource.includes('DRIVING ROUTE')) {
  throw new Error('Orbit driving navigation integration is missing.');
}

if (!earthEngineSource.includes('setSatelliteImagery')
  || !earthEngineSource.includes('/api/orbit/satellite-imagery')
  || !orbitSource.includes('satelliteLayer')
  || !satelliteSource.includes('NASA GIBS')) {
  throw new Error('Orbit real NASA satellite-view layer integration is missing.');
}

if (!orbitSource.includes('<OrbitDrivingView')
  || !drivingViewSource.includes('MapContainer')
  || !drivingViewSource.includes('NOVA LITE · GPS GUIDANCE')
  || !drivingViewSource.includes('MapControls')
  || !drivingViewSource.includes('routeArrow')) {
  throw new Error('Orbit 2D driving guidance view is missing.');
}

if (!drivingViewSource.includes('lastFollowedPosition')
  || !drivingViewSource.includes('const followZoom = lowDataMode ? 16 : 17')
  || !drivingViewSource.includes('map.setView([current.lat, current.lon], followZoom')
  || !orbitSource.includes('nextDrivingStep')) {
  throw new Error('Orbit live GPS map follow or next-maneuver guidance is missing.');
}

if (!orbitSource.includes('createNavigationProfile')
  || !orbitSource.includes('guidanceSpeech')
  || !orbitSource.includes("requestRouteRefresh('off-route')")
  || !serverSource.includes("const fresh = req.query.fresh === '1'")
  || !serverSource.includes('maneuverLocation')) {
  throw new Error('Orbit Lite turn prompts or off-route rerouting integration is missing.');
}

if (!liteSource.includes('navigationMessage')
  || !liteSource.includes("ar: {")
  || !orbitSource.includes('loadCompatibleLiteRoute')
  || !liteStoreSource.includes('MAX_ROUTE_AGE_MS')
  || !drivingViewSource.includes('maxNativeZoom={lowDataMode ? 16 : 19}')
  || !drivingViewSource.includes('useScreenWakeLock')) {
  throw new Error('Orbit Lite multilingual, saved-route, low-data, or screen-awake support is missing.');
}

if (!serverSource.includes("app.post('/api/orbit/navigation-report'")
  || !serverSource.includes('NAVIGATION_REPORT_DAILY_LIMIT')
  || !serverSource.includes('latitude.toFixed(3)')
  || !drivingViewSource.includes('MAP ISSUE REPORT')) {
  throw new Error('Orbit Lite privacy-preserving map report support is missing.');
}

if (!orbitSource.includes('gpsRetry')
  || !fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitCurrentPosition.jsx', import.meta.url), 'utf8').includes('Allow location access')) {
  throw new Error('Orbit GPS permission fallback must not present a default map point as a live location.');
}

if (!searchOverlaySource.includes('BrowserSpeechProvider')
  || !searchOverlaySource.includes('toggleVoiceSearch')
  || !searchOverlaySource.includes('ov20-search-mic')) {
  throw new Error('Orbit voice destination search is missing.');
}

if (!earthViewSource.includes('ov20-marker-pin')
  || !earthViewSource.includes("type === 'base'")
  || !earthViewSource.includes("type === 'typhoon'")
  || !earthViewSource.includes("type === 'satellite'")) {
  throw new Error('Orbit semantic 3D marker overlay integration is missing.');
}

if (!earthEngineSource.includes('zoomProgress')
  || !earthEngineSource.includes('expanded: zoomProgress')
  || !orbitSource.includes('markerUpdateAt')) {
  throw new Error('Orbit responsive marker projection or render throttling is missing.');
}

if (!orbitSource.includes('<OrbitHUD')
  || !orbitSource.includes('ov20-mobile-drawer')
  || !orbitSource.includes('ov20-desktop-panels')) {
  throw new Error('Orbit mobile full-globe HUD and detail drawer are missing.');
}

if (!orbitSource.includes('const TOP_TAB_PANELS')
  || !orbitSource.includes("event: 'events'")
  || !orbitSource.includes("base: 'base'")
  || !orbitSource.includes("hudPanel === 'base'")) {
  throw new Error('Orbit top controls must open their matching mobile telemetry cards.');
}

if (!orbitSource.includes('<OrbitMiningMap')
  || !miningMapSource.includes('SPNX MINING MAP')
  || !miningMapSource.includes('navigation-explore')
  || !miningMapSource.includes('openTelegramLink')
  || !serverSource.includes("'navigation-explore'")) {
  throw new Error('Orbit public Mining Map and opt-in sponsor placement are missing.');
}

if (!pwaSource.includes('beforeinstallprompt')
  || !pwaSource.includes("register('/sw.js'")
  || !manifestSource.includes('NOVA Guided Navigation Lite')
  || !serviceWorkerSource.includes("url.pathname.startsWith('/api/')")
  || !miningMapSource.includes('requestPwaInstall')) {
  throw new Error('Orbit public web PWA install and privacy-safe cache support are missing.');
}

if (!searchOverlaySource.includes('QUICK_DESTINATIONS')
  || !searchOverlaySource.includes('hospital')
  || !searchOverlaySource.includes('airport')
  || !orbitSource.includes('selectQuickDestination')
  || !serverSource.includes('nearLat')
  || !fs.readFileSync(new URL('../src/orbit/api.js', import.meta.url), 'utf8').includes('nearbyParams')) {
  throw new Error('Orbit quick destinations and nearby search support are missing.');
}

if (!routeSource.includes('onShareRoute')
  || !orbitSource.includes('shareRouteSafely')
  || !orbitSource.includes('current location is not included')
  || !drivingViewSource.includes('gpsSignalWeak')
  || !fs.readFileSync(new URL('../src/orbit/OrbitV20/OrbitCurrentPosition.jsx', import.meta.url), 'utf8').includes('ov20-gps-signal-note')) {
  throw new Error('Orbit safe route sharing or weak GPS guidance support is missing.');
}

if (!earthEngineSource.includes("'/orbit/earth-day-nasa.jpg'")
  || !earthEngineSource.includes("'/orbit/earth-day-4k.jpg'")
  || !earthEngineSource.includes("'/orbit/earth-day-8k.jpg'")
  || !earthEngineSource.includes('maxTextureSize >= 8192')
  || !earthEngineSource.includes('_updateTextureLOD')) {
  throw new Error('Orbit 4K/8K texture LOD integration is missing.');
}

if (earthEngineSource.includes('opacity: 0.85, depthTest: false')
  || !earthEngineSource.includes('opacity: 0.85, depthTest: true, depthWrite: false')) {
  throw new Error('Typhoon swirls must be depth-tested so they cannot show through the far side of the globe.');
}

if (earthEngineSource.includes("loader.load(\n      '/orbit/earth-clouds-real.webp'")
  || !earthEngineSource.includes("'2K · SAFE'")) {
  throw new Error('Orbit must use a validated 2K safety surface and avoid truncated cloud assets.');
}

if (!earthEngineSource.includes('nightAmbient')
  || !earthEngineSource.includes('readableNight')
  || !earthEngineSource.includes('vec3(0.026, 0.082, 0.175)')) {
  throw new Error('Orbit mobile night-side visibility fallback is missing.');
}

if (!routeSource.includes('NOVA GLOBAL NAVIGATION')
  || !routeSource.includes('distanceKm')
  || !satelliteSource.includes('satellites.slice(0, 3)')
  || !eventSource.includes('topEvents')) {
  throw new Error('Orbit telemetry panel details are missing.');
}

console.log(JSON.stringify({
  orbitRoute: true,
  lazyLoaded: true,
  earthAssets: true,
  satelliteProxy: true,
  geocodeProxy: true,
  novaOrbitContext: true,
  liveSatelliteTelemetry: true,
  routeTelemetry: true,
}));
