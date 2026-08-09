import React, { useEffect, useRef, useState } from 'react';
import { BrowserSpeechProvider } from '../../nova/voice/BrowserSpeechProvider.js';

export default function OrbitSearchOverlay({ open, t, language, query, results, busy, recent, onChange, onPick, onClose }) {
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
  const showEmpty = query.trim().length >= 2 && !busy && results.length === 0;

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
        {busy && <div className="ov20-search-state"><i />{t.searching}</div>}
        {showRecent && <div className="ov20-search-section-title">◷ {t.recent}</div>}
        {(showRecent ? recent : results).map((place) => (
          <button className="ov20-place-result" key={place.id} onClick={() => onPick(place)}>
            <span className="pin">⌖</span>
            <span><b>{place.label.split(',')[0]}</b><small>{place.label}</small></span>
            <i>›</i>
          </button>
        ))}
        {showEmpty && <div className="ov20-search-empty">⌕<b>{t.noResults}</b><small>{t.searchHint}</small></div>}
      </div>
      <div className="ov20-search-nova"><span>NOVA AI</span>{t.ko ? '목적지를 선택하면 경로와 날씨를 음성으로 안내합니다. 우리의 목표는 누구나 쉽게 세계를 여행하도록 전 세계를 연결하는 것입니다.' : 'Select a destination and I will explain the route and weather. Our goal is to connect the world so everyone can travel with ease.'}</div>
    </div>
  );
}
