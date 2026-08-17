import React, { useEffect, useRef, useState } from 'react';
import { BrowserSpeechProvider } from '../../nova/voice/BrowserSpeechProvider.js';

const QUICK_DESTINATIONS = [
  { id: 'home', icon: '⌂', ko: '집', en: 'Home' },
  { id: 'work', icon: '▣', ko: '회사', en: 'Work' },
  { id: 'hospital', icon: '✚', ko: '병원', en: 'Hospital' },
  { id: 'gas', icon: '⛽', ko: '주유소', en: 'Fuel' },
  { id: 'police', icon: '⚑', ko: '경찰', en: 'Police' },
  { id: 'airport', icon: '✈', ko: '공항', en: 'Airport' },
];

export default function OrbitSearchOverlay({ open, t, language, query, results, busy, nearby = [], nearbyAnchor, nearbyBusy, recent, base, onChange, onPick, onQuickDestination, onClose }) {
  const inputRef = useRef(null);
  const speechRef = useRef(null);
  const heardRef = useRef('');
  const [voiceState, setVoiceState] = useState('idle');
  if (!speechRef.current) speechRef.current = new BrowserSpeechProvider();

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [open]);
  useEffect(() => () => speechRef.current?.stop(), []);
  function toggleVoiceSearch() {
    if (voiceState === 'listening') { speechRef.current.stop(); setVoiceState('idle'); return; }
    heardRef.current = '';
    const started = speechRef.current.listen({ language, onStart: () => setVoiceState('listening'), onResult: (text) => { heardRef.current = text; }, onEnd: () => { if (heardRef.current.trim()) onChange(heardRef.current.trim()); setVoiceState('idle'); }, onError: () => setVoiceState('unsupported') });
    if (!started) setVoiceState('unsupported');
  }

  if (!open) return null;
  const showRecent = query.trim().length < 2 && recent.length > 0;
  const showQuick = query.trim().length < 2;
  const showEmpty = query.trim().length >= 2 && !busy && results.length === 0;
  const showNearby = query.trim().length >= 2 && Boolean(nearbyAnchor);

  return (
    <div className="ov20-search-overlay" role="dialog" aria-modal="true" aria-label={t.searchTitle}>
      <header>
        <button className="ov20-search-back" onClick={onClose} aria-label={t.close}>‹</button>
        <div><b>{t.searchTitle}</b><small>{t.searchHint}</small></div>
      </header>
      <div className="ov20-search-box">
        <span>⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t.searchPlaceholder}
          enterKeyHint="search"
          autoComplete="street-address"
          spellCheck="false"
        />
        {query && <button onClick={() => onChange('')} aria-label={t.close}>×</button>}
        <button className={`ov20-search-mic ${voiceState}`} onClick={toggleVoiceSearch} aria-label={t.voiceSearch}>⌁</button>
      </div>
      {voiceState === 'listening' && <div className="ov20-search-voice-state"><i /> {t.voiceListening}</div>}
      {voiceState === 'unsupported' && <div className="ov20-search-voice-state error">{t.voiceUnavailable}</div>}
      <div className="ov20-search-content">
        {showQuick && <section className="ov20-quick-destinations" aria-label={t.quickDestinations}>
          <div className="ov20-search-section-title">⚡ {t.quickDestinations}</div>
          <div className="ov20-quick-destination-grid">
            {QUICK_DESTINATIONS.map((place) => {
              const isSaved = (place.id === 'home' && base?.home) || (place.id === 'work' && base?.work);
              return <button type="button" className={`ov20-quick-destination ${isSaved ? 'saved' : ''}`} key={place.id} onClick={() => onQuickDestination?.(place.id)}>
                <i aria-hidden="true">{place.icon}</i><b>{t.ko ? place.ko : place.en}</b>{isSaved && <em aria-label={t.ko ? '저장됨' : 'Saved'}>•</em>}
              </button>;
            })}
          </div>
        </section>}
        {busy && <div className="ov20-search-state"><i />{t.searching}</div>}
        {showRecent && <div className="ov20-search-section-title">◷ {t.recent}</div>}
        {(showRecent ? recent : results).map((place) => (
          <button className="ov20-place-result" key={place.id} onClick={() => onPick(place)}>
            <span className="pin">⌖</span>
            <span><b>{place.label.split(',')[0]}</b><small>{place.label}</small></span>
            <i>›</i>
          </button>
        ))}
        {showNearby && <section className="ov20-nearby-places" aria-label={t.ko ? '주변 주요 장소' : 'Nearby essential places'}>
          <div className="ov20-search-section-title">⌖ {t.ko ? `${nearbyAnchor.label.split(',')[0]} 주변 주요 장소` : `NEARBY ${nearbyAnchor.label.split(',')[0]}`}</div>
          {nearbyBusy && <div className="ov20-search-state"><i />{t.ko ? '주변 장소를 찾고 있습니다…' : 'Finding nearby places…'}</div>}
          {!nearbyBusy && nearby.map((place) => (
            <button className="ov20-place-result ov20-nearby-place" key={place.id} onClick={() => onPick(place)}>
              <span className="pin">{place.icon || '⌖'}</span>
              <span><b>{place.label}</b><small>{[place.type, place.subtitle, Number.isFinite(place.distanceKm) ? `${place.distanceKm < 1 ? Math.round(place.distanceKm * 1000) + ' m' : place.distanceKm.toFixed(1) + ' km'}` : ''].filter(Boolean).join(' · ')}</small></span>
              <i>›</i>
            </button>
          ))}
          {!nearbyBusy && nearby.length === 0 && <small className="ov20-nearby-empty">{t.ko ? '공개 지도에서 주변 주요 장소를 찾지 못했습니다.' : 'No nearby essential places were found in public map data.'}</small>}
        </section>}
                {showEmpty && <div className="ov20-search-empty">⌕<b>{t.noResults}</b><small>{t.searchHint}</small></div>}
      </div>
      <div className="ov20-search-nova"><span>NOVA AI</span>{t.ko ? '목적지를 선택하면 경로와 날씨를 음성으로 안내합니다. 우리의 목표는 누구나 쉽게 세계를 여행하도록 전 세계를 연결하는 것입니다.' : 'Select a destination and I will explain the route and weather. Our goal is to connect the world so everyone can travel with ease.'}</div>
    </div>
  );
}
