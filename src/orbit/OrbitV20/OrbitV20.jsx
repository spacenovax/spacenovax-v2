// Orbit V21 FINAL — main container. Owns ALL state, effects, and engine wiring; every
// other file in this folder is a presentational component that receives props from here.
// Engines (EarthEngine, SatelliteEngine, MasterRenderLoop, PerformanceManager) and data
// logic (api.js, geo.js, captainBase.js) are untouched — only how the UI around them is
// organized and styled. Bottom Sheet is abolished per the Final Design Specification:
// Left/Right HUD panels are now always visible, no hide/show.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import EarthEngine from '../EarthEngine.js';
import MasterRenderLoop from '../MasterRenderLoop.js';
import SatelliteEngine from '../SatelliteEngine.js';
import PerformanceManager from '../PerformanceManager.js';
import { BrowserSpeechProvider } from '../../nova/voice/BrowserSpeechProvider.js';
import { fetchWeather, fetchAirQuality, fetchEarthquakes, fetchEonetEvents, reverseGeocode, searchDestination, fetchNearbyPlaces, fetchDrivingRoute } from '../api.js';
import { getCurrentPosition, watchCurrentPosition, haversineKm, bearingDeg, compassLabel } from '../geo.js';
import { createNavigationProfile, getNavigationProgress, guidanceSpeech, maneuverLabel, navigationMessage } from '../navigationLite.js';
import { getLowDataMode, loadCompatibleLiteRoute, saveLiteRoute, setLowDataMode as persistLowDataMode } from '../navigationLiteStore.js';
import { getCaptainBase, setBasePoint, addFavorite } from '../captainBase.js';
import OrbitTopBar from './OrbitTopBar.jsx';
import OrbitEarthView from './OrbitEarthView.jsx';
import OrbitLeftPanel from './OrbitLeftPanel.jsx';
import OrbitRightPanel from './OrbitRightPanel.jsx';
import OrbitHUD from './OrbitHUD.jsx';
import OrbitCurrentPosition from './OrbitCurrentPosition.jsx';
import OrbitSatellite from './OrbitSatellite.jsx';
import OrbitDestination from './OrbitDestination.jsx';
import OrbitWeather from './OrbitWeather.jsx';
import OrbitEvents from './OrbitEvents.jsx';
import OrbitRouteTelemetry from './OrbitRouteTelemetry.jsx';
import OrbitDrivingView from './OrbitDrivingView.jsx';
import OrbitOfflineRegionPacks from './OrbitOfflineRegionPacks.jsx';
import OrbitFloatingNova from './OrbitFloatingNova.jsx';
import OrbitBottomBar from './OrbitBottomBar.jsx';
import OrbitSearchOverlay from './OrbitSearchOverlay.jsx';
import OrbitMiningMap from './OrbitMiningMap.jsx';
import { listOfflineRegionPacks, loadCompatibleOfflineRegionPack, removeOfflineRegionPack, saveOfflineRegionPack } from '../navigationOfflinePacks.js';
import './orbit-v20.css';

function getOrbitClientId() {
  const key = 'spnx_client_id_v1';
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID?.() || `spnx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

async function orbitApi(path, body) {
  const initData = window.Telegram?.WebApp?.initData || '';
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SPNX-Client-ID': getOrbitClientId(), ...(initData ? { 'X-Telegram-Init-Data': initData } : {}) },
    body: JSON.stringify({ ...body, clientId: getOrbitClientId() }),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.message || 'Request failed');
  return data;
}

const orbitSpeech = new BrowserSpeechProvider();
function speakOrbit(text, language, onStateChange) {
  return orbitSpeech.speak({ text, language, rate: 1, onStart: () => onStateChange?.('playing'), onEnd: () => onStateChange?.('idle'), onError: () => onStateChange?.('idle') });
}

// i18n only — Korean stays 100% Korean, English stays 100% English, no mixing.
function useCopy(language) {
  const ko = language === 'ko';
  return useMemo(() => ({
    ko,
    currentPosition: 'CURRENT POSITION', gps: 'GPS', heading: ko ? '방위' : 'HEADING', accuracy: ko ? '정확도' : 'ACCURACY', satellites: ko ? '위성' : 'SATELLITES', altitude: ko ? '고도' : 'ALTITUDE',
    myLocation: ko ? '내 위치로 이동' : 'Move to my location',
    satellitesTitle: 'SATELLITES', tracked: ko ? '추적 중' : 'TRACKED',
    earthEvents: 'EARTH EVENTS', typhoon: ko ? '태풍' : 'Typhoon', quake: ko ? '지진' : 'Earthquake', volcano: ko ? '화산' : 'Volcano', wildfire: ko ? '산불' : 'Wildfire',
    destination: 'DESTINATION', searchPlaceholder: ko ? '목적지 검색...' : 'Search destination…',
    findDestination: ko ? '목적지 찾기' : 'Find destination',
    searchTitle: ko ? '어디로 가시겠습니까?' : 'Where would you like to go?',
    searchHint: ko ? '도시, 주소 또는 장소를 입력하세요.' : 'Enter a city, address, or place.',
    voiceSearch: ko ? '음성으로 목적지 말하기' : 'Speak destination', voiceListening: ko ? '듣는 중입니다. 목적지를 말씀해 주세요.' : 'Listening. Say your destination.', voiceUnavailable: ko ? '이 기기 또는 텔레그램에서는 음성 인식을 사용할 수 없습니다.' : 'Voice recognition is unavailable in this browser.',
    recent: ko ? '최근 목적지' : 'RECENT DESTINATIONS',
    noResults: ko ? '검색 결과가 없습니다.' : 'No destinations found.',
    searching: ko ? '전 세계 목적지를 검색하고 있습니다…' : 'Searching destinations worldwide…',
    close: ko ? '닫기' : 'Close', changeDestination: ko ? '목적지 변경' : 'Change destination',
    distance: ko ? '거리' : 'DISTANCE', eta: 'ETA', course: ko ? '방위각' : 'COURSE',
    weather: ko ? '날씨' : 'WEATHER', wind: ko ? '풍속' : 'Wind', humidity: ko ? '습도' : 'Humidity', air: ko ? '대기질' : 'Air quality',
    online: 'ONLINE', connected: 'CONNECTED', ready: 'READY',
    system: ko ? '시스템' : 'SYSTEM', network: ko ? '네트워크' : 'NETWORK', dataRate: ko ? '데이터 속도' : 'DATA RATE', uptime: ko ? '가동시간' : 'UPTIME', version: ko ? '버전' : 'VERSION',
    nominal: ko ? '전체 시스템 정상' : 'ALL SYSTEMS NOMINAL', stable: ko ? '안정' : 'STABLE', offline: ko ? '오프라인' : 'OFFLINE',
    captainBase: ko ? '캡틴 베이스' : 'CAPTAIN BASE', setHome: ko ? '집 저장' : 'Save Home', setWork: ko ? '회사 저장' : 'Save Work', notSet: '—',
    gpsLive: ko ? 'GPS 실시간 연결' : 'GPS LIVE', gpsLocating: ko ? 'GPS 위치 확인 중' : 'LOCATING GPS', gpsUnavailable: ko ? 'GPS 위치 확인 필요' : 'GPS CHECK REQUIRED',
    gpsSignalWeak: ko ? 'GPS 신호 약함' : 'WEAK GPS SIGNAL', gpsPermissionHint: ko ? '위치 권한을 허용한 뒤 다시 시도해 주세요.' : 'Allow location access, then try again.',
    quickDestinations: ko ? '빠른 목적지' : 'QUICK DESTINATIONS',
    shareRoute: ko ? '공유' : 'SHARE', routeShared: ko ? '목적지 경로를 공유했습니다.' : 'Destination route shared.', routeCopied: ko ? '목적지 경로를 복사했습니다.' : 'Destination route copied.',
    offlineGuidance: ko ? '연결 없음 · 저장된 경로만 확인' : 'OFFLINE · CHECK SAVED ROUTE',
    startNavigation: ko ? '목적지 이동' : 'Start navigation', endNavigation: ko ? '경로 안내 종료' : 'End navigation', liveGuidance: ko ? '실시간 방향 안내' : 'LIVE GUIDANCE', arrived: ko ? '목적지 도착' : 'ARRIVED', remaining: ko ? '남은 거리' : 'REMAINING',
  }), [ko]);
}

function aqiLabel(v, ko) {
  if (v == null) return { text: '—', cls: '' };
  if (v <= 40) return { text: ko ? '좋음' : 'Good', cls: 'ok' };
  if (v <= 80) return { text: ko ? '보통' : 'Fair', cls: '' };
  return { text: ko ? '나쁨' : 'Poor', cls: '' };
}

function coordinateDestination(query, ko) {
  // Latitude, longitude is a useful zero-network navigation entry point for pilots,
  // travelers, and users who received a pin rather than a place name.
  const match = String(query || '').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const coords = `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
  return {
    id: `coord_${lat.toFixed(5)}_${lon.toFixed(5)}`,
    label: ko ? `좌표 · ${coords}` : `Coordinates · ${coords}`,
    country: ko ? '직접 입력 좌표' : 'Manual coordinates',
    lat,
    lon,
  };
}

function eventKind(category = '') {
  if (/wildfire/i.test(category)) return 'wildfire';
  if (/volcano/i.test(category)) return 'volcano';
  if (/storm|cyclone|typhoon|hurricane/i.test(category)) return 'typhoon';
  return 'other';
}

const TOP_TAB_PANELS = {
  satellite: 'satellite',
  weather: 'weather',
  event: 'events',
  base: 'base',
};
// EONET may publish a storm coordinate before an official public name is available.
// Keep those unlabelled systems out of the captain map: a named, active system is far
// more useful than a row of identical decorative swirls.
function officialStormName(title = '') {
  const raw = String(title || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const name = raw
    .replace(/^(?:tropical\s+(?:storm|cyclone|depression)|super\s+typhoon|typhoon|hurricane)\s+/i, '')
    .trim();
  const generic = /^(?:unnamed|unknown|event|storm|cyclone|tropical\s+(?:storm|cyclone|depression)|typhoon|hurricane|disturbance|invest(?:\s*\d+[a-z]{0,2})?|\d{1,3}[a-z]{0,3})$/i;
  const hasName = /[a-z]{3,}/i.test(name);
  return hasName && !generic.test(name) ? name.slice(0, 28) : '';
}

// OSRM returns a small initial "depart" step before the first actual turn.  The
// navigation HUD should announce the upcoming maneuver, not repeatedly tell a
// moving Captain that the trip has merely started.
function nextDrivingStep(route, navigationProgress = null) {
  if (navigationProgress?.nextStep) return navigationProgress.nextStep;
  const steps = route?.steps || [];
  return steps.find((step) => !['depart', 'arrive'].includes(String(step?.maneuver?.type || '').toLowerCase())) || steps[0] || null;
}

export default function OrbitV20({ language, user, onOpenMining }) {
  const t = useCopy(language);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const perfRef = useRef(null);
  const [voiceState, setVoiceState] = useState('idle');
  const [hudPanel, setHudPanel] = useState(null);
  const [earthQuality, setEarthQuality] = useState('2K · LOADING');
  const [satelliteLayer, setSatelliteLayer] = useState({ enabled: false, status: 'idle', date: '' });

  const [tab, setTab] = useState('live');
  const [clock, setClock] = useState(new Date());
  const [current, setCurrent] = useState(null);
  const [currentPlace, setCurrentPlace] = useState(null);
  const [heading, setHeading] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [gpsState, setGpsState] = useState('locating');
  const [gpsRetry, setGpsRetry] = useState(0);
  const [issTracked, setIssTracked] = useState(0);
  const [otherTracked, setOtherTracked] = useState(0);
  const [issPosition, setIssPosition] = useState(null);
  const [satellites, setSatellites] = useState([]);
  const [weather, setWeather] = useState(null);
  const [aqi, setAqi] = useState(null);
  const [events, setEvents] = useState([]);
  const [destination, setDestination] = useState(null);
  const [drivingRoute, setDrivingRoute] = useState(null);
  const [routeStatus, setRouteStatus] = useState('idle');
  const [offlinePacksOpen, setOfflinePacksOpen] = useState(false);
  const [offlinePacks, setOfflinePacks] = useState(() => listOfflineRegionPacks());
  const [lowDataMode, setLowDataMode] = useState(() => getLowDataMode());
  const [routeRefreshNonce, setRouteRefreshNonce] = useState(0);
  const [navigationActive, setNavigationActive] = useState(false);
  const [guidanceSafetyState, setGuidanceSafetyState] = useState('ready');
  const [drivingViewOpen, setDrivingViewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyAnchor, setNearbyAnchor] = useState(null);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyCategory, setNearbyCategory] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [miningMapOpen, setMiningMapOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [recentDestinations, setRecentDestinations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('spnx_orbit_recent_v1') || '[]'); } catch { return []; }
  });
  const [base, setBase] = useState(() => getCaptainBase());
  const [markerPos, setMarkerPos] = useState({});
  const [novaOpen, setNovaOpen] = useState(false);
  const [novaDragPos, setNovaDragPos] = useState({ x: 0, y: 0 });
  const [novaMsgs, setNovaMsgs] = useState([]);
  const [novaInput, setNovaInput] = useState('');
  const [novaBusy, setNovaBusy] = useState(false);
  const [apiHealthy, setApiHealthy] = useState(true);
  const [networkOnline, setNetworkOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const mountedAt = useRef(Date.now());
  const searchTimerRef = useRef(null);
  const searchRequestRef = useRef(0);
  const markerUpdateAt = useRef(0);
  const initialGpsFixRef = useRef(false);
  const routeRequestRef = useRef(0);
  const routeRefreshReasonRef = useRef('initial');
  const spokenGuidanceRef = useRef(new Set());
  const offRouteSinceRef = useRef(0);
  const lastGpsAtRef = useRef(0);
  const guidancePauseSpokenRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const arrivalAnnouncedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const perf = new PerformanceManager({ onModeChange: (low) => {
      MasterRenderLoop.setFrameSkip(low ? 2 : 1);
      engineRef.current?.setPerformanceMode(low);
    } });
    perfRef.current = perf;
    // Start in the sharp renderer mode. Browser hardware hints are often inaccurate
    // in Telegram WebView; only a measured low FPS switches the renderer down.
    const engine = new EarthEngine(containerRef.current, {
      onTextureQualityChange: setEarthQuality,
      onSatelliteLayerChange: setSatelliteLayer,
    });
    engineRef.current = engine;
    MasterRenderLoop.setFrameSkip(1);
    MasterRenderLoop.add('orbit-earth', (time) => engine.renderFrame(time));
    MasterRenderLoop.add('orbit-perf', () => perfRef.current?.tick());
    engine.setSunFromDate(new Date());
    engine.faceSunlitSide(new Date());
    // The 3D renderer remains at its normal cadence, but the DOM labels only need a
    // smooth 12.5fps update. This avoids needless React renders while the globe moves.
    engine.setLabelCallback((positions) => {
      const now = performance.now();
      if (now - markerUpdateAt.current < 80) return;
      markerUpdateAt.current = now;
      setMarkerPos(positions);
    });
    const sunTimer = setInterval(() => engine.setSunFromDate(new Date()), 60_000);
    return () => {
      MasterRenderLoop.remove('orbit-earth');
      MasterRenderLoop.remove('orbit-perf');
      MasterRenderLoop.setFrameSkip(1);
      clearInterval(sunTimer);
      engine.dispose();
    };
  }, []);

  useEffect(() => { const c = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(c); }, []);

  useEffect(() => {
    const onOnline = () => { setNetworkOnline(true); setApiHealthy(true); };
    const onOffline = () => setNetworkOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const applyPosition = (pos) => {
      if (!active) return;
      lastGpsAtRef.current = Date.now();
      setCurrent(pos);
      setAccuracy(pos.accuracy || null);
      setHeading(typeof pos.heading === 'number' ? pos.heading : null);
      setGpsState('live');
      if (!initialGpsFixRef.current) {
        initialGpsFixRef.current = true;
        engineRef.current?.flyTo(pos.lat, pos.lon, { duration: 1100 });
      }
    };
    const useFallback = () => {
      if (!active) return;
      // After a valid fix, preserve the last known point for map context but do not
      // treat it as live guidance data. The safety monitor pauses voice guidance.
      if (initialGpsFixRef.current) {
        setGpsState('lost');
        return;
      }
      setGpsState('unavailable');
      // Keep a neutral map center only.  This must never be presented as the
      // captain's current location when phone GPS permission is unavailable.
      setCurrent(base.home || { lat: 37.5665, lon: 126.9780, accuracy: null, altitude: null, heading: null });
    };

    getCurrentPosition().then(applyPosition).catch(useFallback);
    const stopWatching = watchCurrentPosition(applyPosition, useFallback);
    return () => { active = false; stopWatching(); };
  }, [gpsRetry]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!current) return;
    reverseGeocode(current.lat, current.lon, language).then(setCurrentPlace).catch(() => setApiHealthy(false));
    fetchWeather(current.lat, current.lon).then(setWeather).catch(() => setApiHealthy(false));
    fetchAirQuality(current.lat, current.lon).then(setAqi).catch(() => {});
  }, [current?.lat, current?.lon, language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const satEngine = new SatelliteEngine();
    let timer;
    (async () => {
      await satEngine.load();
      const draw = async () => {
        const positions = satEngine.positionsNow();
        const iss = await satEngine.issNow();
        setIssTracked(iss ? 1 : 0);
        setOtherTracked(positions.length);
        // Keep the visible telemetry deliberately small. The renderer may track every
        // valid public TLE, but React only needs a handful of names for the HUD.
        setSatellites(positions.slice(0, 6));
        setIssPosition(iss);
        if (engineRef.current) {
          const markers = positions.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, color: 0x53e7ff }));
          if (iss) markers.push({ id: 'ISS', lat: iss.lat, lon: iss.lon, color: 0xffffff });
          engineRef.current.setSatelliteLayer3D(markers);
        }
      };
      draw();
      timer = setInterval(draw, 8000);
    })();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [quakes, eonet] = await Promise.all([fetchEarthquakes().catch(() => []), fetchEonetEvents().catch(() => [])]);
      if (!alive) return;
      const merged = [
        ...quakes.map((q) => ({ id: `q_${q.id}`, kind: 'quake', title: q.place ? `M${q.mag} · ${q.place}` : `M${q.mag} earthquake`, lat: q.lat, lon: q.lon, time: q.time })),
        ...eonet.map((e) => {
          const kind = eventKind(e.category);
          return { id: `e_${e.id}`, kind, title: e.title || e.category, stormName: kind === 'typhoon' ? officialStormName(e.title) : '', lat: e.lat, lon: e.lon, time: e.date ? Date.parse(e.date) : 0, track: e.track };
        }),
      ];
      setEvents(merged);
      if (engineRef.current) {
        const visibleEvents = merged.filter((m) => Number.isFinite(m.lat) && (m.kind !== 'typhoon' || m.stormName));
        const markers = visibleEvents.map((m) => ({ id: m.id, lat: m.lat, lon: m.lon, color: m.kind === 'quake' ? 0xff6f6f : 0xffc15e }));
        engineRef.current.setMarkerLayer('events', markers, { size: 0.04 });
        // A historical storm path looks like a broken orange "tail" over the globe on
        // a compact phone display.  Keep the live storm eye only; it is clearer and
        // closer to an operations display than a long, ambiguous route line.
        engineRef.current.clearEventTracks();
        const typhoonPoints = visibleEvents.filter((m) => m.kind === 'typhoon').map((m) => ({ id: m.id, lat: m.lat, lon: m.lon }));
        engineRef.current.setTyphoonSwirls(typhoonPoints);
      }
    })();
    return () => { alive = false; };
  }, []);

  const markerTargets = useMemo(() => {
    const targets = [];
    const here = currentPlace?.city || currentPlace?.country || (t.ko ? '현재 위치' : 'Current position');
    if (current) {
      targets.push({
        id: 'current', type: 'current', lat: current.lat, lon: current.lon,
        label: t.ko ? '현재 위치' : 'CURRENT POSITION', detail: here,
      });
    }
    if (destination) {
      targets.push({
        id: 'dest', type: 'destination', lat: destination.lat, lon: destination.lon,
        label: destination.label?.split(',')[0] || (t.ko ? '목적지' : 'DESTINATION'),
        detail: t.ko ? '목적지' : 'DESTINATION',
      });
    }
    if (base.home) {
      targets.push({
        id: 'captain-base', type: 'base', lat: base.home.lat, lon: base.home.lon,
        label: t.ko ? '캡틴 베이스' : 'CAPTAIN BASE', detail: base.home.label || (t.ko ? '집' : 'HOME'),
      });
    }
    // Nearby search pins are shown only in the destination-search view.  This keeps
    // the globe readable during active guidance and avoids encouraging phone use while driving.
    if (searchOpen && nearbyAnchor) {
      nearbyPlaces.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon)).slice(0, 12).forEach((place) => {
        targets.push({
          id: `nearby-${place.id}`, type: 'nearby', lat: place.lat, lon: place.lon,
          label: place.label || (t.ko ? '주변 장소' : 'NEARBY PLACE'),
          detail: [place.type, Number.isFinite(place.distanceKm) ? (place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)} m` : `${place.distanceKm.toFixed(1)} km`) : ''].filter(Boolean).join(' · '),
          place,
          selectable: true,
        });
      });
    }
    events.filter((event) => event.kind === 'typhoon' && event.stormName && Number.isFinite(event.lat)).forEach((event) => {
      targets.push({
        id: `storm-${event.id}`, type: 'typhoon', lat: event.lat, lon: event.lon,
        label: `🌀 ${event.stormName}`,
        detail: t.ko ? '실시간 · 공식 태풍 추적' : 'LIVE · OFFICIAL STORM TRACKING',
      });
    });
    if (issPosition) {
      targets.push({
        id: 'sat-ISS', type: 'satellite', lat: issPosition.lat, lon: issPosition.lon,
        label: 'ISS', detail: `ISS · ${Math.round(issPosition.altKm)} km`,
      });
    }
    satellites.slice(0, 3).filter((satellite) => Number.isFinite(satellite.lat)).forEach((satellite) => {
      targets.push({
        id: `sat-${satellite.id}`, type: 'satellite', lat: satellite.lat, lon: satellite.lon,
        label: String(satellite.name || satellite.id || 'SATELLITE').slice(0, 20),
        detail: t.ko ? '실시간 궤도' : 'LIVE ORBIT',
      });
    });
    return targets;
  }, [base.home, current, currentPlace, destination, events, issPosition, nearbyAnchor, nearbyPlaces, satellites, searchOpen, t.ko]);

  useEffect(() => {
    engineRef.current?.setLabelTargets(markerTargets);
  }, [markerTargets]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!searchOpen || !nearbyAnchor || !nearbyPlaces.length) {
      engine.clearMarkerLayer('nearby-places');
      return;
    }
    engine.setMarkerLayer('nearby-places', nearbyPlaces
      .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon))
      .slice(0, 12)
      .map((place) => ({ id: `nearby-${place.id}`, lat: place.lat, lon: place.lon, color: 0x5ee7ff, size: 0.03 })),
      { size: 0.03, color: 0x5ee7ff });
  }, [nearbyAnchor, nearbyPlaces, searchOpen]);

  // Route calculation is intentionally event-driven, not tied to every GPS
  // update. While driving, the existing route is followed locally and only a
  // confirmed off-route event requests a fresh route from the gateway.
  useEffect(() => {
    let active = true;
    if (!current || !destination) {
      setDrivingRoute(null);
      setRouteStatus('idle');
      engineRef.current?.clearRoute();
      setDrivingViewOpen(false);
      return undefined;
    }
    const requestId = ++routeRequestRef.current;
    const reason = routeRefreshReasonRef.current;
    const rerouting = reason === 'off-route' || reason === 'start-refresh';
    setRouteStatus(rerouting ? 'rerouting' : 'loading');
    if (!drivingRoute) engineRef.current?.setRoute(current, destination);
    fetchDrivingRoute(current, destination, { fresh: rerouting }).then((route) => {
      if (!active || requestId !== routeRequestRef.current) return;
      const routeWithSession = { ...route, navigationId: `route-${Date.now()}-${requestId}`, origin: { lat: current.lat, lon: current.lon }, source: 'live' };
      setDrivingRoute(routeWithSession);
      // The last route is kept only on this device. It gives a captain a safe
      // fallback while a weak connection is returning; it is not uploaded and
      // is never presented as a full offline-map service.
      saveLiteRoute({ route, origin: current, destination });
      setRouteStatus('ready');
      offRouteSinceRef.current = 0;
      spokenGuidanceRef.current.clear();
      engineRef.current?.setRoadRoute(route?.points);
    }).catch(() => {
      if (!active || requestId !== routeRequestRef.current) return;
      // Preserve the previously usable route when an off-route refresh has a
      // temporary network failure. Dropping it would leave a moving captain
      // without any visual guidance.
      const offlinePack = rerouting ? null : loadCompatibleOfflineRegionPack({ current, destination });
      const saved = offlinePack || (rerouting ? null : loadCompatibleLiteRoute({ current, destination }));
      if (saved) {
        const savedRoute = {
          ...saved.route,
          navigationId: `${offlinePack ? 'offline-pack' : 'saved-route'}-${saved.savedAt}`,
          origin: saved.origin,
          source: offlinePack ? 'offline-pack' : 'saved',
          savedAt: saved.savedAt,
        };
        setDrivingRoute(savedRoute);
        setRouteStatus(offlinePack ? 'offline_pack' : 'saved');
        engineRef.current?.setRoadRoute(saved.route.points);
      } else {
        if (!rerouting) setDrivingRoute(null);
        setRouteStatus(rerouting && drivingRoute ? 'ready' : 'unavailable');
      }
    }).finally(() => {
      if (requestId === routeRequestRef.current) routeRefreshReasonRef.current = 'initial';
    });
    return () => { active = false; };
    // `current` is deliberately reduced to availability. Coordinates are used
    // only when a destination is chosen or a validated reroute increments the nonce.
  }, [Boolean(current), destination?.id, destination?.lat, destination?.lon, routeRefreshNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  function requestRouteRefresh(reason = 'initial') {
    routeRefreshReasonRef.current = reason;
    setRouteRefreshNonce((value) => value + 1);
  }

  function toggleLowDataMode() {
    setLowDataMode((enabled) => persistLowDataMode(!enabled));
  }

  function saveCurrentOfflinePack() {
    if (!current || !destination || drivingRoute?.source !== 'live') return null;
    const pack = saveOfflineRegionPack({ route: drivingRoute, origin: current, destination });
    setOfflinePacks(listOfflineRegionPacks());
    return pack;
  }

  function deleteOfflinePack(id) {
    if (removeOfflineRegionPack(id)) setOfflinePacks(listOfflineRegionPacks());
  }

  function resetGuidanceSession() {
    spokenGuidanceRef.current.clear();
    offRouteSinceRef.current = 0;
    lastRerouteAtRef.current = 0;
    arrivalAnnouncedRef.current = false;
  }

  function runSearch(q, { near = null } = {}) {
    const normalizedQuery = String(q || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    const requestId = ++searchRequestRef.current;
    const coordinate = coordinateDestination(normalizedQuery, t.ko);
    if (coordinate) {
      setSearchResults([coordinate]);
      setNearbyCategory('all');
      setSearchBusy(false);
      return;
    }
    if (normalizedQuery.length < 2) {
      setSearchResults([]); setNearbyPlaces([]); setNearbyAnchor(null); setNearbyBusy(false); setNearbyCategory('all'); setSearchBusy(false); return;
    }
    const currentNear = current ? { lat: current.lat, lon: current.lon } : null;
    setSearchBusy(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchDestination(normalizedQuery, language, { near: near || currentNear });
        if (requestId !== searchRequestRef.current) return;
        setSearchResults(results);
        const anchor = results[0] || null;
        setNearbyAnchor(anchor);
        setNearbyPlaces([]);
        if (anchor) {
          setNearbyBusy(true);
          fetchNearbyPlaces(anchor.lat, anchor.lon, language)
            .then((places) => { if (requestId === searchRequestRef.current) setNearbyPlaces(places); })
            .catch(() => { if (requestId === searchRequestRef.current) setNearbyPlaces([]); })
            .finally(() => { if (requestId === searchRequestRef.current) setNearbyBusy(false); });
        } else setNearbyBusy(false);
      } catch {
        if (requestId === searchRequestRef.current) { setSearchResults([]); setNearbyPlaces([]); setNearbyAnchor(null); setNearbyBusy(false); }
      }
      if (requestId === searchRequestRef.current) setSearchBusy(false);
  }, 320);
  }

  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  function openDestinationSearch() {
    setMiningMapOpen(false);
    setHudPanel(null);
    setTab('live');
    setSearchOpen(true);
    const line = t.ko
      ? 'Captain, 목적지 검색을 열었습니다. 도시, 주소, 관광지 이름을 입력하거나 최근 목적지를 선택해 주세요.'
      : 'Captain, destination search is open. Enter a city, address, landmark, or choose a recent destination.';
    speakOrbit(line, language, setVoiceState);
  }

  function selectQuickDestination(kind) {
    const saved = kind === 'home' ? base.home : kind === 'work' ? base.work : null;
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
      const fallbackLabel = kind === 'home' ? (t.ko ? '저장한 집' : 'Saved Home') : (t.ko ? '저장한 회사' : 'Saved Work');
      pickDestination({
        ...saved,
        id: `captain-${kind}-${saved.lat.toFixed(4)}-${saved.lon.toFixed(4)}`,
        label: saved.label || fallbackLabel,
        country: saved.country || '',
      });
      return;
    }
    if (kind === 'home' || kind === 'work') {
      setSearchOpen(false);
      setHudPanel('base');
      const slotLabel = kind === 'home' ? (t.ko ? '집' : 'home') : (t.ko ? '회사' : 'work');
      speakOrbit(t.ko
        ? `Captain, ${slotLabel} 위치가 아직 저장되지 않았습니다. 실제 GPS 위치를 확인한 뒤 캡틴 베이스에서 저장해 주세요.`
        : `Captain, your ${slotLabel} is not saved yet. Confirm your live GPS position, then save it in Captain Base.`, language, setVoiceState);
      return;
    }

    const quickSearch = {
      hospital: { ko: '병원', en: 'hospital' },
      gas: { ko: '주유소', en: 'fuel station' },
      police: { ko: '경찰서', en: 'police station' },
      airport: { ko: '공항', en: 'airport' },
    }[kind];
    if (!quickSearch) return;
    const nearby = gpsState === 'live' && current
      ? { lat: Number(current.lat.toFixed(3)), lon: Number(current.lon.toFixed(3)) }
      : null;
    const query = t.ko ? quickSearch.ko : quickSearch.en;
    runSearch(query, { near: nearby });
    speakOrbit(nearby
      ? (t.ko ? `Captain, 현재 위치 주변의 ${quickSearch.ko}을 찾고 있습니다.` : `Captain, searching for nearby ${quickSearch.en}.`)
      : (t.ko ? `Captain, GPS 위치를 확인할 수 없어 전 세계 ${quickSearch.ko} 검색을 시작합니다.` : `Captain, GPS is unavailable, so I am searching worldwide for ${quickSearch.en}.`), language, setVoiceState);
  }

  // Navigation UX chain: Search -> Geocoding -> Camera FlyTo -> Arc Route -> Weather ->
  // Distance -> Time -> NOVA Voice, all from one selection.
  async function pickDestination(place) {
    resetGuidanceSession();
    guidancePauseSpokenRef.current = false;
    setGuidanceSafetyState('ready');
    setNavigationActive(false);
    setDrivingViewOpen(false);
    setDrivingRoute(null);
    setRouteStatus('idle');
    setDestination(place);
    requestRouteRefresh('destination');
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    const nextRecent = [place, ...recentDestinations.filter((item) => item.id !== place.id)].slice(0, 5);
    setRecentDestinations(nextRecent);
    localStorage.setItem('spnx_orbit_recent_v1', JSON.stringify(nextRecent));
    if (current) engineRef.current?.focusRoute(current, place, { duration: 1200 });
    setTab('live');
    if (current) {
      const km = haversineKm(current, place);
      let destWeatherLine = '';
      try {
        const w = await fetchWeather(place.lat, place.lon);
        if (w) destWeatherLine = t.ko ? ` 목적지 날씨는 ${Math.round(w.temperature_2m)}도입니다.` : ` Destination weather is ${Math.round(w.temperature_2m)} degrees.`;
      } catch { /* narration continues without destination weather if unavailable */ }
      const line = t.ko
        ? `Captain, ${place.label.split(',')[0]} 목적지를 설정했습니다. 자동차 도로 경로를 계산 중입니다.${destWeatherLine}`
        : `Captain, destination set to ${place.label.split(',')[0]}. Calculating the driving route.${destWeatherLine}`;
      speakOrbit(line, language, setVoiceState);
    }
  }

  function startNavigation() {
    if (!current || !destination) return;
    if (gpsState !== 'live') {
      speakOrbit(navigationMessage('locationRequired', language), language, setVoiceState);
      return;
    }
    if (!drivingRoute) {
      speakOrbit(navigationMessage('routeLoading', language), language, setVoiceState);
      return;
    }
    resetGuidanceSession();
    guidancePauseSpokenRef.current = false;
    setGuidanceSafetyState('ready');
    setMiningMapOpen(false);
    setNavigationActive(true);
    setDrivingViewOpen(true);
    engineRef.current?.focusRoute(current, destination, { duration: 850 });
    const km = Math.max(1, Math.round((drivingRoute?.distanceM || haversineKm(current, destination) * 1000) / 1000));
    const firstStep = activeDrivingStep || nextDrivingStep(drivingRoute);
    const firstDirection = firstStep ? maneuverLabel(firstStep, language) : '';
    const roadName = firstStep?.name ? ` ${navigationMessage('roadDirection', language, { road: firstStep.name })}` : '';
    const startLine = routeStatus === 'saved' || routeStatus === 'offline_pack' || drivingRoute.source === 'saved' || drivingRoute.source === 'offline-pack'
      ? `${navigationMessage('startSaved', language)} `
      : '';
    const line = `${startLine}${navigationMessage('start', language, { destination: destination.label.split(',')[0], kilometers: km.toLocaleString() })}${firstDirection ? ` ${navigationMessage('firstInstruction', language, { direction: firstDirection })}` : ''}${roadName}`;
    speakOrbit(line, language, setVoiceState);
  }

  function stopNavigation() {
    resetGuidanceSession();
    setNavigationActive(false);
    setDrivingViewOpen(false);
    speakOrbit(navigationMessage('ended', language), language, setVoiceState);
  }

  async function submitNavigationReport({ category, note }) {
    if (!current || !destination) throw new Error(t.ko ? '현재 위치와 목적지를 먼저 설정해 주세요.' : 'Set your current location and destination first.');
    const result = await orbitApi('/api/orbit/navigation-report', {
      category,
      note: String(note || '').trim().slice(0, 300),
      // Reports intentionally use an approximately 100m position, not a raw
      // GPS coordinate. The server rounds again before it persists anything.
      location: { lat: Number(current.lat.toFixed(3)), lon: Number(current.lon.toFixed(3)) },
      destination: { label: String(destination.label || '').slice(0, 120), lat: Number(destination.lat.toFixed(3)), lon: Number(destination.lon.toFixed(3)) },
    });
    return result.reportId
      ? `${result.message || navigationMessage('reportReceived', language)} ${t.ko ? '접수 번호' : 'Receipt'}: ${result.reportId.slice(0, 8).toUpperCase()} · ${t.ko ? '상태: 접수됨' : 'Status: received'}`
      : (result.message || navigationMessage('reportReceived', language));
  }

  async function shareRouteSafely() {
    if (!destination) throw new Error(t.ko ? '공유할 목적지를 먼저 선택해 주세요.' : 'Choose a destination before sharing.');
    // Do not include the Captain's current position in the share text or URL.
    // A recipient receives only the destination pin and can decide how to route
    // there from their own device.
    const destinationName = destination.label?.split(',')[0] || (t.ko ? '목적지' : 'Destination');
    const lat = Number(destination.lat.toFixed(5));
    const lon = Number(destination.lon.toFixed(5));
    const destinationUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=16/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`;
    const text = t.ko
      ? `NOVA Guided Navigation Lite 목적지: ${destinationName}\n${destinationUrl}\n내 현재 위치는 공유되지 않습니다.`
      : `NOVA Guided Navigation Lite destination: ${destinationName}\n${destinationUrl}\nMy current location is not included.`;
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: `NOVA · ${destinationName}`, text, url: destinationUrl });
      return 'shared';
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
    throw new Error(t.ko ? '이 브라우저에서는 경로 공유를 지원하지 않습니다.' : 'Route sharing is not supported in this browser.');
  }

  function saveSlot(slot) {
    if (!current || gpsState !== 'live') {
      setHudPanel('position');
      speakOrbit(t.gpsPermissionHint, language, setVoiceState);
      return;
    }
    const slotLabel = slot === 'home' ? (t.ko ? '집' : 'Home') : (t.ko ? '회사' : 'Work');
    const city = currentPlace?.city || currentPlace?.country || '';
    const point = { ...current, label: city ? `${slotLabel} · ${city}` : slotLabel, country: currentPlace?.country || '' };
    setBase({ ...setBasePoint(slot, point) });
  }
  function selectTab(id) {
    const isClosing = tab === id;
    setTab(isClosing ? 'live' : id);
    // The mobile screen does not keep the desktop side cards on display.  Top
    // controls therefore open their actual card instead of acting as a cosmetic
    // highlight only.
    setHudPanel(isClosing ? null : (TOP_TAB_PANELS[id] || null));
    // Satellite is a functional display mode: opening its card also loads the
    // latest available NASA GIBS observation; closing it returns to the local
    // high-resolution Blue Marble map.
    if (id === 'satellite') engineRef.current?.setSatelliteImagery(!isClosing);
  }

  function openMiningMap() {
    setHudPanel(null);
    setSearchOpen(false);
    setMiningMapOpen(true);
  }

  function openOfficialMining() {
    setMiningMapOpen(false);
    onOpenMining?.();
  }

  const dragRef = useRef(null);
  function onNovaPointerDown(e) {
    dragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...novaDragPos },
      next: { ...novaDragPos },
      element: e.currentTarget,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onNovaPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.moved = true;
      dragRef.current.next = { x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy };
      // Direct compositor update keeps NOVA locked to the pointer without re-rendering
      // the Three.js Earth on every pointer event.
      dragRef.current.element.style.transform = `translate3d(${dragRef.current.next.x}px, ${dragRef.current.next.y}px, 0)`;
    }
  }
  function startOrbitGuide() {
    const line = t.ko
      ? 'Captain, NOVA AI입니다. 상단의 목적지 찾기를 누르면 전 세계 도시와 장소를 검색할 수 있습니다. 지구는 손가락으로 돌리고 두 손가락으로 확대할 수 있습니다. 목적지를 선택하면 거리, 방위, 예상시간과 날씨를 안내합니다. SpaceNovaX는 앞으로 지속적인 업데이트를 통해 전 세계를 하나로 연결하고, 누구나 쉽게 길을 찾고 세계를 여행할 수 있는 국제 NOVA AI 내비게이션을 목표로 합니다.'
      : 'Captain, this is NOVA AI. Tap Find destination to search cities and places worldwide. Drag the Earth to rotate and pinch to zoom. After you select a destination, I will explain the distance, course, estimated time, and weather. Through continuous updates, SpaceNovaX aims to connect the world and become an international NOVA AI navigation service that helps everyone find their way and travel across the globe with ease.';
    setNovaMsgs((messages) => messages.length ? messages : [{ id: Date.now(), role: 'ai', text: line }]);
    speakOrbit(line, language, setVoiceState);
  }

  function onNovaPointerUp() {
    if (dragRef.current) {
      if (dragRef.current.moved) {
        setNovaDragPos(dragRef.current.next);
      } else {
        if (!novaOpen && novaMsgs.length === 0) startOrbitGuide();
        setNovaOpen((v) => !v);
      }
    }
    dragRef.current = null;
  }

  async function sendNova() {
    const text = novaInput.trim();
    if (!text || novaBusy) return;
    const prior = novaMsgs.slice(-12);
    setNovaMsgs((m) => [...m, { id: Date.now(), role: 'me', text }]);
    setNovaInput('');
    setNovaBusy(true);
    try {
      const context = `Orbit Earth Navigation. Tracking ${issTracked + otherTracked} satellites (ISS ${issTracked ? 'online' : 'offline'}). ${weather ? `Local weather ${Math.round(weather.temperature_2m)}°C.` : ''} ${events[0] ? `${events.length} active Earth events.` : ''} ${destination ? `Destination set: ${destination.label}.` : ''}`;
      const data = await orbitApi('/api/nova/chat', {
        message: text, language,
        history: prior.map((item) => ({ role: item.role === 'ai' ? 'assistant' : 'user', text: item.text })),
        captainContext: user ? { id: user.id, level: user.level, balance: user.balance, mining: user.mining, gameReward: user.gameReward } : {},
        orbitContext: context,
      });
      const reply = data.reply || data.message || (t.ko ? 'Captain, 응답을 받지 못했습니다.' : 'Captain, no response received.');
      setNovaMsgs((m) => [...m, { id: Date.now() + 1, role: 'ai', text: reply }]);
      if (data.reply) speakOrbit(reply, language, setVoiceState);
    } catch (error) {
      setNovaMsgs((m) => [...m, { id: Date.now() + 1, role: 'ai', text: error.message || (t.ko ? 'Captain, NOVA AI 연결에 실패했습니다.' : 'Captain, NOVA AI connection failed.') }]);
    }
    setNovaBusy(false);
  }

  // A stale coordinate can look "live" in a browser after the device loses signal.
  // Pause rather than guessing directions: the user keeps the map but must resume
  // only after a fresh, sufficiently accurate GPS fix arrives.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!navigationActive) return;
      if (!lastGpsAtRef.current || Date.now() - lastGpsAtRef.current > 30_000) setGpsState('stale');
    }, 5_000);
    return () => clearInterval(timer);
  }, [navigationActive]);

  useEffect(() => {
    if (!navigationActive) return;
    const unsafeGps = gpsState !== 'live' || (Number.isFinite(accuracy) && accuracy > 120);
    if (!unsafeGps) return;
    setNavigationActive(false);
    setGuidanceSafetyState('paused');
    if (!guidancePauseSpokenRef.current) {
      guidancePauseSpokenRef.current = true;
      speakOrbit(t.ko
        ? 'Captain, GPS 신호 또는 정확도가 충분하지 않아 음성 경로 안내를 일시 정지합니다. 안전한 곳에 정차한 뒤 위치를 확인하고 다시 시작해 주세요.'
        : 'Captain, NOVA paused voice guidance because the GPS signal or accuracy is not sufficient. Stop safely, confirm your location, and resume when ready.', language, setVoiceState);
    }
  }, [navigationActive, gpsState, accuracy, language, t.ko]);

  const navigationProfile = useMemo(() => createNavigationProfile(drivingRoute), [drivingRoute]);
  const navigationProgress = useMemo(() => getNavigationProgress(navigationProfile, current), [navigationProfile, current?.lat, current?.lon]);
  const activeDrivingStep = nextDrivingStep(drivingRoute, navigationProgress);
  const directDistanceKm = current && destination ? haversineKm(current, destination) : null;
  const remainingRouteM = navigationProgress?.remainingRouteM;
  const distanceKm = drivingRoute ? (Number.isFinite(remainingRouteM) ? remainingRouteM : drivingRoute.distanceM) / 1000 : directDistanceKm;
  const routeRemainingRatio = drivingRoute && Number.isFinite(remainingRouteM) ? Math.max(0, Math.min(1, remainingRouteM / Math.max(1, drivingRoute.distanceM))) : 1;
  const etaHours = drivingRoute ? (drivingRoute.durationSec * routeRemainingRatio) / 3600 : null;
  const courseDeg = current && destination ? bearingDeg(current, destination) : null;
  const arrivalRadiusM = Math.max(80, Math.min((accuracy || 40) * 2, 250));
  const hasArrived = Boolean(navigationActive && distanceKm != null && distanceKm * 1000 <= arrivalRadiusM);

  // Do not burn route requests every time a phone reports a new GPS coordinate.
  // Re-route only after the GPS has remained clearly away from the current road
  // for several seconds. The threshold grows with reported GPS accuracy.
  useEffect(() => {
    if (!navigationActive || !navigationProgress || !drivingRoute || hasArrived) {
      offRouteSinceRef.current = 0;
      return;
    }
    const thresholdM = Math.max(55, Math.min(150, (accuracy || 35) * 2.2));
    if (navigationProgress.offRouteM <= thresholdM) {
      offRouteSinceRef.current = 0;
      return;
    }
    const currentTime = Date.now();
    if (!offRouteSinceRef.current) {
      offRouteSinceRef.current = currentTime;
      return;
    }
    if (currentTime - offRouteSinceRef.current < 6_000 || currentTime - lastRerouteAtRef.current < 12_000) return;
    lastRerouteAtRef.current = currentTime;
    offRouteSinceRef.current = 0;
    if (drivingRoute.source === 'offline-pack') {
      speakOrbit(language === 'ko' ? '오프라인 지역 경로에서 벗어났습니다. 인터넷 연결 후 새 경로를 확인해 주세요.' : 'You left the offline regional route. Reconnect to check a new route.', language, setVoiceState);
      setNavigationActive(false);
      setDrivingViewOpen(false);
      return;
    }
    speakOrbit(navigationMessage('offRoute', language), language, setVoiceState);
    requestRouteRefresh('off-route');
  }, [navigationActive, navigationProgress?.offRouteM, current?.lat, current?.lon, drivingRoute?.navigationId, hasArrived, accuracy, language, t.ko]); // eslint-disable-line react-hooks/exhaustive-deps

  // Announce the two useful advance-warning distances once per maneuver. A
  // maneuver progresses locally on the already-fetched route, so the prompt is
  // not delayed by a network call while the captain is driving.
  useEffect(() => {
    if (!navigationActive || !activeDrivingStep || hasArrived) return;
    const distanceToManeuverM = activeDrivingStep.distanceToManeuverM;
    if (!Number.isFinite(distanceToManeuverM) || distanceToManeuverM <= 15) return;
    const stage = distanceToManeuverM <= 100 ? '100m' : distanceToManeuverM <= 300 ? '300m' : null;
    if (!stage) return;
    const key = `${drivingRoute?.navigationId || 'route'}:${activeDrivingStep.stepIndex ?? activeDrivingStep.name}:${stage}`;
    if (spokenGuidanceRef.current.has(key)) return;
    spokenGuidanceRef.current.add(key);
    speakOrbit(guidanceSpeech(activeDrivingStep, distanceToManeuverM, language), language, setVoiceState);
  }, [navigationActive, activeDrivingStep?.stepIndex, activeDrivingStep?.name, activeDrivingStep?.distanceToManeuverM, drivingRoute?.navigationId, hasArrived, language, t.ko]);

  useEffect(() => {
    if (!navigationActive || !hasArrived || arrivalAnnouncedRef.current) return;
    arrivalAnnouncedRef.current = true;
    speakOrbit(navigationMessage('arrived', language), language, setVoiceState);
  }, [navigationActive, hasArrived, language, t.ko]);

  const air = aqiLabel(aqi, t.ko);
  const netStable = networkOnline && apiHealthy;
  const dataRate = navigator.connection?.downlink ? `${navigator.connection.downlink} Mbps` : '—';
  const uptimeMs = clock.getTime() - mountedAt.current;
  const uptimeStr = `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`;
  const eventCounts = { typhoon: events.filter((e) => e.kind === 'typhoon' && e.stormName).length, quake: events.filter((e) => e.kind === 'quake').length, volcano: events.filter((e) => e.kind === 'volcano').length, wildfire: events.filter((e) => e.kind === 'wildfire').length };
  const topEvents = useMemo(() => events
    .filter((event) => ['typhoon', 'quake', 'volcano', 'wildfire'].includes(event.kind) && (event.kind !== 'typhoon' || event.stormName))
    .sort((a, b) => b.time - a.time)
    .slice(0, 4), [events]);

  const panelProps = {
    t, current, currentPlace, heading, accuracy, gpsState, satelliteCount: issTracked + otherTracked, compassLabel,
    onMyLocation: () => {
      setGpsState('locating');
      setGpsRetry((value) => value + 1);
      if (current) engineRef.current?.flyTo(current.lat, current.lon);
    },
    issTracked, otherTracked, issPosition, satellites,
    satelliteLayer,
    onToggleSatelliteLayer: () => engineRef.current?.setSatelliteImagery(!satelliteLayer.enabled),
    weather, currentCity: currentPlace?.city, airQualityLabel: air, aqi,
    counts: eventCounts, topEvents,
    destination, searchQuery, searchResults, distanceKm, etaHours, courseDeg, base, navigationActive, hasArrived, arrivalRadiusM, routeStatus, drivingRoute,
    onSearchChange: runSearch, onOpenSearch: openDestinationSearch, onPick: pickDestination, onAddFavorite: () => addFavorite(destination), onClearRoute: () => { resetGuidanceSession(); setNavigationActive(false); setDrivingViewOpen(false); setDestination(null); },
    onStartNavigation: startNavigation, onStopNavigation: stopNavigation,
    onSaveHome: () => saveSlot('home'), onSaveWork: () => saveSlot('work'),
    netStable, dataRate, uptimeStr,
  };
  const inTelegram = Boolean(window.Telegram?.WebApp?.initData);

  return (
    <div className="ov20-root">
      {drivingViewOpen && <OrbitDrivingView t={t} current={current} destination={destination} route={drivingRoute} etaHours={etaHours} distanceKm={distanceKm} nextStep={activeDrivingStep} navigationProgress={navigationProgress} routeStatus={routeStatus} lowDataMode={lowDataMode} gpsState={gpsState} accuracy={accuracy} guidanceSafetyState={guidanceSafetyState} networkOnline={networkOnline} onResume={startNavigation} onToggleLowDataMode={toggleLowDataMode} onReport={submitNavigationReport} onExit={() => setDrivingViewOpen(false)} onStop={stopNavigation} />}
      <OrbitTopBar tab={tab} onSelect={selectTab} t={t} onSearch={openDestinationSearch} onMiningMap={openMiningMap} />
      <div className="ov20-layout">
        <OrbitEarthView
          containerRef={containerRef}
          current={current}
          markerPos={markerPos}
          markerTargets={markerTargets}
          textureQuality={earthQuality}
          onMarkerPick={(marker) => { if (marker.selectable && marker.place) pickDestination(marker.place); }}
          onZoomIn={() => engineRef.current?.zoomBy(0.5)}
          onZoomOut={() => engineRef.current?.zoomBy(-0.5)}
          onRecenter={() => engineRef.current?.recenter()}
        />
        <div className="ov20-col left ov20-desktop-panels">
          <OrbitLeftPanel {...panelProps} />
        </div>
        <div className="ov20-col right ov20-desktop-panels">
          <OrbitRightPanel {...panelProps} />
        </div>
        <OrbitHUD
          t={t}
          current={current}
          currentPlace={currentPlace}
          weather={weather}
          satelliteCount={issTracked + otherTracked}
          destination={destination}
          distanceKm={distanceKm}
          activePanel={hudPanel}
          onOpen={setHudPanel}
        />
        {hudPanel && (
          <section className="ov20-mobile-drawer" aria-label={t.ko ? '네비게이션 상세 정보' : 'Navigation details'}>
            <button className="ov20-drawer-close" onClick={() => setHudPanel(null)} aria-label={t.close}>×</button>
            {hudPanel === 'position' && <OrbitCurrentPosition {...panelProps} />}
            {hudPanel === 'satellite' && <OrbitSatellite {...panelProps} />}
            {(hudPanel === 'destination' || hudPanel === 'base') && <OrbitDestination {...panelProps} />}
            {hudPanel === 'weather' && <OrbitWeather {...panelProps} />}
            {hudPanel === 'events' && <OrbitEvents {...panelProps} />}
          </section>
        )}
        <OrbitRouteTelemetry
          t={t}
          current={current}
          currentPlace={currentPlace}
          destination={destination}
          distanceKm={distanceKm}
          etaHours={etaHours}
          courseDeg={courseDeg}
          compassLabel={compassLabel}
          navigationActive={navigationActive}
          hasArrived={hasArrived}
          routeStatus={routeStatus}
          nextStep={activeDrivingStep}
          gpsState={gpsState}
          accuracy={accuracy}
          networkOnline={networkOnline}
          onSearch={openDestinationSearch}
          onStartNavigation={startNavigation}
          onStopNavigation={stopNavigation}
          onShareRoute={shareRouteSafely}
          onOpenOfflinePacks={() => setOfflinePacksOpen(true)}
          offlinePackCount={offlinePacks.length}
        />
      </div>
      <OrbitOfflineRegionPacks
        open={offlinePacksOpen}
        t={t}
        route={drivingRoute}
        destination={destination}
        packs={offlinePacks}
        onSave={saveCurrentOfflinePack}
        onRemove={deleteOfflinePack}
        onClose={() => setOfflinePacksOpen(false)}
      />
      <OrbitFloatingNova
        t={t} language={language} user={user} novaOpen={novaOpen} novaDragPos={novaDragPos}
        voiceState={voiceState} novaMsgs={novaMsgs} novaInput={novaInput} novaBusy={novaBusy}
        onPointerDown={onNovaPointerDown} onPointerMove={onNovaPointerMove} onPointerUp={onNovaPointerUp}
        onInputChange={setNovaInput} onSend={sendNova} onGuide={startOrbitGuide} onSpeak={(text) => speakOrbit(text, language, setVoiceState)}
      />
      <OrbitSearchOverlay
        open={searchOpen} t={t} language={language} query={searchQuery} results={searchResults} busy={searchBusy}
        nearby={nearbyPlaces} nearbyAnchor={nearbyAnchor} nearbyBusy={nearbyBusy} nearbyCategory={nearbyCategory} onNearbyCategoryChange={setNearbyCategory}
        recent={recentDestinations} base={base} onChange={runSearch} onPick={pickDestination} onQuickDestination={selectQuickDestination}
        onClose={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); setNearbyPlaces([]); setNearbyAnchor(null); setNearbyBusy(false); setNearbyCategory('all'); }}
      />
      {miningMapOpen && !drivingViewOpen && <OrbitMiningMap language={language} inTelegram={inTelegram} onClose={() => setMiningMapOpen(false)} onOpenMining={openOfficialMining} />}
      <OrbitBottomBar />
    </div>
  );
}
