// Orbit Module — V18 Mobile-First Earth Command Center.
// Default view: ONLY Live Earth + thin top tabs + floating NOVA AI + shared bottom nav.
// Tapping a top tab opens a Bottom Sheet with that panel's info; tapping the same tab
// again (or the scrim) closes it back to the Earth-only view. No permanent side panels.
// Engine files (EarthEngine, SatelliteEngine, MasterRenderLoop, PerformanceManager) and
// all data-fetch logic (api.js, geo.js, captainBase.js) are reused exactly as-is.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import EarthEngine from './EarthEngine.js';
import MasterRenderLoop from './MasterRenderLoop.js';
import SatelliteEngine from './SatelliteEngine.js';
import PerformanceManager from './PerformanceManager.js';
import { fetchWeather, fetchAirQuality, fetchEarthquakes, fetchEonetEvents, reverseGeocode, searchDestination } from './api.js';
import { getCurrentPosition, haversineKm, bearingDeg, compassLabel } from './geo.js';
import { getCaptainBase, setBasePoint, addFavorite } from './captainBase.js';
import './orbit.css';

const NOVA_PORTRAIT = '/nova-ai-command-intelligence-v17.webp';

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
  const utter = new window.SpeechSynthesisUtterance(text);
  utter.lang = language === 'ko' ? 'ko-KR' : 'en-US';
  utter.rate = 1;
  utter.onstart = () => onStateChange?.('playing');
  utter.onend = () => onStateChange?.('idle');
  utter.onerror = () => onStateChange?.('idle');
  synth.speak(utter);
  return true;
}

const TABS = [
  { id: 'live', label: 'LIVE' },
  { id: 'satellite', label: 'SATELLITE' },
  { id: 'weather', label: 'WEATHER' },
  { id: 'event', label: 'EVENT' },
  { id: 'base', label: 'BASE' },
];

function useCopy(language) {
  const ko = language === 'ko';
  return useMemo(() => ({
    ko,
    currentPosition: 'CURRENT POSITION', gps: 'GPS', heading: 'HEADING', accuracy: 'ACCURACY', satellites: 'SATELLITES', altitude: 'ALTITUDE',
    myLocation: ko ? '내 위치로 이동' : 'Move to my location',
    satellitesTitle: 'SATELLITES', tracked: ko ? '추적 중' : 'TRACKED',
    earthEvents: 'EARTH EVENTS', typhoon: ko ? '태풍' : 'Typhoon', quake: ko ? '지진' : 'Earthquake', volcano: ko ? '화산' : 'Volcano', wildfire: ko ? '산불' : 'Wildfire',
    destination: 'DESTINATION', searchPlaceholder: ko ? '목적지 검색...' : 'Search destination…',
    distance: 'DISTANCE', eta: 'ETA', course: 'COURSE', startRoute: ko ? '경로 시작' : 'Start route', addFavorite: ko ? '즐겨찾기에 추가' : 'Add to favorites',
    weather: 'WEATHER', wind: ko ? '풍속' : 'Wind', humidity: ko ? '습도' : 'Humidity', air: ko ? '대기질' : 'Air quality',
    online: 'ONLINE', connected: 'CONNECTED', ready: 'READY',
    system: 'SYSTEM', network: 'NETWORK', dataRate: 'DATA RATE', uptime: 'UPTIME', version: 'VERSION',
    nominal: ko ? '전체 시스템 정상' : 'ALL SYSTEMS NOMINAL', stable: ko ? '안정' : 'STABLE', offline: ko ? '오프라인' : 'OFFLINE',
    captainBase: 'CAPTAIN BASE', setHome: ko ? '집 저장' : 'Save Home', setWork: ko ? '회사 저장' : 'Save Work', notSet: '—',
  }), [ko]);
}

function aqiLabel(v, ko) {
  if (v == null) return { text: '—', cls: '' };
  if (v <= 40) return { text: ko ? '좋음' : 'Good', cls: 'ok' };
  if (v <= 80) return { text: ko ? '보통' : 'Fair', cls: '' };
  return { text: ko ? '나쁨' : 'Poor', cls: '' };
}

export default function OrbitScreen({ language, user }) {
  const t = useCopy(language);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const perfRef = useRef(null);
  const [voiceState, setVoiceState] = useState('idle');

  const [tab, setTab] = useState('live'); // 'live' = no sheet open (Earth-only default view)
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
  const [base, setBase] = useState(() => getCaptainBase());
  const [markerPos, setMarkerPos] = useState({});
  const [novaOpen, setNovaOpen] = useState(false);
  const [novaDragPos, setNovaDragPos] = useState({ x: 0, y: 0 });
  const [novaMsgs, setNovaMsgs] = useState([]);
  const [novaInput, setNovaInput] = useState('');
  const [novaBusy, setNovaBusy] = useState(false);
  const [apiHealthy, setApiHealthy] = useState(true);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const engine = new EarthEngine(containerRef.current, {});
    engineRef.current = engine;
    perfRef.current = new PerformanceManager({ onModeChange: (low) => MasterRenderLoop.setFrameSkip(low ? 2 : 1) });
    MasterRenderLoop.add('orbit-earth', (time) => engine.renderFrame(time));
    MasterRenderLoop.add('orbit-perf', () => perfRef.current?.tick());
    engine.setSunFromDate(new Date());
    engine.setLabelCallback((positions) => setMarkerPos(positions));
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
    getCurrentPosition().then((pos) => {
      setCurrent(pos);
      setAccuracy(pos.accuracy || null);
      setHeading(typeof pos.heading === 'number' ? pos.heading : null);
      engineRef.current?.flyTo(pos.lat, pos.lon, { duration: 1100 });
    }).catch(() => setCurrent(base.home || { lat: 37.5665, lon: 126.9780 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!current) return;
    reverseGeocode(current.lat, current.lon).then(setCurrentPlace).catch(() => setApiHealthy(false));
    fetchWeather(current.lat, current.lon).then(setWeather).catch(() => setApiHealthy(false));
    fetchAirQuality(current.lat, current.lon).then(setAqi).catch(() => {});
  }, [current?.lat, current?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (engineRef.current) {
          const markers = positions.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, color: 0x53e7ff }));
          if (iss) markers.push({ id: 'ISS', lat: iss.lat, lon: iss.lon, color: 0xffffff });
          engineRef.current.setMarkerLayer('satellite', markers, { size: 0.045 });
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
        ...quakes.map((q) => ({ id: `q_${q.id}`, kind: 'quake', lat: q.lat, lon: q.lon, time: q.time })),
        ...eonet.map((e) => ({ id: `e_${e.id}`, kind: /wildfire/i.test(e.category) ? 'wildfire' : /volcano/i.test(e.category) ? 'volcano' : /storm|cyclone/i.test(e.category) ? 'typhoon' : 'other', lat: e.lat, lon: e.lon, time: e.date ? Date.parse(e.date) : 0 })),
      ];
      setEvents(merged);
      if (engineRef.current) {
        const markers = merged.filter((m) => Number.isFinite(m.lat)).map((m) => ({ id: m.id, lat: m.lat, lon: m.lon, color: m.kind === 'quake' ? 0xff6f6f : 0xffc15e }));
        engineRef.current.setMarkerLayer('events', markers, { size: 0.04 });
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

  async function runSearch(q) {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    try { setSearchResults(await searchDestination(q)); } catch { setSearchResults([]); }
  }

  // Navigation UX chain: search -> destination -> Camera FlyTo -> Arc Route -> Weather ->
  // Distance -> Time -> NOVA Voice, all triggered from one selection.
  async function pickDestination(place) {
    setDestination(place);
    setSearchQuery('');
    setSearchResults([]);
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
      speakOrbit(line, language, setVoiceState);
    }
  }

  function saveSlot(slot) { if (current) setBase({ ...setBasePoint(slot, current) }); }

  function selectTab(id) { setTab((cur) => (cur === id ? 'live' : id)); }

  const dragRef = useRef(null);
  function onCardPointerDown(e) { dragRef.current = { moved: false, startX: e.clientX, startY: e.clientY, origin: { ...novaDragPos } }; e.currentTarget.setPointerCapture(e.pointerId); }
  function onCardPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) { dragRef.current.moved = true; setNovaDragPos({ x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy }); }
  }
  function onCardPointerUp() { if (dragRef.current && !dragRef.current.moved) setNovaOpen((v) => !v); dragRef.current = null; }

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

  const distanceKm = current && destination ? haversineKm(current, destination) : null;
  const etaHours = distanceKm != null ? distanceKm / 850 : null;
  const courseDeg = current && destination ? bearingDeg(current, destination) : null;
  const air = aqiLabel(aqi, t.ko);
  const netStable = navigator.onLine !== false && apiHealthy;
  const dataRate = navigator.connection?.downlink ? `${navigator.connection.downlink} Mbps` : '—';
  const uptimeMs = clock.getTime() - mountedAt.current;
  const uptimeStr = `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`;
  const eventCounts = { typhoon: events.filter((e) => e.kind === 'typhoon').length, quake: events.filter((e) => e.kind === 'quake').length, volcano: events.filter((e) => e.kind === 'volcano').length, wildfire: events.filter((e) => e.kind === 'wildfire').length };
  const sheetOpen = tab !== 'live';

  return (
    <div className="orbit-root">
      <div className="orbit-globe-wrap">
        <div className="orbit-globe-canvas" ref={containerRef} />
        {current && <div className="orbit-coord-pill"><span>LAT</span>{current.lat.toFixed(4)}° N&nbsp;&nbsp;<span>LON</span>{current.lon.toFixed(4)}° E</div>}
        <div className="orbit-crosshair" />
        {markerPos.current?.visible && <div className="orbit-marker current" style={{ left: markerPos.current.x, top: markerPos.current.y }}><div className="dot" /><span className="tag">CURRENT</span></div>}
        {markerPos.dest?.visible && <div className="orbit-marker dest" style={{ left: markerPos.dest.x, top: markerPos.dest.y }}><div className="dot" /><span className="tag">DESTINATION</span></div>}
        <div className="orbit-globe-controls">
          <button className="orbit-zoom-btn" onClick={() => engineRef.current?.zoomBy(0.5)}>−</button>
          <button className="orbit-recenter-btn" onClick={() => engineRef.current?.recenter()}>⊕</button>
          <button className="orbit-zoom-btn" onClick={() => engineRef.current?.zoomBy(-0.5)}>+</button>
        </div>
      </div>

      <div className="orbit-topbar">
        <div className="orbit-tabs">{TABS.map((tb) => <button key={tb.id} className={`orbit-tab ${tab === tb.id ? 'active' : ''}`} onClick={() => selectTab(tb.id)}>{tb.label}</button>)}</div>
        <div className="orbit-top-right"><div className="orbit-clock">{clock.toISOString().slice(11, 19)} UTC<br />{clock.toISOString().slice(0, 10)}</div></div>
 