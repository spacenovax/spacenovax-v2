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
import { fetchWeather, fetchAirQuality, fetchEarthquakes, fetchEonetEvents, reverseGeocode, searchDestination, fetchDrivingRoute } from '../api.js';
import { getCurrentPosition, watchCurrentPosition, haversineKm, bearingDeg, compassLabel } from '../geo.js';
import { getCaptainBase, setBasePoint, addFavorite } from '../captainBase.js';
import OrbitTopBar from './OrbitTopBar.jsx';
import OrbitEarthView from './OrbitEarthView.jsx';
import OrbitLeftPanel from './OrbitLeftPanel.jsx';
import OrbitRightPanel from './OrbitRightPanel.jsx';
import OrbitRouteTelemetry from './OrbitRouteTelemetry.jsx';
import OrbitFloatingNova from './OrbitFloatingNova.jsx';
import OrbitBottomBar from './OrbitBottomBar.jsx';
import OrbitSearchOverlay from './OrbitSearchOverlay.jsx';
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
function speakOrbit(text, language, onStateChange) { return orbitSpeech.speak({ text, language, rate: 1, onStart: () => onStateChange?.('playing'), onEnd: () => onStateChange?.('idle'), onError: () => onStateChange?.('idle') }); }

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
    startNavigation: ko ? '경로 안내 시작' : 'Start navigation', endNavigation: ko ? '경로 안내 종료' : 'End navigation', liveGuidance: ko ? '실시간 방향 안내' : 'LIVE GUIDANCE', arrived: ko ? '목적지 도착' : 'ARRIVED', remaining: ko ? '남은 거리' : 'REMAINING',
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

export default function OrbitV20({ language, user }) {
  const t = useCopy(language);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const perfRef = useRef(null);
  const [voiceState, setVoiceState] = useState('idle');

  const [tab, setTab] = useState('live');
  const [clock, setClock] = useState(new Date());
  const [current, setCurrent] = useState(null);
  const [currentPlace, setCurrentPlace] = useState(null);
  const [heading, setHeading] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [gpsState, setGpsState] = useState('locating');
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
  const [navigationActive, setNavigationActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const mountedAt = useRef(Date.now());
  const searchTimerRef = useRef(null);
  const searchRequestRef = useRef(0);
  const markerUpdateAt = useRef(0);
  const initialGpsFixRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const engine = new EarthEngine(containerRef.current, {});
    engineRef.current = engine;
    perfRef.current = new PerformanceManager({ onModeChange: (low) => MasterRenderLoop.setFrameSkip(low ? 2 : 1) });
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
    let active = true;
    const applyPosition = (pos) => {
      if (!active) return;
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
      if (!active || initialGpsFixRef.current) return;
      setGpsState('unavailable');
      setCurrent(base.home || { lat: 37.5665, lon: 126.9780, accuracy: null, altitude: null, heading: null });
    };

    getCurrentPosition().then(applyPosition).catch(useFallback);
    const stopWatching = watchCurrentPosition(applyPosition, useFallback);
    return () => { active = false; stopWatching(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        ...eonet.map((e) => ({ id: `e_${e.id}`, kind: /wildfire/i.test(e.category) ? 'wildfire' : /volcano/i.test(e.category) ? 'volcano' : /storm|cyclone/i.test(e.category) ? 'typhoon' : 'other', title: e.title || e.category, lat: e.lat, lon: e.lon, time: e.date ? Date.parse(e.date) : 0, track: e.track })),
      ];
      setEvents(merged);
      if (engineRef.current) {
        const markers = merged.filter((m) => Number.isFinite(m.lat)).map((m) => ({ id: m.id, lat: m.lat, lon: m.lon, color: m.kind === 'quake' ? 0xff6f6f : 0xffc15e }));
        engineRef.current.setMarkerLayer('events', markers, { size: 0.04 });
        // A historical storm path looks like a broken orange "tail" over the globe on
        // a compact phone display.  Keep the live storm eye only; it is clearer and
        // closer to an operations display than a long, ambiguous route line.
        engineRef.current.clearEventTracks();
        const typhoonPoints = merged.filter((m) => m.kind === 'typhoon' && Number.isFinite(m.lat)).map((m) => ({ id: m.id, lat: m.lat, lon: m.lon }));
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
    events.filter((event) => event.kind === 'typhoon' && Number.isFinite(event.lat)).slice(0, 2).forEach((event) => {
      const name = String(event.title || 'Typhoon').replace(/^Typhoon\s*/i, '').slice(0, 28);
      targets.push({
        id: `storm-${event.id}`, type: 'typhoon', lat: event.lat, lon: event.lon,
        label: `🌀 ${name || (t.ko ? '태풍' : 'Typhoon')}`,
        detail: t.ko ? '실시간 · 태풍 추적' : 'LIVE · TYPHOON TRACKING',
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
  }, [base.home, current, currentPlace, destination, events, issPosition, satellites, t.ko]);

  useEffect(() => {
    engineRef.current?.setLabelTargets(markerTargets);
  }, [markerTargets]);

  useEffect(() => {
    let active = true;
    if (!current || !destination) { setDrivingRoute(null); setRouteStatus('idle'); engineRef.current?.clearRoute(); return undefined; }
    setRouteStatus('loading'); engineRef.current?.setRoute(current, destination);
    fetchDrivingRoute(current, destination).then((route) => { if (!active) return; setDrivingRoute(route); setRouteStatus('ready'); engineRef.current?.setRoadRoute(route?.points); }).catch(() => { if (!active) return; setDrivingRoute(null); setRouteStatus('unavailable'); });
    return () => { active = false; };
  }, [current?.lat, current?.lon, destination?.lat, destination?.lon]);

  function runSearch(q) {
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    const requestId = ++searchRequestRef.current;
    const coordinate = coordinateDestination(q, t.ko);
    if (coordinate) {
      setSearchResults([coordinate]);
      setSearchBusy(false);
      return;
    }
    if (q.trim().length < 2) { setSearchResults([]); setSearchBusy(false); return; }
    setSearchBusy(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchDestination(q);
        if (requestId === searchRequestRef.current) setSearchResults(results);
      } catch {
        if (requestId === searchRequestRef.current) setSearchResults([]);
      }
      if (requestId === searchRequestRef.current) setSearchBusy(false);
    }, 320);
  }

  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  function openDestinationSearch() {
    setSearchOpen(true);
    const line = t.ko
      ? 'Captain, 목적지 검색을 열었습니다. 도시, 주소, 관광지 이름을 입력하거나 최근 목적지를 선택해 주세요.'
      : 'Captain, destination search is open. Enter a city, address, landmark, or choose a recent destination.';
    speakOrbit(line, language, setVoiceState);
  }

  // Navigation UX chain: Search -> Geocoding -> Camera FlyTo -> Arc Route -> Weather ->
  // Distance -> Time -> NOVA Voice, all from one selection.
  async function pickDestination(place) {
    setDestination(place);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    const nextRecent = [place, ...recentDestinations.filter((item) => item.id !== place.id)].slice(0, 5);
    setRecentDestinations(nextRecent);
    localStorage.setItem('spnx_orbit_recent_v1', JSON.stringify(nextRecent));
    if (current) engineRef.current?.focusRoute(current, place, { duration: 1200 });
    setTab('live');
    if (current) {
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
    setNavigationActive(true);
    engineRef.current?.focusRoute(current, destination, { duration: 850 });
    const km = Math.round((drivingRoute?.distanceM || haversineKm(current, destination) * 1000) / 1000);
    const firstStep = drivingRoute?.steps?.[0];
    const roadName = firstStep?.name ? ` ${t.ko ? '첫 안내 도로는' : 'First road is'} ${firstStep.name}.` : '';
    const line = t.ko
      ? `Captain, 자동차 경로 안내를 시작합니다. ${destination.label.split(',')[0]}까지 ${km.toLocaleString()}킬로미터입니다.${roadName} 기기의 위치가 바뀌면 경로를 다시 계산합니다.`
      : `Captain, driving guidance is active. ${destination.label.split(',')[0]} is ${km.toLocaleString()} kilometers away.${roadName} The route will recalculate as your device position changes.`;
    speakOrbit(line, language, setVoiceState);
  }

  function stopNavigation() {
    setNavigationActive(false);
    speakOrbit(t.ko ? 'Captain, 경로 안내를 종료했습니다.' : 'Captain, navigation guidance has ended.', language, setVoiceState);
  }

  function saveSlot(slot) { if (current) setBase({ ...setBasePoint(slot, current) }); }
  function selectTab(id) { setTab((cur) => (cur === id ? 'live' : id)); }

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

  const directDistanceKm = current && destination ? haversineKm(current, destination) : null;
  const distanceKm = drivingRoute ? drivingRoute.distanceM / 1000 : directDistanceKm;
  const etaHours = drivingRoute ? drivingRoute.durationSec / 3600 : null;
  const courseDeg = current && destination ? bearingDeg(current, destination) : null;
  const arrivalRadiusM = Math.max(80, Math.min((accuracy || 40) * 2, 250));
  const hasArrived = Boolean(navigationActive && distanceKm != null && distanceKm * 1000 <= arrivalRadiusM);
  const air = aqiLabel(aqi, t.ko);
  const netStable = navigator.onLine !== false && apiHealthy;
  const dataRate = navigator.connection?.downlink ? `${navigator.connection.downlink} Mbps` : '—';
  const uptimeMs = clock.getTime() - mountedAt.current;
  const uptimeStr = `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`;
  const eventCounts = { typhoon: events.filter((e) => e.kind === 'typhoon').length, quake: events.filter((e) => e.kind === 'quake').length, volcano: events.filter((e) => e.kind === 'volcano').length, wildfire: events.filter((e) => e.kind === 'wildfire').length };
  const topEvents = useMemo(() => events
    .filter((event) => ['typhoon', 'quake', 'volcano', 'wildfire'].includes(event.kind))
    .sort((a, b) => b.time - a.time)
    .slice(0, 4), [events]);

  const panelProps = {
    t, current, currentPlace, heading, accuracy, gpsState, satelliteCount: issTracked + otherTracked, compassLabel,
    onMyLocation: () => current && engineRef.current?.flyTo(current.lat, current.lon),
    issTracked, otherTracked, issPosition, satellites,
    weather, currentCity: currentPlace?.city, airQualityLabel: air, aqi,
    counts: eventCounts, topEvents,
    destination, searchQuery, searchResults, distanceKm, etaHours, courseDeg, base, navigationActive, hasArrived, arrivalRadiusM, routeStatus,
    onSearchChange: runSearch, onOpenSearch: openDestinationSearch, onPick: pickDestination, onAddFavorite: () => addFavorite(destination), onClearRoute: () => setDestination(null),
    onStartNavigation: startNavigation, onStopNavigation: stopNavigation,
    onSaveHome: () => saveSlot('home'), onSaveWork: () => saveSlot('work'),
    netStable, dataRate, uptimeStr,
  };

  return (
    <div className="ov20-root">
      <OrbitTopBar tab={tab} onSelect={selectTab} t={t} onSearch={openDestinationSearch} />
      <div className="ov20-layout">
        <OrbitEarthView
          containerRef={containerRef}
          current={current}
          markerPos={markerPos}
          markerTargets={markerTargets}
          onZoomIn={() => engineRef.current?.zoomBy(0.5)}
          onZoomOut={() => engineRef.current?.zoomBy(-0.5)}
          onRecenter={() => engineRef.current?.recenter()}
        />
        <div className="ov20-col left">
          <OrbitLeftPanel {...panelProps} />
        </div>
        <div className="ov20-col right">
          <OrbitRightPanel {...panelProps} />
        </div>
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
          nextStep={drivingRoute?.steps?.[0]}
          onSearch={openDestinationSearch}
          onStartNavigation={startNavigation}
          onStopNavigation={stopNavigation}
        />
      </div>
      <OrbitFloatingNova
        t={t} language={language} user={user} novaOpen={novaOpen} novaDragPos={novaDragPos}
        voiceState={voiceState} novaMsgs={novaMsgs} novaInput={novaInput} novaBusy={novaBusy}
        onPointerDown={onNovaPointerDown} onPointerMove={onNovaPointerMove} onPointerUp={onNovaPointerUp}
        onInputChange={setNovaInput} onSend={sendNova} onGuide={startOrbitGuide} onSpeak={(text) => speakOrbit(text, language, setVoiceState)}
      />
      <OrbitSearchOverlay
        open={searchOpen} t={t} query={searchQuery} results={searchResults} busy={searchBusy}
        recent={recentDestinations} onChange={runSearch} onPick={pickDestination}
        onClose={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
      />
      <OrbitBottomBar />
    </div>
  );
}
