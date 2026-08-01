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
import { fetchWeather, fetchAirQuality, fetchEarthquakes, fetchEonetEvents, reverseGeocode, searchDestination } from '../api.js';
import { getCurrentPosition, haversineKm, bearingDeg, compassLabel } from '../geo.js';
import { getCaptainBase, setBasePoint, addFavorite } from '../captainBase.js';
import OrbitTopBar from './OrbitTopBar.jsx';
import OrbitEarthView from './OrbitEarthView.jsx';
import OrbitLeftPanel from './OrbitLeftPanel.jsx';
import OrbitRightPanel from './OrbitRightPanel.jsx';
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

function speakOrbit(text, language, onStateChange) {
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance || !text) return false;
  synth.cancel();
  onStateChange?.('loading');
  const utter = new window.SpeechSynthesisUtterance(text);
  const locales = {
    en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES',
    pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', ru: 'ru-RU', vi: 'vi-VN', id: 'id-ID',
  };
  const selected = String(language || 'en').toLowerCase().replace(/_/g, '-').split('-')[0];
  utter.lang = locales[selected] || locales.en;
  utter.rate = 1;
  utter.onstart = () => {
    onStateChange?.('playing');
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch (_) {}
  };
  utter.onend = () => onStateChange?.('idle');
  utter.onerror = () => onStateChange?.('idle');
  synth.speak(utter);
  return true;
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
  }), [ko]);
}

function aqiLabel(v, ko) {
  if (v == null) return { text: '—', cls: '' };
  if (v <= 40) return { text: ko ? '좋음' : 'Good', cls: 'ok' };
  if (v <= 80) return { text: ko ? '보통' : 'Fair', cls: '' };
  return { text: ko ? '나쁨' : 'Poor', cls: '' };
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
  const [issTracked, setIssTracked] = useState(0);
  const [otherTracked, setOtherTracked] = useState(0);
  const [weather, setWeather] = useState(null);
  const [aqi, setAqi] = useState(null);
  const [events, setEvents] = useState([]);
  const [destination, setDestination] = useState(null);
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

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const engine = new EarthEngine(containerRef.current, {});
    engineRef.current = engine;
    perfRef.current = new PerformanceManager({ onModeChange: (low) => MasterRenderLoop.setFrameSkip(low ? 2 : 1) });
    MasterRenderLoop.add('orbit-earth', (time) => engine.renderFrame(time));
    MasterRenderLoop.add('orbit-perf', () => perfRef.current?.tick());
    engine.setSunFromDate(new Date());
    engine.faceSunlitSide(new Date());
    engine.setLabelCallback((positions) => setMarkerPos(positions));
    const sunTimer = setInterval(() => engine.setSunFromDate(new Date()), 60_000);
    return () => {
      MasterRenderLoop.remove('orbit-earth');
      MasterRenderLoop.remove('orbit-perf');
      MasterRenderLoop.setFrameSkip(1);
      clearInterval(sunTimer);
      perfRef.current?.dispose();
      perfRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { const c = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(c); }, []);

  useEffect(() => {
    getCurrentPosition().then((pos) => {
      setCurrent(pos);
      setAccuracy(pos.accuracy || null);
      setHeading(typeof pos.heading === 'number' ? pos.heading : null);
      engineRef.current?.flyTo(pos.lat, pos.lon, { duration: 1100 });
    }).catch(() => setCurrent(base.home || { lat: 37.5665, lon: 126.9780 }));
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
    let alive = true;
    (async () => {
      await satEngine.load();
      if (!alive) return;
      const draw = async () => {
        const positions = satEngine.positionsNow();
        const iss = await satEngine.issNow();
        if (!alive) return;
        setIssTracked(iss ? 1 : 0);
        setOtherTracked(positions.length);
        if (engineRef.current) {
          const markers = positions.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, color: 0x53e7ff }));
          if (iss) markers.push({ id: 'ISS', lat: iss.lat, lon: iss.lon, color: 0xffffff });
          engineRef.current.setSatelliteLayer3D(markers);
        }
      };
      draw();
      timer = setInterval(draw, 8000);
    })();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [quakes, eonet] = await Promise.all([fetchEarthquakes().catch(() => []), fetchEonetEvents().catch(() => [])]);
      if (!alive) return;
      const merged = [
        ...quakes.map((q) => ({ id: `q_${q.id}`, kind: 'quake', lat: q.lat, lon: q.lon, time: q.time })),
        ...eonet.map((e) => ({ id: `e_${e.id}`, kind: /wildfire/i.test(e.category) ? 'wildfire' : /volcano/i.test(e.category) ? 'volcano' : /storm|cyclone/i.test(e.category) ? 'typhoon' : 'other', lat: e.lat, lon: e.lon, time: e.date ? Date.parse(e.date) : 0, track: e.track })),
      ];
      setEvents(merged);
      if (engineRef.current) {
        const markers = merged.filter((m) => Number.isFinite(m.lat)).map((m) => ({ id: m.id, lat: m.lat, lon: m.lon, color: m.kind === 'quake' ? 0xff6f6f : 0xffc15e }));
        engineRef.current.setMarkerLayer('events', markers, { size: 0.04 });
        const typhoonTracks = merged
          .filter((m) => m.kind === 'typhoon' && Array.isArray(m.track) && m.track.length > 1)
          .map((m) => ({ id: m.id, color: 0xff8a5c, points: m.track }));
        engineRef.current.setEventTracks(typhoonTracks);
        const typhoonPoints = merged.filter((m) => m.kind === 'typhoon' && Number.isFinite(m.lat)).map((m) => ({ id: m.id, lat: m.lat, lon: m.lon }));
        engineRef.current.setTyphoonSwirls(typhoonPoints);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const targets = [];
    if (current) targets.push({ id: 'current', lat: current.lat, lon: current.lon });
    if (destination) targets.push({ id: 'dest', lat: destination.lat, lon: destination.lon });
    engineRef.current?.setLabelTargets(targets);
  }, [current, destination]);

  useEffect(() => {
    if (current && destination) engineRef.current?.setRoute(current, destination);
    else engineRef.current?.clearRoute();
  }, [current, destination]);

  function runSearch(q) {
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    if (q.trim().length < 2) { setSearchResults([]); setSearchBusy(false); return; }
    setSearchBusy(true);
    searchTimerRef.current = setTimeout(async () => {
      try { setSearchResults(await searchDestination(q)); } catch { setSearchResults([]); }
      setSearchBusy(false);
    }, 320);
  }

  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  function openDestinationSearch() {
    setSearchOpen(true);
    const line = t.ko
      ? 'Captain, 목적지 검색을 열었습니다. 도시, 주소, 관광지 이름을 입력하거나 최근 목적지를 선택해 주세요.'
      : 'Captain, destination search is open. Enter a city, address, landmark, or choose a recent destination.';
    speakOrbit(line, t.ko ? 'ko' : 'en', setVoiceState);
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
    if (current) engineRef.current?.flyTo((current.lat + place.lat) / 2, (current.lon + place.lon) / 2, { duration: 1200 });
    setTab('live');
    if (current) {
      const km = haversineKm(current, place);
      const etaH = km / 850;
      let destWeatherLine = '';
      try {
        const w = await fetchWeather(place.lat, place.lon);
        if (w) destWeatherLine = t.ko ? ` 목적지 날씨는 ${Math.round(w.temperature_2m)}도입니다.` : ` Destination weather is ${Math.round(w.temperature_2m)} degrees.`;
      } catch { /* narration continues without destination weather if unavailable */ }
      const etaText = etaH < 1 ? `${Math.round(etaH * 60)}${t.ko ? '분' : ' minutes'}` : `${Math.floor(etaH)}${t.ko ? '시간' : 'h'} ${Math.round((etaH % 1) * 60)}${t.ko ? '분' : 'm'}`;
      const line = t.ko
        ? `Captain, 경로를 표시합니다. ${place.label.split(',')[0]}까지 ${Math.round(km).toLocaleString()}km, 예상 소요시간 ${etaText}입니다.${destWeatherLine}`
        : `Captain, route displayed. ${Math.round(km).toLocaleString()}km to ${place.label.split(',')[0]}, ETA ${etaText}.${destWeatherLine}`;
      speakOrbit(line, t.ko ? 'ko' : 'en', setVoiceState);
    }
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
      ? 'Captain, NOVA AI입니다. 상단의 목적지 찾기를 누르면 전 세계 도시와 장소를 검색할 수 있습니다. 지구는 손가락으로 돌리고 두 손가락으로 확대할 수 있습니다. 목적지를 선택하면 거리, 방위, 예상시간과 날씨를 안내합니다. SpaceNovaX는 앞으로 지속적인 업데이트를 통해 전 세계를 하나로 �