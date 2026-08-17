import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './nova-navigation.css';

const DEFAULT_POSITION = { lat: 37.5665, lon: 126.978, heading: 0, speed: 0 };
const vehicleIcon = (heading = 0) => L.divIcon({ className: 'nova-nav-icon', html: `<b style="transform:rotate(${heading}deg)">▲</b>`, iconSize: [42, 42], iconAnchor: [21, 21] });
const destinationIcon = L.divIcon({ className: 'nova-nav-destination', html: '<b>◆</b>', iconSize: [34, 34], iconAnchor: [17, 17] });

function MapFollow({ current, route, navigating }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!route?.points?.length || fitted.current) return;
    fitted.current = true;
    map.fitBounds(route.points.map((point) => [point.lat, point.lon]), { padding: [40, 90], maxZoom: 16, animate: true });
  }, [map, route]);
  useEffect(() => { if (navigating && current) map.panTo([current.lat, current.lon], { animate: true, duration: .35 }); }, [map, current?.lat, current?.lon, navigating]);
  return null;
}

function normalizeQuery(value) { return String(value || '').trim().replace(/\s+/g, ' '); }
function formatDistance(meters = 0) { return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.max(0, Math.round(meters))} m`; }
function formatEta(seconds = 0) { const minutes = Math.max(1, Math.round(seconds / 60)); return minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`; }
function arrivalTime(seconds = 0) { return new Date(Date.now() + seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }
function distanceMeters(a, b) { const r = 6371000; const dLat = (b.lat - a.lat) * Math.PI / 180; const dLon = (b.lon - a.lon) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }

function ping() {
  try { const context = new (window.AudioContext || window.webkitAudioContext)(); const start = context.currentTime; [740, 980].forEach((frequency, index) => { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.08, start + index * .14); gain.gain.exponentialRampToValueAtTime(.001, start + index * .14 + .12); oscillator.connect(gain).connect(context.destination); oscillator.start(start + index * .14); oscillator.stop(start + index * .14 + .13); }); } catch {}
}
function speak(text) { if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ko-KR'; utterance.rate = .98; window.speechSynthesis.speak(utterance); }

export default function NovaNavigationApp() {
  const [current, setCurrent] = useState(DEFAULT_POSITION);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [navigating, setNavigating] = useState(false);
  const [notice, setNotice] = useState('출발지와 목적지를 선택하세요.');
  const [locationState, setLocationState] = useState('GPS 확인 필요');
  const watchRef = useRef(null);
  const routeRef = useRef(null);
  const currentRef = useRef(current);
  const destinationRef = useRef(destination);
  const navigatingRef = useRef(navigating);

  useEffect(() => { routeRef.current = route; }, [route]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { destinationRef.current = destination; }, [destination]);
  useEffect(() => { navigatingRef.current = navigating; }, [navigating]);
  useEffect(() => () => { if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => {
    const value = normalizeQuery(query);
    if (value.length < 2) { setResults([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/orbit/geocode?q=${encodeURIComponent(value)}&lang=ko`);
        const data = await response.json();
        setResults(data.results || []);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function updatePosition(position) {
    const next = { lat: position.coords.latitude, lon: position.coords.longitude, heading: Number.isFinite(position.coords.heading) ? position.coords.heading : currentRef.current.heading, speed: Math.max(0, (position.coords.speed || 0) * 3.6) };
    setCurrent(next); setLocationState('GPS 연결됨');
    if (navigatingRef.current && routeRef.current?.points?.length && destinationRef.current && distanceMeters(next, destinationRef.current) < 35) {
      ping(); speak('목적지에 도착하였습니다. 안내를 종료하겠습니다.'); setNotice('목적지에 도착했습니다. 안내를 종료했습니다.'); setNavigating(false);
      if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    }
  }
  function requestLocation(announce = false) {
    if (!navigator.geolocation) { setLocationState('이 기기에서는 GPS를 지원하지 않습니다'); return; }
    setLocationState('GPS 연결 중…');
    navigator.geolocation.getCurrentPosition((position) => { updatePosition(position); if (announce) { ping(); speak('GPS 연결되었습니다. 안내를 시작하겠습니다.'); } }, () => setLocationState('GPS 권한을 허용해 주세요.'), { enableHighAccuracy: true, maximumAge: 8000, timeout: 12000 });
  }
  async function buildRoute(place) {
    setDestination(place); setRoute(null); setNotice('경로를 계산하고 있습니다…');
    try {
      const response = await fetch(`/api/orbit/route?fromLat=${currentRef.current.lat}&fromLon=${currentRef.current.lon}&toLat=${place.lat}&toLon=${place.lon}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.message);
      setRoute(data.route); setNotice('경로가 준비되었습니다. 안내 시작을 누르세요.');
    } catch (error) { setNotice(error.message || '경로를 찾지 못했습니다. 다른 장소를 선택해 주세요.'); }
  }
  function startNavigation() {
    if (!route || !destination) return;
    requestLocation(true); setNavigating(true); setNotice('NOVA가 경로 안내를 시작합니다.');
    if (navigator.geolocation && watchRef.current == null) watchRef.current = navigator.geolocation.watchPosition(updatePosition, () => setLocationState('GPS 신호를 다시 찾고 있습니다…'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  }
  function stopNavigation() { setNavigating(false); if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; } window.speechSynthesis?.cancel(); setNotice('경로 안내를 종료했습니다.'); }
  const nextStep = useMemo(() => route?.steps?.[0], [route]);

  return <main className="nova-navigation-app">
    <header className="nova-nav-header"><a href="https://app.spacenovax.com" aria-label="SpaceNovaX 앱으로 돌아가기">✦ <b>SpaceNovaX</b></a><span>NOVA GUIDED NAVIGATION LITE</span><button onClick={() => requestLocation(false)}>⌖ 내 위치</button></header>
    <section className="nova-nav-search"><div className="nova-nav-input"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="주소, 장소 또는 지역 이름 검색" autoComplete="street-address" /><button onClick={() => setQuery('')}>×</button></div>{results.length > 0 && <div className="nova-nav-results">{results.map((place) => <button key={place.id} onClick={() => { setQuery(place.label); setResults([]); buildRoute(place); }}><b>{place.label.split(',')[0]}</b><small>{place.label}</small><i>›</i></button>)}</div>}</section>
    <section className="nova-nav-map-wrap"><MapContainer center={[current.lat, current.lon]} zoom={13} zoomControl className="nova-nav-map"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution="© OpenStreetMap contributors" />{route?.points?.length > 1 && <><Polyline positions={route.points.map((point) => [point.lat, point.lon])} pathOptions={{ color: '#06182d', weight: 15, opacity: .9 }} /><Polyline positions={route.points.map((point) => [point.lat, point.lon])} pathOptions={{ color: '#1b8cff', weight: 8 }} /></>}<Marker position={[current.lat, current.lon]} icon={vehicleIcon(current.heading)} />{destination && <Marker position={[destination.lat, destination.lon]} icon={destinationIcon} />}<MapFollow current={current} route={route} navigating={navigating} /></MapContainer>{navigating && <div className="nova-nav-next"><strong>{/left/i.test(nextStep?.maneuver?.modifier || '') ? '↰' : /right/i.test(nextStep?.maneuver?.modifier || '') ? '↱' : '↑'}</strong><div><small>다음 안내</small><b>{nextStep?.name || '안내 경로를 따라 이동하세요'}</b></div><em>{nextStep?.distanceM ? formatDistance(nextStep.distanceM) : '—'}</em></div>}</section>
    <section className="nova-nav-panel"><div className="nova-nav-status"><i className={locationState === 'GPS 연결됨' ? 'ok' : ''} />{locationState}<span>{notice}</span></div>{destination ? <><div className="nova-nav-destination-label"><small>목적지</small><b>{destination.label.split(',')[0]}</b><button onClick={() => { setDestination(null); setRoute(null); setQuery(''); }}>변경</button></div>{route && <div className="nova-nav-stats"><div><small>남은 거리</small><b>{formatDistance(route.distanceM)}</b></div><div><small>예상 시간</small><b>{formatEta(route.durationSec)}</b></div><div><small>도착 예정</small><b>{arrivalTime(route.durationSec)}</b></div><div><small>현재 속도</small><b>{Math.round(current.speed)} km/h</b></div></div>}<div className="nova-nav-actions">{navigating ? <button className="danger" onClick={stopNavigation}>■ 길안내 종료</button> : <button className="primary" disabled={!route} onClick={startNavigation}>▶ 길안내 시작</button>}<button onClick={() => requestLocation(false)}>⌖ GPS 재검색</button></div></> : <div className="nova-nav-empty">목적지를 검색하면 주변 장소와 이동 경로를 표시합니다.</div>}<p className="nova-nav-safety">안전 안내: 실제 도로 표지·현지 교통법규를 우선하세요. GPS 및 지도 데이터는 보조 수단입니다.</p></section>
  </main>;
}