import React from 'react';
import { formatOfflinePackAge, OFFLINE_REGION_PACK_LIMIT } from '../navigationOfflinePacks.js';

function distanceLabel(pack, ko) {
  const km = Number(pack?.route?.distanceM || 0) / 1000;
  return km > 0 ? `${km < 10 ? km.toFixed(1) : Math.round(km)} km` : (ko ? '저장된 경로' : 'Saved route');
}

// This is deliberately not a "download a city" control. Public tile servers often
// prohibit offline prefetching. The kit makes the app shell and a captain-selected
// vector route available on-device, while visible map tiles remain browser-controlled.
export default function OrbitOfflineRegionPacks({ open, t, route, destination, packs, onSave, onRemove, onClose }) {
  if (!open) return null;
  const ko = t.ko;
  const canSave = Boolean(route?.source === 'live' && route?.points?.length >= 2 && destination);
  const source = route?.source;

  return (
    <section className="ov20-offline-pack-gate" role="dialog" aria-modal="true" aria-label={ko ? '오프라인 지역 경로팩' : 'Offline region route packs'}>
      <div className="ov20-offline-pack-card">
        <header>
          <span>▣</span>
          <div><small>NOVA GUIDED NAVIGATION LITE</small><h2>{ko ? '오프라인 지역 경로팩' : 'Offline Region Route Packs'}</h2></div>
          <button onClick={onClose} aria-label={t.close}>×</button>
        </header>

        <p className="ov20-offline-pack-intro">{ko
          ? '선택한 자동차 경로를 이 기기에 7일 동안 보관합니다. 데이터가 끊기면 이 저장 경로만 안내할 수 있으며, 경로 이탈 시 안내를 멈춥니다.'
          : 'Keep a selected driving route on this device for seven days. When data is unavailable, only the saved route can be guided and guidance stops if you leave it.'}</p>

        <div className="ov20-offline-pack-status">
          <div><i>✓</i><span><small>{ko ? '앱 기본 화면' : 'APP SHELL'}</small><b>{ko ? 'PWA 캐시로 오프라인 재실행 준비' : 'Prepared for offline restart with PWA cache'}</b></span></div>
          <div><i>◌</i><span><small>{ko ? '지도 표시' : 'MAP DISPLAY'}</small><b>{ko ? '온라인에서 실제로 본 지도 일부만 브라우저 캐시에 남을 수 있습니다.' : 'Only map areas actually viewed online may remain in browser cache.'}</b></span></div>
          <div className="warn"><i>!</i><span><small>{ko ? '미포함 정보' : 'NOT INCLUDED'}</small><b>{ko ? '교통, 공사, 통제, 도로 변경, 전체 도시 지도' : 'Traffic, works, closures, road changes, or a full city map'}</b></span></div>
        </div>

        <div className="ov20-offline-pack-action">
          <div><small>{ko ? '현재 경로' : 'CURRENT ROUTE'}</small><b>{destination?.label?.split(',')[0] || (ko ? '목적지를 먼저 선택하세요.' : 'Select a destination first.')}</b>{source === 'offline-pack' && <em>{ko ? '이미 지역 경로팩에서 불러왔습니다.' : 'Already loaded from an offline region pack.'}</em>}</div>
          <button disabled={!canSave} onClick={onSave}>{ko ? '이 경로 보관' : 'SAVE THIS ROUTE'}</button>
        </div>

        <section className="ov20-offline-pack-list" aria-label={ko ? '저장된 지역 경로' : 'Saved regional routes'}>
          <div className="ov20-offline-pack-list-head"><small>{ko ? `저장된 지역 경로 · 최대 ${OFFLINE_REGION_PACK_LIMIT}개` : `SAVED REGION ROUTES · ${OFFLINE_REGION_PACK_LIMIT} MAX`}</small><span>{packs.length}/{OFFLINE_REGION_PACK_LIMIT}</span></div>
          {packs.length ? packs.map((pack) => <article key={pack.id}>
            <div><b>{pack.destination?.label?.split(',')[0] || (ko ? '저장 목적지' : 'Saved destination')}</b><small>{distanceLabel(pack, ko)} · {formatOfflinePackAge(Date.now() - pack.savedAt, ko)}</small></div>
            <button onClick={() => onRemove(pack.id)} aria-label={ko ? '저장 경로 삭제' : 'Delete saved route'}>×</button>
          </article>) : <p>{ko ? '아직 저장한 지역 경로가 없습니다.' : 'No regional routes are saved yet.'}</p>}
        </section>

        <footer>{ko ? '개인 위치·경로는 이 기기 브라우저에만 저장됩니다. 공용 지도 타일은 미리 다운로드하지 않습니다.' : 'Location and routes stay in this device browser. Public map tiles are never pre-downloaded.'}</footer>
      </div>
    </section>
  );
}
