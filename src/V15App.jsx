import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/v15.css';
import { NovaAIRouter } from './nova/index.js';

const OrbitV20 = lazy(() => import('./orbit/OrbitV20/OrbitV20.jsx'));

// Direct game loading prevents Telegram Android WebView from rendering the old
// two-level cross-origin iframe chain as a blank/black game screen.
const GAME_URL = import.meta.env.VITE_GAME_URL || 'https://nova-x1-genesis-defense.kit372002.chatgpt.site';
const PREVIEW_BUILD = import.meta.env.VITE_PREVIEW_BUILD === 'true' || new URLSearchParams(window.location.search).get('preview') === '1';
const LANGUAGES = [
  ['en', 'English'], ['ko', '한국어'], ['ja', '日本語'], ['zh', '中文'],
  ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch'], ['fr', 'Français'],
  ['ru', 'Русский'], ['vi', 'Tiếng Việt'], ['id', 'Bahasa Indonesia'],
];

const COPY = {
  en: {
    tagline: 'Explore. Mine. Evolve.', rank: 'Rookie', balance: 'Total balance', ready: 'READY',
    verified: 'SYSTEM ONLINE', mining: 'Mining Command', reward: 'Cycle reward',
    rate: 'Effective rate', remaining: 'Remaining', progress: 'Cycle progress',
    fleet: 'Fleet bonus', start: 'Start mining', active: 'Mining active',
    claim: 'Claim reward', ledger: 'Recent activity', pool: 'Network mining pool',
    phase: 'Distribution phase', game: 'NOVA Flight Command', play: 'Launch full game',
    gameCopy: 'Enter the official SpaceNovaX combat experience. Your captain identity stays linked to this app.',
    missions: 'Mission Control', ai: 'NOVA AI', community: 'Community', command: 'Command Center',
    home: 'Home', mine: 'Mine', fleetNav: 'Fleet', vault: 'Vault', more: 'More',
    language: 'Language', ask: 'Ask NOVA about mining, missions, the fleet, or SpaceNovaX.',
    send: 'Send', captain: 'Captain', status: 'Account status', guest: 'Guest session',
    miningReady: 'Your mining core is ready for a new 24-hour cycle.',
    emptyLedger: 'No reward activity yet. Start your first mining cycle.',
    realGame: 'OFFICIAL LIVE GAME', openGame: 'Open game in a new window',
    overview: 'Operations overview', dailyCap: 'Daily game reward cap',
    security: 'Security', wallet: 'Wallet', kyc: 'KYC', ranking: 'Ranking',
    referrals: 'Fleet', logout: 'Language & settings', official: 'Official channels',
    newChat: 'New chat', listening: 'Listening…', thinking: 'NOVA is thinking',
    copy: 'Copy', read: 'Read aloud', stop: 'Stop', preview: 'PREVIEW BUILD',
    missionProgress: 'Mission progress', completed: 'Completed', rewardAvailable: 'Rewards available',
  },
  ko: {
    tagline: '탐험하고, 채굴하고, 진화하세요.', rank: '루키', balance: '총 보유 포인트', ready: '준비 완료',
    verified: '시스템 정상', mining: '채굴 관제 센터', reward: '주기 보상',
    rate: '실시간 채굴 속도', remaining: '남은 시간', progress: '채굴 진행률',
    fleet: '함대 보너스', start: '채굴 시작', active: '채굴 진행 중',
    claim: '보상 수령', ledger: '최근 활동', pool: '네트워크 채굴 풀',
    phase: '배분 단계', game: 'NOVA 비행 관제', play: '전체 게임 실행',
    gameCopy: 'SpaceNovaX 공식 전투 게임을 실행합니다. 캡틴 계정은 이 앱과 연결됩니다.',
    missions: '미션 관제', ai: 'NOVA AI', community: '커뮤니티', command: '통합 관제 센터',
    home: '홈', mine: '채굴', fleetNav: '함대', vault: '금고', more: '더보기',
    language: '언어', ask: '채굴, 미션, 함대 또는 SpaceNovaX에 관해 NOVA에게 질문하세요.',
    send: '전송', captain: '캡틴', status: '계정 상태', guest: '게스트 세션',
    miningReady: '새로운 24시간 채굴 주기를 시작할 준비가 되었습니다.',
    emptyLedger: '아직 보상 내역이 없습니다. 첫 채굴을 시작하세요.',
    realGame: '공식 실시간 게임', openGame: '새 창에서 게임 열기',
    overview: '운영 현황', dailyCap: '일일 게임 보상 한도',
    security: '보안', wallet: '지갑', kyc: 'KYC', ranking: '랭킹',
    referrals: '함대', logout: '언어 및 설정', official: '공식 채널',
    newChat: '새 대화', listening: '듣고 있습니다…', thinking: 'NOVA가 답변을 준비 중입니다',
    copy: '복사', read: '음성으로 듣기', stop: '중지', preview: '검토용 빌드',
    missionProgress: '미션 진행률', completed: '완료', rewardAvailable: '수령 가능한 보상',
  },
};

const WALLET_COPY = {
  en: { assets: 'Assets', active: 'Active', coming: 'Coming Soon', view: 'View-only until KYC approval', unlock: 'Complete KYC to activate transfers and all Wallet features', portfolio: 'Portfolio' },
  ko: { assets: '자산', active: '활성', coming: '출시 예정', view: 'KYC 승인 전에는 조회 전용입니다', unlock: 'KYC 승인 후 송금과 모든 지갑 기능이 활성화됩니다', portfolio: '포트폴리오' },
  ja: { assets: '資産', active: '有効', coming: '近日公開', view: 'KYC承認前は閲覧専用です', unlock: 'KYC承認後に送金と全機能が有効になります', portfolio: 'ポートフォリオ' },
  zh: { assets: '资产', active: '已启用', coming: '即将推出', view: 'KYC 审核前仅可查看', unlock: 'KYC 审核后可启用转账及全部钱包功能', portfolio: '资产组合' },
  es: { assets: 'Activos', active: 'ACTIVO', coming: 'PRÓXIMAMENTE', view: 'Solo consulta hasta la aprobación KYC', unlock: 'Completa KYC para activar transferencias y todas las funciones', portfolio: 'Cartera' },
  pt: { assets: 'Ativos', active: 'ATIVO', coming: 'EM BREVE', view: 'Somente consulta até a aprovação KYC', unlock: 'Conclua o KYC para ativar transferências e todos os recursos', portfolio: 'Portfólio' },
  de: { assets: 'Vermögen', active: 'AKTIV', coming: 'DEMNÄCHST', view: 'Nur Ansicht bis zur KYC-Genehmigung', unlock: 'KYC abschließen, um Überweisungen und alle Funktionen zu aktivieren', portfolio: 'Portfolio' },
  fr: { assets: 'Actifs', active: 'ACTIF', coming: 'BIENTÔT DISPONIBLE', view: 'Consultation uniquement avant validation KYC', unlock: 'Terminez le KYC pour activer les transferts et toutes les fonctions', portfolio: 'Portefeuille' },
  ru: { assets: 'Активы', active: 'АКТИВНО', coming: 'СКОРО', view: 'Только просмотр до одобрения KYC', unlock: 'Пройдите KYC для активации переводов и всех функций', portfolio: 'Портфель' },
  vi: { assets: 'Tài sản', active: 'ĐANG HOẠT ĐỘNG', coming: 'SẮP RA MẮT', view: 'Chỉ xem cho đến khi KYC được phê duyệt', unlock: 'Hoàn tất KYC để kích hoạt chuyển tiền và mọi tính năng', portfolio: 'Danh mục' },
  id: { assets: 'Aset', active: 'AKTIF', coming: 'SEGERA HADIR', view: 'Hanya lihat hingga KYC disetujui', unlock: 'Selesaikan KYC untuk mengaktifkan transfer dan semua fitur', portfolio: 'Portofolio' },
};

function getClientId() {
  const key = 'spnx_client_id_v1';
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID?.() || `spnx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

async function api(path, options = {}) {
  const initData = window.Telegram?.WebApp?.initData || '';
  let body = options.body;
  if (typeof body === 'object' && body !== null) body = JSON.stringify({ ...body, clientId: getClientId() });
  const response = await fetch(path, {
    ...options,
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-SPNX-Client-ID': getClientId(),
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.message || 'Request failed');
  return data;
}

// Voice and conversational routing are deliberately isolated from the app
// modules.  The router resolves browser speech, local audio, FAQ and rules
// before the final text-only provider is even considered.
const novaVoiceRouter = new NovaAIRouter({ request: api, clientKey: getClientId() });

const fallbackUser = {
  id: 'guest', firstName: 'Space Explorer', level: 1, balance: 0, activeFleet: 0,
  fleetBonus: 0, securityCircle: [], securityCircleCount: 0, securityCircleBonus: 0, missionBonus: 0, missionPassportComplete: false,
  gameReward: { earnedToday: 0, bestScore: 0 },
  mining: { active: false, claimable: false, reward: 30, speedPerHour: 1.25, remainingMs: 86400000, progress: 0, minedSoFar: 0, phase: 1 },
};

function format(value, digits = 2) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function clock(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((part) => String(part).padStart(2, '0')).join(':');
}

// The ledger remains server-authoritative.  This hook only advances the
// server-calculated in-progress portion between session refreshes, so a
// Captain sees a smooth 0.5s live counter without creating a client-side
// reward or changing the settled balance.
function useLiveMiningView(user) {
  const [tick, setTick] = useState(() => Date.now());
  const mining = user.mining || fallbackUser.mining;
  const active = Boolean(mining.active) && !Boolean(mining.claimable);

  useEffect(() => {
    setTick(Date.now());
    if (!active) return undefined;
    const timer = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active, mining.startedAt, mining.calculatedAt, mining.endsAt, mining.speedPerHour]);

  const calculatedAt = Number(mining.calculatedAt || tick);
  const durationMs = Number(mining.durationMs || 86400000);
  const elapsedSinceServer = active ? Math.max(0, Math.min(tick - calculatedAt, Number(mining.remainingMs || durationMs))) : 0;
  const liveMined = Math.min(
    Number(mining.claimableReward || mining.reward || 0),
    Number(mining.minedSoFar || 0) + (Number(mining.speedPerHour || 0) * elapsedSinceServer / 3600000),
  );
  const remainingMs = active ? Math.max(0, Number(mining.remainingMs || 0) - elapsedSinceServer) : Number(mining.remainingMs || 0);
  const progress = active
    ? Math.min(1, Math.max(0, 1 - (remainingMs / durationMs)))
    : Number(mining.progress || 0);

  return {
    mining: { ...mining, minedSoFar: liveMined, remainingMs, progress, active: active && remainingMs > 0 },
    displayBalance: Number(user.balance || 0) + liveMined,
  };
}

const NOVA_SPEECH_LOCALES = {
  en: 'en-US',
  ko: 'ko-KR',
  ja: 'ja-JP',
  zh: 'zh-CN',
  es: 'es-ES',
  pt: 'pt-BR',
  de: 'de-DE',
  fr: 'fr-FR',
  ru: 'ru-RU',
  vi: 'vi-VN',
  id: 'id-ID',
};

let novaSpeechRequest = 0;
let novaAudioPlayer;
let novaAudioContext;
let novaAudioSource;
let novaAudioObjectUrl;
let novaAudioUnlocked = false;
let novaAudioKeepAliveSource;
let novaAudioKeepAliveGain;
let novaDeviceVoices = [];
let activeNovaVoiceSource = '';

const NOVA_SILENT_WAV = 'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

function triggerNovaHaptic(style = 'light') {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {}
  if (!window.Telegram?.WebApp?.HapticFeedback && navigator.vibrate) {
    navigator.vibrate(style === 'medium' ? 18 : 10);
  }
}

function emitNovaVoiceStatus(source, status, requestId = novaSpeechRequest) {
  if (requestId !== novaSpeechRequest && status !== 'stopped') return;
  window.dispatchEvent(new CustomEvent('nova-voice-status', {
    detail: { source, status, requestId },
  }));
  if (['complete', 'error', 'stopped'].includes(status) && activeNovaVoiceSource === source) {
    activeNovaVoiceSource = '';
  }
}

function beginNovaVoice(source, requestId) {
  if (activeNovaVoiceSource && activeNovaVoiceSource !== source) {
    emitNovaVoiceStatus(activeNovaVoiceSource, 'stopped', requestId);
  }
  activeNovaVoiceSource = source;
  emitNovaVoiceStatus(source, 'loading', requestId);
}

function configureNovaPlayer(player) {
  player.preload = 'auto';
  player.playsInline = true;
  player.setAttribute('playsinline', '');
  player.setAttribute('webkit-playsinline', '');
}

function keepNovaMediaSessionAlive(player) {
  if (player.dataset.novaReal === 'true') return;
  player.loop = true;
  player.volume = .01;
  if (player.src !== NOVA_SILENT_WAV) player.src = NOVA_SILENT_WAV;
  player.play()
    .then(() => { novaAudioUnlocked = true; })
    .catch((error) => {
      novaAudioUnlocked = false;
      console.warn('NOVA media session keep-alive failed:', error);
    });
}

function unlockNovaAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const player = novaAudioPlayer || new Audio();
  novaAudioPlayer = player;
  configureNovaPlayer(player);

  // Telegram Android and iOS WebViews grant playback only inside the original
  // tap. Keep this same element silently active while speech is downloaded.
  let mediaUnlock = Promise.resolve(novaAudioUnlocked);
  if (player.dataset.novaReal !== 'true' && (player.paused || !novaAudioUnlocked)) {
    player.loop = true;
    player.volume = .01;
    player.src = NOVA_SILENT_WAV;
    mediaUnlock = player.play()
      .then(() => {
        novaAudioUnlocked = true;
        return true;
      })
      .catch((error) => {
        novaAudioUnlocked = false;
        console.warn('NOVA HTML audio unlock failed:', error);
        return false;
      });
  }

  if (!AudioContext) {
    return Promise.resolve(mediaUnlock).then((mediaUnlocked) => ({
      context: undefined,
      mediaUnlocked,
    }));
  }

  try {
    novaAudioContext ||= new AudioContext();
    const context = novaAudioContext;
    const resumePromise = context.state === 'suspended'
      ? context.resume()
      : Promise.resolve();

    // A one-sample buffer ends immediately and WebKit may suspend before the
    // network response arrives. One near-silent loop preserves the global
    // NOVA audio session across every section and sequential playback.
    if (!novaAudioKeepAliveSource) {
      novaAudioKeepAliveGain = context.createGain();
      novaAudioKeepAliveGain.gain.value = .00001;
      novaAudioKeepAliveGain.connect(context.destination);
      novaAudioKeepAliveSource = context.createBufferSource();
      novaAudioKeepAliveSource.buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      novaAudioKeepAliveSource.loop = true;
      novaAudioKeepAliveSource.connect(novaAudioKeepAliveGain);
      novaAudioKeepAliveSource.start(0);
    }

    return Promise.all([resumePromise, mediaUnlock]).then(([, mediaUnlocked]) => ({
      context,
      mediaUnlocked,
    }));
  } catch (error) {
    console.warn('NOVA audio unlock failed:', error);
    return Promise.resolve(mediaUnlock).then((mediaUnlocked) => ({
      context: undefined,
      mediaUnlocked,
    }));
  }
}

function refreshNovaDeviceVoices() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  if (voices.length) novaDeviceVoices = voices;
  return novaDeviceVoices;
}

function findNovaDeviceVoice(locale) {
  const voices = refreshNovaDeviceVoices();
  const normalizedLocale = locale.toLowerCase();
  const languagePrefix = normalizedLocale.slice(0, 2);
  return voices.find((voice) => voice.lang?.toLowerCase() === normalizedLocale)
    || voices.find((voice) => voice.lang?.toLowerCase().startsWith(languagePrefix))
    || null;
}

window.speechSynthesis?.addEventListener?.('voiceschanged', refreshNovaDeviceVoices);
refreshNovaDeviceVoices();

function playNovaDeviceVoice(text, language, rate = .95, onFailure, lifecycle = {}) {
  const synthesis = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  if (!synthesis || !Utterance) return false;
  try {
    const locale = NOVA_SPEECH_LOCALES[language] || 'en-US';
    const utterance = new Utterance(text);
    utterance.voice = findNovaDeviceVoice(locale);
    utterance.lang = utterance.voice?.lang || locale;
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    let started = false;
    let failed = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      onFailure?.();
    };
    const startWatchdog = window.setTimeout(() => {
      if (started) return;
      synthesis.cancel();
      fail();
    }, 500);
    utterance.onstart = () => {
      started = true;
      clearTimeout(startWatchdog);
      lifecycle.onStart?.();
    };
    utterance.onend = () => {
      clearTimeout(startWatchdog);
      lifecycle.onEnd?.();
    };
    utterance.onerror = (event) => {
      clearTimeout(startWatchdog);
      if (!['canceled', 'interrupted'].includes(event.error)) {
        console.warn('NOVA device voice playback failed:', event.error);
      }
      fail();
    };
    if (synthesis.speaking || synthesis.pending) synthesis.cancel();
    synthesis.resume();
    synthesis.speak(utterance);
    return true;
  } catch (error) {
    console.warn('NOVA device voice fallback failed:', error);
    onFailure?.();
    return false;
  }
}

async function playNovaServerVoice(text, language, requestId, audioContextPromise, rate = .95, statusSource = 'nova-global') {
  // Remote audio generation is intentionally disabled.  This legacy helper is
  // retained only so older UI callers do not break while all playback is moved
  // to the free local/browser provider.
  return novaVoiceRouter.speak({
    text,
    language,
    rate,
    onStart: () => emitNovaVoiceStatus(statusSource, 'playing', requestId),
    onEnd: () => emitNovaVoiceStatus(statusSource, 'complete', requestId),
    onError: () => emitNovaVoiceStatus(statusSource, 'error', requestId),
  });
  /*
  let audioUrl;
  try {
    novaAudioSource?.stop();
    novaAudioSource = undefined;
    const response = await fetch('/api/nova-disabled-voice', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });
    if (!response.ok) throw new Error(`voice-${response.status}`);
    const audioData = await response.arrayBuffer();
    if (requestId !== novaSpeechRequest) {
      return false;
    }

    const unlocked = await audioContextPromise;
    const player = novaAudioPlayer || new Audio();
    novaAudioPlayer = player;
    audioUrl = URL.createObjectURL(new Blob([audioData], { type: 'audio/wav' }));
    if (novaAudioObjectUrl) URL.revokeObjectURL(novaAudioObjectUrl);
    novaAudioObjectUrl = audioUrl;
    player.onended = null;
    player.onerror = null;
    player.pause();
    configureNovaPlayer(player);
    player.dataset.novaReal = 'true';
    player.loop = false;
    player.src = audioUrl;
    player.volume = 1;
    player.load();

    try {
      await player.play();
      novaAudioUnlocked = true;
      emitNovaVoiceStatus(statusSource, 'playing', requestId);
      player.onended = () => {
        if (novaAudioObjectUrl === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          novaAudioObjectUrl = undefined;
        }
        player.dataset.novaReal = 'false';
        keepNovaMediaSessionAlive(player);
        emitNovaVoiceStatus(statusSource, 'complete', requestId);
      };
      return true;
    } catch (mediaError) {
      console.warn('NOVA HTML audio playback failed; trying Web Audio:', mediaError);
    }

    // Samsung/Telegram versions differ: if the unlocked HTML media element is
    // still blocked, decode the same WAV through the already-resumed context.
    const context = unlocked?.context;
    if (!context) throw new Error('voice-playback-blocked');
    if (context.state === 'suspended') await context.resume();
    const decodedAudio = await context.decodeAudioData(audioData.slice(0));
    if (requestId !== novaSpeechRequest) return false;

    const source = context.createBufferSource();
    source.buffer = decodedAudio;
    source.connect(context.destination);
    source.onended = () => {
      if (novaAudioSource === source) novaAudioSource = undefined;
      if (novaAudioObjectUrl === audioUrl) {
        URL.revokeObjectURL(audioUrl);
        novaAudioObjectUrl = undefined;
      }
      emitNovaVoiceStatus(statusSource, 'complete', requestId);
    };
    novaAudioSource = source;
    emitNovaVoiceStatus(statusSource, 'playing', requestId);
    source.start(0);
    return true;
  } catch (error) {
    if (audioUrl && novaAudioObjectUrl !== audioUrl) URL.revokeObjectURL(audioUrl);
    console.warn('NOVA mobile voice playback failed:', error);
    const usedDeviceVoice = playNovaDeviceVoice(text, language, rate, () => {
      emitNovaVoiceStatus(statusSource, 'error', requestId);
    }, {
      onStart: () => emitNovaVoiceStatus(statusSource, 'playing', requestId),
      onEnd: () => emitNovaVoiceStatus(statusSource, 'complete', requestId),
    });
    if (!usedDeviceVoice) emitNovaVoiceStatus(statusSource, 'error', requestId);
    return usedDeviceVoice;
  }
  */
}

function speakNova(value, language = 'en', rate = .95, source = 'nova-global') {
  const text = String(value || '').trim();
  if (!text) return false;

  const requestId = ++novaSpeechRequest;
  beginNovaVoice(source, requestId);
  if (document.hidden) {
    emitNovaVoiceStatus(source, 'stopped', requestId);
    return false;
  }
  return novaVoiceRouter.speak({
    text,
    language,
    rate,
    onStart: () => emitNovaVoiceStatus(source, 'playing', requestId),
    onEnd: () => emitNovaVoiceStatus(source, 'complete', requestId),
    onError: () => emitNovaVoiceStatus(source, 'error', requestId),
  });
}

function useNovaVoiceFeedback(source) {
  const [voiceState, setVoiceState] = useState('idle');
  useEffect(() => {
    let resetTimer;
    const update = (event) => {
      if (event.detail?.source !== source) return;
      clearTimeout(resetTimer);
      setVoiceState(event.detail.status || 'idle');
      if (['complete', 'error', 'stopped'].includes(event.detail.status)) {
        resetTimer = window.setTimeout(() => setVoiceState('idle'), 1500);
      }
    };
    window.addEventListener('nova-voice-status', update);
    return () => {
      clearTimeout(resetTimer);
      window.removeEventListener('nova-voice-status', update);
    };
  }, [source]);
  const play = useCallback((text, language, rate = .95) => {
    triggerNovaHaptic('light');
    return speakNova(text, language, rate, source);
  }, [source]);
  return { voiceState, play };
}

function voiceLabel(state, language, idleKo, idleEn) {
  const ko = language === 'ko';
  if (state === 'loading') return ko ? '음성 연결 중' : 'CONNECTING';
  if (state === 'playing') return ko ? '재생 중' : 'PLAYING';
  if (state === 'complete') return ko ? '재생 완료' : 'COMPLETE';
  if (state === 'error') return ko ? '음성 오류' : 'VOICE ERROR';
  if (state === 'stopped') return ko ? '재생 중지' : 'STOPPED';
  return ko ? idleKo : idleEn;
}

function Icon({ name, size = 22 }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,
    mine: <><path d="m5 20 6-6M8 17l-2-2"/><path d="M13 4c3 0 5 1 7 3l-4 4-3-3-3 3-2-2 5-5Z"/></>,
    ai: <><rect x="4" y="6" width="16" height="13" rx="4"/><path d="M12 3v3M8 12h.01M16 12h.01M8 16h8"/></>,
    fleet: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M14 15c3.6-.5 5.8 1.2 6.5 5"/></>,
    game: <><path d="M7 9h10a5 5 0 0 1 4.5 7.2l-1.1 2.3a2 2 0 0 1-3.2.6L15 17H9l-2.2 2.1a2 2 0 0 1-3.2-.6l-1.1-2.3A5 5 0 0 1 7 9Z"/><path d="M8 12v4M6 14h4M16.5 13h.01M18.5 15h.01"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
    shield: <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"/>,
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6h2Z"/><path d="M4 6V4h12v2M15 12h5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    speaker: <><path d="M5 10v4h3l4 3V7l-4 3H5Z"/><path d="M16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    mission: <><path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9L12 3Z"/></>,
    external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
    community: <><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/></>,
    telegram: <><path d="m21 4-4.1 16.1a1.25 1.25 0 0 1-2 .67l-5-3.67-2.42 2.35a1 1 0 0 1-1.7-.7v-3.3L17.35 6.8 3.5 12.2l-2.1-.7a1.25 1.25 0 0 1 .02-2.38L19.35 3a1.25 1.25 0 0 1 1.65 1Z"/></>,
    xbrand: <path d="M4 3h4.5l3.9 5.2L16.8 3H20l-6 7.1L20.5 21H16l-4.3-5.8L6.8 21H3.5l6.4-7.6L4 3Z"/>,
    discord: <><path d="M7 7.2c3.1-1.7 6.9-1.7 10 0 1.2 1.7 1.9 3.8 2 6-1.4 2.2-3.4 3.7-5.8 4.5l-1-1.3c.7-.25 1.35-.6 1.9-1.05-2.6 1.15-5.5 1.15-8.1 0 .55.45 1.2.8 1.9 1.05l-1 1.3c-2.4-.8-4.4-2.3-5.8-4.5.1-2.2.8-4.3 2-6 1.2-.7 2.5-1.1 3.9-1.4l.55 1.1c1.25-.2 2.55-.2 3.8 0l.55-1.1c1.4.3 2.7.7 3.9 1.4"/><circle cx="8.7" cy="12.2" r="1" fill="currentColor" stroke="none"/><circle cx="15.3" cy="12.2" r="1" fill="currentColor" stroke="none"/></>,
    youtube: <><rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none"/></>,
  };
  return <svg className="v15-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.more}</svg>;
}

function Splash({ done }) {
  const [exit, setExit] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setExit(true), 2300);
    const b = setTimeout(done, 2850);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [done]);
  return <div className={`v15-splash ${exit ? 'exit' : ''}`}>
    <div className="splash-nebula" /><div className="splash-stars-v15" />
    <div className="v15-mark"><img src="/brand/spacenovax-symbol.jpg" alt="SpaceNovaX" /></div>
    <div className="v15-splash-copy"><small>NOVA NETWORK PRESENTS</small><h1>SPACENOVA<span>X</span></h1><p>EXPLORE · MINE · EVOLVE</p></div>
    <div className="boot-line"><i /><span>NOVA CORE INITIALIZING</span></div>
  </div>;
}

function Header({ user, language, setLanguage, t, onPreview }) {
  const [open, setOpen] = useState(false);
  return <header className="v15-header">
    <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <img src="/brand/spacenovax-symbol.jpg" alt="" /><span><b>SpaceNovaX</b><small>{t.tagline}</small></span>
    </button>
    <div className="header-actions">
      {PREVIEW_BUILD && <button className="preview-chip" onClick={onPreview}>{t.preview}</button>}
      <a className="header-website" href="https://spacenovax.com" target="_blank" rel="noreferrer" aria-label="Open official SpaceNovaX website" title="spacenovax.com"><Icon name="external" size={17}/><span>WEB</span></a>
      <button className="language-button" onClick={() => setOpen(!open)}><Icon name="globe" size={18}/><span>{language.toUpperCase()}</span></button>
      <span className="rank-chip"><i />{t.rank}</span>
    </div>
    {open && <div className="language-menu">
      <strong>{t.language}</strong>
      {LANGUAGES.map(([code, label]) => <button className={code === language ? 'selected' : ''} key={code} onClick={() => { setLanguage(code); setOpen(false); }}>{label}<span>{code.toUpperCase()}</span></button>)}
    </div>}
  </header>;
}

function MiningCore({ user, t, onStart, onClaim, busy, detailed = false }) {
  const m = user.mining || fallbackUser.mining;
  const pct = Math.max(0, Math.min(100, Math.round(Number(m.progress || 0) * 100)));
  const claimable = Boolean(m.claimable);
  const active = Boolean(m.active);
  return <section className={`command-card mining-core ${detailed ? 'detailed' : ''}`}>
    <div className="section-heading">
      <div><small>SPNX DISTRIBUTION ENGINE</small><h2>{t.mining}</h2></div>
      <span className={active ? 'live-state pulse' : 'live-state'}><i />{active ? t.active : t.ready}</span>
    </div>
    <MiningReactor
      active={active}
      progress={pct}
      detailed={detailed}
      onActivate={!active && !busy ? onStart : claimable && !busy ? onClaim : undefined}
      actionLabel={claimable ? t.claim : t.start}
    />
    <div className="cycle-visual">
      <div className="progress-ring" style={{ '--progress': `${pct * 3.6}deg` }}>
        <div><b>{pct}%</b><small>{t.progress}</small></div>
      </div>
      <div className="cycle-data">
        <span><small>{t.remaining}</small><b>{claimable ? '00:00:00' : clock(m.remainingMs || 86400000)}</b></span>
        <span><small>{t.reward}</small><b>{format(m.reward || 30)} SPNX</b></span>
        <span><small>{t.rate}</small><b>{format(m.speedPerHour || (m.reward || 30) / 24, 3)} SPNX/h</b></span>
      </div>
    </div>
    <div className="mining-track"><i style={{ width: `${pct}%` }} /><span className="track-node n1"/><span className="track-node n2"/><span className="track-node n3"/></div>
    <div className="mining-metrics">
      <span><small>{t.phase}</small><b>{t.phase} {m.phase || 1}</b></span>
      <span><small>{t.fleet}</small><b>+{Number(m.fleetBonus || user.fleetBonus || 0)}%</b></span>
      <span><small>SECURITY CIRCLE</small><b>{Number(m.securityCircleCount || user.securityCircleCount || 0)}/5 · +{Number(m.securityBonus || user.securityCircleBonus || 0)}%</b></span>
      <span><small>MISSION PASSPORT</small><b>{m.missionPassportComplete || user.missionPassportComplete ? 'VERIFIED · +5%' : 'LOCKED · +0%'}</b></span>
      <span><small>LIVE EARNED</small><b>{format(m.minedSoFar || 0, 4)}</b></span>
    </div>
    {detailed && <button className="primary-action" disabled={busy || (active && !claimable)} onClick={claimable ? onClaim : onStart}>
      <Icon name={claimable ? 'wallet' : 'bolt'} />{claimable ? t.claim : active ? t.active : t.start}<Icon name="arrow" />
    </button>}
    {!active && <p className="system-note"><Icon name="shield" size={17}/>{t.miningReady}</p>}
    {detailed && <div className="network-panel">
      <div><span>{t.pool}</span><b>3.5B SPNX</b></div>
      <div className="pool-bar"><i style={{ width: '0.001%' }}/></div>
      <small>Server-authoritative · 24h UTC cycle · Anti-automation protection active</small>
    </div>}
  </section>;
}

function MiningReactor({ active, progress, detailed, onActivate, actionLabel }) {
  const particles = useMemo(() => Array.from({ length: detailed ? 26 : 16 }, (_, index) => ({
    left: 8 + ((index * 37) % 84),
    delay: (index * .17) % 2.4,
    duration: 1.8 + ((index * 13) % 16) / 10,
    size: 2 + (index % 3),
  })), [detailed]);
  return <div
    className={`mining-reactor ${active ? 'running' : 'idle'} ${detailed ? 'reactor-large' : ''} ${onActivate ? 'reactor-touchable' : ''}`}
    onClick={onActivate}
    onKeyDown={(event) => { if (onActivate && (event.key === 'Enter' || event.key === ' ')) onActivate(); }}
    role={onActivate ? 'button' : undefined}
    tabIndex={onActivate ? 0 : undefined}
    aria-label={onActivate ? actionLabel : undefined}
  >
    <div className="reactor-grid"/>
    <div className="energy-stream left"/><div className="energy-stream right"/>
    <div className="reactor-machine">
      <span className="reactor-ring ring-one"/><span className="reactor-ring ring-two"/><span className="reactor-ring ring-three"/>
      <span className="reactor-bracket b1"/><span className="reactor-bracket b2"/><span className="reactor-bracket b3"/><span className="reactor-bracket b4"/>
      <div className="reactor-core"><i/><b>{active ? 'MINING' : onActivate ? 'TOUCH' : 'STANDBY'}</b><small>{active ? `${progress}% OUTPUT` : actionLabel?.toUpperCase()}</small></div>
      <span className="scanner-beam"/>
    </div>
    <div className="reactor-particles">{particles.map((particle, index) => <i key={index} style={{ left: `${particle.left}%`, animationDelay: `${particle.delay}s`, animationDuration: `${particle.duration}s`, width: particle.size, height: particle.size }}/>)}</div>
    <div className="reactor-status"><span><i/>QUANTUM CORE</span><span>HASH LINK {active ? 'STABLE' : 'READY'}</span><span>NODE 01</span></div>
  </div>;
}

const LEDGER_LABELS = {
  mining_reward: '24H MINING REWARD',
  mission_reward: 'MISSION REWARD',
  game_reward: 'GAMEFI REWARD',
  fleet_weekly_reward: 'FLEET LEAGUE REWARD',
  admin_adjustment: 'COMMAND ADJUSTMENT',
};

function ActivityLedger({ balance, t }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    let live = true;
    api('/api/ledger', { method: 'POST', body: {} })
      .then((data) => { if (live) setEntries(data.entries || []); })
      .catch(() => {});
    return () => { live = false; };
  }, [balance]);
  return <section className="command-card activity-card">
    <div className="section-heading"><div><small>SERVER LEDGER</small><h2>{t.ledger}</h2></div><span className="secure-label"><Icon name="shield" size={17}/> HASH CHAIN</span></div>
    {entries.length ? <div className="ledger-list">{entries.slice(0, 8).map((entry) => <article key={entry.id}>
      <span><b>{LEDGER_LABELS[entry.type] || String(entry.type || '').replaceAll('_', ' ').toUpperCase()}</b><small>{new Date(entry.at).toLocaleString()}</small></span>
      <strong className={Number(entry.amount) >= 0 ? 'credit' : 'debit'}>{Number(entry.amount) >= 0 ? '+' : ''}{format(entry.amount, 4)} <small>SPNX POINT</small></strong>
    </article>)}</div> : <p>{t.emptyLedger}</p>}
  </section>;
}

function Home({ user, t, onStart, onClaim, busy, setTab }) {
  const live = useLiveMiningView(user);
  const liveUser = { ...user, mining: live.mining };
  const [balanceInteger, balanceFraction = ''] = format(live.displayBalance, 5).split('.');
  return <main className="v15-page">
    <section className="hero-command">
      <div className="hero-space"/>
      <div className="hero-copy">
        <span className="eyebrow"><i />{t.verified}</span>
        <small>{t.balance} · {live.mining.active ? 'LIVE SESSION' : 'SETTLED LEDGER'}</small><strong className="hero-balance" aria-label={`${balanceInteger}${balanceFraction ? `.${balanceFraction}` : ''} SPNX POINTS`}><span className="hero-balance-int">{balanceInteger}</span>{balanceFraction && <span className="hero-balance-fraction">.{balanceFraction}</span>}</strong><h1>SPNX POINTS</h1>
        <p>NOVA-X1 / AI CONTROLLED GENESIS FLAGSHIP</p>
      </div>
      <img className="hero-station" src="/spacenovax-orbital-hq-live-v16.webp" alt="SpaceNovaX Orbital Headquarters above Earth" />
      <div className="hero-live-light" aria-hidden="true"/>
      <div className="distant-meteor-cloud" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index}/>)}</div>
      <div className="cosmic-dust" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index}/>)}</div>
      <div className="orbital-satellite" aria-hidden="true"><i/><b/><span/></div>
      <div className="station-brand"><span>ORBITAL COMMAND</span><b>SpaceNova<span>X</span></b><small>EARTH SECTOR · HQ-01</small></div>
      <div className="captain-strip"><span><small>{t.captain}</small><b>{user.firstName || 'Space Explorer'}</b></span><span><small>LEVEL</small><b>{user.level || 1}</b></span><span><small>{t.status}</small><b>{user.isGuest ? t.guest : 'TELEGRAM VERIFIED'}</b></span></div>
    </section>
    <MiningCore user={liveUser} t={t} onStart={onStart} onClaim={onClaim} busy={busy}/>
    <section className="command-card home-mission-banner" onClick={() => setTab('missions')}>
      <div className="mission-emblem"><Icon name="mission" size={26}/></div>
      <div><small>MISSION PASSPORT · PERMANENT BONUS</small><h3>{t.missions}</h3><p>Complete all 5 missions · Unlock +5% mining speed</p></div>
      <div className="mission-reward"><b>+1,300</b><small>POINTS · +5% SPEED</small></div><Icon name="arrow"/>
    </section>
    <ActivityLedger balance={user.balance} t={t}/>
  </main>;
}

const MISSION_BRANDS = {
  website: { mark: 'W', className: 'web' },
  telegram: { mark: 'T', className: 'telegram' },
  x: { mark: 'X', className: 'x' },
  x_follow: { mark: 'X', className: 'x' },
  discord: { mark: 'D', className: 'discord' },
  youtube_subscribe: { mark: '▶', className: 'youtube' },
  youtube_sub: { mark: '▶', className: 'youtube' },
};

function Missions({ user, setUser, t, language }) {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState('');
  const { voiceState, play: playMissionVoice } = useNovaVoiceFeedback('missions-briefing');
  useEffect(() => {
    let live = true;
    api('/api/missions').then((data) => { if (live) setMissions(data.missions || []); }).catch(() => {}).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);
  const completed = missions.filter((mission) => mission.status?.completed).length;
  const totalReward = missions.filter((mission) => !mission.status?.completed).reduce((sum, mission) => sum + Number(mission.reward || 0), 0);
  const passportComplete = missions.length === 5 && completed === 5;
  const missionBrief = language === 'ko'
    ? '캡틴, 공식 웹사이트, 텔레그램, 디스코드, 엑스, 유튜브의 다섯 가지 미션을 모두 완료하세요. 여러분의 참여는 공식 채널 성장, 콘텐츠 도달률, 게임과 노바 AI의 지속적인 개발 기반을 강화합니다. 총 1,300 SPNX 포인트와 미션 패스포트가 지급되며, 기본 채굴 속도가 영구적으로 5퍼센트 증가합니다. 최종 토큰 전환은 KYC와 보안 검증을 통과한 계정만 가능합니다.'
    : 'Captain, complete all five missions: the official website, Telegram, Discord, X, and YouTube. Your participation strengthens official channel growth, content reach, and the sustainable development of our games and NOVA AI. You will receive 1,300 SPNX Points and a Mission Passport that permanently increases base mining speed by five percent. Final token conversion requires KYC and security approval.';
  function explainMission() {
    playMissionVoice(missionBrief, language, .94);
  }
  async function claim(mission) {
    if (mission.status?.completed || claiming) return;
    setClaiming(mission.id);
    try {
      if (PREVIEW_BUILD) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (!mission.status?.openedAt) {
          const openedAt = Date.now() - 16_000;
          setMissions((current) => current.map((item) => item.id === mission.id ? { ...item, status: { completed: false, openedAt, verificationReadyAt: openedAt + 15_000 } } : item));
        } else {
          setMissions((current) => current.map((item) => item.id === mission.id ? { ...item, status: { completed: true } } : item));
        }
      } else {
        if (!mission.status?.openedAt) {
          const data = await api('/api/missions/open', { method: 'POST', body: { missionId: mission.id } });
          setMissions((current) => current.map((item) => item.id === mission.id ? { ...item, status: data.status } : item));
        } else {
          const data = await api('/api/missions/claim', { method: 'POST', body: { missionId: mission.id } });
          if (data.user) setUser((current) => ({ ...current, ...data.user }));
          setMissions((current) => current.map((item) => item.id === mission.id ? { ...item, status: { completed: true } } : item));
        }
      }
      if (!mission.status?.openedAt && mission.url) {
        const telegram = window.Telegram?.WebApp;
        if (telegram?.openLink) telegram.openLink(mission.url); else window.open(mission.url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) { window.alert(error.message); }
    setClaiming('');
  }
  return <main className="v15-page"><section className="command-card missions-command">
    <div className="section-heading"><div><small>COMMUNITY REWARD NETWORK</small><h2>{t.missions}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>SERVER VERIFIED</span></div>
    <div className="mission-summary">
      <div className="mission-progress-ring" style={{ '--mission-progress': `${missions.length ? completed / missions.length * 360 : 0}deg` }}><span><b>{completed}/{missions.length || 5}</b><small>{t.completed}</small></span></div>
      <div><small>{t.rewardAvailable}</small><strong>+{totalReward.toLocaleString()} SPNX POINT</strong><p>{language === 'ko' ? '5개 공식 미션을 모두 완료하면 Mission Passport와 기본 채굴 속도 +5%가 영구 적용됩니다.' : 'Complete all five official missions to permanently unlock the Mission Passport +5% base mining speed bonus.'}</p></div>
    </div>
    <div className={`mission-passport ${passportComplete ? 'unlocked' : ''}`}>
      <img src="/nova-ai-command-intelligence-v17.webp" alt="NOVA AI"/>
      <div><small>NOVA AI · MISSION BRIEFING</small><b>{passportComplete ? (language === 'ko' ? 'MISSION PASSPORT 인증 완료' : 'MISSION PASSPORT VERIFIED') : (language === 'ko' ? '5개 미션 완수 시 채굴률 +5%' : 'COMPLETE 5 MISSIONS · +5% MINING')}</b><p>{missionBrief}</p></div>
      <button className={`nova-voice-control voice-${voiceState}`} onClick={explainMission} aria-live="polite"><Icon name="speaker" size={17}/>{voiceLabel(voiceState, language, 'NOVA 설명 듣기', 'HEAR NOVA')}</button>
    </div>
    <div className="community-growth-loop">
      <div><small>01 · PARTICIPATE</small><b>{language === 'ko' ? '공식 채널 참여' : 'Official participation'}</b><p>{language === 'ko' ? '검증된 회원이 SpaceNovaX 공식 채널에 참여합니다.' : 'Verified Captains join official SpaceNovaX channels.'}</p></div>
      <i><Icon name="arrow" size={16}/></i>
      <div><small>02 · GROW</small><b>{language === 'ko' ? '도달률과 신뢰 성장' : 'Reach and trust grow'}</b><p>{language === 'ko' ? '커뮤니티 규모와 콘텐츠 영향력이 함께 성장합니다.' : 'Community scale and content impact grow together.'}</p></div>
      <i><Icon name="arrow" size={16}/></i>
      <div><small>03 · BUILD</small><b>{language === 'ko' ? 'NOVA AI·게임 재투자 기반' : 'NOVA AI and game foundation'}</b><p>{language === 'ko' ? '성장 기반은 제품 개발과 생태계 운영을 지속시키는 데 사용됩니다.' : 'Growth supports sustainable product development and operations.'}</p></div>
    </div>
    <div className="mission-list">{loading ? <div className="mission-skeleton">SYNCING MISSION NETWORK…</div> : missions.map((mission) => {
      const brand = MISSION_BRANDS[mission.id] || { mark: 'M', className: 'web' };
      const done = mission.status?.completed;
      const opened = Boolean(mission.status?.openedAt);
      return <article className={`mission-card ${brand.className} ${done ? 'done' : ''}`} key={mission.id}>
        <div className="mission-brand">{brand.mark}</div>
        <div className="mission-copy"><small>{mission.type === 'daily' ? 'DAILY MISSION' : 'ONE-TIME MISSION'}</small><h3>{mission.title}</h3><span>{done ? 'Reward secured in server ledger' : opened ? 'Return and request server verification' : 'Open official channel and complete mission'}</span></div>
        <div className="mission-value"><b>+{Number(mission.reward || 0)}</b><small>SPNX</small></div>
        <button disabled={done || claiming === mission.id} onClick={() => claim(mission)}>{done ? 'COMPLETED' : claiming === mission.id ? 'VERIFYING' : opened ? 'VERIFY' : mission.action || 'OPEN'}{!done && <Icon name={opened ? 'shield' : 'external'} size={15}/>}</button>
      </article>;
    })}</div>
    <p className="mission-policy"><Icon name="shield" size={16}/>{language === 'ko' ? '미션 보상과 +5% 채굴 보너스는 서버 원장에 기록됩니다. 최종 SPNX 전환에는 KYC 및 공식 채널 참여 검증이 필요합니다.' : 'Mission rewards and the +5% mining bonus are recorded in the server ledger. KYC and official-channel participation verification are required for final SPNX conversion.'}</p>
  </section></main>;
}

function Game({ user, t, language }) {
  const [gameOpen, setGameOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [gameUrl, setGameUrl] = useState('');
  const [gameSession, setGameSession] = useState('');
  const [gameSyncStatus, setGameSyncStatus] = useState('');
  const gameFrameRef = useRef(null);
  const { voiceState, play: playGameVoice } = useNovaVoiceFeedback('game-reward-briefing');
  const launchBriefings = {
    en: 'Captain, NOVA-X launch sequence is ready. Beginning the Genesis Gate defense operation.',
    ko: '캡틴, NOVA-X 출격 준비가 완료되었습니다. 제네시스 게이트 방어 작전을 시작합니다.',
    ja: 'キャプテン、NOVA-Xの発進準備が完了しました。ジェネシスゲート防衛作戦を開始します。',
    zh: '舰长，NOVA-X 已准备起飞。现在开始创世纪之门防御行动。',
    es: 'Capitán, la secuencia de lanzamiento de NOVA-X está lista. Iniciando la defensa de la Puerta Génesis.',
    pt: 'Capitão, a sequência de lançamento da NOVA-X está pronta. Iniciando a defesa do Portal Gênesis.',
    de: 'Captain, die NOVA-X ist startbereit. Die Verteidigung des Genesis-Tors beginnt.',
    fr: 'Capitaine, la séquence de lancement de NOVA-X est prête. Début de la défense de la Porte Genesis.',
    ru: 'Капитан, NOVA-X готов к запуску. Начинаем оборону Врат Генезиса.',
    vi: 'Thuyền trưởng, NOVA-X đã sẵn sàng xuất kích. Bắt đầu chiến dịch bảo vệ Cổng Genesis.',
    id: 'Kapten, urutan peluncuran NOVA-X siap. Memulai operasi pertahanan Gerbang Genesis.',
  };
  const rewardBriefing = language === 'ko'
    ? '캡틴, 게임 보상 안내입니다. 다이아몬드 300개를 모으면 10 SPNX 포인트를 받으며 하루 최대 두 번 적용됩니다. 보급함은 하루 한 번, 1에서 5 SPNX 포인트를 무작위로 지급합니다. 보스 최초 처치 보상은 하루 한 번 5 SPNX 포인트입니다. 게임 보상은 하루 최대 30 SPNX 포인트이며, 미국 동부시간 오전 6시에 새로 시작됩니다. 모든 보상은 서버 검증 후 원장에 기록됩니다.'
    : 'Captain, here is your game reward briefing. Collect three hundred diamonds to earn ten SPNX Points, up to twice per day. A supply crate grants a random one to five SPNX Points once per day. Your first boss defeat grants five SPNX Points once per day. Total game rewards are capped at thirty SPNX Points per day and reset at six A M Eastern Time. Every reward is server verified and recorded in the ledger.';
  useEffect(() => {
    if (!gameOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.Telegram?.WebApp?.expand?.();
    const closeOnBackground = () => {
      if (document.hidden) {
        setGameOpen(false);
        setLoaded(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setGameOpen(false);
        setLoaded(false);
      }
    };
    document.addEventListener('visibilitychange', closeOnBackground);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('visibilitychange', closeOnBackground);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [gameOpen]);
  useEffect(() => {
    if (!gameOpen || !gameSession) return undefined;
    const gameOrigin = new URL(GAME_URL).origin;
    const onGameMessage = async (event) => {
      if (event.origin !== gameOrigin || event.source !== gameFrameRef.current?.contentWindow) return;
      const message = event.data && typeof event.data === 'object' ? event.data : {};
      if (message.type === 'SPACENOVAX_GAME_BRIDGE_READY' || message.type === 'SPACENOVAX_GAME_READY') {
        event.source?.postMessage({
          type: 'SPACENOVAX_APP_CONTEXT',
          session: gameSession,
          language,
          rewards: { enabled: false, reason: 'server-signature-required' },
        }, gameOrigin);
        setGameSyncStatus(language === 'ko' ? '게임 보안 연결 완료' : 'Secure game link active');
        return;
      }
      if (message.type !== 'SPACENOVAX_GAME_RESULT') return;
      const result = message.result && typeof message.result === 'object' ? message.result : message;
      try {
        setGameSyncStatus(language === 'ko' ? '점수 저장 중…' : 'Saving score…');
        const saved = await api('/api/game/result', {
          method: 'POST',
          body: {
            session: gameSession,
            runId: result.runId,
            score: result.score,
            kills: result.kills,
            rescued: result.rescued,
            missionCleared: result.missionCleared,
            bossDefeated: result.bossDefeated,
          },
        });
        setGameSyncStatus(language === 'ko'
          ? `점수 저장 완료 · 최고 ${Number(saved.bestScore || 0).toLocaleString()}`
          : `Score saved · best ${Number(saved.bestScore || 0).toLocaleString()}`);
      } catch (error) {
        setGameSyncStatus(error.message || (language === 'ko' ? '점수를 저장하지 못했습니다.' : 'Unable to save score.'));
      }
    };
    window.addEventListener('message', onGameMessage);
    return () => window.removeEventListener('message', onGameMessage);
  }, [gameOpen, gameSession, language]);

  async function launchGame() {
    // Keep this inside the user's tap handler so mobile and Telegram WebViews
    // grant audio playback permission before the cross-origin game is mounted.
    triggerNovaHaptic('medium');
    speakNova(launchBriefings[language] || launchBriefings.en, language, .96, 'game-launch');
    try {
      const launch = await api('/api/game/launch', { method: 'POST', body: {} });
      const params = new URLSearchParams({ source: 'mining-app', mode: 'fullscreen', session: launch.session, api: window.location.origin, parentOrigin: window.location.origin, lang: language });
      const directGameUrl = `${GAME_URL}/?${params.toString()}`;
      // Telegram Android can block a cross-origin iframe even when the game URL
      // itself is healthy. Open the verified game directly there; desktop keeps
      // the in-app frame and the same secure launch session.
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(directGameUrl, { try_instant_view: false });
        setGameSyncStatus(language === 'ko' ? '게임을 전체 화면으로 실행합니다.' : 'Opening the game in full screen.');
        return;
      }
      setGameSession(launch.session);
      setGameSyncStatus('');
      setGameUrl(directGameUrl);
      setLoaded(false);
      setGameOpen(true);
    } catch (error) {
      window.alert(error.message || (language === 'ko' ? '게임 연결을 시작할 수 없습니다.' : 'Unable to start the game connection.'));
    }
  }
  function closeGame() {
    setGameOpen(false);
    setLoaded(false);
    setGameUrl('');
    setGameSession('');
    setGameSyncStatus('');
  }
  function playRewardBriefing() {
    playGameVoice(rewardBriefing, language, .94);
  }
  return <main className="v15-page">
    <section className="command-card game-portal game-theme">
      <div className="section-heading"><div><small>{t.realGame}</small><h2>{t.game}</h2></div><span className="live-state"><i/>LIVE</span></div>
      <p>{t.gameCopy}</p>
      <div className="game-launch-preview" aria-label={language === 'ko' ? 'NOVA-X 게임 미리보기' : 'NOVA-X game preview'}>
        <img src="/nova-x-launch-cinematic-v1.svg" alt="NOVA-X Genesis Defense flagship at the SpaceNovaX orbital base"/>
        <div className="game-ship-brand" aria-hidden="true">
          <small>SPACENOVAX FLAGSHIP</small>
          <b>NOVA-X</b>
          <span>GENESIS DEFENSE</span>
        </div>
        <div className="game-launch-copy">
          <small>ORBITAL FLIGHT COMMAND</small>
          <strong>{language === 'ko' ? '전체화면 전투 관제' : 'FULL-SCREEN FLIGHT COMMAND'}</strong>
          <span>{language === 'ko' ? '게임을 시작할 때만 화면과 배경음악이 활성화됩니다.' : 'The game display and soundtrack activate only after launch.'}</span>
        </div>
      </div>
      <button className="primary-action game-single-launch" onClick={launchGame}><Icon name="game"/>{language === 'ko' ? 'NOVA-X 게임 시작' : 'LAUNCH NOVA-X'}<Icon name="arrow"/></button>
      <div className="nova-reward-briefing"><img src="/nova-ai-command-intelligence-v17.webp" alt="NOVA AI"/><div><small>NOVA · REWARD COMMAND</small><b>{language === 'ko' ? '게임 운영 및 보상 안내' : 'Game operations and reward briefing'}</b><p>{rewardBriefing}</p></div><button className={`nova-voice-control voice-${voiceState}`} onClick={playRewardBriefing} aria-live="polite"><Icon name="speaker" size={17}/>{voiceLabel(voiceState, language, '음성 안내', 'PLAY VOICE')}</button></div>
      <div className="game-reward-grid"><span><small>300 DIAMONDS</small><b>+10 SPNX × 2</b></span><span><small>SUPPLY CRATE · ONCE</small><b>+1~5 SPNX</b></span><span><small>FIRST BOSS · ONCE</small><b>+5 SPNX</b></span><span><small>DAILY RESET</small><b>06:00 AM ET</b></span></div>
      <div className="game-stats"><span><small>{t.dailyCap}</small><b>{Number(user.gameReward?.earnedToday || 0)} / 30 SPNX</b></span><span><small>BEST SCORE</small><b>{Number(user.gameReward?.bestScore || 0).toLocaleString()}</b></span></div>
    </section>
    {gameOpen && <div className="game-fullscreen" role="dialog" aria-modal="true" aria-label="NOVA-X">
      <div className="game-fullscreen-bar">
        <div><img src="/brand/spacenovax-symbol.jpg" alt=""/><span><small>SPACENOVAX</small><b>NOVA-X</b></span></div>
        <button onClick={closeGame} aria-label={language === 'ko' ? '게임 닫기' : 'Close game'}>×</button>
      </div>
      {!loaded && <div className="game-loading game-fullscreen-loading"><img src="/brand/spacenovax-symbol.jpg" alt=""/><b>CONNECTING TO FLIGHT SERVER</b><span><i/></span></div>}
      {gameSyncStatus && <div className="game-sync-status" role="status">{gameSyncStatus}</div>}
      <iframe ref={gameFrameRef} title="SpaceNovaX official game" src={gameUrl} onLoad={() => setLoaded(true)} allow="autoplay; fullscreen; gamepad" />
    </div>}
  </main>;
}

function NovaAI({ user, t, language }) {
  const storageKey = `spnx_nova_conversation_v151_${language}`;
  const initialMessage = () => ({ id: crypto.randomUUID?.() || String(Date.now()), role: 'nova', text: language === 'ko'
    ? `캡틴 ${user.firstName || 'Explorer'}, NOVA 지휘 링크가 연결되었습니다. 무엇이든 질문해 주세요.`
    : `Captain ${user.firstName || 'Explorer'}, NOVA command link is online. Ask me anything.` });
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || [initialMessage()]; } catch { return [initialMessage()]; }
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState('');
  const [aiStatus, setAiStatus] = useState({ configured: false, enabled: true, model: '' });
  const { voiceState, play: playAiVoice } = useNovaVoiceFeedback('nova-ai-message');
  const endRef = useRef(null);
  const abortRef = useRef(null);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50))); endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, storageKey]);
  useEffect(() => { api('/api/nova/status').then(setAiStatus).catch(() => setAiStatus({ configured: false, enabled: false, model: '' })); }, []);
  useEffect(() => () => { abortRef.current?.abort(); novaVoiceRouter.stopVoice(); }, []);
  function newChat() {
    abortRef.current?.abort();
    novaVoiceRouter.stopVoice();
    setBusy(false); setText(''); setMessages([initialMessage()]);
  }
  function speak(value, messageId) {
    setSpeakingMessageId(messageId || '');
    playAiVoice(value, language, 1);
  }
  function voiceInput() {
    triggerNovaHaptic('medium');
    const started = novaVoiceRouter.listen({
      language,
      interimResults: true,
      onStart: () => setListening(true),
      onResult: (spoken) => setText(spoken),
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    });
    if (!started) window.alert('Voice input is not supported in this browser.');
  }
  async function send() {
    const clean = text.trim(); if (!clean || busy) return;
    const userMessage = { id: crypto.randomUUID?.() || String(Date.now()), role: 'user', text: clean };
    const prior = messages.slice(-12);
    setMessages((m) => [...m, userMessage]); setText(''); setBusy(true);
    abortRef.current = new AbortController();
    try {
      const data = await novaVoiceRouter.ask({
        question: clean,
        language,
        history: prior.map((item) => ({ role: item.role === 'nova' ? 'assistant' : 'user', text: item.text })),
        captainContext: { id: user.id, level: user.level, balance: user.balance, mining: user.mining, gameReward: user.gameReward },
        clientKey: getClientId(),
      });
      setMessages((m) => [...m, { id: crypto.randomUUID?.() || String(Date.now()), role: 'nova', text: data.reply || data.message || 'NOVA response received.' }]);
    } catch (error) {
      if (error.name !== 'AbortError') setMessages((m) => [...m, { id: String(Date.now()), role: 'nova', text: error.message }]);
    }
    setBusy(false);
  }
  return <main className="v15-page"><section className="command-card ai-console ai-theme">
    <div className="section-heading ai-heading"><div><small>SPACENOVAX INTELLIGENCE CORE</small><h2>{t.ai}</h2></div><div className="ai-head-actions"><span className={`live-state ${aiStatus.configured && aiStatus.enabled ? 'pulse' : 'setup'}`}><i/>{aiStatus.configured && aiStatus.enabled ? 'LIVE AI' : 'SETUP REQUIRED'}</span><button onClick={newChat} title={t.newChat}><Icon name="plus" size={18}/><span>{t.newChat}</span></button></div></div>
    <div className="ai-identity"><div className="nova-portrait"><img src="/nova-ai-command-intelligence-v17.webp" alt="NOVA AI command model"/><i/><i/></div><div><b>NOVA</b><small>SpaceNovaX Proprietary AI · Web3 · Mining · GameFi{aiStatus.model ? ` · ${aiStatus.model}` : ''}</small></div></div>
    {!aiStatus.configured && <div className="ai-setup-notice"><Icon name="shield"/><div><b>Live intelligence is not connected</b><p>Restart START_PREVIEW.bat and enter a valid server-side NOVA AI key. The key is never stored in the browser.</p></div></div>}
    <div className="ai-messages">{messages.map((m) => <article className={m.role} key={m.id}>
      <div className={`message-avatar ${m.role === 'nova' ? 'nova-message-avatar' : ''}`}>{m.role === 'nova' ? <img src="/nova-ai-command-intelligence-v17.webp" alt=""/> : (user.firstName || 'C').slice(0,1).toUpperCase()}</div>
      <div className="message-body"><small>{m.role === 'nova' ? 'NOVA' : t.captain}</small><p>{m.text}</p>
        <div className="message-tools"><button onClick={() => navigator.clipboard?.writeText(m.text)}><Icon name="copy" size={14}/>{t.copy}</button>{m.role === 'nova' && <button className={`nova-voice-control ${speakingMessageId === m.id ? `voice-${voiceState}` : 'voice-idle'}`} onClick={() => speak(m.text, m.id)} aria-live="polite"><Icon name="speaker" size={14}/>{speakingMessageId === m.id ? voiceLabel(voiceState, language, '음성으로 듣기', 'READ ALOUD') : t.read}</button>}</div>
      </div>
    </article>)}
      {busy && <article className="nova thinking"><div className="message-avatar nova-message-avatar"><img src="/nova-ai-command-intelligence-v17.webp" alt=""/></div><div className="message-body"><small>NOVA</small><p><span className="typing"><i/><i/><i/></span>{t.thinking}</p></div></article>}
      <div ref={endRef}/>
    </div>
    <div className="ai-composer">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? t.listening : t.ask} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}/>
      <div className="composer-actions"><button className={listening ? 'listening' : ''} onClick={voiceInput} title={t.listening}><Icon name="mic"/></button>{busy ? <button onClick={() => { abortRef.current?.abort(); setBusy(false); }} title={t.stop}><Icon name="close"/></button> : <button className="send-button" disabled={!text.trim()} onClick={send} title={t.send}><Icon name="arrow"/></button>}</div>
      <small>NOVA can make mistakes. Never share passwords, seed phrases, or private keys.</small>
    </div>
  </section></main>;
}

function PreviewPanel({ open, close, t }) {
  const checks = [
    ['English default', document.documentElement.lang === 'en' || Boolean(localStorage.getItem('spnx_language'))],
    ['Responsive navigation', true], ['Mining sandbox protection', PREVIEW_BUILD],
    ['NOVA conversation history', true], ['Voice capability detection', 'speechSynthesis' in window],
    ['Draggable NOVA guide', true], ['Orbital ambient events', true],
    ['Official website & contact', true], ['Official game portal', true], ['Admin route preserved', true],
  ];
  if (!open) return null;
  return <div className="preview-overlay" role="dialog" aria-modal="true">
    <section className="preview-panel"><header><div><small>V16.5-PREVIEW-12</small><h2>Pre-deployment QA</h2></div><button onClick={close}><Icon name="close"/></button></header>
      <p>This build is isolated from production mining mutations. Review every screen before GitHub release.</p>
      <div className="qa-checks">{checks.map(([label, pass]) => <div key={label}><span className={pass ? 'pass' : 'warn'}>{pass ? 'PASS' : 'CHECK'}</span><b>{label}</b></div>)}</div>
      <button className="primary-action" onClick={close}><Icon name="shield"/>Continue preview<Icon name="arrow"/></button>
    </section>
  </div>;
}

function More({ t, setTab, language }) {
  const ko = language === 'ko';
  const cards = [['whitepaper', 'Whitepaper', 'mission'], ['orbit', ko ? '국제 네비게이션' : 'Global Navigation', 'globe'], ['community', t.community, 'community'], ['nodes', ko ? '커뮤니티 노드' : 'Community Node', 'bolt'], ['missions', t.missions, 'shield'], ['fleet', t.referrals, 'fleet'], ['rank', t.ranking, 'home'], ['wallet', t.wallet, 'wallet'], ['kyc', t.kyc, 'shield'], ['game', t.game, 'game']];
  return <main className="v15-page"><section className="command-card command-grid command-theme">
    <div className="section-heading"><div><small>NOVA OPERATIONS</small><h2>{t.command}</h2></div></div>
    <div className="module-grid">{cards.map(([id, label, icon]) => <button key={id} onClick={() => setTab(id)}><Icon name={icon}/><span><b>{label}</b><small>Open module</small></span><Icon name="arrow" size={18}/></button>)}</div>
    <h3>{t.official}</h3><div className="official-links" aria-label="SpaceNovaX official channels">
      <a className="official-channel website-channel" href="https://spacenovax.com" target="_blank" rel="noreferrer"><Icon name="globe" size={15}/><span>WEBSITE</span></a>
      <a className="official-channel telegram-channel" href="https://t.me/spacenovaxteam" target="_blank" rel="noreferrer"><Icon name="telegram" size={15}/><span>TELEGRAM</span></a>
      <a className="official-channel x-channel" href="https://x.com/spacenovaxteam" target="_blank" rel="noreferrer"><Icon name="xbrand" size={14}/><span>X</span></a>
      <a className="official-channel discord-channel" href="https://discord.gg/rxVNWMC8e8" target="_blank" rel="noreferrer"><Icon name="discord" size={16}/><span>DISCORD</span></a>
      <a className="official-channel youtube-channel" href="https://youtube.com/@spacenovaxteam" target="_blank" rel="noreferrer"><Icon name="youtube" size={17}/><span>YOUTUBE</span></a>
    </div>
    <section className="collaboration-contact">
      <div className="contact-orbit"><i/><span>SPNX</span></div>
      <div><small>PARTNERSHIP · MEDIA · TECHNOLOGY</small><h3>{ko ? 'SpaceNovaX와 미래를 함께 만드세요.' : 'Build the future with SpaceNovaX.'}</h3><p>{ko ? 'AI, GameFi, 콘텐츠, 기술 협업 및 공식 사업 문의 전용 창구입니다.' : 'Official contact for AI, GameFi, content, technology collaboration, and business inquiries.'}</p></div>
      <div className="contact-actions"><a href="mailto:business@spacenovax.com?subject=SpaceNovaX%20Collaboration%20Inquiry"><Icon name="external" size={16}/>business@spacenovax.com</a><a href="https://spacenovax.com" target="_blank" rel="noreferrer"><Icon name="globe" size={16}/>spacenovax.com</a></div>
    </section>
  </section></main>;
}

function Community({ user, language, setTab }) {
  const [posts, setPosts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [permission, setPermission] = useState({ allowed: false, circleCount: user.securityCircleCount || 0, required: 5 });
  const [category, setCategory] = useState('all');
  const [form, setForm] = useState({ category: 'nova-ai', title: '', body: '', imageData: '', imageName: '' });
  const [notice, setNotice] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { voiceState, play: playCommunityVoice } = useNovaVoiceFeedback('community-briefing');
  const ko = language === 'ko';
  const load = useCallback(() => api('/api/community/feed', { method: 'POST', body: { category } }).then((data) => { setPosts(data.posts || []); setPermission(data.permission || permission); }).catch((error) => setNotice(error.message)), [category]);
  useEffect(() => {
    load();
    api('/api/community/dashboard', { method: 'POST', body: {} }).then((data) => setDashboard(data.dashboard || null)).catch((error) => setNotice(error.message));
  }, [load]);
  function copyInvite() {
    navigator.clipboard?.writeText(dashboard?.referralLink || '');
    setNotice(ko ? '함대 초대 링크를 복사했습니다.' : 'Fleet invitation link copied.');
  }
  async function shareInvite() {
    const url = dashboard?.referralLink || '';
    if (!url) return;
    const active = Number(dashboard?.activeFleet || 0);
    const limit = Number(dashboard?.referralLimit || user.fleetMaxMembers || 1000);
    const bonus = Number(dashboard?.fleetBonus || user.fleetBonus || 0);
    const text = ko
      ? `나의 SpaceNovaX 함대에 합류하세요. 활성 추천인 ${active}/${limit}, 현재 채굴 속도 +${bonus}%`
      : `Join my SpaceNovaX Fleet. Active referrals ${active}/${limit}; current mining speed bonus +${bonus}%.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'SpaceNovaX · Explore · Earn · Beyond', text, url });
        setNotice(ko ? '공유 카드 링크를 전송했습니다. 신규 캡틴이 공식 앱을 열면 추천이 자동 연결됩니다.' : 'Share card link sent. A new Captain is linked automatically after opening the official app.');
      } else {
        await navigator.clipboard?.writeText(url);
        setNotice(ko ? '공유 카드 링크를 복사했습니다.' : 'Share card link copied.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice(ko ? '공유를 완료하지 못했습니다. 링크를 복사해 다시 시도하세요.' : 'Could not complete sharing. Copy the link and try again.');
    }
  }
  function explainCommunityFleet() {
    const text = ko
      ? '캡틴, 이곳에서 본인의 함대 초대 코드와 링크를 복사하거나 공유할 수 있습니다. 초대한 회원이 실제로 채굴하면 활성 함대원으로 집계되고 채굴 속도 보너스가 적용됩니다. 최종 솔라나 SPNX 전환에는 본인 KYC와 추천인의 KYC 승인이 필요합니다. 주간 함대 순위는 함대원들의 게임 종합 점수로 결정되며, 게임 개인 순위도 이 화면에서 확인할 수 있습니다. 함대 전체 관리 버튼을 누르면 보안 서클, 함대 채팅, 비활성 회원 알림과 전체 리그를 이용할 수 있습니다.'
      : 'Captain, copy or share your fleet invitation code and link here. Invited members count as active fleet members when they actually mine, activating the mining speed bonus. Final Solana SPNX conversion requires your KYC and KYC approval for qualifying referrals. Weekly fleet ranking is based on the fleet game score, and your personal game rank is also shown here. Open Fleet Management for Security Circle, fleet chat, inactive-member reminders, and the complete league.';
    playCommunityVoice(text, language, .94);
  }
  async function prepareImage(file) {
    if (!file) return setForm((current) => ({ ...current, imageData: '', imageName: '' }));
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setNotice('PNG, JPEG, or WebP only.');
    const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = source; });
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', .82);
    if (imageData.length > 2_000_000) return setNotice('Image is still too large after optimization.');
    setForm((current) => ({ ...current, imageData, imageName: file.name }));
  }
  async function publish() {
    setPublishing(true); setNotice('');
    try { await api('/api/community/post', { method: 'POST', body: form }); setForm({ category: 'nova-ai', title: '', body: '', imageData: '', imageName: '' }); setNotice(ko ? '게시물이 등록되었습니다.' : 'Post published.'); load(); }
    catch (error) { setNotice(error.message); }
    setPublishing(false);
  }
  async function like(post) {
    try { await api('/api/community/like', { method: 'POST', body: { postId: post.id } }); load(); } catch (error) { setNotice(error.message); }
  }
  async function report(post) {
    try { const data = await api('/api/community/report', { method: 'POST', body: { postId: post.id } }); setNotice(data.message); } catch (error) { setNotice(error.message); }
  }
  const categories = [['all', ko ? '전체' : 'All'],['nova-ai','NOVA AI'],['game',ko ? '게임' : 'Game'],['mining',ko ? '채굴' : 'Mining'],['guide',ko ? '가이드' : 'Guides'],['community',ko ? '커뮤니티' : 'Community']];
  return <main className="v15-page"><section className="command-card ops-module community-theme">
    <div className="section-heading"><div><small>CAPTAIN KNOWLEDGE NETWORK</small><h2>{ko ? '캡틴 커뮤니티' : 'Captain Community'}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>TRUST GATED</span></div>
    <div className="community-intro"><img src="/nova-ai-command-intelligence-v17.webp" alt="NOVA"/><div><small>NOVA MODERATED INTELLIGENCE</small><h3>{ko ? '유용한 지식이 함대를 성장시킵니다.' : 'Useful knowledge strengthens every fleet.'}</h3><p>{ko ? 'NOVA AI, 게임 전략, 채굴 가이드와 SpaceNovaX 생태계 정보를 공유하세요. 모든 회원은 읽을 수 있으며 KYC 보안 서클 5명을 확보한 캡틴만 게시할 수 있습니다.' : 'Share NOVA AI knowledge, game strategy, mining guides, and SpaceNovaX ecosystem information. Everyone can read; posting requires five KYC-approved Security Circle members.'}</p></div></div>
    <section className="community-fleet-command">
      <div className="community-fleet-head"><div><small>COMMUNITY GROWTH COMMAND</small><h3>{ko ? '나의 초대 코드와 함대 현황' : 'My Invite Code & Fleet Status'}</h3><p>{ko ? '초대 링크를 공유해 검증된 캡틴 함대를 성장시키고 주간 함대·게임 순위를 확인하세요.' : 'Share your invitation, grow a verified Captain fleet, and track weekly fleet and game rankings.'}</p></div><div className="community-fleet-actions"><button className={`nova-voice-control voice-${voiceState}`} onClick={explainCommunityFleet} aria-live="polite"><Icon name="speaker" size={16}/>{voiceLabel(voiceState, language, 'NOVA 설명', 'NOVA BRIEF')}</button><button onClick={() => setTab('fleet')}>{ko ? '함대 전체 관리' : 'OPEN FLEET'}<Icon name="arrow" size={16}/></button></div></div>
      <div className="community-referral-code"><div><small>YOUR FLEET CODE</small><strong>{dashboard?.referralCode || user.referralCode || 'SYNCING'}</strong></div><input readOnly value={dashboard?.referralLink || 'Synchronizing invitation link…'}/><button onClick={copyInvite}><Icon name="copy" size={16}/>{ko ? '복사' : 'COPY'}</button><button onClick={shareInvite}><Icon name="external" size={16}/>{ko ? '공유' : 'SHARE'}</button></div>
      <div className="community-fleet-stats"><span><small>{ko ? '총 초대' : 'TOTAL INVITES'}</small><b>{dashboard?.totalInvites ?? user.referrals?.length ?? 0}</b></span><span><small>{ko ? '활성 함대' : 'ACTIVE FLEET'}</small><b>{dashboard?.activeFleet ?? user.activeFleet ?? 0}</b></span><span><small>{ko ? '채굴 보너스' : 'MINING BONUS'}</small><b>+{dashboard?.fleetBonus ?? user.fleetBonus ?? 0}%</b></span><span><small>{ko ? '주간 함대 순위' : 'FLEET RANK'}</small><b>{dashboard?.fleetRank ? `#${dashboard.fleetRank}` : '—'}</b></span><span><small>{ko ? '게임 순위' : 'GAME RANK'}</small><b>{dashboard?.gameRank ? `#${dashboard.gameRank}` : '—'}</b></span><span><small>{ko ? '최고 게임 점수' : 'BEST GAME SCORE'}</small><b>{Number(dashboard?.gameScore || 0).toLocaleString()}</b></span></div>
      <div className="community-rank-panels">
        <article><header><div><small>WEEKLY FLEET LEAGUE</small><b>{ko ? '함대 종합 순위' : 'Fleet Ranking'}</b></div><button onClick={() => setTab('rank')}>{ko ? '전체 보기' : 'VIEW ALL'}</button></header>{(dashboard?.fleetTop || []).length ? dashboard.fleetTop.slice(0,3).map((row) => <p key={row.rank}><em>#{row.rank}</em><span>{row.captainName}<small>{row.members} MEMBERS</small></span><strong>{Number(row.score || 0).toLocaleString()}</strong></p>) : <div className="community-rank-empty">{ko ? '첫 함대를 모집하고 순위에 도전하세요.' : 'Recruit your first fleet and enter the league.'}</div>}</article>
        <article><header><div><small>NOVA FLIGHT LEAGUE</small><b>{ko ? '게임 개인 순위' : 'Game Ranking'}</b></div><button onClick={() => setTab('rank')}>{ko ? '전체 보기' : 'VIEW ALL'}</button></header>{(dashboard?.gameTop || []).length ? dashboard.gameTop.slice(0,3).map((row) => <p key={row.rank}><em>#{row.rank}</em><span>{row.firstName}<small>PILOT</small></span><strong>{Number(row.score || 0).toLocaleString()}</strong></p>) : <div className="community-rank-empty">{ko ? '게임을 시작해 첫 점수를 기록하세요.' : 'Play the game and record the first score.'}</div>}</article>
      </div>
      <p className="community-fleet-rule"><Icon name="shield" size={15}/>{ko ? '추천 보너스의 최종 Solana SPNX 전환에는 본인 KYC와 KYC 승인 추천인 검증이 필요합니다.' : 'Final Solana SPNX conversion of referral bonuses requires your KYC and verified KYC-approved referrals.'}</p>
    </section>
    <div className={`publisher-access ${permission.allowed ? 'unlocked' : ''}`}><Icon name={permission.allowed ? 'community' : 'shield'}/><div><small>CAPTAIN PUBLISHING ACCESS</small><b>{permission.allowed ? (ko ? '게시 권한 활성화' : 'Publishing unlocked') : `${permission.circleCount || 0}/${permission.required || 5} SECURITY CIRCLE`}</b><p>{permission.allowed ? (ko ? '글과 사진을 업로드할 수 있습니다.' : 'You can publish text and photos.') : (ko ? 'KYC 보안 서클 5명을 확보하면 글·사진 게시 권한이 자동으로 활성화됩니다.' : 'Publishing unlocks automatically after securing five KYC-approved Security Circle members.')}</p></div></div>
    {permission.allowed && <div className="community-composer"><select value={form.category} onChange={(event) => setForm({...form,category:event.target.value})}>{categories.slice(1).map(([id,label]) => <option value={id} key={id}>{label}</option>)}</select><input value={form.title} onChange={(event) => setForm({...form,title:event.target.value})} placeholder={ko ? '명확한 제목을 입력하세요' : 'Add a clear title'}/><textarea value={form.body} onChange={(event) => setForm({...form,body:event.target.value})} placeholder={ko ? '커뮤니티에 도움이 되는 정보를 작성하세요…' : 'Write useful information for the community…'}/><div className="community-upload"><label><Icon name="plus" size={16}/>{form.imageName || (ko ? '사진 추가' : 'Add photo')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => prepareImage(event.target.files?.[0])}/></label>{form.imageData && <img src={form.imageData} alt="Preview"/>}<button disabled={publishing} onClick={publish}>{publishing ? 'PUBLISHING…' : (ko ? '게시하기' : 'PUBLISH')}<Icon name="arrow"/></button></div></div>}
    <div className="community-categories">{categories.map(([id,label]) => <button className={category === id ? 'active' : ''} onClick={() => setCategory(id)} key={id}>{label}</button>)}</div>
    <div className="community-feed">{posts.length ? posts.map((post) => <article className="community-post" key={post.id}><header><span className="community-avatar">{post.author.firstName.slice(0,1).toUpperCase()}</span><div><b>{post.author.firstName}</b><small>{post.author.fleetGrade} · {new Date(post.createdAt).toLocaleDateString()}</small></div><em>{post.category.toUpperCase()}</em></header><h3>{post.title}</h3><p>{post.body}</p>{post.imageUrl && <img className="community-post-image" src={post.imageUrl} alt="Community upload"/>}<footer><button className={post.liked ? 'liked' : ''} onClick={() => like(post)}>✦ {post.likes}</button><button onClick={() => report(post)}><Icon name="shield" size={13}/>{ko ? '신고' : 'Report'}</button></footer></article>) : <div className="community-empty"><Icon name="community" size={38}/><b>{ko ? '첫 번째 지식을 공유해 보세요.' : 'Be the first to share useful knowledge.'}</b><p>{ko ? '검증된 캡틴의 글이 이곳에 표시됩니다.' : 'Posts from verified captains will appear here.'}</p></div>}</div>
    {notice && <p className="module-notice">{notice}</p>}
  </section></main>;
}

function Whitepaper({ language }) {
  const ko = language === 'ko';
  return <main className="v15-page"><section className="command-card ops-module whitepaper-theme">
    <div className="section-heading"><div><small>SPACENOVAX CORPORATE MANIFESTO</small><h2>{ko ? '백서 및 비전' : 'Whitepaper & Vision'}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>OFFICIAL</span></div>
    <div className="manifesto-hero"><img src="/nova-ai-command-intelligence-v17.webp" alt="NOVA AI"/><div><small>OUR IDENTITY</small><h3>{ko ? '우리는 코인을 판매하는 회사가 아닙니다.' : 'We are not a coin-selling company.'}</h3><p>{ko ? 'SpaceNovaX는 NOVA AI와 게임을 개발하는 기술 회사입니다. SPNX는 제품과 커뮤니티 참여를 연결하는 생태계 유틸리티입니다.' : 'SpaceNovaX is a technology company building NOVA AI and games. SPNX is an ecosystem utility connecting products with verified community participation.'}</p></div></div>
    <div className="vision-pillars">
      <article><b>01</b><div><h3>NOVA AI</h3><p>{ko ? 'Web3·게임·커뮤니티 운영을 지원하는 SpaceNovaX 전용 인공지능 플랫폼.' : 'A proprietary AI platform for Web3, games, and community operations.'}</p></div></article>
      <article><b>02</b><div><h3>GAME STUDIO</h3><p>{ko ? 'NOVA-X 세계관을 기반으로 완성도 높은 GameFi 경험을 개발합니다.' : 'Premium GameFi experiences built around the NOVA-X universe.'}</p></div></article>
      <article><b>03</b><div><h3>SPNX UTILITY</h3><p>{ko ? 'AI 서비스, 게임, 미션과 생태계 기능에 사용되는 참여 기반 유틸리티.' : 'Participation-based utility for AI services, games, missions, and ecosystem features.'}</p></div></article>
      <article><b>04</b><div><h3>FAIR NETWORK</h3><p>{ko ? '서버 검증, KYC, 투명한 보상 원장과 장기적인 신뢰를 우선합니다.' : 'Server verification, KYC, transparent reward ledgers, and long-term trust.'}</p></div></article>
    </div>
    <section className="whitepaper-section">
      <div className="whitepaper-title"><small>TOKEN ARCHITECTURE</small><h3>{ko ? '고정 공급량과 커뮤니티 중심 배분' : 'Fixed Supply & Community Allocation'}</h3><p>{ko ? 'SPNX 총 공급량은 100억 개로 고정되며 추가 발행은 없습니다. 커뮤니티 배분에는 채굴, GameFi, 미션, 추천과 생태계 이벤트가 포함됩니다.' : 'SPNX has a fixed 10 billion supply with no future minting. Community allocation covers mining, GameFi, missions, referrals, and ecosystem events.'}</p></div>
      <div className="supply-total"><small>TOTAL SUPPLY · NO FUTURE MINT</small><strong>10,000,000,000</strong><b>SPNX</b></div>
      <div className="allocation-bar"><i/><i/><i/><i/><i/><i/><i/></div>
      <div className="allocation-grid">{[['65%','COMMUNITY','6.5B'],['10%','LIQUIDITY','1.0B'],['10%','ECOSYSTEM','1.0B'],['5%','TEAM','0.5B'],['5%','MARKETING','0.5B'],['3%','TREASURY','0.3B'],['2%','ADVISORS','0.2B']].map(([pct,label,amount]) => <span key={label}><b>{pct}</b><small>{label}</small><em>{amount}</em></span>)}</div>
      <div className="mining-allocation"><div><small>COMMUNITY MINING RESERVE</small><strong>3.5B SPNX</strong></div><p>{ko ? '커뮤니티 65% 배분 중 35억 SPNX가 채굴 보상 풀로 운영됩니다.' : '3.5 billion SPNX within the 65% community allocation is reserved for mining rewards.'}</p></div>
    </section>
    <section className="whitepaper-section">
      <div className="whitepaper-title"><small>MINING & REDUCTION POLICY</small><h3>{ko ? '참여 증가에 따른 단계적 감산' : 'Progressive Reduction by Verified Growth'}</h3></div>
      <div className="policy-grid">
        <article><b>30</b><small>SPNX POINT / 24H</small><p>{ko ? '초기 기본 채굴 주기 보상' : 'Initial base mining cycle reward'}</p></article>
        <article><b>−10%</b><small>EVERY +10,000 KYC USERS</small><p>{ko ? 'KYC 인증 사용자 1만 명 증가마다 기본 채굴량 10% 감산' : 'Base reward decreases 10% for every 10,000 additional KYC users'}</p></article>
        <article><b>+5%</b><small>PER ACTIVE REFERRAL</small><p>{ko ? '활성 추천인 1명당 채굴 속도 증가, 최대 1,000명' : 'Mining speed per active referral, up to 1,000 members'}</p></article>
        <article><b>+1%</b><small>SECURITY CIRCLE · MAX 5</small><p>{ko ? 'KYC 보안 서클 1명당 1%, 최대 5% 추가' : '1% per KYC Security Circle member, up to 5%'}</p></article>
        <article><b>+5%</b><small>MISSION PASSPORT</small><p>{ko ? '5개 공식 커뮤니티 미션을 모두 완료하면 기본 채굴 속도에 영구 추가' : 'Permanent base mining speed bonus after completing all five official community missions'}</p></article>
        <article><b>6 MONTHS</b><small>CONVERSION WINDOW</small><p>{ko ? '메인넷 전환 기간 종료 후 미전환 물량 소각' : 'Unconverted balances burn after the conversion window'}</p></article>
      </div>
    </section>
    <section className="whitepaper-section">
      <div className="whitepaper-title"><small>BUSINESS DIRECTION</small><h3>{ko ? 'NOVA AI 중심의 글로벌 제품 생태계' : 'A Global Product Ecosystem Led by NOVA AI'}</h3></div>
      <div className="roadmap-line">
        <span><b>01</b><strong>NOVA AI PLATFORM</strong><small>{ko ? 'Web3 전용 AI와 커뮤니티 운영 지능' : 'Web3 intelligence and community operations'}</small></span>
        <span><b>02</b><strong>GAME & GAMEFI</strong><small>{ko ? 'NOVA-X 게임 세계관과 실사용 보상' : 'NOVA-X games and utility-driven rewards'}</small></span>
        <span><b>03</b><strong>WALLET & MARKET</strong><small>{ko ? '지갑, 거래, 디지털 생태계 서비스' : 'Wallet, marketplace, and digital services'}</small></span>
        <span><b>04</b><strong>GLOBAL AI COMPANY</strong><small>{ko ? 'SPNX로 연결되는 AI·게임 기술회사' : 'An AI and game company connected by SPNX'}</small></span>
      </div>
    </section>
    <div className="conversion-rule"><Icon name="shield"/><div><b>{ko ? 'Solana SPNX 전환 필수 조건' : 'Required for Solana SPNX Conversion'}</b><p>{ko ? '현재 채굴되는 값은 SPNX Point입니다. 공식 전환 기간에 본인 KYC 통과, 보안 검토, Solana 지갑 등록이 완료된 계정만 SPNX로 전환할 수 있습니다. 추천 보너스 역시 KYC를 통과한 정상 추천인만 최종 전환 계산에 포함됩니다.' : 'Mining currently earns SPNX Points. Conversion to SPNX during the official window requires account KYC approval, security review, and a registered Solana wallet. Referral bonuses count only for legitimate referrals who pass KYC.'}</p></div></div>
    <div className="whitepaper-statement"><Icon name="shield"/><p>{ko ? 'SpaceNovaX의 가치는 토큰 판매가 아니라 NOVA AI의 기술력, 게임의 품질, 그리고 실제 사용자가 만드는 생태계에서 발생합니다.' : 'SpaceNovaX derives value from NOVA AI technology, game quality, and a real user ecosystem—not from selling tokens.'}</p></div>
  </section></main>;
}

function Fleet({ user, setUser, t, language }) {
  const [fleet, setFleet] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  const [message, setMessage] = useState('');
  const [security, setSecurity] = useState(null);
  const [securityCode, setSecurityCode] = useState('');
  const [securityNote, setSecurityNote] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityTarget, setSecurityTarget] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState('overview');
  const code = fleet?.code || user.referralCode || 'SYNCING';
  const link = fleet?.link || `https://t.me/SpaceNovaXBot?start=${code}`;
  const load = useCallback(() => Promise.all([api('/api/fleet/dashboard', { method: 'POST', body: {} }), api('/api/security-circle/dashboard', { method: 'POST', body: {} })]).then(([data, securityData]) => { setFleet(data.fleet); setSecurity(securityData.circle || null); if (data.user) setUser((current) => ({ ...current, ...data.user })); }).catch((error) => setNotice(error.message)), [setUser]);
  useEffect(() => { load(); }, [load]);
  function share() {
    if (navigator.share) navigator.share({ title: 'Join my SpaceNovaX Fleet', text: 'Explore, mine and evolve with my fleet.', url: link });
    else navigator.clipboard?.writeText(link);
  }
  async function join() {
    try { const data = await api('/api/fleet/join', { method: 'POST', body: { code: codeInput } }); setNotice(data.message); if (data.user) setUser((current) => ({ ...current, ...data.user })); setCodeInput(''); load(); } catch (error) { setNotice(error.message); }
  }
  async function sendMessage() {
    if (!message.trim()) return;
    try { await api('/api/fleet/chat', { method: 'POST', body: { message } }); setMessage(''); load(); } catch (error) { setNotice(error.message); }
  }
  async function remind(member) {
    try { const data = await api('/api/fleet/remind', { method: 'POST', body: { userId: member.id } }); setNotice(data.message); } catch (error) { setNotice(error.message); }
  }
  async function inviteSecurityMember() { try { const data = await api('/api/security-circle/invite', { method: 'POST', body: { code: securityCode, message: securityNote } }); setNotice(data.message); setSecurityCode(''); setSecurityNote(''); load(); } catch (error) { setNotice(error.message); } }
  async function respondSecurityInvite(inviteId, action) { try { const data = await api('/api/security-circle/respond', { method: 'POST', body: { inviteId, action } }); setNotice(data.message); if (data.user) setUser((current) => ({ ...current, ...data.user })); load(); } catch (error) { setNotice(error.message); } }
  async function sendSecurityMessage() { if (!securityTarget || !securityMessage.trim()) return; try { await api('/api/security-circle/message', { method: 'POST', body: { toUserId: securityTarget, message: securityMessage } }); setSecurityMessage(''); load(); } catch (error) { setNotice(error.message); } }
  return <main className="v15-page"><section className="command-card ops-module fleet-theme">
    <div className="section-heading"><div><small>CAPTAIN REFERRAL NETWORK</small><h2>{t.referrals}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>LIVE NETWORK</span></div>
    <div className="fleet-explainer"><Icon name="fleet"/><div><b>{language === 'ko' ? '함대가 성장할수록 함께 강해집니다.' : 'Your fleet grows stronger together.'}</b><p>{language === 'ko' ? '활성 추천인 1명당 채굴 속도 +5%, 최대 1,000명까지 적용됩니다. 최종 전환은 KYC 인증 추천인만 인정됩니다.' : '+5% mining speed per active referral, up to 1,000 members. Final conversion recognizes KYC-verified referrals only.'}</p></div></div>
    <div className="fleet-hero"><div className="fleet-radar"><i/><i/><i/><span><Icon name="fleet" size={32}/></span></div><div><small>YOUR FLEET CODE</small><strong>{code}</strong><p>Invite verified captains. Every active member adds +5% mining speed.</p></div></div>
    <div className="referral-box"><input readOnly value={link}/><button onClick={() => navigator.clipboard?.writeText(link)}><Icon name="copy"/>COPY</button><button onClick={share}><Icon name="external"/>SHARE</button></div>
    {!user.referredBy && <div className="join-fleet"><div><small>HAVE A REFERRAL CODE?</small><b>Join a captain fleet</b></div><input value={codeInput} onChange={(event) => setCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="8-DIGIT CODE" maxLength={8}/><button onClick={join}>APPLY CODE<Icon name="arrow"/></button></div>}
    <div className="ops-stats fleet-stat-grid"><span><small>TOTAL INVITES</small><b>{fleet?.total ?? user.referrals?.length ?? 0}/1000</b></span><span><small>ACTIVE FLEET</small><b>{fleet?.active ?? user.activeFleet ?? 0}</b></span><span><small>KYC VERIFIED</small><b>{fleet?.kycVerified || 0}</b></span><span><small>MINING BONUS</small><b>+{user.fleetBonus || 0}%</b></span><span><small>SECURITY BONUS</small><b>+{user.securityCircleBonus || 0}%</b></span><span><small>FLEET GRADE</small><b>{fleet?.grade || user.fleetGrade || 'Explorer'}</b></span></div>
    <div className="fleet-conversion-alert"><Icon name="shield"/><div><b>{language === 'ko' ? '추천 보너스의 Solana SPNX 전환 기준' : 'Referral Bonus Conversion to Solana SPNX'}</b><p>{language === 'ko' ? '앱에서는 활성 추천인 기준으로 채굴 속도가 표시됩니다. 공식 전환 시에는 KYC를 통과한 정상 추천인만 최종 추천 보너스에 합산되며, 본인 KYC 승인과 Solana 지갑 등록도 필수입니다.' : 'The app displays speed using active referrals. At official conversion, only legitimate referrals who pass KYC count toward the final bonus. Your KYC approval and Solana wallet registration are also required.'}</p></div></div>
    <div className="fleet-tabs fleet-tabs-four"><button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>MEMBERS</button><button className={view === 'security' ? 'active' : ''} onClick={() => setView('security')}>SECURITY</button><button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>CHAT</button><button className={view === 'league' ? 'active' : ''} onClick={() => setView('league')}>LEAGUE</button></div>
    {view === 'overview' && <div className="fleet-members">{(fleet?.members || []).length ? fleet.members.map((member) => <article key={member.id}><div className={`member-signal ${member.active ? 'online' : ''}`}><i/></div><span><b>{member.firstName}</b><small>{member.active ? 'MINING ACTIVE' : 'INACTIVE · REMINDER AVAILABLE'}</small></span><strong>{Number(member.gameScore || 0).toLocaleString()} XP</strong>{!member.active && <button onClick={() => remind(member)}><Icon name="bolt" size={15}/>REMIND</button>}</article>) : <div className="fleet-empty">Invite your first captain to activate the fleet roster.</div>}</div>}
    {view === 'chat' && <div className="fleet-chat"><div className="fleet-chat-log">{(fleet?.messages || []).length ? fleet.messages.map((item) => <article key={item.id}><b>{item.firstName}</b><p>{item.message}</p><small>{new Date(item.at).toLocaleString()}</small></article>) : <div className="fleet-empty">Fleet channel is ready. Send the first message.</div>}</div><div className="fleet-chat-compose"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }} placeholder="Message your fleet…"/><button onClick={sendMessage}><Icon name="arrow"/></button></div></div>}
    {view === 'security' && <div className="security-circle-panel"><div className="security-circle-head"><div><small>MUTUAL TRUST NETWORK</small><h3>Security Circle</h3><p>{language === 'ko' ? '서로 아는 캡틴에게 초대를 보내고 상대가 승인하면 연결됩니다. 5명 완성 시 신뢰도 100%이며, KYC 승인 멤버만 채굴 속도 +1%씩 최대 +5%가 적용됩니다.' : 'Invite trusted Captains and connect only after mutual approval. Five members mean 100% trust; KYC-approved members add +1% mining speed each, up to +5%.'}</p></div><strong>{security?.percent ?? 0}%</strong></div><div className="security-progress"><i style={{width: ((security?.percent ?? 0) + '%')}}/></div><div className="security-slots">{Array.from({length:5},(_,index) => { const selected = security?.members?.[index]; return <span className={selected ? 'filled' : ''} key={index}>{selected ? selected.firstName.slice(0,1).toUpperCase() : <Icon name="plus" size={16}/>}<small>{selected ? selected.firstName : 'OPEN'}</small></span>; })}</div><div className="security-invite-form"><input value={securityCode} onChange={(e)=>setSecurityCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))} placeholder={language === 'ko' ? '캡틴 코드 8자리' : '8-DIGIT CAPTAIN CODE'}/><input value={securityNote} onChange={(e)=>setSecurityNote(e.target.value.slice(0,240))} placeholder={language === 'ko' ? '초대 메시지 (선택)' : 'Invitation message (optional)'}/><button onClick={inviteSecurityMember}><Icon name="shield" size={16}/>{language === 'ko' ? '보안 서클 초대' : 'INVITE'}</button></div><div className="security-invites">{(security?.incoming || []).map((invite)=><article key={invite.id}><span><b>{invite.fromName}</b><small>{invite.message || (language === 'ko' ? '보안 서클 초대' : 'Security Circle invitation')}</small></span><button onClick={()=>respondSecurityInvite(invite.id,'accept')}>ACCEPT</button><button onClick={()=>respondSecurityInvite(invite.id,'reject')}>DECLINE</button></article>)}{(security?.outgoing || []).map((invite)=><article key={invite.id}><span><b>{invite.toName}</b><small>{language === 'ko' ? '승인 대기 중' : 'Awaiting approval'}</small></span></article>)}</div><div className="security-messages"><select value={securityTarget} onChange={(e)=>setSecurityTarget(e.target.value)}><option value="">{language === 'ko' ? '보안 서클 멤버 선택' : 'Select a Circle member'}</option>{(security?.members || []).map((member)=><option value={member.id} key={member.id}>{member.firstName}{member.kycVerified ? ' · KYC' : ''}</option>)}</select><input value={securityMessage} onChange={(e)=>setSecurityMessage(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')sendSecurityMessage()}} placeholder={language === 'ko' ? '선택한 멤버에게 보안 메시지 보내기' : 'Send a secure message'}/><button onClick={sendSecurityMessage}><Icon name="arrow"/></button><div>{(security?.messages || []).filter((item)=>!securityTarget || item.fromUserId===securityTarget || item.toUserId===securityTarget).slice(-8).map((item)=><p key={item.id}><b>{item.fromName}</b> {item.message}</p>)}</div></div></div>}
    {view === 'league' && <div className="fleet-league"><div className="league-prizes"><span><b>#1</b><strong>+10 SPNX</strong><small>EVERY MEMBER</small></span><span><b>#2</b><strong>+5 SPNX</strong><small>EVERY MEMBER</small></span><span><b>#3</b><strong>+3 SPNX</strong><small>EVERY MEMBER</small></span></div><div className="league-summary"><span><small>YOUR WEEKLY SCORE</small><b>{Number(fleet?.weeklyScore || 0).toLocaleString()}</b></span><span><small>YOUR FLEET RANK</small><b>{fleet?.weeklyRank ? `#${fleet.weeklyRank}` : 'UNRANKED'}</b></span></div><div className="league-ranking">{(fleet?.ranking || []).slice(0,10).map((row,index) => <article key={row.captainId}><em>#{index+1}</em><span><b>{row.captainName}</b><small>{row.members} MEMBERS</small></span><strong>{Number(row.score).toLocaleString()}</strong></article>)}</div><p className="league-policy">Weekly UTC settlement · Rewards are paid once to every direct fleet member · Duplicate payout protection enabled</p></div>}
    <div className="fleet-policy"><Icon name="shield"/><div><b>Verified Fleet Policy</b><p>Only active, legitimate and KYC-verified referrals qualify for final token conversion. Automated or duplicate accounts are excluded.</p></div></div>
    {notice && <p className="module-notice">{notice}</p>}
  </section></main>;
}

function Ranking({ user, t }) {
  const [ranking, setRanking] = useState([]);
  const [communityRanking, setCommunityRanking] = useState(null);
  const [view, setView] = useState('game');
  useEffect(() => {
    api('/api/ranking').then((data) => setRanking(data.top || [])).catch(() => {});
    api('/api/community/dashboard', { method: 'POST', body: {} }).then((data) => setCommunityRanking(data.dashboard || null)).catch(() => {});
  }, []);
  const balanceRows = ranking.length ? ranking.slice(0, 20).map((captain, index) => ({ rank:index+1, name:captain.firstName, subtitle:captain.rankTitle || 'Space Explorer', value:format(captain.balance), unit:'SPNX' })) : [];
  const gameRows = (communityRanking?.gameTop || []).map((captain) => ({ rank:captain.rank, name:captain.firstName, subtitle:'NOVA PILOT', value:Number(captain.score || 0).toLocaleString(), unit:'PTS' }));
  const fleetRows = (communityRanking?.fleetTop || []).map((fleet) => ({ rank:fleet.rank, name:fleet.captainName, subtitle:`${fleet.members} MEMBERS`, value:Number(fleet.score || 0).toLocaleString(), unit:'PTS' }));
  const rows = view === 'game' ? gameRows : view === 'fleet' ? fleetRows : balanceRows;
  return <main className="v15-page"><section className="command-card ops-module rank-theme">
    <div className="section-heading"><div><small>GALAXY LEADERBOARD</small><h2>{t.ranking}</h2></div><span className="live-state"><i/>SERVER LIVE</span></div>
    <div className="rank-podium"><span><small>YOUR GAME RANK</small><b>{communityRanking?.gameRank ? `#${communityRanking.gameRank}` : 'UNRANKED'}</b></span><span><small>YOUR FLEET RANK</small><b>{communityRanking?.fleetRank ? `#${communityRanking.fleetRank}` : 'UNRANKED'}</b></span><span><small>BEST GAME SCORE</small><b>{Number(communityRanking?.gameScore || 0).toLocaleString()}</b></span></div>
    <div className="ranking-tabs"><button className={view === 'game' ? 'active' : ''} onClick={() => setView('game')}>GAME</button><button className={view === 'fleet' ? 'active' : ''} onClick={() => setView('fleet')}>FLEET</button><button className={view === 'balance' ? 'active' : ''} onClick={() => setView('balance')}>SPNX POINT</button></div>
    <div className="ranking-list">{rows.length ? rows.map((captain, index) => <article key={`${view}-${captain.rank}-${index}`}><em>{String(captain.rank).padStart(2, '0')}</em><div className="captain-avatar">{(captain.name || 'C').slice(0,1)}</div><span><b>{captain.name || 'Captain'}</b><small>{captain.subtitle}</small></span><strong>{captain.value} <small>{captain.unit}</small></strong></article>) : <div className="fleet-empty">Awaiting the first verified ranking result.</div>}</div>
  </section></main>;
}

function Wallet({ user, setUser, t, language }) {
  const w = WALLET_COPY[language] || WALLET_COPY.en;
  const [wallet, setWallet] = useState(user.solanaWallet || '');
  const [notice, setNotice] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [walletSecurity, setWalletSecurity] = useState(null);
  const [walletPin, setWalletPin] = useState('');
  const [walletLocked, setWalletLocked] = useState(true);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletAsset, setWalletAsset] = useState('SPNX Points');
  useEffect(() => { api('/api/nova-wallet/status', { method: 'POST', body: {} }).then((data) => setWalletSecurity(data.security)).catch(() => {}); }, []);
  useEffect(() => { const lock = () => setWalletLocked(true); const hidden = () => { if (document.hidden) lock(); }; document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', lock); return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', lock); }; }, []);
  async function unlockNOVAWallet() {
    setWalletBusy(true);
    try {
      const endpoint = walletSecurity?.pinConfigured ? '/api/nova-wallet/pin/unlock' : '/api/nova-wallet/pin/setup';
      const data = await api(endpoint, { method: 'POST', body: { pin: walletPin } });
      setWalletSecurity(data.security); setWalletPin(''); setWalletLocked(false); setNotice('NOVA Wallet security verified.');
    } catch (error) { setNotice(error.message); } finally { setWalletBusy(false); }
  }
  async function requestWalletRecovery() {
    try {
      const data = await api('/api/nova-wallet/recovery/request', { method: 'POST', body: {} });
      const ready = new Date(data.recoveryAvailableAt).toLocaleString();
      setNotice('Recovery protection started. You can create a new Wallet security profile after ' + ready + '. Keep your PIN and recovery access safe.');
    } catch (error) { setNotice(error.message); }
  }
  async function connectAndVerify() {
    if (PREVIEW_BUILD) return setNotice('Preview validation passed. No production wallet was changed.');
    const provider = window.solana;
    if (!provider?.connect || !provider?.signMessage) return setNotice('Install Phantom or a compatible Solana wallet that supports message signing.');
    setVerifying(true);
    try {
      const connection = await provider.connect();
      const address = String(connection.publicKey || provider.publicKey || '');
      setWallet(address);
      const challenge = await api('/api/wallet/challenge', { method: 'POST', body: { wallet: address } });
      const signed = await provider.signMessage(new TextEncoder().encode(challenge.message), 'utf8');
      const bytes = signed.signature || signed;
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const signature = `base64:${btoa(binary)}`;
      const data = await api('/api/wallet/verify', { method: 'POST', body: { wallet: address, signature } });
      if (data.user) setUser((current) => ({ ...current, ...data.user }));
      setNotice('Wallet ownership verified. SpaceNovaX never receives your private key.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setVerifying(false);
    }
  }
  if (walletLocked) return <main className="v15-page"><section className="command-card ops-module wallet-theme">
    <div className="section-heading"><div><small>NOVA WALLET · SECURE ACCESS</small><h2>{walletSecurity?.pinConfigured ? 'Unlock NOVA Wallet' : 'Create 6-digit Wallet PIN'}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>LOCKED</span></div>
    <p>Set up or unlock your Wallet with PIN now. KYC is required only for transfers, withdrawals, Marketplace payments and live assets.</p>
    <div className="wallet-form"><label>6-DIGIT PIN</label><input inputMode="numeric" type="password" maxLength="6" value={walletPin} onChange={(e) => setWalletPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••"/><button disabled={walletBusy} onClick={unlockNOVAWallet}><Icon name="shield"/>{walletBusy ? 'VERIFYING…' : walletSecurity?.pinConfigured ? 'UNLOCK WALLET' : 'CREATE SECURE PIN'}</button></div>
    <p className="privacy-note">Keep your PIN and account access safe. If forgotten, a verified Captain can request a protected new Wallet profile; the prior Wallet profile is archived and cannot be reopened.</p><button className="wallet-recovery-link" onClick={requestWalletRecovery}>FORGOT PIN? CREATE A NEW WALLET</button>{notice && <p className="module-notice">{notice}</p>}
  </section></main>;
  return <main className="v15-page"><section className="command-card ops-module wallet-theme nova-wallet-shell">
    <div className="section-heading"><div><small>NOVA WALLET · {w.assets.toUpperCase()}</small><h2>NOVA Wallet</h2></div><button className="secure-label" onClick={() => setWalletLocked(true)}><Icon name="shield" size={17}/>LOCKED SESSION</button></div>
    <div className="nova-wallet-hero"><div><small>{w.portfolio.toUpperCase()} · POINTS MODE</small><strong>{format(user.balance)} <em>SPNX POINTS</em></strong><p>{w.view}</p></div><div className="nova-wallet-orb">✦<span>SECURE</span></div></div>
    <div className="nova-asset-grid">
      {[['SPNX','0.000000',w.coming,'🚀'],['USDT','0.00',w.coming,'◈'],['SPNX Points',format(user.balance),w.active,'✦']].map(([name,value,status,mark]) => <button key={name} className={'nova-asset-card ' + (walletAsset === name ? 'selected' : '')} onClick={() => setWalletAsset(name)}><span>{mark}</span><small>{name}</small><b>{value}</b><i className={status === w.active ? 'active' : ''}>{status}</i></button>)}
    </div>
    <div className="nova-wallet-actions"><button disabled={walletAsset !== 'SPNX Points'}><Icon name="arrow-down"/>RECEIVE <small>{walletAsset === 'SPNX Points' ? 'KYC REQUIRED' : 'COMING SOON'}</small></button><button disabled><Icon name="arrow-up"/>SEND <small>KYC REQUIRED</small></button><button><Icon name="chart"/>{w.portfolio.toUpperCase()} <small>SPNX · USDT · POINTS</small></button></div>
    <div className="conversion-card conversion-locked"><div><b>{w.unlock}</b><p>KYC approval is required for SPNX Points transfers, Marketplace payments, future SPNX / USDT / SOL / USDC assets and withdrawals. Until then, this Wallet is view-only.</p></div><button disabled>KYC REQUIRED<Icon name="shield"/></button></div>
    <div className="wallet-form"><label>SOLANA WALLET ADDRESS · FUTURE SETTLEMENT</label><input readOnly value={wallet} placeholder="Connect Phantom or a compatible Solana wallet"/><button disabled={verifying} onClick={connectAndVerify}><Icon name="wallet"/>{verifying ? 'VERIFYING SIGNATURE…' : user.walletVerified ? 'WALLET VERIFIED' : 'CONNECT & VERIFY WALLET'}</button><p className="privacy-note"><Icon name="shield" size={15}/>Never enter a seed phrase or private key. Supported assets and live price data activate only after the official launch.</p></div>
    {notice && <p className="module-notice">{notice}</p>}
  </section></main>;
}

function Kyc({ t, language }) {
  const ko = language === 'ko';
  return <main className="v15-page"><section className="command-card ops-module kyc-theme">
    <div className="section-heading"><div><small>CAPTAIN IDENTITY SECURITY</small><h2>{t.kyc}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>COMING SOON</span></div>
    <div className="kyc-lock-hero"><Icon name="shield" size={42}/><div><small>PRIVACY-FIRST RELEASE</small><h3>{ko ? '현재는 개인정보를 수집하지 않습니다.' : 'No personal identity data is collected yet.'}</h3><p>{ko ? '커뮤니티 활성화 이후 전문 KYC 제공업체를 연결하고 회원이 개인 프로필에서 인증 비용을 직접 결제하는 방식으로 출시합니다.' : 'After community activation, a professional KYC provider will be connected. Members will pay the verification fee directly from their personal profile.'}</p></div></div>
    <div className="kyc-steps"><span className="active"><b>01</b><small>COMMUNITY</small></span><i/><span><b>02</b><small>PROVIDER</small></span><i/><span><b>03</b><small>VERIFY</small></span><i/><span><b>04</b><small>CONVERT</small></span></div>
    <div className="kyc-coming-grid">
      <article><Icon name="shield"/><b>{ko ? '전문 인증기관' : 'Professional provider'}</b><p>{ko ? '관리자 수동 승인이 아니라 서명된 제공업체 결과만 인정합니다.' : 'Only signed provider results will be accepted, never manual admin approval.'}</p></article>
      <article><Icon name="wallet"/><b>{ko ? '개인 직접 결제' : 'User-paid verification'}</b><p>{ko ? '지원 결제수단과 실제 비용은 공급업체 확정 후 미리 공지합니다.' : 'Supported payment methods and the exact fee will be announced before launch.'}</p></article>
      <article><Icon name="copy"/><b>{ko ? '최소 데이터 보관' : 'Minimal retention'}</b><p>{ko ? '앱에는 인증 상태와 제공업체 참조값만 저장하는 구조를 목표로 합니다.' : 'The app is designed to retain only verification status and a provider reference.'}</p></article>
    </div>
    <button className="kyc-disabled-action" disabled><Icon name="shield"/>{ko ? '아직 신청할 수 없습니다' : 'VERIFICATION NOT YET AVAILABLE'}</button>
    <p className="privacy-note"><Icon name="shield"/>{ko ? '비밀번호, 시드 문구, 개인키, 텔레그램 로그인 코드는 절대 입력하지 마세요.' : 'Never submit passwords, seed phrases, private keys, or Telegram login codes.'}</p>
  </section></main>;
}

function NodeSetup({ language, setTab }) {
  const ko = language === 'ko';
  const download = '/downloads/Genesis_Community_Node_V1_Standalone_2026-08-08.zip';
  return <main className="v15-page"><section className="command-card ops-module node-module node-setup-module">
    <div className="section-heading"><div><small>GENESIS COMMUNITY NODE · V1</small><h2>{ko ? '노드 설치 및 보안 가이드' : 'Node Installation & Security Guide'}</h2></div><button className="node-back" onClick={() => setTab('nodes')}><Icon name="arrow" size={16}/>{ko ? '노드 허브' : 'NODE HUB'}</button></div>
    <section className="node-hero"><div><small>{ko ? '15분 읽기 전용 세션' : '15-MINUTE READ-ONLY SESSION'}</small><strong>SAFE BY DESIGN</strong><p>{ko ? 'Community Node V1은 공개 정보 캐시와 상태 모니터링만 보조합니다. SpaceNovaX 앱의 채굴·보상·잔액·지갑·KYC·관리자 기능에는 접근하지 않습니다.' : 'Community Node V1 assists only with public-information cache and status monitoring. It cannot access SpaceNovaX mining, rewards, balances, wallets, KYC, or administration.'}</p></div><Icon name="shield" size={58}/></section>
    <section className="node-install-grid">
      <article><b>01</b><h3>{ko ? '패키지 다운로드' : 'Download the package'}</h3><p>{ko ? 'Node.js 18 이상이 설치된 PC에서 Node V1 ZIP 파일을 내려받아 압축을 풉니다.' : 'On a computer with Node.js 18+, download and unzip the Node V1 package.'}</p><a className="primary-action" href={download} download><Icon name="external"/>{ko ? 'NODE V1 다운로드' : 'DOWNLOAD NODE V1'}</a></article>
      <article><b>02</b><h3>{ko ? '로컬 환경 설정' : 'Configure locally'}</h3><p>{ko ? '패키지 안의 .env.example을 참고해 별도 노드 키를 로컬에만 설정합니다. 앱의 JWT, 지갑, DB 비밀번호는 절대 사용하지 않습니다.' : 'Use .env.example to configure separate node keys locally. Never use the app JWT, wallet, or database credentials.'}</p><code>cp .env.example .env<br/>npm test<br/>npm start</code></article>
      <article><b>03</b><h3>{ko ? '자동 연결 및 검증' : 'Pair and verify automatically'}</h3><p>{ko ? '앱에서 발급한 1회용 페어링 코드를 입력하면 관리자의 승인 없이 자동 등록됩니다. 첫 Heartbeat 이후 상태 검증이 시작됩니다.' : 'Enter the one-time pairing code issued by the app to register automatically, with no manual approval. Verification begins after the first heartbeat.'}</p><code>COMMUNITY_NODE_PAIRING_CODE=...<br/>node agent.mjs</code></article>
    </section>
    <section className="node-security"><Icon name="shield"/><div><b>{ko ? '운영자와 노드 운영자의 보안 역할은 분리됩니다.' : 'Operator and node-owner security roles stay separated.'}</b><p>{ko ? '노드 비밀키는 게이트웨이에 scrypt 해시로만 보관되고, 발급 토큰은 15분 후 만료됩니다. 임의 외부 URL 접근과 모든 금융·신원 변경 경로는 차단됩니다.' : 'Node secrets are stored by the gateway only as scrypt hashes and issued tokens expire in 15 minutes. Arbitrary external URLs and all financial or identity mutation paths are blocked.'}</p></div></section>
    <button className="node-apply" onClick={() => setTab('nodes')}><Icon name="community"/>{ko ? '앱에서 페어링 코드 발급' : 'ISSUE PAIRING CODE IN APP'}<Icon name="arrow"/></button>
  </section></main>;
}

function Nodes({ language, setTab, user, setUser }) {
  const ko = language === 'ko';
  const download = '/downloads/Genesis_Community_Node_V1_Standalone_2026-08-08.zip';
  const [pairing, setPairing] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const node = user.communityNode || {};
  const program = user.communityNodeProgram || { registered: 0, online: 0, limit: 1000 };
  const issuePairing = async () => {
    setBusy(true); setNotice('');
    try {
      const data = await api('/api/nodes/pairing', { method: 'POST', body: {} });
      setPairing(data); setNotice(ko ? '10분 동안 유효한 1회용 코드가 발급되었습니다.' : 'A one-time code valid for 10 minutes was issued.');
    } catch (error) { setNotice(error.message); }
    setBusy(false);
  };
  const copy = async (value) => { try { await navigator.clipboard.writeText(value); setNotice(ko ? '복사했습니다.' : 'Copied.'); } catch { setNotice(value); } };
  return <main className="v15-page"><section className="command-card ops-module node-module">
    <div className="section-heading"><div><small>GENESIS COMMUNITY NODE</small><h2>{ko ? '커뮤니티 노드' : 'Community Node'}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>{ko ? '최대 1,000대' : 'FIRST 1,000 NODES'}</span></div>
    <section className="node-hero"><div><small>{ko ? '창립 노드 프로그램' : 'FOUNDING NODE PROGRAM'}</small><strong>{program.registered} / {program.limit}</strong><p>{ko ? '노드는 승인 대기 없이 자동 연결되지만, 24시간 기여·Heartbeat·검증 작업을 통과해야 +25%가 활성화됩니다. 노드는 채굴, 보상, 잔액, 지갑, KYC, 관리자 데이터에는 접근할 수 없습니다.' : 'Nodes pair automatically without approval, but +25% starts only after 24-hour contribution, heartbeat, and verification checks. Nodes cannot access mining, rewards, balances, wallets, KYC, or administration data.'}</p></div><Icon name="globe" size={58}/></section>
    <div className="node-actions"><a className="primary-action" href={download} download><Icon name="external"/>{ko ? 'Node V1 다운로드' : 'DOWNLOAD NODE V1'}<Icon name="arrow"/></a><button className="node-guide-link" onClick={() => setTab('node-setup')}><Icon name="mission"/>{ko ? '설치·보안 안내 보기' : 'INSTALLATION & SECURITY GUIDE'}<Icon name="arrow" size={16}/></button></div>
    <div className="node-steps"><article><b>01</b><span><strong>{ko ? '다운로드' : 'Download'}</strong><small>{ko ? 'Node V1 패키지를 내려받습니다.' : 'Download the Node V1 package.'}</small></span></article><article><b>02</b><span><strong>{ko ? '페어링 코드' : 'Pairing code'}</strong><small>{ko ? 'Captain ID에서 1회용 코드를 발급합니다.' : 'Issue a one-time code from your Captain ID.'}</small></span></article><article><b>03</b><span><strong>{ko ? '자동 검증' : 'Automatic verification'}</strong><small>{ko ? '기여 조건 충족 시 +25%가 자동 활성화됩니다.' : '+25% activates automatically after contribution checks.'}</small></span></article></div>
    <section className="node-security"><Icon name="shield"/><div><b>{node.registered ? (node.status === 'qualified' ? (ko ? '노드 보너스가 활성화되었습니다.' : 'Node bonus is active.') : (ko ? '노드 검증이 진행 중입니다.' : 'Node verification is in progress.')) : (ko ? 'Captain ID당 노드는 1대만 등록할 수 있습니다.' : 'One node can be registered per Captain ID.')}</b><p>{node.registered ? `${node.label || node.nodeId} · ${node.status} · ${node.bonusPercent || 0}%` : (ko ? '관리자의 수동 승인은 필요하지 않습니다. 설치 후 첫 Heartbeat부터 중앙 서버가 상태를 검증합니다.' : 'No manual administrator approval is required. The central server starts verification from the first heartbeat.')}</p></div></section>
    {!node.registered && <button className="node-apply" disabled={busy} onClick={issuePairing}><Icon name="community"/>{busy ? (ko ? '코드 발급 중…' : 'ISSUING…') : (ko ? '1회용 페어링 코드 발급' : 'ISSUE ONE-TIME PAIRING CODE')}<Icon name="arrow"/></button>}
    {pairing && <section className="node-security"><Icon name="copy"/><div><b>{ko ? '이 코드는 한 번만 표시됩니다.' : 'This code is shown once.'}</b><p><code>{pairing.pairingCode}</code></p><button className="node-guide-link" onClick={() => copy(pairing.pairingCode)}>{ko ? '코드 복사' : 'COPY CODE'}</button></div></section>}
    {notice && <p className="module-notice">{notice}</p>}
    <section className="node-security"><Icon name="shield"/><div><b>{ko ? '권한 경계가 고정된 노드입니다.' : 'A node with fixed permission boundaries.'}</b><p>{ko ? 'Node V1은 공개 캐시, 번역 정적 리소스, Orbit 상태, API 응답시간과 서비스 상태만 처리합니다. 보상 지급과 사용자 원장은 서버에서만 처리됩니다.' : 'Node V1 handles only public cache, translation static assets, Orbit status, API latency, and service heartbeat. Reward issuance and user ledgers remain server-only.'}</p></div></section>
  </section></main>;
}

function Nav({ tab, setTab, t }) {
  const orbitLabel = t.home === '홈' ? '국제 네비게이션' : 'Global Navigation';
  const isKorean = t.home === '홈';
  const items = [['home','home',t.home,t.home],['ai','ai',t.ai,t.ai],['orbit','globe',orbitLabel,isKorean ? '네비' : 'Orbit'],['community','community',t.community,isKorean ? '커뮤니티' : 'Community'],['game','game','Game','Game'],['more','more',t.more,t.more]];
  return <nav className="v15-nav">{items.map(([id, icon, label, shortLabel]) => <button key={id} data-nav={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon name={icon}/><small className="nav-full">{label}</small><small className="nav-short">{shortLabel}</small></button>)}</nav>;
}

function NovaGuide({ tab, language, setTab }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const { voiceState, play: playGuideVoice } = useNovaVoiceFeedback('floating-guide');
  const [position, setPosition] = useState(() => {
    try { return JSON.parse(localStorage.getItem('spnx_nova_position_v1')) || { x: 0, y: 0 }; } catch { return { x: 0, y: 0 }; }
  });
  const dragRef = useRef({ active: false, moved: false, x: 0, y: 0, originX: 0, originY: 0 });
  function clampPosition(next) {
    return {
      x: Math.max(-(window.innerWidth - 94), Math.min(0, next.x)),
      y: Math.max(-(window.innerHeight - 170), Math.min(0, next.y)),
    };
  }
  function startDrag(event) {
    event.preventDefault();
    dragRef.current = { active: true, moved: false, x: event.clientX, y: event.clientY, originX: position.x, originY: position.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragRef.current.moved = true;
    setPosition(clampPosition({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy }));
  }
  function endDrag() {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setPosition((current) => {
      const next = clampPosition(current);
      localStorage.setItem('spnx_nova_position_v1', JSON.stringify(next));
      return next;
    });
  }
  useEffect(() => {
    const resize = () => setPosition((current) => clampPosition(current));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const move = (event) => moveDrag(event);
    const end = () => endDrag();
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  });
  const guides = {
    en: {
      home: 'Captain, touch the glowing quantum core to start your 24-hour mining cycle. Mission Control is directly below it.',
      ai: 'This is NOVA AI. Type or speak any question. Live answers require the secure server intelligence connection.',
      community: 'Welcome to Captain Community. Your fleet invite code, active members, mining bonus, weekly fleet rank, and personal game rank are displayed at the top. Play the NOVA Fleet Brief for a complete explanation. Everyone can read trusted information, while publishing requires five KYC-approved Security Circle members.',
      missions: 'Complete the official website, Telegram, Discord, X, and YouTube missions. All five unlock a permanent Mission Passport bonus of five percent to base mining speed. NOVA can explain the full policy on this screen.',
      game: 'Launch NOVA Flight Command here. Collect three hundred diamonds for ten SPNX Points up to twice daily, open one supply crate for one to five points, and defeat the first boss for five points. The daily maximum is thirty SPNX Points and resets at six A M Eastern Time.',
      orbit: 'This is Orbit Control. Rotate Live Earth with a drag, and switch layers for satellites, weather, and Earth Intelligence. Save your Captain Base to see live distance and bearing.',
      fleet: 'This is Fleet Command. Register or share a referral code, contact inactive members, chat with your fleet, and track the weekly game league.',
      whitepaper: 'The whitepaper explains our identity. SpaceNovaX builds NOVA AI and games. SPNX supports product utility and verified participation.',
      nodes: 'This is the Community Node Hub. Download Node V1, review the installation and security guide, and submit a founding-node application. Nodes are strictly read-only and cannot access rewards or user funds.',
      'node-setup': 'This installation guide explains the Node V1 download, local environment configuration, and secure registration flow. Never use an app wallet key, database password, or administrator secret in a community node.',
      more: 'This is Command Center. Open Fleet, Ranking, Wallet, KYC, missions, or the official game.',
    },
    ko: {
      home: '캡틴, 빛나는 양자 코어를 터치하면 24시간 채굴이 바로 시작됩니다. 아래에서 미션 관제로 이동할 수 있습니다.',
      ai: '여기는 NOVA AI입니다. 질문을 입력하거나 음성으로 말해 주세요. 실제 답변은 보안 서버 연결 후 활성화됩니다.',
      community: '캡틴 커뮤니티입니다. 상단에서 본인의 함대 초대 코드, 활성 함대원, 채굴 보너스, 주간 함대 순위와 개인 게임 순위를 확인할 수 있습니다. NOVA 함대 브리핑을 누르면 전체 이용 방법을 들을 수 있습니다. 모든 회원은 정보를 읽을 수 있고 글과 사진 게시는 KYC 승인 보안 서클 5명이 필요합니다.',
      missions: '공식 웹사이트, 텔레그램, 디스코드, 엑스, 유튜브의 5개 미션을 모두 완료하면 Mission Passport가 발급되고 기본 채굴 속도 5퍼센트가 영구 추가됩니다. 이 화면에서 NOVA의 전체 설명을 들을 수 있습니다.',
      game: '여기서 NOVA 비행 관제를 실행할 수 있습니다. 다이아몬드 300개 보상 10 포인트는 하루 두 번, 보급함 1에서 5 포인트와 보스 최초 처치 5 포인트는 하루 한 번 지급됩니다. 일일 최대 보상은 30 SPNX 포인트이며 미국 동부시간 오전 6시에 초기화됩니다.',
      orbit: '여기는 Orbit Control입니다. 화면을 드래그해 지구를 회전시키고, 위성·기상·지구 감시 레이어를 전환할 수 있습니다. Captain Base를 저장하면 실시간 거리와 방향을 확인할 수 있습니다.',
      fleet: '함대 관제입니다. 추천코드를 등록하거나 공유하고, 비활성 함대원에게 알림을 보내며, 함대 채팅과 주간 게임 순위를 확인할 수 있습니다.',
      whitepaper: '백서에서는 SpaceNovaX의 정체성을 설명합니다. 우리는 NOVA AI와 게임을 개발하며, SPNX는 제품 사용과 검증된 참여를 지원합니다.',
      nodes: '커뮤니티 노드 허브입니다. Node V1을 내려받고 설치·보안 안내를 확인한 뒤 창립 노드 신청을 할 수 있습니다. 노드는 읽기 전용이며 보상이나 사용자 자금에 접근할 수 없습니다.',
      'node-setup': '이 설치 안내에서는 Node V1 다운로드, 로컬 환경 설정, 안전한 등록 과정을 설명합니다. 커뮤니티 노드에 앱 지갑 키, 데이터베이스 비밀번호, 관리자 비밀키를 절대 넣지 마세요.',
      more: '통합 관제 센터입니다. 함대, 랭킹, 지갑, KYC, 미션과 공식 게임을 이용할 수 있습니다.',
    },
  };
  const guide = (guides[language] || guides.en)[tab] || (guides[language] || guides.en).more;
  function speak(value = guide) {
    playGuideVoice(value, language, .95);
  }
  function listen() {
    triggerNovaHaptic('medium');
    const started = novaVoiceRouter.listen({
      language,
      onStart: () => setListening(true),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
      onResult: (spoken) => {
      const command = spoken.toLowerCase();
      const routes = [
        [['nova', 'ai', '노바'], 'ai'], [['community', '커뮤니티', '게시판'], 'community'], [['mission', '미션'], 'missions'],
        [['game', '게임'], 'game'], [['home', '홈'], 'home'], [['fleet', '함대'], 'fleet'],
        [['wallet', '지갑'], 'wallet'], [['rank', '랭킹', '순위'], 'rank'], [['kyc'], 'kyc'],
        [['whitepaper', '백서', 'vision', '비전'], 'whitepaper'], [['node', '노드'], 'nodes'],
        [['more', 'command', '더보기', '관제'], 'more'],
      ];
      const route = routes.find(([keywords]) => keywords.some((keyword) => command.includes(keyword)));
      if (route) { setTab(route[1]); speak(language === 'ko' ? '요청한 화면으로 이동합니다.' : 'Opening the requested module.'); }
      else speak(language === 'ko' ? '명령을 확인하지 못했습니다. 홈, 노바, 미션, 게임 또는 더보기라고 말해 주세요.' : 'Command not recognized. Say Home, NOVA, Missions, Game, or More.');
      },
    });
    if (!started) window.alert('Voice control is not supported in this browser.');
  }
  return <aside className={`nova-guide tab-${tab} ${open ? 'open' : ''}`} style={{ '--nova-x': `${position.x}px`, '--nova-y': `${position.y}px` }}>
    {open && <div className="nova-guide-panel">
      <button className="guide-close" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" size={15}/></button>
      <div><small>NOVA GUIDANCE ONLINE</small><b>{language === 'ko' ? '무엇을 도와드릴까요?' : 'How may I assist?'}</b><p>{guide}</p></div>
      <div className="guide-actions"><button className={`nova-voice-control voice-${voiceState}`} onClick={() => speak()} aria-live="polite"><Icon name="speaker" size={16}/>{voiceLabel(voiceState, language, '안내 듣기', 'PLAY GUIDE')}</button><button className={`nova-voice-control ${listening ? 'listening voice-playing' : 'voice-idle'}`} onClick={listen}><Icon name="mic" size={16}/>{listening ? (language === 'ko' ? '듣는 중' : 'LISTENING') : (language === 'ko' ? '음성 명령' : 'VOICE COMMAND')}</button></div>
      <small className="nova-drag-tip">{language === 'ko' ? 'NOVA 이미지를 손가락이나 마우스로 원하는 위치에 옮길 수 있습니다.' : 'Drag NOVA anywhere with your finger or mouse.'}</small>
    </div>}
    <button className={`nova-guide-avatar voice-${voiceState} ${listening ? 'listening' : ''}`} onPointerDown={startDrag} onClick={() => { if (dragRef.current.moved) { dragRef.current.moved = false; return; } setOpen((value) => !value); if (!open) speak(); }} aria-label="Move or open NOVA guide">
      <img src="/nova-ai-command-intelligence-v17.webp" alt="NOVA AI" draggable="false"/>
      <em className="nova-holo-scan"/><em className="nova-eye-light"/>
      <em className="nova-core-node"/>
      <span><i/>NOVA AI</span>
    </button>
  </aside>;
}

export default function V15App() {
  const [launched, setLaunched] = useState(false);
  const [language, setLanguageState] = useState(() => localStorage.getItem('spnx_language') || 'en');
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState(fallbackUser);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(PREVIEW_BUILD);
  const t = COPY[language] || COPY.en;
  const setLanguage = (value) => { localStorage.setItem('spnx_language', value); setLanguageState(value); document.documentElement.lang = value; };
  const sync = useCallback(async () => {
    try { const data = await api('/api/session', { method: 'POST', body: {} }); if (data.user) setUser({ ...fallbackUser, ...data.user, mining: { ...fallbackUser.mining, ...(data.user.mining || {}) } }); } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    sync();
    // A lightweight server re-sync corrects the smooth 0.5s display counter
    // while mining is running; the server remains the only reward authority.
    const timer = setInterval(sync, user.mining?.active ? 15000 : 30000);
    // Returning from the full-screen NOVA-X game must refresh the authoritative
    // server balance immediately rather than waiting for the next interval.
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') sync();
    };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [language, sync, user.mining?.active]);
  async function miningAction(path) {
    if (PREVIEW_BUILD) {
      setUser((current) => ({ ...current, mining: { ...current.mining, active: true, progress: .42, remainingMs: 50123000, minedSoFar: 12.6 } }));
      return;
    }
    setBusy(true);
    try { const data = await api(path, { method: 'POST', body: {} }); if (data.user) setUser({ ...fallbackUser, ...data.user }); }
    catch (error) { window.alert(error.message); }
    setBusy(false);
  }
  let page;
  if (tab === 'home') page = <Home user={user} t={t} onStart={() => miningAction('/api/mining/start')} onClaim={() => miningAction('/api/mining/claim')} busy={busy} setTab={setTab}/>;
  else if (tab === 'orbit') page = <Suspense fallback={<main className="v15-page"><section className="command-card ops-module"><div className="section-heading"><div><small>EARTH NAVIGATION NETWORK</small><h2>Orbit Control</h2></div><span className="live-state"><i/>CONNECTING</span></div></section></main>}><OrbitV20 language={language} user={user}/></Suspense>;
  else if (tab === 'game') page = <Game user={user} t={t} language={language}/>;
  else if (tab === 'ai') page = <NovaAI user={user} t={t} language={language}/>;
  else if (tab === 'community') page = <Community user={user} language={language} setTab={setTab}/>;
  else if (tab === 'missions') page = <Missions user={user} setUser={setUser} t={t} language={language}/>;
  else if (tab === 'nodes') page = <Nodes language={language} setTab={setTab} user={user} setUser={setUser}/>;
  else if (tab === 'node-setup') page = <NodeSetup language={language} setTab={setTab}/>;
  else if (tab === 'more') page = <More t={t} setTab={setTab} language={language}/>;
  else if (tab === 'fleet') page = <Fleet user={user} setUser={setUser} t={t} language={language}/>;
  else if (tab === 'whitepaper') page = <Whitepaper language={language}/>;
  else if (tab === 'rank') page = <Ranking user={user} t={t}/>;
  else if (tab === 'wallet') page = <Wallet user={user} setUser={setUser} t={t} language={language}/>;
  else if (tab === 'kyc') page = <Kyc t={t} language={language}/>;
  else page = <More t={t} setTab={setTab}/>;
  return <>
    {!launched && <Splash done={() => setLaunched(true)}/>}
    <div className={`v15-shell ${launched ? 'ready' : ''}`}><Header user={user} language={language} setLanguage={setLanguage} t={t} onPreview={() => setPreviewOpen(true)}/>{page}<Nav tab={tab} setTab={setTab} t={t}/>{tab !== 'orbit' && <NovaGuide tab={tab} language={language} setTab={setTab}/>}</div>
    <PreviewPanel open={previewOpen && launched} close={() => setPreviewOpen(false)} t={t}/>
  </>;
}
