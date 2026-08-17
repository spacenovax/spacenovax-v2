import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const destinationIcon = L.divIcon({ className: 'ov20-destination-marker-wrap', html: '<div class="ov20-destination-marker">◆</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
const vehicleIcon = (heading = 0) => L.divIcon({ className: 'ov20-car-marker-wrap', html: `<div class="ov20-car-marker" style="transform:rotate(${Number.isFinite(heading) ? heading : 0}deg)">▲</div>`, iconSize: [56, 56], iconAnchor: [28, 28] });
const routeArrow = (heading) => L.divIcon({ className: 'ov20-route-arrow-wrap', html: `<i style="transform:rotate(${heading}deg)">➤</i>`, iconSize: [20, 20], iconAnchor: [10, 10] });

function bearing(from, to) { return (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI + 90 + 360) % 360; }

function useScreenWakeLock() {
  useEffect(() => {
    let wakeLock = null;
    let released = false;
    const requestWakeLock = async () => {
      if (released || !navigator?.wakeLock?.request) return;
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* browser/webview may decline this optional feature */ }
    };
    const restoreWakeLock = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    requestWakeLock();
    document.addEventListener('visibilitychange', restoreWakeLock);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', restoreWakeLock);
      wakeLock?.release?.().catch?.(() => {});
    };
  }, []);
}

function MapCamera({ current, points, recenterToken, lowDataMode }) {
  const map = useMap();
  const initialized = useRef(false);
  const lastFollowedPosition = useRef('');
  useEffect(() => {
    if (!current) return;
    const currentKey = `${current.lat.toFixed(5)},${current.lon.toFixed(5)}`;
    const followZoom = lowDataMode ? 16 : 17;
    if (!initialized.current) {
      initialized.current = true;
      lastFollowedPosition.current = currentKey;
      // Start in a close road-level view, not a whole-route overview. This is
      // the useful mobile-navigation perspective: nearby roads and the next
      // intersection are immediately visible when the captain taps Go.
      map.setView([current.lat, current.lon], followZoom, { animate: false });
      return;
    }
    // A navigation screen must stay with the moving GPS marker.  Previously the
    // map moved only after a manual GPS tap, so a long trip looked frozen even
    // while the vehicle marker and route were updating.
    if (recenterToken > 0 || lastFollowedPosition.current !== currentKey) {
      lastFollowedPosition.current = currentKey;
      map.flyTo([current.lat, current.lon], Math.max(map.getZoom(), followZoom), { animate: !lowDataMode, duration: lowDataMode ? 0 : .45 });
    }
  }, [current?.lat, current?.lon, points.length, recenterToken, lowDataMode]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function MapControls({ onRecenter, onExit, lowDataMode, onToggleLowDataMode, onOpenReport }) {
  const map = useMap();
  return <aside className="ov20-driving-controls">
    <button onClick={() => map.zoomIn()} aria-label="Zoom in">+</button>
    <button onClick={() => map.zoomOut()} aria-label="Zoom out">−</button>
    <button className="ov20-driving-recenter" onClick={onRecenter} aria-label="Recenter on GPS">⌖<small>GPS</small></button>
    <button className={`ov20-driving-data ${lowDataMode ? 'active' : ''}`} onClick={onToggleLowDataMode} aria-label="Toggle low data mode">▱<small>{lowDataMode ? 'ECO' : 'DATA'}</small></button>
    <button className="ov20-driving-report-button" onClick={onOpenReport} aria-label="Report a map issue">⚑<small>MAP</small></button>
    <button className="ov20-driving-globe" onClick={onExit} aria-label="Return to globe">◉<small>3D</small></button>
  </aside>;
}

function MapReportPanel({ t, onClose, onSubmit }) {
  const [category, setCategory] = useState('missing_road');
  const [note, setNote] = useState('');
  const [state, setState] = useState('idle');
  const labels = t.ko
    ? { missing_road: '도로 또는 길이 없음', wrong_route: '경로가 맞지 않음', road_blocked: '통행 불가 또는 공사', unsafe: '안전상 주의 필요', other: '기타' }
    : { missing_road: 'Missing road or path', wrong_route: 'Wrong route', road_blocked: 'Blocked road or construction', unsafe: 'Safety concern', other: 'Other' };

  async function submit(event) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const message = await onSubmit({ category, note });
      setState(message || 'sent');
    } catch (error) {
      setState(error.message || (t.ko ? '신고를 보내지 못했습니다.' : 'Could not send report.'));
    }
  }

  return <form className="ov20-driving-report" onSubmit={submit} aria-label={t.ko ? '지도 오류 신고' : 'Map issue report'}>
    <header><b>{t.ko ? '지도 오류 신고' : 'MAP ISSUE REPORT'}</b><button type="button" onClick={onClose} aria-label={t.ko ? '닫기' : 'Close'}>×</button></header>
    {state !== 'idle' && state !== 'sending' ? <p className="ov20-driving-report-result">{state}</p> : <>
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t.ko ? '오류 유형' : 'Issue type'}>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 300))} placeholder={t.ko ? '필요한 내용을 짧게 적어 주세요. (선택)' : 'Add a short note (optional).'} maxLength={300} />
      <small>{t.ko ? '정확한 GPS는 저장하지 않고 약 100m 단위 위치만 보냅니다.' : 'Only an approximate location (about 100m) is sent; exact GPS is not stored.'}</small>
      <button type="submit" disabled={state === 'sending'}>{state === 'sending' ? (t.ko ? '전송 중…' : 'SENDING…') : (t.ko ? '신고 보내기' : 'SEND REPORT')}</button>
    </>}
  </form>;
}

function formatEta(hours, ko) { if (hours == null) return '—'; if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}${ko ? '분' : ' min'}`; return `${Math.floor(hours)}${ko ? '시간 ' : 'h '}${Math.round((hours % 1) * 60)}${ko ? '분' : 'min'}`; }
function formatArrivalTime(hours, ko) {
  if (!Number.isFinite(hours) || hours < 0) return '—';
  const at = new Date(Date.now() + hours * 3600000);
  const time = new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(at);
  return ko ? time + ' 도착' : time + ' arrival';
}
function turnSymbol(maneuver) { if (/left/i.test(maneuver)) return '↰'; if (/right/i.test(maneuver)) return '↱'; if (/uturn/i.test(maneuver)) return '↶'; return '↑'; }

export default function OrbitDrivingView({ t, current, destination, route, etaHours, distanceKm, nextStep, navigationProgress, routeStatus, lowDataMode, gpsState, accuracy, liveSpeedMps, guidanceSafetyState = 'ready', networkOnline, onResume, onChangeDestination, onToggleLowDataMode, onReport, onExit, onStop }) {
  const [recenterToken, setRecenterToken] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const points = useMemo(() => (route?.points || []).map((point) => [point.lat, point.lon]), [route]);
  const arrows = useMemo(() => {
    const stride = Math.max(5, Math.floor(points.length / 14));
    return points.filter((_, index) => index > 1 && index < points.length - 1 && index % stride === 0).map((point, index) => ({ point, heading: bearing(points[Math.max(0, (index + 1) * stride - 1)], point) }));
  }, [points]);
  useScreenWakeLock();
  const maneuver = nextStep?.maneuver?.modifier || nextStep?.maneuver?.type || 'continue';
  const road = nextStep?.name || (t.ko ? '안내 경로' : 'Guidance route');
  const maneuverDistanceM = nextStep?.distanceToManeuverM ?? nextStep?.distanceM;
  const isRerouting = routeStatus === 'rerouting';
  const isSavedRoute = routeStatus === 'saved' || route?.source === 'saved';
  const weakGps = gpsState === 'live' && Number.isFinite(accuracy) && accuracy > 80;
  const guidancePaused = guidanceSafetyState === 'paused';
  const guidanceArrived = guidanceSafetyState === 'arrived';
  const speedKmh = Number.isFinite(liveSpeedMps) && liveSpeedMps >= 0 ? liveSpeedMps * 3.6 : null;
  const reliableLiveSpeed = Number.isFinite(speedKmh) && speedKmh >= 4 && speedKmh <= 180
    && (!Number.isFinite(accuracy) || accuracy <= 65)
    && (!current.capturedAt || Date.now() - current.capturedAt <= 20_000);
  const liveEtaHours = reliableLiveSpeed && Number.isFinite(distanceKm) ? distanceKm / speedKmh : null;
  // Blend GPS speed with the route's road-time estimate, capped to avoid a single
  // noisy GPS fix producing an unsafe or wildly optimistic arrival prediction.
  const navigationEtaHours = liveEtaHours != null && etaHours != null
    ? Math.max(etaHours * 0.65, Math.min(etaHours * 1.65, etaHours * 0.55 + liveEtaHours * 0.45))
    : (liveEtaHours ?? etaHours);
  const signalNote = !networkOnline
    ? t.offlineGuidance
    : weakGps
      ? `${t.gpsSignalWeak} · ±${Math.round(accuracy)}m`
      : '';
  const statusLabel = guidanceArrived
    ? (t.ko ? '목적지 도착 · 안내 종료' : 'ARRIVED · GUIDANCE ENDED')
    : guidancePaused
      ? (t.ko ? '안전 정지 · GPS 확인 필요' : 'SAFETY PAUSE · CHECK GPS')
      : isRerouting
      ? (t.ko ? '경로 재탐색 중' : 'REROUTING')
    : isSavedRoute
      ? (t.ko ? '저장 경로 · 연결 확인 필요' : 'SAVED ROUTE · CHECK ONLINE')
      : (t.ko ? 'NOVA LITE · GPS 안내' : 'NOVA LITE · GPS GUIDANCE');
  if (!current || !destination || points.length < 2) return null;

  return <section className={`ov20-driving ${lowDataMode ? 'low-data' : ''}`} aria-label="Driving navigation">
    <MapContainer center={[current.lat, current.lon]} zoom={15} zoomControl={false} className="ov20-driving-map" attributionControl zoomAnimation={!lowDataMode} fadeAnimation={!lowDataMode} markerZoomAnimation={!lowDataMode} preferCanvas>
      <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} maxNativeZoom={lowDataMode ? 16 : 19} keepBuffer={lowDataMode ? 0 : 2} updateWhenIdle={lowDataMode} updateWhenZooming={!lowDataMode} />
      <Polyline positions={points} pathOptions={{ color: '#062142', weight: 15, opacity: .86 }} />
      <Polyline positions={points} pathOptions={{ color: '#147ff5', weight: 8, opacity: 1 }} />
      {!lowDataMode && arrows.map((arrow, index) => <Marker key={`${arrow.point.join(',')}-${index}`} position={arrow.point} icon={routeArrow(arrow.heading)} interactive={false} />)}
      <Marker position={[current.lat, current.lon]} icon={vehicleIcon(current.heading)} /><Marker position={[destination.lat, destination.lon]} icon={destinationIcon} />
      <MapCamera current={current} points={points} recenterToken={recenterToken} lowDataMode={lowDataMode} />
      <MapControls onRecenter={() => setRecenterToken((value) => value + 1)} onExit={onExit} lowDataMode={lowDataMode} onToggleLowDataMode={onToggleLowDataMode} onOpenReport={() => setReportOpen((open) => !open)} />
    </MapContainer>
    <header className="ov20-driving-top"><button onClick={onExit}>‹ {t.ko ? '지구본' : 'GLOBE'}</button><span className={guidanceArrived ? 'arrived' : guidancePaused ? 'paused' : isRerouting ? 'rerouting' : isSavedRoute ? 'saved' : ''}><i /> {statusLabel}</span><button onClick={onStop}>■ {t.ko ? '종료' : 'END'}</button></header>
    {guidancePaused && <aside className="ov20-driving-safety-pause" role="alert"><b>{t.ko ? '음성 안내가 일시 정지되었습니다' : 'Voice guidance is paused'}</b><small>{t.ko ? 'GPS를 확인하고 안전한 곳에 정차한 뒤 다시 시작하세요. 도로 표지·현장 통제·교통법규를 우선하세요.' : 'Check GPS and resume only when safely stopped. Follow road signs, local controls, and traffic laws.'}</small><button onClick={onResume}>{t.ko ? 'GPS 확인 후 다시 시작' : 'RESUME AFTER GPS CHECK'}</button></aside>}
    <div className="ov20-driving-instruction"><strong>{turnSymbol(maneuver)}</strong><div><small>{t.ko ? '다음 안내' : 'NEXT MANEUVER'}</small><b>{road}</b>{Number.isFinite(navigationProgress?.offRouteM) && navigationProgress.offRouteM > 55 && <small className="ov20-driving-gps-note">{t.ko ? 'GPS 위치 확인 중' : 'CHECKING GPS POSITION'}</small>}{signalNote && <small className="ov20-driving-gps-note warning">⚠ {signalNote}</small>}</div><em>{Number.isFinite(maneuverDistanceM) ? `${Math.max(1, Math.round(maneuverDistanceM / 10) * 10)} m` : '—'}</em></div>
    {reportOpen && <MapReportPanel t={t} onClose={() => setReportOpen(false)} onSubmit={onReport} />}
    <section className="ov20-driving-actions" aria-label={t.ko ? '길안내 설정' : 'Navigation settings'}>
      <button onClick={() => setRecenterToken((value) => value + 1)}>⌖ {t.ko ? '내 위치' : 'MY LOCATION'}</button>
      <button onClick={onChangeDestination}>⌕ {t.ko ? '목적지 변경' : 'CHANGE DESTINATION'}</button>
      {guidancePaused ? <button className="primary" onClick={onResume}>▶ {t.ko ? '길안내 재개' : 'RESUME GUIDANCE'}</button> : <button className="primary" onClick={onStop}>■ {t.ko ? '길안내 종료' : 'END GUIDANCE'}</button>}
    </section>
    <footer className="ov20-driving-bottom ov20-driving-live-metrics">
      <div><small>{t.ko ? '현재 속도' : 'LIVE SPEED'}</small><b>{speedKmh == null ? '—' : `${Math.round(speedKmh)} km/h`}</b></div>
      <div><small>{t.remaining}</small><b>{distanceKm == null ? '—' : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`}</b></div>
      <div><small>{t.ko ? '예상 시간' : 'ETA'}</small><b>{formatEta(navigationEtaHours, t.ko)}</b></div>
      <div><small>{t.ko ? '예상 도착' : 'ARRIVAL'}</small><b>{formatArrivalTime(navigationEtaHours, t.ko)}</b></div>
    </footer>
  </section>;
}
