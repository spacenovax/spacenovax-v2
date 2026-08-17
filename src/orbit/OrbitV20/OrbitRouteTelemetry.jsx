import React, { useEffect, useState } from 'react';

function formatEta(hours, ko) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}${ko ? '분' : 'm'}`;
  return `${Math.floor(hours)}${ko ? '시간' : 'h'} ${Math.round((hours % 1) * 60)}${ko ? '분' : 'm'}`;
}

// A compact route readout for the 3D Earth. It deliberately reports an estimate rather
// than claiming turn-by-turn transport guidance: this is a global/orbital visualisation.
export default function OrbitRouteTelemetry({ t, current, currentPlace, destination, distanceKm, etaHours, courseDeg, compassLabel, navigationActive, hasArrived, routeStatus, nextStep, gpsState, accuracy, networkOnline, onSearch, onStartNavigation, onStopNavigation, onShareRoute, onOpenOfflinePacks, offlinePackCount = 0, routeMode = 'recommended', onRouteModeChange }) {
  const hasRoute = Boolean(current && destination && distanceKm != null);
  const from = currentPlace?.city || currentPlace?.country || (t.ko ? '현재 위치' : 'Current position');
  const to = destination?.label?.split(',')[0] || (t.ko ? '목적지를 선택하세요' : 'Select a destination');
  const [shareState, setShareState] = useState('');
  const weakGps = gpsState === 'live' && Number.isFinite(accuracy) && accuracy > 80;
  const locationUnavailable = gpsState && gpsState !== 'live';
  const signalNotice = !networkOnline
    ? t.offlineGuidance
    : locationUnavailable
      ? t.gpsPermissionHint
      : weakGps
        ? `${t.gpsSignalWeak} · ±${Math.round(accuracy)}m`
        : '';

  useEffect(() => {
    if (!shareState) return undefined;
    const timer = window.setTimeout(() => setShareState(''), 2800);
    return () => window.clearTimeout(timer);
  }, [shareState]);

  async function shareRoute() {
    if (!onShareRoute) return;
    setShareState('working');
    try {
      const result = await onShareRoute();
      setShareState(result === 'copied' ? 'copied' : 'shared');
    } catch (error) {
      if (error?.name === 'AbortError') setShareState('');
      else setShareState('error');
    }
  }

  return (
    <section className={`ov20-route-telemetry ${hasRoute ? 'has-route' : ''}`} aria-label="Orbit route telemetry">
      <div className="ov20-route-head">
        <span className="ov20-route-icon">⌁</span>
        <div className="ov20-route-copy"><small>{hasArrived ? t.arrived : navigationActive ? t.liveGuidance : 'NOVA GLOBAL NAVIGATION'}</small><b>{from} <em>→</em> {to}</b></div>
        <div className="ov20-route-actions">
          {onOpenOfflinePacks && <button className="ov20-route-offline-btn" onClick={onOpenOfflinePacks} aria-label={t.ko ? '오프라인 지역 경로팩 관리' : 'Manage offline regional route packs'}>▣ ${offlinePackCount}/3</button>}
          {hasRoute && !navigationActive && !hasArrived && <button className="ov20-route-share" onClick={shareRoute} aria-label={t.ko ? '현재 위치를 포함하지 않고 목적지만 공유' : 'Share destination only; your current location is not included'}>{shareState === 'working' ? '…' : `↗ ${t.shareRoute}`}</button>}
          <button onClick={onSearch}>{hasRoute ? (t.ko ? '경로 변경' : 'CHANGE') : t.findDestination}</button>
        </div>
      </div>
      {hasRoute && <small className="ov20-route-road-status">{routeStatus === 'loading' ? (t.ko ? '자동차 도로 경로 계산 중…' : 'CALCULATING DRIVING ROUTE…') : routeStatus === 'rerouting' ? (t.ko ? 'NOVA가 현재 위치에서 새 경로를 탐색 중입니다…' : 'NOVA IS FINDING A NEW ROUTE…') : routeStatus === 'offline_pack' ? (t.ko ? '오프라인 지역 경로팩 · 연결 전까지 재탐색 불가' : 'OFFLINE REGION PACK · NO REROUTE UNTIL ONLINE') : routeStatus === 'saved' ? (t.ko ? 'NOVA LITE 저장 경로 · 연결 후 경로 확인' : 'NOVA LITE SAVED ROUTE · CHECK WHEN ONLINE') : routeStatus === 'ready' ? `${t.ko ? 'NOVA LITE 자동차 경로' : 'NOVA LITE DRIVING ROUTE'}${nextStep?.name ? ` · ${nextStep.name}` : ''}` : (t.ko ? '도로 경로를 불러오지 못했습니다. 직선 거리만 표시합니다.' : 'Driving route unavailable. Showing direct distance.')}</small>}
      {hasRoute && !navigationActive && !hasArrived && <div className="ov20-route-mode-selector" aria-label={t.ko ? '도로 선택' : 'Route preference'}>
        {[['recommended', t.ko ? '추천 경로' : 'Recommended'], ['toll', t.ko ? '유료도로 허용' : 'Allow tolls'], ['free', t.ko ? '무료도로 우선' : 'Avoid tolls']].map(([id, label]) => <button key={id} type="button" className={routeMode === id ? 'active' : ''} onClick={() => onRouteModeChange?.(id)}>{label}</button>)}
      </div>}
      {hasRoute && routeMode !== 'recommended' && <small className="ov20-route-toll-note">{t.ko ? '선택한 도로 유형으로 경로를 계산하며, 재탐색에도 같은 선택을 유지합니다. 지원 국가에서는 예상 통행료가 표시됩니다.' : 'The selected road preference is kept during rerouting. Estimated tolls appear where supported.'}</small>}
      {hasRoute && signalNotice && <small className="ov20-route-signal-note">⚠ {signalNotice}</small>}
      {shareState && shareState !== 'working' && <small className={`ov20-route-share-state ${shareState}`}>{shareState === 'copied' ? t.routeCopied : shareState === 'shared' ? t.routeShared : (t.ko ? '경로를 공유하지 못했습니다.' : 'Could not share this route.')}</small>}
      <div className="ov20-route-metrics">
        <div><small>{t.distance}</small><b>{hasRoute ? `${Math.round(distanceKm).toLocaleString()} km` : '—'}</b></div>
        <div><small>{t.eta}</small><b>{formatEta(etaHours, t.ko)}</b></div>
        <div className="ov20-route-course"><small>{t.course}</small><b>{hasRoute ? `${compassLabel(courseDeg)} ${Math.round(courseDeg)}°` : '—'}</b></div>
      </div>
      {hasRoute && !hasArrived && <button className={`ov20-route-guidance-btn ${navigationActive ? 'active' : ''}`} onClick={navigationActive ? onStopNavigation : onStartNavigation}>
        {navigationActive ? `■ ${t.endNavigation}` : `▶ ${t.startNavigation}`}
      </button>}
    </section>
  );
}
