// Orbit V20 — the ONE and ONLY NOVA AI on this screen. Drag, Voice, Chat, status.
// No other component in OrbitV20/ renders NOVA_PORTRAIT or a "NOVA AI" label — this is
// the single source, imported exactly once by OrbitV20.jsx.
import React from 'react';

const NOVA_PORTRAIT = '/nova-ai-command-intelligence-v17.webp';

function novaTouchFeedback(kind = 'light') {
  try {
    const haptics = window.Telegram?.WebApp?.HapticFeedback;
    if (haptics?.impactOccurred) haptics.impactOccurred(kind);
    else if (navigator.vibrate) navigator.vibrate(kind === 'medium' ? 24 : 12);
  } catch (_) {
    // Haptics are an enhancement; unsupported devices continue normally.
  }
}

export default function OrbitFloatingNova({
  t, language, user, novaOpen, novaDragPos, voiceState, novaMsgs, novaInput, novaBusy,
  onPointerDown, onPointerMove, onPointerUp, onInputChange, onSend, onGuide, onSpeak,
}) {
  return (
    <div
      className={`ov20-nova-float ${novaOpen ? 'open' : ''} voice-${voiceState}`}
      style={{ transform: `translate3d(${novaDragPos.x}px, ${novaDragPos.y}px, 0)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="ov20-nova-grip"><i /><i /><i /><i /><i /><i /></div>
      <div className="ov20-nova-avatar">
        <img src={NOVA_PORTRAIT} alt="NOVA AI" />
        <span className="ov20-nova-scan" />
      </div>
      <b>NOVA AI</b>
      <div className="ov20-nova-wave" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
      </div>
      <div className="ov20-nova-status">
        <span><i />{t.online}</span>
        <span><i />{t.connected}</span>
        <span><i />{voiceState === 'playing' ? (t.ko ? '음성 안내 중' : 'SPEAKING') : t.ready}</span>
      </div>
      {novaOpen && (
        <div className="ov20-nova-panel">
          <button
            className="ov20-nova-guide"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => { novaTouchFeedback('medium'); onGuide(); }}
          >🧭 {t.ko ? '기능 사용 안내' : 'NAVIGATION GUIDE'}</button>
          <div className="ov20-nova-msgs">
            {novaMsgs.length === 0 && (
              <div className="ov20-nova-msg">{t.ko ? `Captain ${user?.firstName || ''}, 모든 시스템 정상입니다.` : `Captain ${user?.firstName || ''}, all systems nominal.`}</div>
            )}
            {novaMsgs.map((m, i) => (
              <div key={i} className={`ov20-nova-msg ${m.role === 'me' ? 'me' : ''}`}>
                {m.text}
                {m.role === 'ai' && <button
                  className="ov20-nova-speak"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => { novaTouchFeedback('medium'); onSpeak(m.text); }}
                >🔊 {voiceState === 'playing' ? (t.ko ? '재생 중' : 'PLAYING') : (t.ko ? '읽어주기' : 'READ')}</button>}
              </div>
            ))}
          </div>
          <input
            placeholder={t.ko ? '메시지 입력...' : 'Message NOVA…'}
            value={novaInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
            disabled={novaBusy}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
