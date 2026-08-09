/**
 * Optional pre-recorded voice cue player.  Audio is intentionally local-only:
 * deployments may add the listed files under public/audio/nova without changing
 * code. When a clip is unavailable, BrowserSpeechProvider supplies the voice.
 */
export const NOVA_LOCAL_AUDIO_EVENTS = Object.freeze({
  welcome: '/audio/nova/welcome-captain.mp3',
  miningStarted: '/audio/nova/mining-started.mp3',
  miningCompleted: '/audio/nova/mining-completed.mp3',
  walletConnected: '/audio/nova/wallet-connected.mp3',
  missionComplete: '/audio/nova/mission-complete.mp3',
  navigationReady: '/audio/nova/navigation-ready.mp3',
  connectionLost: '/audio/nova/connection-lost.mp3',
  gameStarted: '/audio/nova/game-started.mp3',
  enemyDetected: '/audio/nova/enemy-detected.mp3',
  shieldActivated: '/audio/nova/shield-activated.mp3',
});

// Event clips are optional, but when a locally installed clip matches a common
// system announcement we play it before falling back to the browser TTS voice.
// Keeping this match here prevents UI modules from knowing anything about audio
// file names or providers.
const EVENT_HINTS = Object.freeze([
  ['welcome', ['welcome captain', '환영합니다', '환영해']],
  ['miningStarted', ['mining started', '채굴 시작', '채굴을 시작']],
  ['miningCompleted', ['mining completed', '채굴 완료', '채굴이 완료']],
  ['walletConnected', ['wallet connected', '지갑 연결']],
  ['missionComplete', ['mission complete', '미션 완료']],
  ['navigationReady', ['navigation ready', '네비게이션 준비', '내비게이션 준비']],
  ['connectionLost', ['connection lost', '연결이 끊', '연결 끊김']],
  ['gameStarted', ['game started', '게임 시작']],
  ['enemyDetected', ['enemy detected', '적 기체', '적 탐지']],
  ['shieldActivated', ['shield activated', '실드 활성', '보호막 활성']],
]);

export class LocalAudioProvider {
  constructor(events = NOVA_LOCAL_AUDIO_EVENTS) {
    this.events = events;
    this.cache = new Map();
  }

  async play(eventName, { onStart, onEnd, onError } = {}) {
    const source = this.events[eventName];
    if (!source || document.hidden || typeof Audio === 'undefined') return false;
    const audio = this.cache.get(eventName) || new Audio(source);
    this.cache.set(eventName, audio);
    audio.preload = 'auto';
    audio.currentTime = 0;
    audio.onplay = () => onStart?.();
    audio.onended = () => onEnd?.();
    audio.onerror = () => onError?.('local-audio-unavailable');
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  inferEvent(text) {
    const normalized = String(text || '').trim().toLocaleLowerCase();
    if (!normalized) return null;
    return EVENT_HINTS.find(([, hints]) => hints.some((hint) => normalized.includes(hint)))?.[0] || null;
  }

  stop() {
    this.cache.forEach((audio) => audio.pause());
  }
}
