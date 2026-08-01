import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/v15.css';
import OrbitV20 from './orbit/OrbitV20/OrbitV20.jsx';

const GAME_URL = 'https://game.spacenovax.com';
const PREVIEW_BUILD = import.meta.env.VITE_PREVIEW_BUILD === 'true' || new URLSearchParams(window.location.search).get('preview') === '1';
const LANGUAGES = [
  ['en', 'English'], ['ko', '한국어'], ['ja', '日本語'], ['zh', '中文'],
  ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch'], ['fr', 'Français'],
  ['ru', 'Русский'], ['vi', 'Tiếng Việt'], ['id', 'Bahasa Indonesia'],
];

const COPY = {
  en: {
    tagline: 'Explore. Mine. Evolve.', rank: 'Rookie', balance: 'Total balance',
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
    tagline: '탐험하고, 채굴하고, 진화하세요.', rank: '루키', balance: '총 보유 포인트',
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

function getClientId() {
  const key = 'spnx_client_id_v1';
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID?.() || `spnx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

export async function api(path, options = {}) {
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

export function triggerNovaHaptic(style = 'light') {
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
  let audioUrl;
  try {
    novaAudioSource?.stop();
    novaAudioSource = undefined;
    const response = await fetch('/api/nova/speech', {
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
}

export function speakNova(value, language = 'en', rate = .95, source = 'nova-global') {
  const text = String(value || '').trim();
  if (!text) return false;

  const requestedLanguage