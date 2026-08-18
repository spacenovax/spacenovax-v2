import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/v15.css';
import './styles/node-status.css';
import { NovaAIRouter } from './nova/index.js';
import { WALLET_UI_COPY } from './i18n/wallet.js';
import { buildReferralInvitation, copyReferralText, shareReferralInvitation } from './referralInvite.js';

const OrbitV20 = lazy(() => import('./orbit/OrbitV20/OrbitV20.jsx'));

// Direct game loading prevents Telegram Android WebView from rendering the old
// two-level cross-origin iframe chain as a blank/black game screen.
const GAME_URL = import.meta.env.VITE_GAME_URL || 'https://nova-x1-genesis-defense.kit372002.chatgpt.site';
const OFFICIAL_TELEGRAM_BOT_URL = 'https://t.me/SpaceNovaXAdminBot';
const PREVIEW_BUILD = import.meta.env.VITE_PREVIEW_BUILD === 'true' || new URLSearchParams(window.location.search).get('preview') === '1';
const LANGUAGES = [
  ['en', 'English'], ['ko', '한국어'], ['ja', '日本語'], ['zh', '中文'],
  ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch'], ['fr', 'Français'],
  ['ru', 'Русский'], ['vi', 'Tiếng Việt'], ['id', 'Bahasa Indonesia'], ['ar', 'العربية'],
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
    security: 'Security', wallet: 'NOVA Wallet', kyc: 'KYC', ranking: 'Ranking',
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
    security: '보안', wallet: 'NOVA Wallet', kyc: 'KYC', ranking: '랭킹',
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

const FLEET_LEAGUE_COPY = {
  en:{everyMember:'EVERY MEMBER',weeklyScore:'YOUR WEEKLY SCORE',fleetRank:'YOUR FLEET RANK',unranked:'UNRANKED',members:'MEMBERS',settlement:'Weekly UTC settlement · Rewards are paid once to every direct fleet member · Duplicate payout protection enabled',policyTitle:'Verified Fleet Policy',policyBody:'Only active, legitimate and KYC-verified referrals qualify for final token conversion. Automated or duplicate accounts are excluded.'},
  ko:{everyMember:'모든 회원',weeklyScore:'나의 주간 점수',fleetRank:'나의 함대 순위',unranked:'순위 없음',members:'회원',settlement:'매주 UTC 기준 정산 · 모든 직속 함대원에게 1회 보상 지급 · 중복 지급 방지 적용',policyTitle:'검증된 함대 정책',policyBody:'활성 상태이며 정상적으로 참여하고 KYC 인증을 완료한 추천인만 최종 토큰 전환에 인정됩니다. 자동화 계정과 중복 계정은 제외됩니다.'},
  ja:{everyMember:'全メンバー',weeklyScore:'週間スコア',fleetRank:'艦隊順位',unranked:'ランク外',members:'メンバー',settlement:'毎週UTC基準で精算 · 直属艦隊メンバー全員に1回のみ報酬 · 重複支払い防止を適用',policyTitle:'認証済み艦隊ポリシー',policyBody:'アクティブで正当かつKYC認証済みの紹介者のみ、最終トークン変換の対象です。自動化・重複アカウントは除外されます。'},
  zh:{everyMember:'每位成员',weeklyScore:'本周得分',fleetRank:'舰队排名',unranked:'未排名',members:'成员',settlement:'每周按UTC结算 · 每位直属舰队成员仅获一次奖励 · 已启用重复支付保护',policyTitle:'已验证舰队政策',policyBody:'只有活跃、真实且已通过KYC的推荐用户才计入最终代币转换。自动化或重复账户将被排除。'},
  es:{everyMember:'CADA MIEMBRO',weeklyScore:'PUNTUACIÓN SEMANAL',fleetRank:'RANGO DE FLOTA',unranked:'SIN RANGO',members:'MIEMBROS',settlement:'Liquidación semanal UTC · Un pago por miembro directo de la flota · Protección contra pagos duplicados',policyTitle:'Política de flota verificada',policyBody:'Solo los referidos activos, legítimos y verificados por KYC califican para la conversión final. Se excluyen cuentas automatizadas o duplicadas.'},
  pt:{everyMember:'CADA MEMBRO',weeklyScore:'PONTUAÇÃO SEMANAL',fleetRank:'RANK DA FROTA',unranked:'SEM RANK',members:'MEMBROS',settlement:'Liquidação semanal em UTC · Um pagamento por membro direto da frota · Proteção contra pagamentos duplicados',policyTitle:'Política de Frota Verificada',policyBody:'Somente indicados ativos, legítimos e verificados por KYC entram na conversão final. Contas automatizadas ou duplicadas são excluídas.'},
  de:{everyMember:'JEDES MITGLIED',weeklyScore:'WOCHENPUNKTZAHL',fleetRank:'FLOTTENRANG',unranked:'OHNE RANG',members:'MITGLIEDER',settlement:'Wöchentliche UTC-Abrechnung · Einmalige Belohnung je direktem Flottenmitglied · Schutz vor Doppelzahlungen aktiv',policyTitle:'Verifizierte Flottenrichtlinie',policyBody:'Nur aktive, legitime und KYC-verifizierte Empfehlungen zählen für die endgültige Token-Umwandlung. Automatisierte oder doppelte Konten sind ausgeschlossen.'},
  fr:{everyMember:'CHAQUE MEMBRE',weeklyScore:'SCORE HEBDOMADAIRE',fleetRank:'RANG DE FLOTTE',unranked:'NON CLASSÉ',members:'MEMBRES',settlement:'Règlement hebdomadaire UTC · Une récompense par membre direct · Protection contre les doubles paiements',policyTitle:'Politique de flotte vérifiée',policyBody:'Seuls les filleuls actifs, légitimes et vérifiés KYC sont admis à la conversion finale. Les comptes automatisés ou en double sont exclus.'},
  ru:{everyMember:'КАЖДОМУ УЧАСТНИКУ',weeklyScore:'НЕДЕЛЬНЫЕ ОЧКИ',fleetRank:'РАНГ ФЛОТА',unranked:'БЕЗ РАНГА',members:'УЧАСТНИКОВ',settlement:'Еженедельный расчёт по UTC · Одна выплата каждому прямому участнику флота · Защита от дублей включена',policyTitle:'Политика проверенного флота',policyBody:'В итоговой конвертации учитываются только активные, реальные и прошедшие KYC рефералы. Автоматические и дублирующие аккаунты исключаются.'},
  vi:{everyMember:'MỖI THÀNH VIÊN',weeklyScore:'ĐIỂM HÀNG TUẦN',fleetRank:'HẠNG HẠM ĐỘI',unranked:'CHƯA XẾP HẠNG',members:'THÀNH VIÊN',settlement:'Đối soát hàng tuần theo UTC · Mỗi thành viên trực tiếp nhận thưởng một lần · Đã bật chống trả thưởng trùng',policyTitle:'Chính sách Hạm đội đã xác minh',policyBody:'Chỉ người giới thiệu đang hoạt động, hợp lệ và đã xác minh KYC mới đủ điều kiện chuyển đổi cuối cùng. Tài khoản tự động hoặc trùng lặp bị loại.'},
  id:{everyMember:'SETIAP ANGGOTA',weeklyScore:'SKOR MINGGUAN',fleetRank:'PERINGKAT ARMADA',unranked:'BELUM BERPERINGKAT',members:'ANGGOTA',settlement:'Penyelesaian mingguan UTC · Satu hadiah untuk setiap anggota armada langsung · Perlindungan pembayaran ganda aktif',policyTitle:'Kebijakan Armada Terverifikasi',policyBody:'Hanya referral aktif, sah, dan terverifikasi KYC yang memenuhi syarat konversi akhir. Akun otomatis atau duplikat dikecualikan.'},
  ar:{everyMember:'كل عضو',weeklyScore:'نقاطك الأسبوعية',fleetRank:'رتبة الأسطول',unranked:'غير مصنف',members:'أعضاء',settlement:'تسوية أسبوعية بتوقيت UTC · مكافأة واحدة لكل عضو مباشر في الأسطول · حماية من تكرار الدفع مفعلة',policyTitle:'سياسة الأسطول الموثق',policyBody:'لا يتأهل للتحويل النهائي إلا المحالون النشطون والشرعيون والموثقون عبر KYC. تُستبعد الحسابات الآلية أو المكررة.'},
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

const REFERRAL_TICKET_KEY = 'spnx_referral_ticket';

function getReferralTicket() {
  try {
    const url = new URL(window.location.href);
    const incoming = url.searchParams.get('rt') || '';
    if (incoming) {
      window.sessionStorage.setItem(REFERRAL_TICKET_KEY, incoming);
      url.searchParams.delete('rt');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      return incoming;
    }
    return window.sessionStorage.getItem(REFERRAL_TICKET_KEY) || '';
  } catch {
    return '';
  }
}

async function api(path, options = {}) {
  const initData = window.Telegram?.WebApp?.initData || '';
  const referralTicket = getReferralTicket();
  let body = options.body;
  if (typeof body === 'object' && body !== null) body = JSON.stringify({ ...body, clientId: getClientId() });
  const response = await fetch(path, {
    ...options,
    body,
    headers: {
      'Content-Type': 'application/json',
      'X-SPNX-Client-ID': getClientId(),
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      ...(referralTicket ? { 'X-SPNX-Referral-Ticket': referralTicket } : {}),
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
  totalReferrals: 0, fleetBonus: 0, securityCircle: [], securityCircleCount: 0, securityCircleBonus: 0, missionBonus: 0, missionPassportComplete: false,
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

const VOICE_DELAY_COPY = {
  en: 'Voice guidance is delayed by Telegram’s in-app environment. Please try again shortly or use text guidance.',
  ko: '텔레그램 앱 내 환경 정책으로 음성 안내가 지연되고 있습니다. 잠시 후 다시 시도하거나 텍스트 안내를 이용해 주세요.',
  ja: 'Telegramアプリ内の環境により音声案内が遅れています。しばらくしてから再試行するか、テキスト案内をご利用ください。',
  zh: '受 Telegram 应用内环境影响，语音引导正在延迟。请稍后重试或使用文字引导。',
  es: 'La guía por voz se está retrasando por el entorno integrado de Telegram. Inténtalo de nuevo en breve o usa la guía de texto.',
  pt: 'A orientação por voz está atrasada devido ao ambiente integrado do Telegram. Tente novamente em instantes ou use a orientação por texto.',
  de: 'Die Sprachführung verzögert sich aufgrund der integrierten Telegram-Umgebung. Bitte versuchen Sie es in Kürze erneut oder nutzen Sie die Textführung.',
  fr: 'Le guidage vocal est retardé par l’environnement intégré de Telegram. Réessayez dans un instant ou utilisez le guidage textuel.',
  ru: 'Голосовая навигация задерживается из-за встроенной среды Telegram. Повторите попытку позже или используйте текстовую подсказку.',
  vi: 'Hướng dẫn bằng giọng nói đang bị chậm do môi trường tích hợp của Telegram. Vui lòng thử lại sau hoặc dùng hướng dẫn bằng văn bản.',
  id: 'Panduan suara terlambat karena lingkungan terintegrasi Telegram. Silakan coba lagi sebentar atau gunakan panduan teks.',
  ar: 'يتأخر الإرشاد الصوتي بسبب بيئة Telegram المدمجة. يُرجى المحاولة بعد قليل أو استخدام الإرشاد النصي.',
};

function NovaVoiceDelayNotice({ language }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let delayTimer;
    let dismissTimer;
    const show = () => {
      window.clearTimeout(delayTimer);
      window.clearTimeout(dismissTimer);
      setVisible(true);
      dismissTimer = window.setTimeout(() => setVisible(false), 9000);
    };
    const update = (event) => {
      const status = event.detail?.status;
      if (status === 'loading') {
        window.clearTimeout(delayTimer);
        delayTimer = window.setTimeout(show, 4500);
      } else if (status === 'error') {
        show();
      } else if (status === 'playing' || status === 'complete' || status === 'stopped') {
        window.clearTimeout(delayTimer);
      }
    };
    window.addEventListener('nova-voice-status', update);
    return () => {
      window.clearTimeout(delayTimer);
      window.clearTimeout(dismissTimer);
      window.removeEventListener('nova-voice-status', update);
    };
  }, []);
  if (!visible) return null;
  return <aside className="nova-voice-delay-notice" role="status" aria-live="polite"><Icon name="speaker" size={18}/><p>{VOICE_DELAY_COPY[language] || VOICE_DELAY_COPY.en}</p><button onClick={() => setVisible(false)} aria-label="Close voice notice"><Icon name="close" size={15}/></button></aside>;
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
  const [launching, setLaunching] = useState(false);
  useEffect(() => {
    // Start only after the first paint: Android WebView otherwise skips the
    // beginning of a CSS animation and shows only its final static frame.
    const start = setTimeout(() => setLaunching(true), 180);
    const a = setTimeout(() => setExit(true), 3200);
    const b = setTimeout(done, 3550);
    return () => { clearTimeout(start); clearTimeout(a); clearTimeout(b); };
  }, [done]);
  return <div className={`v15-splash ${launching ? 'launching' : ''} ${exit ? 'exit' : ''}`}>
    <div className="splash-nebula" /><div className="splash-stars-v15" />
    <div key={launching ? 'symbol-arrival' : 'symbol-ready'} className="v15-mark"><img src="/brand/spacenovax-symbol.jpg" alt="SpaceNovaX" /></div>
    <div className="v15-splash-copy"><small>NOVA NETWORK PRESENTS</small><h1>SPACENOVA<span>X</span></h1><p>EXPLORE · MINE · EVOLVE</p></div>
    <div className="boot-line"><i /><span>NOVA CORE INITIALIZING</span></div>
  </div>;
}

function Header({ user, language, setLanguage, t, onPreview, onMessages, onAnnouncements }) {
  const [open, setOpen] = useState(false);
  const unreadMessages = Number(user.unreadMessageCount || 0);
  return <header className="v15-header">
    <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <img src="/brand/spacenovax-symbol.jpg" alt="" /><span><b>SpaceNovaX</b><small>{t.tagline}</small></span>
    </button>
    <div className="header-actions">
      {PREVIEW_BUILD && <button className="preview-chip" onClick={onPreview}>{t.preview}</button>}
      <button className="announcement-bell comms-control" onClick={onAnnouncements} aria-label="Global announcements" title={language === 'ko' ? '전체 공지' : 'Global announcements'}><span className="comms-symbol broadcast-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 17h4l10 6V9l-10 6H7v2Z"/><path d="M11 17v7h4l1-4M24 11c2.6 2.8 2.6 7.2 0 10M27 8c4.4 4.6 4.4 11.4 0 16"/></svg></span>{Number(user.unreadAnnouncementCount || 0) > 0 && <b className="comms-count notice-count">{Math.min(99, Number(user.unreadAnnouncementCount || 0))}</b>}</button>
      <button className="message-bell comms-control" onClick={onMessages} aria-label="Personal messages" title={language === 'ko' ? '개인 쪽지' : 'Personal messages'}><span className="comms-symbol message-symbol"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 8h20v14H14l-6 5v-5H6V8Z"/><path d="m10 12 6 5 6-5"/>{unreadMessages > 0 && <circle cx="24.5" cy="7.5" r="3.2" className="signal-core"/>}</svg></span>{unreadMessages > 0 && <b className="comms-count message-count">{Math.min(99, unreadMessages)}</b>}</button>
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

function MiningCore({ user, t, onStart, onClaim, onOpenGlobalChat, onOpenFleet, busy, detailed = false }) {
  const [speedOpen, setSpeedOpen] = useState(false);
  const m = user.mining || fallbackUser.mining;
  const pct = Math.max(0, Math.min(100, Math.round(Number(m.progress || 0) * 100)));
  const claimable = Boolean(m.claimable);
  const active = Boolean(m.active);
  const ko = document.documentElement.lang === 'ko';
  const baseSpeed = Number(m.baseSpeedPerHour || (m.baseReward || 30) / 24);
  const fleetBonus = Number(m.fleetBonus || user.fleetBonus || 0);
  const activeReferrals = Math.max(0, Number(m.activeFleet ?? user.activeFleet ?? 0));
  const totalReferrals = Math.max(activeReferrals, Number(m.totalReferrals ?? user.totalReferrals ?? user.referrals?.length ?? 0));
  const securityBonus = Number(m.securityBonus || user.securityCircleBonus || 0);
  const missionBonus = Number(m.missionBonus || user.missionBonus || 0);
  const nodeBonus = m.nodeOnline ? Number(m.nodeBonus || 0) : 0;
  const eventMultiplier = Number(m.eventMultiplier || 1);
  const subtotalSpeed = baseSpeed * (1 + (fleetBonus + securityBonus + missionBonus) / 100) * eventMultiplier;
  const currentSpeed = Number(m.speedPerHour || subtotalSpeed * (1 + nodeBonus / 100));
  const reductionSteps = Number(m.reductionSteps || 0);
  const reductionMultiplier = Number.isFinite(Number(m.reductionMultiplier)) ? Number(m.reductionMultiplier) : 1;
  const effectiveReductionPercent = Math.max(0, (1 - reductionMultiplier) * 100);
  const baseBeforeReduction = Number(m.baseBeforeReductionPerHour || baseSpeed / Math.max(reductionMultiplier, .000001));
  const grossSpeedBeforeReduction = baseBeforeReduction * (1 + (fleetBonus + securityBonus + missionBonus) / 100) * eventMultiplier * (1 + nodeBonus / 100);
  const reductionAmountPerHour = Math.max(0, grossSpeedBeforeReduction - currentSpeed);
  useEffect(() => { const open=()=>setSpeedOpen(true); window.addEventListener('spnx-open-speed',open); return()=>window.removeEventListener('spnx-open-speed',open); }, []);
  return <section className={`command-card mining-core ${detailed ? 'detailed' : ''}`}>
    <div className="section-heading mining-command-heading">
      <div><small>SPNX DISTRIBUTION ENGINE</small><h2>{t.mining}</h2></div>
      <div className="mining-command-actions">
        {onOpenGlobalChat && <button className="global-chat-launch" onClick={onOpenGlobalChat} title={ko ? '전 세계 12개국 채팅방 열기' : 'Open 12 global chat rooms'}><Icon name="community" size={16}/><span>{ko ? '글로벌 채팅' : 'GLOBAL CHAT'}</span><b>12</b></button>}
        <span className={active ? 'live-state pulse' : 'live-state'}><i />{active ? t.active : t.ready}</span>
      </div>
    </div>
    <MiningReactor
      active={active}
      progress={pct}
      detailed={detailed}
      onActivate={!active && !busy ? onStart : claimable && !busy ? onClaim : undefined}
      actionLabel={claimable ? t.claim : t.start}
      nodeOnline={Boolean(m.nodeOnline)}
      nodeStatus={m.nodeStatus || user.communityNode?.status || ''}
      nodeBonus={nodeBonus}
    />
    <div className="cycle-visual">
      <div className="progress-ring" style={{ '--progress': `${pct * 3.6}deg` }}>
        <div><b>{pct}%</b><small>{t.progress}</small></div>
      </div>
      <div className="cycle-data">
        <span><small>{t.remaining}</small><b>{claimable ? '00:00:00' : clock(m.remainingMs || 86400000)}</b></span>
        <span><small>{t.reward}</small><b>{format(m.reward || 30)} SPNX</b></span>
        <span><small>{t.rate}</small><b>{format(currentSpeed, 5)} SPNX/h</b></span>
      </div>
    </div>
    <div className="mining-track"><i style={{ width: `${pct}%` }} /><span className="track-node n1"/><span className="track-node n2"/><span className="track-node n3"/></div>
    <div className="mining-metrics">
      <span><small>{t.phase}</small><b>{t.phase} {m.phase || 1}</b></span>
      <button type="button" className="fleet-live-metric fleet-entry-button" onClick={onOpenFleet} title={ko ? '내 함대와 초대 링크 열기' : 'Open my fleet and invite link'} aria-label={ko ? `활성 채굴자 ${activeReferrals}명, 총 레퍼럴 ${totalReferrals}명. 내 함대 열기` : `${activeReferrals} active miners out of ${totalReferrals} referrals. Open my fleet`}>
        <span className="fleet-metric-orbit" aria-hidden="true"><i/><Icon name="fleet" size={16}/></span>
        <span className="fleet-metric-copy"><small>FLEET LINK</small><strong className="fleet-metric-count">{activeReferrals.toLocaleString()}<em>/</em>{totalReferrals.toLocaleString()}</strong><span className="fleet-metric-status"><i/>ACTIVE · TOTAL</span></span>
        <span className="fleet-metric-bonus"><b>+5%</b><small>/ ACTIVE</small></span>
        <span className="fleet-metric-open" aria-hidden="true"><Icon name="arrow" size={12}/></span>
      </button>
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
    {speedOpen && <div className="speed-modal-backdrop" role="presentation" onClick={() => setSpeedOpen(false)}><section className="speed-command-panel" role="dialog" aria-modal="true" aria-label={ko?'현재 채굴 속도':'Current mining speed'} onClick={(event)=>event.stopPropagation()}><header><div className="speed-symbol"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="7"/><ellipse cx="32" cy="32" rx="25" ry="10"/><ellipse cx="32" cy="32" rx="25" ry="10" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="25" ry="10" transform="rotate(120 32 32)"/><path d="m25 23 14 18M39 23 25 41"/></svg></div><div><small>NOVA PULSE · LIVE RATE</small><h3>{ko?'현재 채굴 속도':'Current Mining Speed'}</h3></div><button onClick={()=>setSpeedOpen(false)} aria-label="Close">×</button></header><div className="speed-total"><small>{ko?'반감기 적용 후 시간당 실시간 적립 속도':'LIVE RATE AFTER MINING REDUCTION'}</small><strong>{format(currentSpeed,5)}</strong><b>SPNX POINT / HOUR</b><span>{active?(ko?'24시간 채굴 세션 가동 중':'24H MINING SESSION ACTIVE'):(ko?'채굴 시작 대기 중':'READY TO START MINING')}</span></div><div className="speed-reduction-summary"><div><small>{ko?'보너스 포함 총 채굴 속도':'GROSS RATE WITH BONUSES'}</small><b>{format(grossSpeedBeforeReduction,5)} SPNX/h</b></div><i>−</i><div className="reduction"><small>{ko?`반감기 ${reductionSteps}단계 차감`:`REDUCTION · STEP ${reductionSteps}`}</small><b>−{format(effectiveReductionPercent,2)}% · {format(reductionAmountPerHour,5)}</b></div><i>=</i><div className="final"><small>{ko?'최종 채굴 속도':'FINAL RATE'}</small><b>{format(currentSpeed,5)} SPNX/h</b></div></div><div className="speed-formula"><article><span>01</span><div><small>{ko?'반감기 전 기본 속도':'BASE BEFORE REDUCTION'}</small><b>{format(baseBeforeReduction,5)} SPNX/h</b></div></article><article><span>02</span><div><small>{ko?'함대 보너스':'FLEET BONUS'}</small><b>+{fleetBonus}%</b></div></article><article><span>03</span><div><small>{ko?'보안 서클':'SECURITY CIRCLE'}</small><b>+{securityBonus}%</b></div></article><article><span>04</span><div><small>{ko?'5대 미션 패스포트':'MISSION PASSPORT'}</small><b>+{missionBonus}%</b></div></article><article><span>05</span><div><small>{ko?'커뮤니티 노드':'COMMUNITY NODE'}</small><b>{m.nodeOnline?`+${nodeBonus}%`:(ko?'오프라인 · +0%':'OFFLINE · +0%')}</b></div></article><article className="reduction-item"><span>06</span><div><small>{ko?'총 채굴 점수 반감기':'TOTAL MINING REDUCTION'}</small><b>{reductionSteps?`−${format(effectiveReductionPercent,2)}%`:(ko?'현재 −0%':'CURRENTLY −0%')}</b></div></article></div><div className="speed-equation"><small>{ko?'최종 계산식':'FINAL FORMULA'}</small><p>({format(baseBeforeReduction,5)} × (100% + {fleetBonus + securityBonus + missionBonus}%) × {format(eventMultiplier,2)} × (100% + {nodeBonus}%)) × {format(reductionMultiplier * 100,2)}%</p><strong>= {format(currentSpeed,5)} SPNX/h</strong></div><p className="speed-note"><Icon name="shield" size={15}/>{ko?'반감기는 보너스를 포함한 총 채굴 점수에 적용됩니다. 기존 보유 포인트는 차감되지 않으며 새 채굴 속도와 적립량만 감소합니다.':'The reduction applies to total mining output including bonuses. Existing points are never deducted; only new mining speed and earnings decrease.'}</p></section></div>}
  </section>;
}

function MiningReactor({ active, progress, detailed, onActivate, actionLabel, nodeOnline = false, nodeStatus = '', nodeBonus = 0 }) {
  const particles = useMemo(() => Array.from({ length: detailed ? 26 : 16 }, (_, index) => ({
    left: 8 + ((index * 37) % 84),
    delay: (index * .17) % 2.4,
    duration: 1.8 + ((index * 13) % 16) / 10,
    size: 2 + (index % 3),
  })), [detailed]);
  const nodeWaiting = ['awaiting_heartbeat', 'not_registered', ''].includes(String(nodeStatus));
  const nodeState = nodeOnline ? 'ONLINE' : nodeWaiting ? 'WAITING' : 'OFFLINE';
  const hashState = nodeOnline ? 'STABLE' : nodeWaiting ? 'WAITING' : 'OFFLINE';
  const coreState = active ? 'MINING' : nodeOnline ? 'NODE ONLINE' : onActivate ? 'TOUCH' : 'STANDBY';
  const coreOutput = active ? `${progress}% OUTPUT` : nodeOnline ? `+${nodeBonus}% SPEED` : actionLabel?.toUpperCase();
  return <div
    className={`mining-reactor ${active ? 'running' : 'idle'} ${nodeOnline ? 'node-online' : 'node-offline'} ${detailed ? 'reactor-large' : ''} ${onActivate ? 'reactor-touchable' : ''}`}
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
      <div className="reactor-core"><i/><b>{coreState}</b><small>{coreOutput}</small></div>
      <span className="scanner-beam"/>
    </div>
    <div className="reactor-particles">{particles.map((particle, index) => <i key={index} style={{ left: `${particle.left}%`, animationDelay: `${particle.delay}s`, animationDuration: `${particle.duration}s`, width: particle.size, height: particle.size }}/>)}</div>
    <div className="reactor-status">
      <span className={active ? 'status-core is-active' : 'status-core'}><i/>QUANTUM CORE {active ? 'ACTIVE' : 'READY'}</span>
      <span className={`status-link ${nodeOnline ? 'is-online' : nodeWaiting ? 'is-waiting' : 'is-offline'}`}><i/>HASH LINK {hashState}</span>
      <span className={`status-node ${nodeOnline ? 'is-online' : nodeWaiting ? 'is-waiting' : 'is-offline'}`}><i/>NODE 01 {nodeState}</span>
    </div>
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

function SponsoredBannerSlot({ placement, language }) {
  const ko = language === 'ko';
  const [enabled, setEnabled] = useState(false);
  const [banners, setBanners] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await api('/api/sponsored-banners', { method: 'POST', body: { placement } });
        if (!alive) return;
        setEnabled(Boolean(data.enabled));
        setBanners(Array.isArray(data.banners) ? data.banners : []);
        setActiveIndex(0);
      } catch {
        if (!alive) return;
        setEnabled(false);
        setBanners([]);
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [placement]);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = setInterval(() => setActiveIndex((current) => (current + 1) % banners.length), 7000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const banner = banners[activeIndex] || null;
  if (!enabled || !banner) return null;

  function recordPartnerClick(event) {
    // A real link preserves the user's browser gesture. Telegram uses its
    // native outbound-link view; the normal web app opens the same link in a
    // separate tab. Either route starts only after the explicit user tap.
    const telegram = window.Telegram?.WebApp;
    if (typeof telegram?.openLink === 'function') {
      event.preventDefault();
      telegram.openLink(banner.destinationUrl);
    }
    void api('/api/sponsored-banners/click', { method: 'POST', body: { bannerId: banner.id } }).catch(() => {});
  }

  return <section className="sponsored-banner-slot" aria-label={ko ? '스폰서 파트너 안내' : 'Sponsored partner information'}>
    <div className="sponsored-banner-topline"><span>{ko ? '광고 · SPONSORED' : 'ADVERTISEMENT · SPONSORED'}</span><small>{banner.label}</small></div>
    <div className="sponsored-banner-main">
      {banner.imageUrl ? <img className="sponsored-banner-image" src={banner.imageUrl} alt={`${banner.partnerName} partner banner`} loading="lazy"/> : <div className="sponsored-banner-fallback" aria-hidden="true"><span>{String(banner.partnerName || 'P').slice(0, 1).toUpperCase()}</span></div>}
      <div className="sponsored-banner-copy"><small>{banner.partnerName}</small><h3>{banner.title}</h3><p>{banner.body}</p></div>
      <a className="sponsored-banner-action" href={banner.destinationUrl} target="_blank" rel="noopener noreferrer" onClick={recordPartnerClick}><span>{ko ? '공식 파트너 열기' : 'VIEW PARTNER'}</span><Icon name="external" size={15}/></a>
    </div>
    <div className="sponsored-banner-foot"><p>{banner.disclosure}</p><small>{ko ? 'SpaceNovaX 앱은 이 배너에서 지갑 연결·서명·자동 이동을 실행하지 않습니다.' : 'SpaceNovaX never starts a wallet connection, signature, or automatic redirect from this banner.'}</small>{banners.length > 1 && <span className="sponsored-banner-dots" aria-label={ko ? '파트너 배너 선택' : 'Partner banner selection'}>{banners.map((item, index) => <button type="button" key={item.id} className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)} aria-label={`${index + 1}`}/>)}</span>}</div>
  </section>;
}

function CaptainTelegramOnboarding({ language }) {
  const korean = language === 'ko';
  // Preserve a referral when a Captain arrives from a shared app.spacenovax.com/join/CODE link.
  // The bot receives the same code through Telegram's official start parameter.
  const pathParts = String(window.location.pathname || '').split('/').filter(Boolean);
  const possibleReferralCode = pathParts[0] === 'join' ? pathParts[1] || '' : '';
  const referralCode = /^[A-Za-z0-9]{1,32}$/.test(possibleReferralCode) ? possibleReferralCode.toUpperCase() : '';
  const telegramUrl = referralCode ? `${OFFICIAL_TELEGRAM_BOT_URL}?start=${encodeURIComponent(referralCode)}` : OFFICIAL_TELEGRAM_BOT_URL;
  const telegramInstallUrl = 'https://telegram.org/apps';
  const openTelegram = () => {
    const telegram = window.Telegram?.WebApp;
    if (typeof telegram?.openTelegramLink === 'function') telegram.openTelegramLink(telegramUrl);
    else window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  };
  return <section className="captain-onboarding-card" aria-label={korean ? '캡틴 ID 시작 안내' : 'Captain ID getting started'}>
    <div className="captain-onboarding-orbit" aria-hidden="true">✦</div>
    <div className="captain-onboarding-copy">
      <span>{korean ? 'SPACENOVAX 시작 안내' : 'SPACENOVAX GETTING STARTED'}</span>
      <h2>{korean ? '채굴을 시작하려면 캡틴 ID가 필요합니다' : 'A Captain ID is required to start mining'}</h2>
      <p>{korean ? '웹에서는 서비스 내용을 둘러볼 수 있습니다. SPNX Points 채굴과 보상 기록은 공식 Telegram Mini App에서 생성되는 캡틴 ID로만 보호됩니다.' : 'You can explore SpaceNovaX on the web. Mining and reward records are protected through a Captain ID created in the official Telegram Mini App.'}</p>
      <ol><li>{korean ? 'Telegram이 없다면 먼저 공식 앱을 설치합니다.' : 'If you do not have Telegram, install the official app first.'}</li><li>{korean ? '공식 Telegram 봇을 엽니다.' : 'Open the official Telegram bot.'}</li><li>{korean ? 'START 또는 앱 열기를 누릅니다.' : 'Tap START or Open App.'}</li><li>{korean ? '캡틴 ID가 자동 생성되면 채굴을 시작합니다.' : 'Your Captain ID is created automatically; then start mining.'}</li></ol>
      <a className="captain-telegram-install" href={telegramInstallUrl} target="_blank" rel="noreferrer"><Icon name="external" size={15}/>{korean ? 'Telegram 공식 앱 설치' : 'Install the official Telegram app'}</a>
      <button className="captain-onboarding-action" onClick={openTelegram}><Icon name="telegram" size={18}/>{korean ? '공식 Telegram에서 캡틴 ID 만들기' : 'Create Captain ID in Telegram'}<Icon name="external" size={15}/></button>
      <a className="captain-onboarding-link" href={telegramUrl} target="_blank" rel="noreferrer">{korean ? '링크 열기 / 복사하기' : 'Open or copy the Telegram link'}{referralCode && <b> · REF {referralCode}</b>}</a>
      <small>{korean ? '보안 안내: 비밀번호·지갑 개인키·Telegram 인증 코드는 절대 입력하지 마세요.' : 'Security: Never enter a password, wallet private key, or Telegram login code.'}</small>
    </div>
  </section>;
}

function Home({ user, t, onStart, onClaim, busy, setTab, language, requiresCaptain }) {
  const live = useLiveMiningView(user);
  const liveUser = { ...user, mining: live.mining };
  const [balanceInteger, balanceFraction = ''] = format(live.displayBalance, 5).split('.');
  const miningIsLive = Boolean(live.mining.active) && !Boolean(live.mining.claimable);
  const heroSpeed = miningIsLive ? Number(live.mining.speedPerHour || (live.mining.reward || 30) / 24) : 0;
  return <main className="v15-page">
    <section className="hero-command">
      <div className="hero-space"/>
      <div className="hero-copy">
        <span className="eyebrow"><i />{t.verified}</span>
        <small>{t.balance} · {live.mining.active ? 'LIVE SESSION' : 'SETTLED LEDGER'}</small><strong className="hero-balance" aria-label={`${balanceInteger}${balanceFraction ? `.${balanceFraction}` : ''} SPNX POINTS`}><span className="hero-balance-int">{balanceInteger}</span>{balanceFraction && <span className="hero-balance-fraction">.{balanceFraction}</span>}</strong><h1>SPNX POINTS</h1>
        <p>SPACENOVAX / EARTH ORBITAL COMMAND NETWORK</p>
      </div>
      <img className="hero-station" src="/spacenovax-orbital-command-v17.webp" alt="SpaceNovaX 궤도 관제기지" />
      <div className="hero-live-light" aria-hidden="true"/>
      <div className="cosmic-dust" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index}/>)}</div>
      <div className="spnx-token-flight" aria-hidden="true"><span><img src="/spnx-orbital-token-v1.webp" alt="" /></span></div>
      <button className={`hero-nova-pulse ${miningIsLive ? 'mining-live' : 'mining-offline'}`} onClick={() => window.dispatchEvent(new Event('spnx-open-speed'))} aria-label="Open NOVA Pulse mining speed details"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="7"/><ellipse cx="32" cy="32" rx="25" ry="10"/><ellipse cx="32" cy="32" rx="25" ry="10" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="25" ry="10" transform="rotate(120 32 32)"/><path d="m25 23 14 18M39 23 25 41"/></svg><span><small>NOVA PULSE · {document.documentElement.lang==='ko'?(miningIsLive?'현재 채굴 속도':'채굴 정지'):(miningIsLive?'LIVE MINING SPEED':'MINING OFFLINE')}</small><b>{format(heroSpeed,5)} SPNX/h</b><em>{document.documentElement.lang==='ko'?'터치하여 상세 보기':'TOUCH FOR DETAILS'}</em></span></button>
      <div className="station-brand"><span>SPACENOVAX ORBITAL COMMAND</span><b>SpaceNova<span>X</span></b><small>EARTH SECTOR · COMMAND BASE HQ-01</small></div>
      <div className="captain-strip"><span><small>{t.captain}</small><b>{user.firstName || 'Space Explorer'}</b></span><span><small>LEVEL</small><b>{user.level || 1}</b></span><span><small>{t.status}</small><b>{user.isGuest ? t.guest : 'TELEGRAM VERIFIED'}</b></span></div>
    </section>
    {requiresCaptain && <CaptainTelegramOnboarding language={language}/>} 
    <SponsoredBannerSlot placement="mining-top" language={language}/>
    <MiningCore user={liveUser} t={t} onStart={onStart} onClaim={onClaim} onOpenGlobalChat={() => setTab('global-chat')} onOpenFleet={() => setTab('fleet')} busy={busy}/>
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
    // Keep just enough context for a natural follow-up while preserving the
    // shared beta quota for all Captains.
    const prior = messages.slice(-6);
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
  const cards = [['announcements', ko ? '전체 공지' : 'Global Announcements', 'mission'], ['messages', ko ? '개인 쪽지' : 'Personal Messages', 'community'], ['whitepaper', 'Whitepaper', 'mission'], ['orbit', ko ? '국제 네비게이션' : 'Global Navigation', 'globe'], ['community', t.community, 'community'], ['nodes', ko ? '커뮤니티 노드' : 'Community Node', 'bolt'], ['missions', t.missions, 'shield'], ['fleet', t.referrals, 'fleet'], ['rank', t.ranking, 'home'], ['wallet', t.wallet, 'wallet'], ['kyc', t.kyc, 'shield'], ['game', t.game, 'game']];
  return <main className="v15-page"><section className="command-card command-grid command-theme">
    <div className="section-heading"><div><small>NOVA OPERATIONS</small><h2>{t.command}</h2></div></div>
    <div className="module-grid">{cards.map(([id, label, icon]) => <button key={id} onClick={() => setTab(id)}><Icon name={icon}/><span><b>{label}</b><small>{id === 'wallet' ? (ko ? 'PIN 설정 · 보안 관리' : 'PIN SETUP · SECURITY') : 'Open module'}</small></span><Icon name="arrow" size={18}/></button>)}</div>
    <h3>{t.official}</h3><div className="official-links" aria-label="SpaceNovaX official channels">
      <a className="official-channel website-channel" href="https://spacenovax.com" target="_blank" rel="noreferrer"><Icon name="globe" size={15}/><span>WEBSITE</span></a>
      <a className="official-channel telegram-channel" href="https://t.me/spacenovaxteam" target="_blank" rel="noreferrer"><Icon name="telegram" size={15}/><span>TELEGRAM</span></a>
      <a className="official-channel x-channel" href="https://x.com/spacenovaxteam" target="_blank" rel="noreferrer"><Icon name="xbrand" size={14}/><span>X</span></a>
      <a className="official-channel discord-channel" href="https://discord.gg/pChzTUcm2t" target="_blank" rel="noreferrer"><Icon name="discord" size={16}/><span>DISCORD</span></a>
      <a className="official-channel youtube-channel" href="https://youtube.com/@spacenovaxteam" target="_blank" rel="noreferrer"><Icon name="youtube" size={17}/><span>YOUTUBE</span></a>
    </div>
    <section className="collaboration-contact">
      <div className="contact-orbit"><i/><span>SPNX</span></div>
      <div><small>PARTNERSHIP · MEDIA · TECHNOLOGY</small><h3>{ko ? 'SpaceNovaX와 미래를 함께 만드세요.' : 'Build the future with SpaceNovaX.'}</h3><p>{ko ? 'AI, GameFi, 콘텐츠, 기술 협업 및 공식 사업 문의 전용 창구입니다.' : 'Official contact for AI, GameFi, content, technology collaboration, and business inquiries.'}</p></div>
      <div className="contact-actions"><a href="mailto:business@spacenovax.com?subject=SpaceNovaX%20Collaboration%20Inquiry"><Icon name="external" size={16}/>business@spacenovax.com</a><a href="https://spacenovax.com" target="_blank" rel="noreferrer"><Icon name="globe" size={16}/>spacenovax.com</a></div>
    </section>
  </section></main>;
}

function PersonalMessages({ language, onRead }) {
  const ko = language === 'ko';
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => api('/api/messages', { method: 'POST', body: {} }).then((data) => { setMessages(data.messages || []); return data; }).catch((error) => { setNotice(error.message); return null; }), []);
  const markAllRead = useCallback(async () => {
    try { await api('/api/messages/read', { method: 'POST', body: { messageId: 'all' } }); onRead?.(); await load(); }
    catch (error) { setNotice(error.message); }
  }, [load, onRead]);
  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive && Number(data?.unreadCount || 0) > 0) return markAllRead();
      return undefined;
    });
    return () => { alive = false; };
  }, [load, markAllRead]);
  return <main className="v15-page"><section className="command-card ops-module personal-message-module">
    <div className="section-heading"><div><small>OFFICIAL SYSTEM INBOX</small><h2>{ko ? '시스템 알림함' : 'System Inbox'}</h2></div><button className="node-guide-link" onClick={markAllRead}>{ko ? '전체 읽음' : 'MARK ALL READ'}</button></div>
    <p className="module-notice">{ko?'이곳은 운영자·노드·서비스 상태 알림 전용입니다. 회원 간 비공개 대화는 함대 관제의 함대 쪽지를 이용하세요.':'This inbox is reserved for official, node, and service-status notices. Use Fleet Direct Messages for private conversations.'}</p>
    <div className="personal-message-list">{messages.length ? messages.map((item) => <article className={item.readAt?'':'unread'} key={item.id}><i className={item.type === 'node_online' ? 'online' : item.type === 'node_offline' ? 'offline' : ''}/><div><small>{item.type.replaceAll('_',' ').toUpperCase()}</small><b>{item.title}</b><p>{item.body}</p><time>{new Date(item.createdAt).toLocaleString()}</time></div></article>) : <p className="module-notice">{ko ? '아직 받은 시스템 알림이 없습니다.' : 'No system notices yet.'}</p>}</div>
    {notice && <p className="module-notice">{notice}</p>}
  </section></main>;
}

function Announcements({ language, onRead }) {
  const ko = language === 'ko';
  const [announcements, setAnnouncements] = useState([]);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => api('/api/announcements', { method:'POST', body:{} }).then((data) => setAnnouncements(data.announcements || [])).catch((error) => setNotice(error.message)), []);
  useEffect(() => { load(); }, [load]);
  async function markAllRead() { try { await api('/api/announcements/read', { method:'POST', body:{ announcementId:'all' } }); await load(); onRead?.(); } catch(error) { setNotice(error.message); } }
  return <main className="v15-page"><section className="command-card ops-module personal-message-module announcement-module"><div className="section-heading"><div><small>SPACENOVAX GLOBAL BULLETIN</small><h2>{ko?'전체 공지':'Global Announcements'}</h2></div><button className="node-guide-link" onClick={markAllRead}>{ko?'전체 읽음':'MARK ALL READ'}</button></div><div className="personal-message-list">{announcements.length?announcements.map((item)=><article className={`${item.read?'':'unread'} announcement-${item.priority}`} key={item.id}><i/><div><small>{item.showBanner?'NEW · ':''}{String(item.priority).toUpperCase()}</small><b>{item.title}</b><p>{item.body}</p><time>{new Date(item.publishedAt).toLocaleString()}</time></div></article>):<p className="module-notice">{ko?'등록된 전체 공지가 없습니다.':'No global announcements yet.'}</p>}</div>{notice&&<p className="module-notice">{notice}</p>}</section></main>;
}

function Community({ user, setUser, language, setTab }) {
  const [posts, setPosts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [permission, setPermission] = useState({ allowed: false, completed: user.missionPassportComplete ? 5 : 0, required: 5 });
  const [category, setCategory] = useState('all');
  const [feedSort, setFeedSort] = useState('latest');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [form, setForm] = useState({ category: 'nova-ai', title: '', body: '', imageData: '', imageName: '' });
  const [notice, setNotice] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { voiceState, play: playCommunityVoice } = useNovaVoiceFeedback('community-briefing');
  const ko = language === 'ko';
  const referralCode = dashboard?.referralCode || user.referralCode || '';
  const referralLink = dashboard?.referralLink || dashboard?.legacyReferralLink || '';
  const invitation = useMemo(() => buildReferralInvitation({ language, code: referralCode, link: referralLink }), [language, referralCode, referralLink]);
  const load = useCallback(() => api('/api/community/feed', { method: 'POST', body: { category, sort: feedSort } }).then((data) => { setPosts(data.posts || []); setPermission(data.permission || permission); }).catch((error) => setNotice(error.message)), [category, feedSort]);
  useEffect(() => {
    load();
    api('/api/community/dashboard', { method: 'POST', body: {} }).then((data) => setDashboard(data.dashboard || null)).catch((error) => setNotice(error.message));
  }, [load]);
  async function copyInvite() {
    if (!invitation.text) return setNotice(invitation.notices.unavailable);
    try {
      const copied = await copyReferralText(invitation.text);
      setNotice(copied ? invitation.notices.copied : invitation.notices.failed);
    } catch {
      setNotice(invitation.notices.failed);
    }
  }
  async function shareInvite() {
    if (!invitation.text) return setNotice(invitation.notices.unavailable);
    try {
      const outcome = await shareReferralInvitation(invitation);
      setNotice(outcome === 'shared' ? invitation.notices.shared : outcome === 'copied' ? invitation.notices.copied : invitation.notices.failed);
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice(invitation.notices.failed);
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
  async function updateAvatar(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setNotice(ko ? 'JPG, PNG 또는 WebP 사진만 사용할 수 있습니다.' : 'Use a JPG, PNG, or WebP image.');
    try {
      const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = source; });
      const size = Math.min(image.width, image.height);
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
      canvas.getContext('2d').drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 512, 512);
      const imageData = canvas.toDataURL('image/jpeg', .82);
      const data = await api('/api/profile/avatar', { method: 'POST', body: { imageData } });
      if (data.user) setUser((current) => ({ ...current, ...data.user }));
      setNotice(ko ? '커뮤니티 프로필 사진이 등록되었습니다.' : 'Community profile photo updated.');
      load();
    } catch (error) { setNotice(error.message); }
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
  async function comment(post) {
    const body = String(commentDrafts[post.id] || '').trim();
    if (!body) return;
    try { await api('/api/community/comment', { method: 'POST', body: { postId: post.id, body } }); setCommentDrafts((current) => ({ ...current, [post.id]: '' })); load(); }
    catch (error) { setNotice(error.message); }
  }
  async function sharePost(post) {
    const text = `${post.title}\n\n${post.body.slice(0, 180)}`;
    try { if (navigator.share) await navigator.share({ title: post.title, text, url: window.location.href }); else { await navigator.clipboard?.writeText(`${text}\n${window.location.href}`); setNotice(ko ? '게시물 정보를 복사했습니다.' : 'Post copied.'); } } catch (error) { if (error?.name !== 'AbortError') setNotice(ko ? '공유하지 못했습니다.' : 'Could not share.'); }
  }
  async function report(post) {
    try { const data = await api('/api/community/report', { method: 'POST', body: { postId: post.id } }); setNotice(data.message); } catch (error) { setNotice(error.message); }
  }
  const categories = [['all', ko ? '전체' : 'All'],['nova-ai','NOVA AI'],['game',ko ? '게임' : 'Game'],['mining',ko ? '채굴' : 'Mining'],['guide',ko ? '가이드' : 'Guides'],['community',ko ? '커뮤니티' : 'Community']];
  return <main className="v15-page"><section className="command-card ops-module community-theme">
    <div className="section-heading"><div><small>CAPTAIN KNOWLEDGE NETWORK</small><h2>{ko ? '캡틴 커뮤니티' : 'Captain Community'}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>TRUST GATED</span></div>
    <div className="community-intro"><img src="/nova-ai-command-intelligence-v17.webp" alt="NOVA"/><div><small>NOVA MODERATED INTELLIGENCE</small><h3>{ko ? '유용한 지식과 사진을 전 세계 캡틴과 공유하세요.' : 'Share useful knowledge and photos with Captains worldwide.'}</h3><p>{ko ? '모든 회원은 게시물을 읽을 수 있습니다. 공식 웹사이트·텔레그램·디스코드·X·유튜브의 5대 미션을 모두 완료하면 글과 사진 게시 권한이 자동으로 열립니다.' : 'Everyone can read. Text and photo publishing unlocks after completing all five official Website, Telegram, Discord, X, and YouTube missions.'}</p></div></div>
    <div className="community-publish-notice"><Icon name="mission" size={20}/><div><strong>{ko ? '커뮤니티 게시 권한 안내' : 'COMMUNITY PUBLISHING NOTICE'}</strong><p>{ko ? '공식 웹사이트 방문 · 텔레그램 가입 · 디스코드 가입 · X 팔로우 · 유튜브 구독, 5대 미션을 모두 통과한 회원만 글과 사진을 올릴 수 있습니다. 모든 회원은 게시물을 자유롭게 열람할 수 있습니다.' : 'Only members who complete all five missions—Official Website, Telegram, Discord, X, and YouTube—can publish text and photos. Every member may view community posts.'}</p></div><b>{permission.completed || 0}/{permission.required || 5}</b></div>
    <section className="community-fleet-command">
      <div className="community-fleet-head"><div><small>COMMUNITY GROWTH COMMAND</small><h3>{ko ? '나의 초대 코드와 함대 현황' : 'My Invite Code & Fleet Status'}</h3><p>{ko ? '초대 링크를 공유해 검증된 캡틴 함대를 성장시키고 주간 함대·게임 순위를 확인하세요.' : 'Share your invitation, grow a verified Captain fleet, and track weekly fleet and game rankings.'}</p></div><div className="community-fleet-actions"><button className={`nova-voice-control voice-${voiceState}`} onClick={explainCommunityFleet} aria-live="polite"><Icon name="speaker" size={16}/>{voiceLabel(voiceState, language, 'NOVA 설명', 'NOVA BRIEF')}</button><button onClick={() => setTab('fleet')}>{ko ? '함대 전체 관리' : 'OPEN FLEET'}<Icon name="arrow" size={16}/></button></div></div>
      <div className="community-referral-code"><div><small>YOUR FLEET CODE</small><strong>{invitation.code || 'SYNCING'}</strong></div><input readOnly value={invitation.link || 'Synchronizing invitation link…'}/><button onClick={copyInvite}><Icon name="copy" size={16}/>{ko ? '복사' : 'COPY'}</button><button onClick={shareInvite}><Icon name="external" size={16}/>{ko ? '공유' : 'SHARE'}</button></div>
      <div className="community-fleet-stats"><span><small>{ko ? '총 초대' : 'TOTAL INVITES'}</small><b>{dashboard?.totalInvites ?? user.referrals?.length ?? 0}</b></span><span><small>{ko ? '활성 함대' : 'ACTIVE FLEET'}</small><b>{dashboard?.activeFleet ?? user.activeFleet ?? 0}</b></span><span><small>{ko ? '채굴 보너스' : 'MINING BONUS'}</small><b>+{dashboard?.fleetBonus ?? user.fleetBonus ?? 0}%</b></span><span><small>{ko ? '주간 함대 순위' : 'FLEET RANK'}</small><b>{dashboard?.fleetRank ? `#${dashboard.fleetRank}` : '—'}</b></span><span><small>{ko ? '게임 순위' : 'GAME RANK'}</small><b>{dashboard?.gameRank ? `#${dashboard.gameRank}` : '—'}</b></span><span><small>{ko ? '최고 게임 점수' : 'BEST GAME SCORE'}</small><b>{Number(dashboard?.gameScore || 0).toLocaleString()}</b></span></div>
      <div className="community-rank-panels">
        <article><header><div><small>WEEKLY FLEET LEAGUE</small><b>{ko ? '함대 종합 순위' : 'Fleet Ranking'}</b></div><button onClick={() => setTab('rank')}>{ko ? '전체 보기' : 'VIEW ALL'}</button></header>{(dashboard?.fleetTop || []).length ? dashboard.fleetTop.slice(0,3).map((row) => <p key={row.rank}><em>#{row.rank}</em><span>{row.captainName}<small>{row.members} MEMBERS</small></span><strong>{Number(row.score || 0).toLocaleString()}</strong></p>) : <div className="community-rank-empty">{ko ? '첫 함대를 모집하고 순위에 도전하세요.' : 'Recruit your first fleet and enter the league.'}</div>}</article>
        <article><header><div><small>NOVA FLIGHT LEAGUE</small><b>{ko ? '게임 개인 순위' : 'Game Ranking'}</b></div><button onClick={() => setTab('rank')}>{ko ? '전체 보기' : 'VIEW ALL'}</button></header>{(dashboard?.gameTop || []).length ? dashboard.gameTop.slice(0,3).map((row) => <p key={row.rank}><em>#{row.rank}</em><span>{row.firstName}<small>PILOT</small></span><strong>{Number(row.score || 0).toLocaleString()}</strong></p>) : <div className="community-rank-empty">{ko ? '게임을 시작해 첫 점수를 기록하세요.' : 'Play the game and record the first score.'}</div>}</article>
      </div>
      <p className="community-fleet-rule"><Icon name="shield" size={15}/>{ko ? '추천 보너스의 최종 Solana SPNX 전환에는 본인 KYC와 KYC 승인 추천인 검증이 필요합니다.' : 'Final Solana SPNX conversion of referral bonuses requires your KYC and verified KYC-approved referrals.'}</p>
    </section>
    <div className="community-profile-card"><span className="community-profile-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt=""/> : (user.firstName || 'C').slice(0,1).toUpperCase()}</span><div><small>MY COMMUNITY PROFILE</small><b>{user.firstName || 'Captain'}</b><p>{ko ? '게시글과 댓글에 표시할 본인 사진을 등록하세요.' : 'Choose the photo shown on your posts and comments.'}</p></div><label><Icon name="plus" size={15}/>{ko ? '사진 등록·변경' : 'ADD · CHANGE PHOTO'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateAvatar(event.target.files?.[0])}/></label></div>
    <div className={`publisher-access ${permission.allowed ? 'unlocked' : ''}`}><Icon name={permission.allowed ? 'community' : 'mission'}/><div><small>MISSION PASSPORT · PUBLISHING ACCESS</small><b>{permission.allowed ? (ko ? '글·사진 게시 권한 활성화' : 'Text & photo publishing unlocked') : `${permission.completed || 0}/${permission.required || 5} OFFICIAL MISSIONS`}</b><p>{permission.allowed ? (ko ? '정보, 가이드와 사진을 업로드할 수 있습니다.' : 'You can publish information, guides, and photos.') : (ko ? '5대 공식 채널 미션을 모두 완료하면 게시 권한이 자동으로 활성화됩니다.' : 'Complete all five official channel missions to unlock publishing.')}</p></div></div>
    {permission.allowed && <div className="community-composer"><select value={form.category} onChange={(event) => setForm({...form,category:event.target.value})}>{categories.slice(1).map(([id,label]) => <option value={id} key={id}>{label}</option>)}</select><input value={form.title} onChange={(event) => setForm({...form,title:event.target.value})} placeholder={ko ? '명확한 제목을 입력하세요' : 'Add a clear title'}/><textarea value={form.body} onChange={(event) => setForm({...form,body:event.target.value})} placeholder={ko ? '커뮤니티에 도움이 되는 정보를 작성하세요…' : 'Write useful information for the community…'}/><div className="community-upload"><label><Icon name="plus" size={16}/>{form.imageName || (ko ? '사진 추가' : 'Add photo')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => prepareImage(event.target.files?.[0])}/></label>{form.imageData && <img src={form.imageData} alt="Preview"/>}<button disabled={publishing} onClick={publish}>{publishing ? 'PUBLISHING…' : (ko ? '게시하기' : 'PUBLISH')}<Icon name="arrow"/></button></div></div>}
    <div className="community-feed-controls"><div className="community-categories">{categories.map(([id,label]) => <button className={category === id ? 'active' : ''} onClick={() => setCategory(id)} key={id}>{label}</button>)}</div><div className="community-sort"><button className={feedSort === 'latest' ? 'active' : ''} onClick={() => setFeedSort('latest')}>{ko ? '최신' : 'Latest'}</button><button className={feedSort === 'popular' ? 'active' : ''} onClick={() => setFeedSort('popular')}>{ko ? '인기' : 'Popular'}</button></div></div>
    <div className="community-feed">{posts.length ? posts.map((post) => <article className="community-post" key={post.id}><header><span className="community-avatar">{post.author.avatarUrl ? <img src={post.author.avatarUrl} alt=""/> : post.author.firstName.slice(0,1).toUpperCase()}</span><div><b>{post.author.firstName}</b><small>{post.author.fleetGrade} · {new Date(post.createdAt).toLocaleDateString()}</small></div><em>{post.category.toUpperCase()}</em></header><h3>{post.title}</h3><p>{post.body}</p>{post.imageUrl && <img className="community-post-image" src={post.imageUrl} alt="Community upload" loading="lazy"/>}<footer><button className={post.liked ? 'liked' : ''} onClick={() => like(post)}>♡ {post.likes}</button><button onClick={() => sharePost(post)}><Icon name="external" size={13}/>{ko ? '공유' : 'Share'}</button><button onClick={() => report(post)}><Icon name="shield" size={13}/>{ko ? '신고' : 'Report'}</button></footer><div className="community-comments">{(post.comments || []).slice(-3).map((item) => <p key={item.id}><b>{item.authorName}</b><span>{item.body}</span></p>)}<div><input value={commentDrafts[post.id] || ''} maxLength={500} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder={ko ? `댓글 ${post.comments?.length || 0}개 · 의견을 남겨보세요` : `${post.comments?.length || 0} comments · Add a comment`}/><button onClick={() => comment(post)}>{ko ? '등록' : 'SEND'}</button></div></div></article>) : <div className="community-empty"><Icon name="community" size={38}/><b>{ko ? '첫 번째 지식과 사진을 공유해 보세요.' : 'Be the first to share knowledge and photos.'}</b><p>{ko ? '5대 공식 미션을 완료한 캡틴의 게시물이 이곳에 표시됩니다.' : 'Posts from Captains who completed all five official missions appear here.'}</p></div>}</div>
    {notice && <p className="module-notice">{notice}</p>}
  </section></main>;
}

const GLOBAL_CHAT_PREFERRED_ROOM = {
  ko: 'korea', ja: 'japan', zh: 'china', vi: 'vietnam', es: 'spain', pt: 'brazil',
  ru: 'russia', id: 'indonesia', ar: 'arabic', en: 'global-en',
};

function formatGlobalChatTime(value, language) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function GlobalChat({ user, language, setTab }) {
  const ko = language === 'ko';
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomDetails, setRoomDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [viewerState, setViewerState] = useState(null);
  const [moderation, setModeration] = useState(null);
  const [retention, setRetention] = useState(null);
  const [roomTab, setRoomTab] = useState('chat');
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState({ data: '', name: '' });
  const [moderatorReason, setModeratorReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const loadRooms = useCallback(async () => {
    try {
      const data = await api('/api/global-chat/rooms', { method: 'POST', body: {} });
      const nextRooms = data.rooms || [];
      setRooms(nextRooms);
      setRetention(data.retention || null);
      setRoomId((current) => current || nextRooms.find((room) => room.id === (GLOBAL_CHAT_PREFERRED_ROOM[language] || 'global-en'))?.id || nextRooms[0]?.id || '');
    } catch (error) {
      setNotice(error.message);
    }
  }, [language]);
  const loadMessages = useCallback(async (targetRoomId) => {
    if (!targetRoomId) return;
    try {
      const data = await api('/api/global-chat/messages', { method: 'POST', body: { roomId: targetRoomId } });
      setRoomDetails(data.room || null);
      setMessages(data.messages || []);
      setViewerState(data.viewer || null);
      setModeration(data.moderation || null);
    } catch (error) {
      setNotice(error.message);
    }
  }, []);
  useEffect(() => { loadRooms(); }, [loadRooms]);
  useEffect(() => {
    if (!roomId || !roomOpen) return undefined;
    loadMessages(roomId);
    const poll = setInterval(() => loadMessages(roomId), 8000);
    return () => clearInterval(poll);
  }, [roomId, roomOpen, loadMessages]);
  const selectedRoom = roomDetails || rooms.find((room) => room.id === roomId) || null;
  const isMuted = Number(viewerState?.muteUntil || 0) > Date.now();
  const refresh = async () => {
    await Promise.all([loadRooms(), roomOpen ? loadMessages(roomId) : Promise.resolve()]);
  };
  function openRoom(room) {
    setRoomId(room.id);
    setRoomOpen(true);
    setRoomDetails(null);
    setRoomTab('chat');
    setNotice('');
  }
  async function preparePhoto(file) {
    if (!file) { setPhoto({ data: '', name: '' }); return; }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setNotice(ko ? 'JPG, PNG 또는 WebP 사진만 올릴 수 있습니다.' : 'Use a JPG, PNG, or WebP image.'); return; }
    try {
      const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = source; });
      let longest = 1280;
      let quality = .78;
      let imageData = '';
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const scale = Math.min(1, longest / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        imageData = canvas.toDataURL('image/jpeg', quality);
        if (imageData.length <= 900000) break;
        longest = Math.round(longest * .78);
        quality -= .08;
      }
      if (imageData.length > 900000) throw new Error(ko ? '사진 크기를 더 줄여 주세요.' : 'Please choose a smaller photo.');
      setPhoto({ data: imageData, name: file.name });
    } catch (error) {
      setNotice(error.message || (ko ? '사진을 준비하지 못했습니다.' : 'Could not prepare the photo.'));
    }
  }
  async function sendMessage(event) {
    event.preventDefault();
    if (busy || !roomId || isMuted || (!draft.trim() && !photo.data)) return;
    setBusy(true); setNotice('');
    try {
      await api('/api/global-chat/send', { method: 'POST', body: { roomId, body: draft, imageData: photo.data } });
      setDraft(''); setPhoto({ data: '', name: '' });
      await refresh();
    } catch (error) {
      setNotice(error.message);
    }
    setBusy(false);
  }
  async function reportMessage(message) {
    if (!window.confirm(ko ? '이 메시지를 신고하고 작성자를 차단할까요?' : 'Report this message and block this author?')) return;
    try {
      const data = await api('/api/global-chat/report', { method: 'POST', body: { messageId: message.id, reason: 'community_review' } });
      setNotice(data.message || (ko ? '신고를 접수했습니다.' : 'Report submitted.'));
      await refresh();
    } catch (error) { setNotice(error.message); }
  }
  async function blockAuthor(message) {
    if (!window.confirm(ko ? `${message.author.firstName} 님을 이 채팅에서 차단할까요?` : `Block ${message.author.firstName} in Global Chat?`)) return;
    try {
      await api('/api/global-chat/block', { method: 'POST', body: { userId: message.author.id, action: 'block' } });
      setNotice(ko ? '작성자를 차단했습니다.' : 'Author blocked.');
      await refresh();
    } catch (error) { setNotice(error.message); }
  }
  async function moderateMessage(message, action) {
    if (action === 'delete' && !window.confirm(ko ? '이 메시지를 이 방에서 삭제할까요?' : 'Remove this message from this room?')) return;
    let minutes = 60;
    if (action === 'mute') {
      const value = window.prompt(ko ? '채팅 일시정지 시간을 분 단위로 입력하세요. (5~10080)' : 'Enter chat pause minutes (5–10080).', '60');
      if (value === null) return;
      minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes < 5 || minutes > 10080) { setNotice(ko ? '5분에서 10,080분 사이로 입력하세요.' : 'Enter 5 to 10,080 minutes.'); return; }
    }
    try {
      const data = await api('/api/global-chat/moderate', { method: 'POST', body: { roomId, messageId: message.id, action, minutes } });
      setNotice(data.message || (ko ? '모더레이션을 적용했습니다.' : 'Moderation applied.'));
      await refresh();
    } catch (error) { setNotice(error.message); }
  }
  async function unmuteCaptain(mute) {
    try {
      const data = await api('/api/global-chat/moderate', { method: 'POST', body: { roomId, userId: mute.userId, action: 'unmute' } });
      setNotice(data.message || (ko ? '채팅 일시정지를 해제했습니다.' : 'Chat pause removed.'));
      await refresh();
    } catch (error) { setNotice(error.message); }
  }
  async function applyForModerator(event) {
    event.preventDefault();
    if (!roomId || busy) return;
    setBusy(true); setNotice('');
    try {
      await api('/api/global-chat/moderator/apply', { method: 'POST', body: { roomId, reason: moderatorReason } });
      setModeratorReason('');
      setNotice(ko ? '모더레이터 신청을 접수했습니다. 운영 승인 후 이 방에서만 관리 권한이 열립니다.' : 'Moderator application submitted. Rights activate only in this room after approval.');
      await refresh();
    } catch (error) { setNotice(error.message); }
    setBusy(false);
  }
  const roomModerators = selectedRoom?.moderators || [];
  return <main className="v15-page global-chat-page">
    {!roomId ? <section className="command-card global-chat-loading"><Icon name="community" size={32}/><b>{ko ? '글로벌 채널을 연결 중입니다…' : 'CONNECTING GLOBAL CHANNELS…'}</b></section> : <section className="command-card global-chat-shell">
      {!selectedRoom ? <div className="global-chat-loading"><Icon name="community" size={32}/><b>{ko ? '채널을 불러오는 중입니다…' : 'LOADING CHANNELS…'}</b></div> : <>
        <div className="global-chat-hero">
          <div><small>SPACENOVAX GLOBAL COMMUNITY · 12 REGIONS</small><h2>{ko ? '글로벌 채팅' : 'Global Chat'}</h2><p>{ko ? '국가·언어별 채널에서 전 세계 캡틴과 대화하세요. 모든 채팅은 채굴·SPNX·지갑과 분리됩니다.' : 'Talk with Captains by country and language. Chat is separate from mining, SPNX, and wallets.'}</p></div>
          <div className="global-chat-hero-actions"><span><Icon name="shield" size={15}/>{ko ? '공식 텔레그램 캡틴 전용' : 'VERIFIED CAPTAINS ONLY'}</span><button onClick={() => setTab('home')}><Icon name="home" size={16}/>{ko ? '채굴 화면' : 'MINING'}</button></div>
        </div>
        <SponsoredBannerSlot placement="global-chat" language={language}/>
        {!roomOpen && <div className="global-chat-room-list">{rooms.map((room) => <button className={`global-chat-room-card ${room.id === roomId ? 'active' : ''}`} key={room.id} onClick={() => openRoom(room)}><span className="global-chat-room-flag">{room.flag}</span><span className="global-chat-room-copy"><b>{room.name}</b><small>{room.nativeName} · {room.language}</small><em>{room.lastMessage ? `${room.lastMessage.authorName}: ${room.lastMessage.body}` : (ko ? '첫 인사를 남겨보세요.' : 'Be the first to say hello.')}</em></span><span className="global-chat-room-meta"><strong>{room.moderatorCount}/{room.moderatorLimit}</strong><small>MOD</small><Icon name="arrow" size={16}/></span></button>)}</div>}
        {roomOpen && selectedRoom && <section className="global-chat-room-view">
          <header className="global-chat-room-header"><button className="global-chat-back" onClick={() => { setRoomOpen(false); setRoomDetails(null); setMessages([]); setViewerState(null); setModeration(null); }} aria-label={ko ? '채널 목록' : 'Channel list'}>←</button><span className="global-chat-room-flag">{selectedRoom.flag}</span><div><small>GLOBAL COMMUNITY CHANNEL</small><h3>{selectedRoom.name}</h3><p>{selectedRoom.nativeName} · {selectedRoom.moderatorCount}/{selectedRoom.moderatorLimit} MODERATORS</p></div><button className="global-chat-refresh" onClick={refresh} aria-label={ko ? '새로고침' : 'Refresh'}>↻</button></header>
          <div className="global-chat-tabs"><button className={roomTab === 'chat' ? 'active' : ''} onClick={() => setRoomTab('chat')}>{ko ? '모든 메시지' : 'ALL MESSAGES'}</button><button className={roomTab === 'rules' ? 'active' : ''} onClick={() => setRoomTab('rules')}>{ko ? '채널 안내' : 'CHANNEL GUIDE'}</button><button className={roomTab === 'moderators' ? 'active' : ''} onClick={() => setRoomTab('moderators')}>{ko ? '모더레이터' : 'MODERATORS'}</button></div>
          {roomTab === 'rules' && <div className="global-chat-info-card"><Icon name="shield" size={26}/><div><small>{ko ? '안전한 글로벌 대화를 위한 기본 원칙' : 'GLOBAL CHAT SAFETY RULES'}</small><b>{ko ? '지갑 시드문구·개인키·송금 요청·외부 투자 링크는 금지됩니다.' : 'Seed phrases, private keys, payment requests, and unapproved investment links are prohibited.'}</b><p>{ko ? '각 방은 해당 언어 중심으로 운영됩니다. 사진은 첨부할 수 있지만, 보관 한도를 넘으면 오래된 기록과 사진부터 자동 정리됩니다.' : 'Each room is language-led. Photos are supported, while the oldest records and photos are automatically cleared after the retention limit.'}</p></div></div>}
          {roomTab === 'moderators' && <div className="global-chat-moderator-panel"><div className="global-chat-moderator-summary"><span>{selectedRoom.flag}</span><div><small>COUNTRY CHANNEL REPRESENTATIVES</small><b>{selectedRoom.moderatorCount}/{selectedRoom.moderatorLimit} {ko ? '명 배정' : 'ASSIGNED'}</b><p>{ko ? '승인된 모더레이터는 이 국가/권역 방에서만 메시지 삭제와 채팅 일시정지를 할 수 있습니다.' : 'Approved moderators can remove messages and temporarily pause chat only in this country or region room.'}</p></div></div><div className="global-chat-moderator-list">{roomModerators.length ? roomModerators.map((moderator) => <article key={moderator.id}><span className="global-chat-avatar">{moderator.avatarUrl ? <img src={moderator.avatarUrl} alt=""/> : moderator.firstName.slice(0, 1).toUpperCase()}</span><div><b>{moderator.firstName}</b><small>{moderator.badge}</small></div></article>) : <p>{ko ? '아직 승인된 모더레이터가 없습니다.' : 'No moderator has been approved yet.'}</p>}</div>{viewerState?.isModerator ? <div className="global-chat-mod-active"><b>{viewerState.moderatorBadge}</b><p>{ko ? '현재 이 방의 모더레이터입니다. 메시지 아래의 관리 버튼으로 삭제 또는 일시정지를 실행할 수 있습니다.' : 'You are a moderator for this room. Use the message controls to remove or temporarily pause chat.'}</p>{(moderation?.activeMutes || []).length > 0 && <div className="global-chat-mute-list">{moderation.activeMutes.map((mute) => <span key={mute.id}><b>{mute.firstName}</b><small>{formatGlobalChatTime(mute.until, language)} {ko ? '까지' : 'until'}</small><button onClick={() => unmuteCaptain(mute)}>{ko ? '해제' : 'UNMUTE'}</button></span>)}</div>}</div> : viewerState?.application?.status === 'pending' ? <div className="global-chat-mod-pending"><b>{ko ? '모더레이터 신청 검토 중' : 'MODERATOR APPLICATION PENDING'}</b><p>{ko ? '관리자 승인 전에는 일반 캡틴 권한으로 참여합니다.' : 'You continue as a Captain until an administrator approves the application.'}</p></div> : <form className="global-chat-mod-apply" onSubmit={applyForModerator}><label><small>{ko ? '이 방을 어떻게 안전하게 운영할지 적어주세요.' : 'Explain how you will keep this room safe and useful.'}</small><textarea minLength="20" maxLength="500" value={moderatorReason} onChange={(event) => setModeratorReason(event.target.value)} placeholder={ko ? '예: 해당 언어의 가이드 안내, 사칭·사기 신고 처리, 대화 질서 유지…' : 'Example: help with local guidance, review reports, and keep conversation respectful…'} required/></label><button disabled={busy || selectedRoom.moderatorCount >= selectedRoom.moderatorLimit}>{selectedRoom.moderatorCount >= selectedRoom.moderatorLimit ? (ko ? '정원 마감' : 'ALL 10 MODERATOR SLOTS FILLED') : (ko ? '모더레이터 신청' : 'APPLY TO MODERATE')}</button><p>{ko ? '모더레이터는 지갑·SPNX·KYC·계정 권한에 접근할 수 없습니다.' : 'Moderators never receive wallet, SPNX, KYC, or account-control access.'}</p></form>}</div>}
          {roomTab === 'chat' && <><div className="global-chat-message-list">{messages.length ? messages.map((message) => <article className={`global-chat-message ${message.author.id === user.id ? 'mine' : ''}`} key={message.id}><span className="global-chat-avatar">{message.author.avatarUrl ? <img src={message.author.avatarUrl} alt=""/> : message.author.firstName.slice(0, 1).toUpperCase()}</span><div className="global-chat-bubble"><header><b>{message.author.firstName}</b>{message.author.isModerator && <em>{message.author.badge}</em>}<time>{formatGlobalChatTime(message.createdAt, language)}</time></header>{message.body && <p>{message.body}</p>}{message.imageUrl && <img src={message.imageUrl} alt="Global chat upload" loading="lazy"/>}{message.imageExpired && <small className="global-chat-expired">{ko ? '사진 보관 기간이 지나 정리되었습니다.' : 'Photo cleared after the retention period.'}</small>}{message.author.id !== user.id && <footer><button onClick={() => reportMessage(message)}>{ko ? '신고' : 'REPORT'}</button><button onClick={() => blockAuthor(message)}>{ko ? '차단' : 'BLOCK'}</button>{viewerState?.canModerate && <><button className="moderator-control" onClick={() => moderateMessage(message, 'delete')}>{ko ? '삭제' : 'REMOVE'}</button>{!message.author.isModerator && <button className="moderator-control mute" onClick={() => moderateMessage(message, 'mute')}>{ko ? '일시정지' : 'PAUSE CHAT'}</button>}</>}</footer>}</div></article>) : <div className="global-chat-empty"><Icon name="community" size={36}/><b>{ko ? '아직 메시지가 없습니다.' : 'No messages yet.'}</b><p>{ko ? '첫 인사와 함께 글로벌 채널을 시작해 보세요.' : 'Start this global channel with a friendly hello.'}</p></div>}</div>{isMuted ? <div className="global-chat-muted"><Icon name="shield" size={18}/><div><b>{ko ? '이 방에서 채팅이 일시정지되었습니다.' : 'Chat is temporarily paused in this room.'}</b><p>{formatGlobalChatTime(viewerState.muteUntil, language)} {ko ? '까지 메시지를 보낼 수 없습니다.' : ' — you cannot send messages until then.'}</p></div></div> : <form className="global-chat-composer" onSubmit={sendMessage}>{photo.data && <div className="global-chat-photo-preview"><img src={photo.data} alt="Upload preview"/><span>{photo.name}</span><button type="button" onClick={() => setPhoto({ data: '', name: '' })}>×</button></div>}<textarea value={draft} maxLength="400" onChange={(event) => setDraft(event.target.value)} placeholder={ko ? '여기에 메시지를 작성하세요…' : 'Write a message…'}/><div><label><Icon name="plus" size={16}/>{ko ? '사진' : 'PHOTO'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => preparePhoto(event.target.files?.[0])}/></label><small>{draft.length}/400</small><button disabled={busy || (!draft.trim() && !photo.data)}>{busy ? '…' : (ko ? '전송' : 'SEND')}<Icon name="arrow" size={16}/></button></div></form>}</>}
        </section>}
        {!roomOpen && <p className="global-chat-retention"><Icon name="shield" size={15}/>{ko ? `각 방은 최근 ${retention?.messagesPerRoom || 1200}개 메시지와 ${retention?.photosPerRoom || 150}장 사진을 보관합니다. 트래픽 한도를 넘으면 가장 오래된 순서부터 자동 정리됩니다.` : `Each room retains the latest ${retention?.messagesPerRoom || 1200} messages and ${retention?.photosPerRoom || 150} photos. The oldest records are cleared first when traffic limits are reached.`}</p>}
      </>}
      {notice && <p className="module-notice">{notice}</p>}
    </section>}
  </main>;
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
  const leagueText = FLEET_LEAGUE_COPY[language] || FLEET_LEAGUE_COPY.en;
  const [fleet, setFleet] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  const [message, setMessage] = useState('');
  const [directMessages, setDirectMessages] = useState([]);
  const [directMembers, setDirectMembers] = useState([]);
  const [directRecipient, setDirectRecipient] = useState('');
  const [directQuery, setDirectQuery] = useState('');
  const [directDraft, setDirectDraft] = useState({ body:'', imageData:'', imageName:'', replyTo:'' });
  const [security, setSecurity] = useState(null);
  const [securityCode, setSecurityCode] = useState('');
  const [securityNote, setSecurityNote] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityTarget, setSecurityTarget] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState('overview');
  const referralCode = fleet?.code || user.referralCode || '';
  const referralLink = fleet?.link || '';
  const invitation = useMemo(() => buildReferralInvitation({ language, code: referralCode, link: referralLink }), [language, referralCode, referralLink]);
  const code = invitation.code || 'SYNCING';
  const link = invitation.link || 'Synchronizing invitation link…';
  const load = useCallback(() => Promise.all([api('/api/fleet/dashboard', { method: 'POST', body: {} }), api('/api/security-circle/dashboard', { method: 'POST', body: {} }), api('/api/fleet/messages', { method:'POST', body:{} })]).then(([data, securityData, directData]) => { setFleet(data.fleet); setSecurity(securityData.circle || null); setDirectMessages(directData.messages || []); if (data.user) setUser((current) => ({ ...current, ...data.user })); }).catch((error) => setNotice(error.message)), [setUser]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if(view==='direct'&&directMessages.some((item)=>item.direction==='received'&&!item.readAt)) api('/api/fleet/messages/read',{method:'POST',body:{}}).then(load).catch(()=>{}); }, [view, directMessages, load]);
  useEffect(() => { const timer=setTimeout(()=>api('/api/fleet/messages/members',{method:'POST',body:{query:directQuery}}).then((data)=>setDirectMembers(data.members||[])).catch((error)=>setNotice(error.message)),250); return()=>clearTimeout(timer); },[directQuery]);
  async function copyInvite() {
    if (!invitation.text) return setNotice(invitation.notices.unavailable);
    try {
      const copied = await copyReferralText(invitation.text);
      setNotice(copied ? invitation.notices.copied : invitation.notices.failed);
    } catch {
      setNotice(invitation.notices.failed);
    }
  }
  async function share() {
    if (!invitation.text) return setNotice(invitation.notices.unavailable);
    try {
      const outcome = await shareReferralInvitation(invitation);
      setNotice(outcome === 'shared' ? invitation.notices.shared : outcome === 'copied' ? invitation.notices.copied : invitation.notices.failed);
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice(invitation.notices.failed);
    }
  }
  async function join() {
    try { const data = await api('/api/fleet/join', { method: 'POST', body: { code: codeInput } }); setNotice(data.message); if (data.user) setUser((current) => ({ ...current, ...data.user })); setCodeInput(''); load(); } catch (error) { setNotice(error.message); }
  }
  async function sendMessage() {
    if (!message.trim()) return;
    try { await api('/api/fleet/chat', { method: 'POST', body: { message } }); setMessage(''); load(); } catch (error) { setNotice(error.message); }
  }
  async function attachDirectPhoto(file) { if(!file)return; if(!/^image\/(png|jpeg|webp)$/.test(file.type))return setNotice(language==='ko'?'JPG, PNG 또는 WebP 사진만 가능합니다.':'Use JPG, PNG, or WebP.'); try{const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=source});const scale=Math.min(1,1400/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const imageData=canvas.toDataURL('image/jpeg',.8);if(imageData.length>1_350_000)return setNotice(language==='ko'?'사진 용량이 너무 큽니다.':'Photo is too large.');setDirectDraft((current)=>({...current,imageData,imageName:file.name}))}catch(error){setNotice(error.message)} }
  async function sendDirectMessage(){if(!directRecipient)return setNotice(language==='ko'?'같은 함대의 받는 회원을 선택하세요.':'Choose a member of your fleet.');try{const data=await api('/api/fleet/messages/send',{method:'POST',body:{recipientId:directRecipient,...directDraft}});setDirectDraft({body:'',imageData:'',imageName:'',replyTo:''});setNotice(data.message);await load()}catch(error){setNotice(error.message)}}
  async function toggleDirectBlock(item){const targetId=item.direction==='sent'?item.userId:item.senderId;try{await api('/api/fleet/messages/block',{method:'POST',body:{userId:targetId,action:item.blocked?'unblock':'block'}});setNotice(item.blocked?(language==='ko'?'차단을 해제했습니다.':'Member unblocked.'):(language==='ko'?'함대원의 쪽지를 차단했습니다.':'Fleet member blocked.'));await load()}catch(error){setNotice(error.message)}}
  async function reportDirectMessage(item){if(!window.confirm(language==='ko'?'사기·운영자 사칭 또는 피싱 쪽지로 신고하고 발신자를 차단합니까?':'Report fraud or impersonation and block the sender?'))return;try{const data=await api('/api/fleet/messages/report',{method:'POST',body:{messageId:item.id,reason:'fraud_impersonation_or_phishing'}});setNotice(data.message);await load()}catch(error){setNotice(error.message)}}
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
    <div className="referral-box"><input readOnly value={link}/><button onClick={copyInvite}><Icon name="copy"/>COPY</button><button onClick={share}><Icon name="external"/>SHARE</button></div>
    {!user.referredBy && <div className="join-fleet"><div><small>HAVE A REFERRAL CODE?</small><b>Join a captain fleet</b></div><input value={codeInput} onChange={(event) => setCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="8-DIGIT CODE" maxLength={8}/><button onClick={join}>APPLY CODE<Icon name="arrow"/></button></div>}
    <div className="ops-stats fleet-stat-grid"><span><small>TOTAL INVITES</small><b>{fleet?.total ?? user.referrals?.length ?? 0}/1000</b></span><span><small>ACTIVE FLEET</small><b>{fleet?.active ?? user.activeFleet ?? 0}</b></span><span><small>KYC VERIFIED</small><b>{fleet?.kycVerified || 0}</b></span><span><small>MINING BONUS</small><b>+{user.fleetBonus || 0}%</b></span><span><small>SECURITY BONUS</small><b>+{user.securityCircleBonus || 0}%</b></span><span><small>FLEET GRADE</small><b>{fleet?.grade || user.fleetGrade || 'Explorer'}</b></span></div>
    <div className="fleet-conversion-alert"><Icon name="shield"/><div><b>{language === 'ko' ? '추천 보너스의 Solana SPNX 전환 기준' : 'Referral Bonus Conversion to Solana SPNX'}</b><p>{language === 'ko' ? '앱에서는 활성 추천인 기준으로 채굴 속도가 표시됩니다. 공식 전환 시에는 KYC를 통과한 정상 추천인만 최종 추천 보너스에 합산되며, 본인 KYC 승인과 Solana 지갑 등록도 필수입니다.' : 'The app displays speed using active referrals. At official conversion, only legitimate referrals who pass KYC count toward the final bonus. Your KYC approval and Solana wallet registration are also required.'}</p></div></div>
    <div className="fleet-tabs fleet-tabs-five"><button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>MEMBERS</button><button className={view === 'security' ? 'active' : ''} onClick={() => setView('security')}>SECURITY</button><button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>CHAT</button><button className={view === 'direct' ? 'active' : ''} onClick={() => setView('direct')}>{language==='ko'?'함대 쪽지':'DIRECT'}</button><button className={view === 'league' ? 'active' : ''} onClick={() => setView('league')}>LEAGUE</button></div>
    {view === 'overview' && <div className="fleet-members">{(fleet?.members || []).length ? fleet.members.map((member) => <article key={member.id}><div className={`member-signal ${member.active ? 'online' : ''}`}><i/></div><span><b>{member.firstName}</b><small>{member.active ? 'MINING ACTIVE' : 'INACTIVE · REMINDER AVAILABLE'}</small></span><strong>{Number(member.gameScore || 0).toLocaleString()} XP</strong>{!member.active && <button onClick={() => remind(member)}><Icon name="bolt" size={15}/>REMIND</button>}</article>) : <div className="fleet-empty">Invite your first captain to activate the fleet roster.</div>}</div>}
    {view === 'chat' && <div className="fleet-chat"><div className="fleet-chat-log">{(fleet?.messages || []).length ? fleet.messages.map((item) => <article key={item.id}><b>{item.firstName}</b><p>{item.message}</p><small>{new Date(item.at).toLocaleString()}</small></article>) : <div className="fleet-empty">Fleet channel is ready. Send the first message.</div>}</div><div className="fleet-chat-compose"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }} placeholder="Message your fleet…"/><button onClick={sendMessage}><Icon name="arrow"/></button></div></div>}
    {view === 'direct' && <div className="fleet-direct"><div className="message-security-warning"><Icon name="shield" size={20}/><div><b>{language==='ko'?'같은 함대 회원 전용 비공개 쪽지':'PRIVATE MESSAGES · SAME FLEET ONLY'}</b><p>{language==='ko'?'사진·답장·차단·신고를 지원합니다. 사기, 금전 요구, 운영자 사칭, 피싱은 확인 즉시 영구정지됩니다.':'Photos, replies, blocking, and reporting are supported. Confirmed fraud, payment demands, impersonation, or phishing result in permanent suspension.'}</p></div></div><div className="member-message-composer"><input value={directQuery} onChange={(e)=>setDirectQuery(e.target.value)} placeholder={language==='ko'?'함대원 이름 검색':'Search fleet member'}/><select value={directRecipient} onChange={(e)=>setDirectRecipient(e.target.value)}><option value="">{language==='ko'?'받는 함대원 선택':'Choose fleet member'}</option>{directMembers.map((member)=><option value={member.id} key={member.id}>{member.firstName}</option>)}</select>{directDraft.replyTo&&<p className="message-reply-preview">↩ {language==='ko'?'답장 작성 중':'Replying'} <button onClick={()=>setDirectDraft({...directDraft,replyTo:''})}>×</button></p>}<textarea maxLength={1500} value={directDraft.body} onChange={(e)=>setDirectDraft({...directDraft,body:e.target.value})} placeholder={language==='ko'?'함대 쪽지를 입력하세요.':'Write a fleet direct message.'}/><div><label><Icon name="plus" size={14}/>{directDraft.imageName||(language==='ko'?'사진 첨부':'ATTACH PHOTO')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>attachDirectPhoto(e.target.files?.[0])}/></label><button onClick={sendDirectMessage}>{language==='ko'?'쪽지 보내기':'SEND'}<Icon name="arrow" size={14}/></button></div>{directDraft.imageData&&<img className="message-photo-preview" src={directDraft.imageData} alt=""/>}</div><div className="personal-message-list">{directMessages.length?directMessages.map((item)=><article className={`${item.readAt||item.direction==='sent'?'':'unread'} ${item.direction==='sent'?'sent':''}`} key={item.id}>{item.senderAvatarUrl?<img className="message-member-avatar" src={item.senderAvatarUrl} alt=""/>:<span className="message-member-avatar">{(item.senderName||'C').slice(0,1)}</span>}<div><small>{item.direction==='sent'?(language==='ko'?`보냄 · ${item.recipientName}`:`SENT · ${item.recipientName}`):(language==='ko'?`받음 · ${item.senderName}`:`FROM · ${item.senderName}`)}</small><b>{item.title}</b>{item.replyPreview&&<blockquote>↩ {item.replyPreview}</blockquote>}<p>{item.body}</p>{item.imageUrl&&<img className="message-photo" src={item.imageUrl} alt="Fleet message attachment" loading="lazy"/>}<time>{new Date(item.createdAt).toLocaleString()}</time><nav>{item.direction!=='sent'&&<button onClick={()=>{setDirectRecipient(item.senderId);setDirectDraft((current)=>({...current,replyTo:item.id}))}}>{language==='ko'?'답장':'REPLY'}</button>}<button onClick={()=>toggleDirectBlock(item)}>{item.blocked?(language==='ko'?'차단 해제':'UNBLOCK'):(language==='ko'?'차단':'BLOCK')}</button>{item.direction!=='sent'&&<button className="danger" onClick={()=>reportDirectMessage(item)}>{language==='ko'?'사기·사칭 신고':'REPORT'}</button>}</nav></div></article>):<div className="fleet-empty">{language==='ko'?'아직 함대 쪽지가 없습니다.':'No fleet direct messages yet.'}</div>}</div></div>}
    {view === 'security' && <div className="security-circle-panel"><div className="security-circle-head"><div><small>MUTUAL TRUST NETWORK</small><h3>Security Circle</h3><p>{language === 'ko' ? '서로 아는 캡틴에게 초대를 보내고 상대가 승인하면 연결됩니다. 5명 완성 시 신뢰도 100%이며, KYC 승인 멤버만 채굴 속도 +1%씩 최대 +5%가 적용됩니다.' : 'Invite trusted Captains and connect only after mutual approval. Five members mean 100% trust; KYC-approved members add +1% mining speed each, up to +5%.'}</p></div><strong>{security?.percent ?? 0}%</strong></div><div className="security-progress"><i style={{width: ((security?.percent ?? 0) + '%')}}/></div><div className="security-slots">{Array.from({length:5},(_,index) => { const selected = security?.members?.[index]; return <span className={selected ? 'filled' : ''} key={index}>{selected ? selected.firstName.slice(0,1).toUpperCase() : <Icon name="plus" size={16}/>}<small>{selected ? selected.firstName : 'OPEN'}</small></span>; })}</div><div className="security-invite-form"><input value={securityCode} onChange={(e)=>setSecurityCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))} placeholder={language === 'ko' ? '캡틴 코드 8자리' : '8-DIGIT CAPTAIN CODE'}/><input value={securityNote} onChange={(e)=>setSecurityNote(e.target.value.slice(0,240))} placeholder={language === 'ko' ? '초대 메시지 (선택)' : 'Invitation message (optional)'}/><button onClick={inviteSecurityMember}><Icon name="shield" size={16}/>{language === 'ko' ? '보안 서클 초대' : 'INVITE'}</button></div><div className="security-invites">{(security?.incoming || []).map((invite)=><article key={invite.id}><span><b>{invite.fromName}</b><small>{invite.message || (language === 'ko' ? '보안 서클 초대' : 'Security Circle invitation')}</small></span><button onClick={()=>respondSecurityInvite(invite.id,'accept')}>ACCEPT</button><button onClick={()=>respondSecurityInvite(invite.id,'reject')}>DECLINE</button></article>)}{(security?.outgoing || []).map((invite)=><article key={invite.id}><span><b>{invite.toName}</b><small>{language === 'ko' ? '승인 대기 중' : 'Awaiting approval'}</small></span></article>)}</div><div className="security-messages"><select value={securityTarget} onChange={(e)=>setSecurityTarget(e.target.value)}><option value="">{language === 'ko' ? '보안 서클 멤버 선택' : 'Select a Circle member'}</option>{(security?.members || []).map((member)=><option value={member.id} key={member.id}>{member.firstName}{member.kycVerified ? ' · KYC' : ''}</option>)}</select><input value={securityMessage} onChange={(e)=>setSecurityMessage(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')sendSecurityMessage()}} placeholder={language === 'ko' ? '선택한 멤버에게 보안 메시지 보내기' : 'Send a secure message'}/><button onClick={sendSecurityMessage}><Icon name="arrow"/></button><div>{(security?.messages || []).filter((item)=>!securityTarget || item.fromUserId===securityTarget || item.toUserId===securityTarget).slice(-8).map((item)=><p key={item.id}><b>{item.fromName}</b> {item.message}</p>)}</div></div></div>}
    {view === 'league' && <div className="fleet-league"><div className="league-prizes"><span><b>#1</b><strong>+10 SPNX</strong><small>{leagueText.everyMember}</small></span><span><b>#2</b><strong>+5 SPNX</strong><small>{leagueText.everyMember}</small></span><span><b>#3</b><strong>+3 SPNX</strong><small>{leagueText.everyMember}</small></span></div><div className="league-summary"><span><small>{leagueText.weeklyScore}</small><b>{Number(fleet?.weeklyScore || 0).toLocaleString()}</b></span><span><small>{leagueText.fleetRank}</small><b>{fleet?.weeklyRank ? `#${fleet.weeklyRank}` : leagueText.unranked}</b></span></div><div className="league-ranking">{(fleet?.ranking || []).slice(0,10).map((row,index) => <article key={row.captainId}><em>#{index+1}</em><span><b>{row.captainName}</b><small>{row.members} {leagueText.members}</small></span><strong>{Number(row.score).toLocaleString()}</strong></article>)}</div><p className="league-policy">{leagueText.settlement}</p></div>}
    <div className="fleet-policy"><Icon name="shield"/><div><b>{leagueText.policyTitle}</b><p>{leagueText.policyBody}</p></div></div>
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

function Wallet({ user, setUser, t, language, initialPanel = 'overview' }) {
  const w = WALLET_COPY[language] || WALLET_COPY.en;
  const wu = WALLET_UI_COPY[language] || WALLET_UI_COPY.en;
  const liveMining = useLiveMiningView(user);
  const livePointsBalance = liveMining.displayBalance;
  const [wallet, setWallet] = useState(user.solanaWallet || '');
  const [notice, setNotice] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [walletSecurity, setWalletSecurity] = useState(null);
  const [walletPin, setWalletPin] = useState('');
  const [walletPinConfirm, setWalletPinConfirm] = useState('');
  const [walletPinStep, setWalletPinStep] = useState('create');
  const [walletLocked, setWalletLocked] = useState(true);
  const [walletBusy, setWalletBusy] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [walletAsset, setWalletAsset] = useState('SPNX');
  const [walletPanel, setWalletPanel] = useState(initialPanel);
  useEffect(() => { api('/api/nova-wallet/status', { method: 'POST', body: {} }).then((data) => setWalletSecurity(data.security)).catch(() => {}); }, []);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const supported = Boolean(window.PublicKeyCredential && navigator.credentials?.create && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.());
        if (active) setBiometricSupported(supported);
      } catch { if (active) setBiometricSupported(false); }
    };
    check(); return () => { active = false; };
  }, []);
  useEffect(() => { setWalletPanel(initialPanel); }, [initialPanel]);
  useEffect(() => { const lock = () => setWalletLocked(true); const hidden = () => { if (document.hidden) lock(); }; document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', lock); return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', lock); }; }, []);
  const isPinSetup = !walletSecurity?.pinConfigured;
  const activePin = isPinSetup && walletPinStep === 'confirm' ? walletPinConfirm : walletPin;
  const setActivePin = (next) => isPinSetup && walletPinStep === 'confirm' ? setWalletPinConfirm(next) : setWalletPin(next);
  function pressWalletPin(key) {
    setActivePin(key === 'CLEAR' ? '' : key === '⌫' ? activePin.slice(0, -1) : activePin.length < 6 ? activePin + key : activePin);
  }
  async function unlockNOVAWallet() {
    if (isPinSetup && walletPinStep === 'create') {
      if (walletPin.length !== 6) return setNotice('Enter all six PIN digits first.');
      setWalletPinStep('confirm'); setWalletPinConfirm(''); setNotice('Re-enter the same six digits to confirm your PIN.'); return;
    }
    if (isPinSetup && walletPin !== walletPinConfirm) {
      setWalletPin(''); setWalletPinConfirm(''); setWalletPinStep('create'); setNotice('PINs did not match. Create your six-digit PIN again.'); return;
    }
    setWalletBusy(true);
    try {
      const endpoint = walletSecurity?.pinConfigured ? '/api/nova-wallet/pin/unlock' : '/api/nova-wallet/pin/setup';
      const data = await api(endpoint, { method: 'POST', body: { pin: activePin } });
      setWalletSecurity(data.security); setWalletPin(''); setWalletPinConfirm(''); setWalletPinStep('create'); setWalletLocked(false); setNotice('NOVA Wallet security verified.');
    } catch (error) { setNotice(error.message); } finally { setWalletBusy(false); }
  }
  async function requestWalletRecovery() {
    try {
      const data = await api('/api/nova-wallet/recovery/request', { method: 'POST', body: {} });
      const ready = new Date(data.recoveryAvailableAt).toLocaleString();
      setNotice('Recovery protection started. You can create a new Wallet security profile after ' + ready + '. Keep your PIN and recovery access safe.');
    } catch (error) { setNotice(error.message); }
  }
  function webauthnBytes(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  function webauthnText(value) {
    const bytes = new Uint8Array(value); let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function registrationOptionsForBrowser(options) {
    return { ...options, challenge: webauthnBytes(options.challenge), user: { ...options.user, id: webauthnBytes(options.user.id) }, excludeCredentials: (options.excludeCredentials || []).map((credential) => ({ ...credential, id: webauthnBytes(credential.id) })) };
  }
  function authenticationOptionsForBrowser(options) {
    return { ...options, challenge: webauthnBytes(options.challenge), allowCredentials: (options.allowCredentials || []).map((credential) => ({ ...credential, id: webauthnBytes(credential.id) })) };
  }
  function registrationResponseJSON(credential) {
    return { id: credential.id, rawId: webauthnText(credential.rawId), type: credential.type, clientExtensionResults: credential.getClientExtensionResults?.() || {}, response: { attestationObject: webauthnText(credential.response.attestationObject), clientDataJSON: webauthnText(credential.response.clientDataJSON), transports: credential.response.getTransports?.() || [] } };
  }
  function authenticationResponseJSON(credential) {
    return { id: credential.id, rawId: webauthnText(credential.rawId), type: credential.type, clientExtensionResults: credential.getClientExtensionResults?.() || {}, response: { authenticatorData: webauthnText(credential.response.authenticatorData), clientDataJSON: webauthnText(credential.response.clientDataJSON), signature: webauthnText(credential.response.signature), userHandle: credential.response.userHandle ? webauthnText(credential.response.userHandle) : undefined } };
  }
  async function registerWalletBiometric() {
    if (!biometricSupported) return setNotice('This device does not provide supported Face ID or fingerprint authentication. Your PIN remains available.');
    setBiometricBusy(true); setNotice('');
    try {
      const begin = await api('/api/nova-wallet/biometric/register/options', { method: 'POST', body: {} });
      const credential = await navigator.credentials.create({ publicKey: registrationOptionsForBrowser(begin.options) });
      if (!credential) throw new Error('Device biometric registration was cancelled.');
      const data = await api('/api/nova-wallet/biometric/register/verify', { method: 'POST', body: { challengeId: begin.challengeId, response: registrationResponseJSON(credential) } });
      setWalletSecurity(data.security); setNotice('Device biometric access is registered. You may use Face ID or fingerprint instead of PIN on this device.');
    } catch (error) { setNotice(error.message || 'Device biometric registration was not completed.'); } finally { setBiometricBusy(false); }
  }
  async function unlockWalletWithBiometric() {
    if (!biometricSupported) return setNotice('This device does not provide supported Face ID or fingerprint authentication. Use your PIN.');
    setBiometricBusy(true); setNotice('');
    try {
      const begin = await api('/api/nova-wallet/biometric/authenticate/options', { method: 'POST', body: {} });
      const credential = await navigator.credentials.get({ publicKey: authenticationOptionsForBrowser(begin.options) });
      if (!credential) throw new Error('Device biometric authentication was cancelled.');
      const data = await api('/api/nova-wallet/biometric/authenticate/verify', { method: 'POST', body: { challengeId: begin.challengeId, response: authenticationResponseJSON(credential) } });
      setWalletSecurity(data.security); setWalletLocked(false); setNotice('NOVA Wallet opened with device biometrics.');
    } catch (error) { setNotice(error.message || 'Device biometric authentication was not completed. Use your PIN.'); } finally { setBiometricBusy(false); }
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
  if (walletLocked) return <main className="v15-page"><section className="command-card ops-module wallet-theme nova-wallet-onboarding">
    <div className="wallet-security-scan"/><div className="section-heading"><div><small>{wu.genesis}</small><h2>{walletSecurity?.pinConfigured ? wu.unlock : wu.initialize}</h2></div><span className="secure-label"><Icon name="shield" size={17}/>{wu.secure}</span></div>
    <p className="wallet-onboard-lead">{walletSecurity?.pinConfigured ? wu.enterPin : walletPinStep === 'confirm' ? wu.reenterPin : wu.createPin}</p>
    <div className="wallet-onboard-grid">
      <div className="wallet-pin-console"><small>{walletSecurity?.pinConfigured ? wu.securityKey : walletPinStep === 'confirm' ? wu.confirmKey : wu.createKey}</small><label>{walletSecurity?.pinConfigured ? wu.unlockLabel : walletPinStep === 'confirm' ? wu.confirmLabel : wu.createLabel}</label><input inputMode="numeric" type="password" maxLength="6" value={activePin} onChange={(e) => setActivePin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••"/>
        <div className="wallet-pin-slots">{Array.from({ length: 6 }, (_, index) => <i key={index} className={activePin[index] ? 'filled' : ''}>{activePin[index] ? '•' : ''}</i>)}</div>
        {isPinSetup && <div className="wallet-pin-stage"><i className={walletPinStep === 'create' ? 'active' : ''}>1</i><span/><i className={walletPinStep === 'confirm' ? 'active' : ''}>2</i><b>{walletPinStep === 'confirm' ? wu.confirmStage : wu.createStage}</b></div>}
        <div className="wallet-pin-keypad">{['1','2','3','4','5','6','7','8','9','CLEAR','0','⌫'].map((key) => <button key={key} type="button" className={key === 'CLEAR' ? 'clear' : key === '⌫' ? 'back' : ''} onClick={() => pressWalletPin(key)}>{key === 'CLEAR' ? wu.clear : key}</button>)}</div>
        <button className="wallet-primary-launch" disabled={walletBusy || activePin.length !== 6} onClick={unlockNOVAWallet}><Icon name="shield"/>{walletBusy ? wu.verifying : walletSecurity?.pinConfigured ? wu.unlockLabel : walletPinStep === 'confirm' ? wu.activate : wu.continue}</button>
        {walletSecurity?.biometricAvailable && <button className="wallet-biometric-launch" disabled={biometricBusy} onClick={unlockWalletWithBiometric}><Icon name="shield"/>{biometricBusy ? wu.verifying : wu.biometric}</button>}
      </div>
      <aside className="wallet-genesis-preview"><small>{wu.walletEcosystem}</small><div><Icon name="wallet" size={28}/><b>SPNX Points</b><span>{wu.activeLedger}</span></div><div><Icon name="mission" size={28}/><b>NOVA NFT Vault</b><span>{wu.coming}</span></div><p>{wu.kycInfo}</p></aside>
    </div>
    <div className="wallet-recovery-row"><div><Icon name="shield"/><span><b>{wu.keepPin}</b><small>{wu.recoveryInfo}</small></span></div><button className="wallet-recovery-link" onClick={requestWalletRecovery}>{wu.forgot}</button></div>{notice && <p className="module-notice">{notice}</p>}
  </section></main>;
  return <main className="v15-page"><section className="command-card ops-module wallet-theme nova-wallet-shell">
    <div className="section-heading"><div><small>NOVA WALLET · {w.assets.toUpperCase()}</small><h2>NOVA Wallet</h2></div><button className="secure-label" onClick={() => setWalletLocked(true)}><Icon name="shield" size={17}/>{wu.lockedSession}</button></div>
    <div className="nova-wallet-hero"><div><small>{w.portfolio.toUpperCase()} · LIVE SPNX POINTS LEDGER</small><strong>{format(livePointsBalance)} <em>SPNX POINTS</em></strong><p>Live mining, mission and verified game credits settle here through your Captain ledger. KYC is required only when official SPNX conversion launches.</p></div><div className="nova-wallet-orb">✦<span>SECURE</span></div></div>
    <div className="nova-asset-grid">
      {[['SPNX','0.000000',w.coming],['USDT','0.00',w.coming]].map(([name,value,status]) => <button key={name} className={'nova-asset-card ' + (walletAsset === name ? 'selected' : '')} onClick={() => setWalletAsset(name)}><span className={'asset-emblem ' + (name === 'SPNX' ? 'spnx' : 'usdt')}>{name === 'SPNX' ? <img src="/brand/spacenovax-symbol.jpg" alt="SPNX" /> : '₮'}</span><small>{name}</small><b>{value}</b><i>{status}</i></button>)}
      <button className="nova-asset-card spnx-convert-card" onClick={() => setWalletPanel('convert')}><span className="asset-emblem points">✦</span><small>SPNX POINTS</small><b>LIVE LEDGER</b><i className="active">{format(livePointsBalance)} LIVE</i><strong>POINTS → SPNX <Icon name="arrow" size={14}/></strong></button>
    </div>
    <div className="nova-wallet-actions">
      <button className={walletPanel === 'receive' ? 'selected' : ''} onClick={() => setWalletPanel('receive')}><Icon name="arrow-down"/>{wu.receive} <small>{wu.rewardsOnly}</small></button>
      <button className={walletPanel === 'send' ? 'selected' : ''} onClick={() => setWalletPanel('send')}><Icon name="arrow-up"/>{wu.send} <small>{wu.kycGated}</small></button>
      <button className={walletPanel === 'history' ? 'selected' : ''} onClick={() => setWalletPanel('history')}><Icon name="chart"/>{wu.history} <small>{wu.serverLedger}</small></button>
      <button className={walletPanel === 'swap' ? 'selected swap-command' : 'swap-command'} onClick={() => setWalletPanel('swap')}><Icon name="bolt"/>{wu.swap} <small>{wu.kycGated}</small></button>
      <button className={walletPanel === 'nft' ? 'selected nft-command' : 'nft-command'} onClick={() => setWalletPanel('nft')}><Icon name="mission"/>{wu.nft} <small>{wu.insideWallet}</small></button>
      <button className={walletPanel === 'security' ? 'selected' : ''} onClick={() => setWalletPanel('security')}><Icon name="shield"/>{wu.security} <small>{wu.pinProtected}</small></button>
    </div>
    <section className="nova-wallet-operation">
      {walletPanel === 'overview' && <><small>WALLET COMMAND DECK</small><b>Choose an action to manage your NOVA Wallet.</b><p>Every asset, transfer request and security action is recorded through the server-authoritative SpaceNovaX ledger.</p></>}
      {walletPanel === 'receive' && <><small>RECEIVE · REWARD LEDGER</small><b>SPNX Points are credited only by verified SpaceNovaX rewards.</b><p>Mining, mission and verified game rewards are automatically recorded in your live balance. External deposits are not enabled.</p></>}
      {walletPanel === 'send' && <><small>SEND · SECURITY GATE</small><b>KYC approval is required before any transfer can be opened.</b><p>After KYC launch, sending will require PIN confirmation and server-side risk validation. No asset can leave this Wallet before that approval.</p></>}
      {walletPanel === 'history' && <><small>HISTORY · SERVER LEDGER</small><b>Your settled SPNX Points activity is protected on the server.</b><p>Mining, mission and game settlements appear in the activity ledger. Live token transactions will be added only after official asset activation.</p></>}
      {walletPanel === 'security' && <><small>SECURITY CENTER</small><b>{walletSecurity?.biometricAvailable ? 'Device biometric access is registered for this Wallet.' : 'Your Wallet is protected with a six-digit PIN.'}</b><p>PIN or registered device biometrics can open the Wallet. Biometrics stay on your device; SpaceNovaX stores only a verification public key. Never share a seed phrase, private key or PIN with anyone.</p>{!walletSecurity?.biometricAvailable && <button className="wallet-security-action" disabled={biometricBusy || !biometricSupported} onClick={registerWalletBiometric}><Icon name="shield"/>{biometricBusy ? 'REGISTERING DEVICE…' : biometricSupported ? 'REGISTER FACE ID / FINGERPRINT' : 'DEVICE BIOMETRICS NOT AVAILABLE'}</button>}<button className="wallet-security-action" onClick={() => setWalletLocked(true)}><Icon name="shield"/>LOCK NOVA WALLET NOW</button></>}
      {walletPanel === 'swap' && <><small>SWAP · KYC SECURITY GATE</small><b>SPNX swap will activate only after KYC approval and official live-asset release.</b><p>Before then, no exchange rate, liquidity, quote or transfer can be executed. The final Swap flow will require PIN reconfirmation, KYC status, server validation and a signed transaction.</p></>}
      {walletPanel === 'convert' && <><small>SPNX POINTS → SPNX · KYC SECURITY GATE</small><b>Your live SPNX Points balance will be eligible for conversion only after KYC approval and the official SPNX launch.</b><p>No conversion rate, token issuance, balance reduction or transaction is executed today. When activation is announced, this command will require KYC, PIN re-authentication, server validation and an auditable conversion record.</p><button className="wallet-security-action" disabled><Icon name="shield"/>KYC & TOKEN LAUNCH REQUIRED</button></>}
      {walletPanel === 'nft' && <><small>NOVA NFT VAULT · INSIDE NOVA WALLET</small><b>Your future collectibles, mission badges and game assets will live here.</b><p>The NFT Vault belongs inside NOVA Wallet. Minting, transfers and Marketplace trading remain disabled until the official network and KYC release.</p></>}
    </section>
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

const NODE_GUIDE_COPY = {
  en:{title:'Node User Guide',hub:'Node Hub',safe:'READ-ONLY SECURITY',intro:'The node assists only with public cache, service monitoring and SHA-256 verification. It cannot access balances, wallets, KYC or administration.',download:'Download and extract',downloadText:'Download the ZIP on a Windows 10/11 PC and extract all files. Node.js is not required.',pair:'Issue a pairing code',pairText:'In the app, open More → Community Node and issue a one-time code. It is valid for 10 minutes.',run:'Run the node',runText:'Double-click SpaceNovaX_Node.exe and enter the code once. Keep the console window open.',verify:'Confirm operation',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED and SHA-256 VERIFIED mean that the node is running normally.',bonus:'Mining speed +25%',bonusText:'The first valid heartbeat activates +25% immediately. Closing the node pauses it after about two minutes; reconnection restores it.',alerts:'Status notifications',alertsText:'Online, offline and recovery notices are delivered to the in-app inbox and the linked Telegram account.',reset:'Reset pairing',resetText:'To move to another PC, stop the node and run RESET_NODE_PAIRING.cmd. Never share node-config.json.',security:'Security warning',securityText:'Never enter a wallet seed phrase, private key, app JWT, database password or Telegram login code.',action:'ISSUE PAIRING CODE IN APP'},
  ko:{title:'노드 상세 사용 방법',hub:'노드 허브',safe:'읽기 전용 보안 노드',intro:'노드는 공개 캐시, 서비스 상태 확인, SHA-256 검증만 보조합니다. 잔액·지갑·KYC·관리자 데이터에는 접근할 수 없습니다.',download:'다운로드 및 압축 해제',downloadText:'Windows 10/11 PC에서 ZIP을 내려받고 모든 파일의 압축을 풉니다. Node.js는 필요하지 않습니다.',pair:'페어링 코드 발급',pairText:'앱의 더보기 → 커뮤니티 노드에서 10분간 유효한 1회용 코드를 발급합니다.',run:'노드 실행',runText:'SpaceNovaX_Node.exe를 더블클릭하고 코드를 최초 한 번 입력합니다. 실행 창을 계속 열어둡니다.',verify:'구동 상태 확인',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED, SHA-256 VERIFIED가 표시되면 정상 구동 중입니다.',bonus:'채굴 속도 +25%',bonusText:'첫 정상 Heartbeat부터 즉시 +25%가 적용됩니다. 창을 닫으면 약 2분 뒤 중지되고 재연결하면 복구됩니다.',alerts:'상태 알림',alertsText:'구동·중단·복구 상태는 앱 개인 쪽지와 연결된 텔레그램 계정으로 안내됩니다.',reset:'페어링 초기화',resetText:'다른 PC로 옮길 때 노드를 종료하고 RESET_NODE_PAIRING.cmd를 실행합니다. node-config.json은 공유하지 마세요.',security:'보안 주의사항',securityText:'지갑 시드 문구, 개인키, 앱 JWT, DB 비밀번호, 텔레그램 로그인 코드는 절대 입력하지 마세요.',action:'앱에서 페어링 코드 발급'},
  ja:{title:'ノード詳細使用ガイド',hub:'ノードハブ',safe:'読み取り専用セキュリティ',intro:'ノードは公開キャッシュ、サービス監視、SHA-256検証のみを支援します。残高、ウォレット、KYC、管理機能にはアクセスできません。',download:'ダウンロードと展開',downloadText:'Windows 10/11でZIPをダウンロードし、すべてのファイルを展開します。Node.jsは不要です。',pair:'ペアリングコード発行',pairText:'アプリの「その他→コミュニティノード」で10分間有効なワンタイムコードを発行します。',run:'ノードを実行',runText:'SpaceNovaX_Node.exeをダブルクリックし、初回のみコードを入力します。コンソールを開いたままにします。',verify:'稼働確認',verifyText:'NODE ONLINE、HEARTBEAT VERIFIED、SHA-256 VERIFIEDが表示されれば正常です。',bonus:'採掘速度+25%',bonusText:'最初の正常なHeartbeatで即時有効になります。終了後約2分で停止し、再接続で復旧します。',alerts:'状態通知',alertsText:'開始、停止、復旧はアプリ内メッセージと連携Telegramへ通知されます。',reset:'ペアリング解除',resetText:'別のPCへ移す場合は終了後RESET_NODE_PAIRING.cmdを実行します。node-config.jsonを共有しないでください。',security:'セキュリティ警告',securityText:'シードフレーズ、秘密鍵、JWT、DBパスワード、Telegramログインコードは入力しないでください。',action:'アプリでコードを発行'},
  zh:{title:'节点详细使用指南',hub:'节点中心',safe:'只读安全节点',intro:'节点仅协助公共缓存、服务监控和SHA-256验证，无法访问余额、钱包、KYC或管理数据。',download:'下载并解压',downloadText:'在Windows 10/11电脑下载ZIP并解压全部文件，无需安装Node.js。',pair:'获取配对码',pairText:'在应用“更多→社区节点”生成有效期10分钟的一次性配对码。',run:'运行节点',runText:'双击SpaceNovaX_Node.exe，首次输入配对码，并保持窗口开启。',verify:'确认运行',verifyText:'出现NODE ONLINE、HEARTBEAT VERIFIED和SHA-256 VERIFIED即表示正常。',bonus:'挖矿速度+25%',bonusText:'首次有效心跳立即启用+25%。关闭约两分钟后暂停，重新连接后恢复。',alerts:'状态通知',alertsText:'上线、离线和恢复通知将发送到应用私信及绑定的Telegram。',reset:'重置配对',resetText:'迁移电脑时先停止节点，再运行RESET_NODE_PAIRING.cmd。切勿分享node-config.json。',security:'安全警告',securityText:'切勿输入钱包助记词、私钥、应用JWT、数据库密码或Telegram登录码。',action:'在应用中获取配对码'},
  es:{title:'Guía detallada del nodo',hub:'Centro de nodos',safe:'SEGURIDAD DE SOLO LECTURA',intro:'El nodo solo ayuda con caché pública, supervisión y verificación SHA-256. No accede a saldos, billeteras, KYC ni administración.',download:'Descargar y extraer',downloadText:'Descarga el ZIP en Windows 10/11 y extrae todos los archivos. No necesitas Node.js.',pair:'Obtener código de enlace',pairText:'En Más → Nodo comunitario, genera un código de un solo uso válido durante 10 minutos.',run:'Ejecutar el nodo',runText:'Abre SpaceNovaX_Node.exe, introduce el código una vez y mantén abierta la consola.',verify:'Confirmar funcionamiento',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED y SHA-256 VERIFIED indican funcionamiento normal.',bonus:'Velocidad de minería +25%',bonusText:'El primer latido válido activa +25%. Al cerrar, se pausa tras unos dos minutos y vuelve al reconectar.',alerts:'Notificaciones',alertsText:'Los avisos de conexión, desconexión y recuperación llegan a la app y Telegram vinculado.',reset:'Restablecer enlace',resetText:'Para cambiar de PC, detén el nodo y ejecuta RESET_NODE_PAIRING.cmd. No compartas node-config.json.',security:'Aviso de seguridad',securityText:'Nunca introduzcas frase semilla, clave privada, JWT, contraseña de base de datos ni código de Telegram.',action:'OBTENER CÓDIGO EN LA APP'},
  pt:{title:'Guia detalhado do nó',hub:'Central do nó',safe:'SEGURANÇA SOMENTE LEITURA',intro:'O nó auxilia apenas cache público, monitoramento e verificação SHA-256. Não acessa saldos, carteiras, KYC ou administração.',download:'Baixar e extrair',downloadText:'Baixe o ZIP no Windows 10/11 e extraia todos os arquivos. Node.js não é necessário.',pair:'Emitir código de pareamento',pairText:'Em Mais → Nó da comunidade, emita um código único válido por 10 minutos.',run:'Executar o nó',runText:'Abra SpaceNovaX_Node.exe, digite o código uma vez e mantenha o console aberto.',verify:'Confirmar operação',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED e SHA-256 VERIFIED indicam operação normal.',bonus:'Velocidade de mineração +25%',bonusText:'O primeiro Heartbeat válido ativa +25%. Ao fechar, pausa após cerca de dois minutos e retorna ao reconectar.',alerts:'Notificações',alertsText:'Avisos de início, interrupção e recuperação chegam à caixa do app e ao Telegram vinculado.',reset:'Redefinir pareamento',resetText:'Para mudar de PC, pare o nó e execute RESET_NODE_PAIRING.cmd. Não compartilhe node-config.json.',security:'Aviso de segurança',securityText:'Nunca informe frase-semente, chave privada, JWT, senha do banco ou código de login do Telegram.',action:'EMITIR CÓDIGO NO APP'},
  de:{title:'Ausführliche Node-Anleitung',hub:'Node-Zentrale',safe:'SCHREIBGESCHÜTZTE SICHERHEIT',intro:'Der Node unterstützt nur öffentlichen Cache, Überwachung und SHA-256-Prüfung. Kein Zugriff auf Guthaben, Wallet, KYC oder Verwaltung.',download:'Herunterladen und entpacken',downloadText:'ZIP unter Windows 10/11 laden und vollständig entpacken. Node.js ist nicht erforderlich.',pair:'Kopplungscode erzeugen',pairText:'Unter Mehr → Community-Node einen einmaligen, 10 Minuten gültigen Code erzeugen.',run:'Node starten',runText:'SpaceNovaX_Node.exe doppelklicken, Code einmal eingeben und das Fenster geöffnet lassen.',verify:'Betrieb prüfen',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED und SHA-256 VERIFIED bestätigen den normalen Betrieb.',bonus:'Mining-Geschwindigkeit +25%',bonusText:'Der erste gültige Heartbeat aktiviert +25%. Nach dem Schließen pausiert es nach etwa zwei Minuten und kehrt bei Verbindung zurück.',alerts:'Statusmeldungen',alertsText:'Online-, Offline- und Wiederherstellungsmeldungen kommen im App-Postfach und verbundenen Telegram an.',reset:'Kopplung zurücksetzen',resetText:'Vor PC-Wechsel Node stoppen und RESET_NODE_PAIRING.cmd ausführen. node-config.json niemals teilen.',security:'Sicherheitshinweis',securityText:'Niemals Seed-Phrase, privaten Schlüssel, JWT, DB-Passwort oder Telegram-Anmeldecode eingeben.',action:'KOPPLUNGSCODE ERZEUGEN'},
  fr:{title:'Guide détaillé du nœud',hub:'Centre des nœuds',safe:'SÉCURITÉ EN LECTURE SEULE',intro:'Le nœud aide uniquement au cache public, à la surveillance et à la vérification SHA-256. Aucun accès aux soldes, portefeuilles, KYC ou administration.',download:'Télécharger et extraire',downloadText:'Téléchargez le ZIP sous Windows 10/11 et extrayez tous les fichiers. Node.js est inutile.',pair:'Créer un code de jumelage',pairText:'Dans Plus → Nœud communautaire, créez un code unique valable 10 minutes.',run:'Lancer le nœud',runText:'Ouvrez SpaceNovaX_Node.exe, saisissez le code une fois et gardez la console ouverte.',verify:'Vérifier le fonctionnement',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED et SHA-256 VERIFIED confirment le fonctionnement normal.',bonus:'Vitesse de minage +25%',bonusText:'Le premier Heartbeat valide active +25%. La fermeture le suspend après environ deux minutes; la reconnexion le restaure.',alerts:'Notifications',alertsText:'Les alertes de connexion, arrêt et reprise arrivent dans l’application et sur Telegram lié.',reset:'Réinitialiser le jumelage',resetText:'Pour changer de PC, arrêtez le nœud puis lancez RESET_NODE_PAIRING.cmd. Ne partagez jamais node-config.json.',security:'Avertissement de sécurité',securityText:'Ne saisissez jamais phrase de récupération, clé privée, JWT, mot de passe DB ou code Telegram.',action:'CRÉER LE CODE DANS L’APP'},
  ru:{title:'Подробное руководство узла',hub:'Центр узлов',safe:'БЕЗОПАСНОСТЬ ТОЛЬКО ДЛЯ ЧТЕНИЯ',intro:'Узел выполняет только публичное кэширование, мониторинг и проверку SHA-256. Доступа к балансу, кошельку, KYC и управлению нет.',download:'Скачать и распаковать',downloadText:'Скачайте ZIP на Windows 10/11 и распакуйте все файлы. Node.js не требуется.',pair:'Получить код привязки',pairText:'В разделе Ещё → Узел сообщества создайте одноразовый код на 10 минут.',run:'Запустить узел',runText:'Откройте SpaceNovaX_Node.exe, один раз введите код и оставьте консоль открытой.',verify:'Проверить работу',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED и SHA-256 VERIFIED означают нормальную работу.',bonus:'Скорость майнинга +25%',bonusText:'Первый корректный Heartbeat сразу включает +25%. После закрытия бонус приостанавливается примерно через две минуты и восстанавливается при подключении.',alerts:'Уведомления',alertsText:'Сообщения о запуске, остановке и восстановлении приходят в приложение и привязанный Telegram.',reset:'Сбросить привязку',resetText:'Для переноса на другой ПК остановите узел и запустите RESET_NODE_PAIRING.cmd. Не передавайте node-config.json.',security:'Предупреждение',securityText:'Никогда не вводите seed-фразу, приватный ключ, JWT, пароль БД или код входа Telegram.',action:'ПОЛУЧИТЬ КОД В ПРИЛОЖЕНИИ'},
  vi:{title:'Hướng dẫn nút chi tiết',hub:'Trung tâm nút',safe:'BẢO MẬT CHỈ ĐỌC',intro:'Nút chỉ hỗ trợ bộ nhớ đệm công khai, giám sát và xác minh SHA-256; không truy cập số dư, ví, KYC hay quản trị.',download:'Tải xuống và giải nén',downloadText:'Tải ZIP trên Windows 10/11 và giải nén toàn bộ. Không cần cài Node.js.',pair:'Cấp mã ghép nối',pairText:'Trong Thêm → Nút cộng đồng, cấp mã dùng một lần có hiệu lực 10 phút.',run:'Chạy nút',runText:'Mở SpaceNovaX_Node.exe, nhập mã một lần và giữ cửa sổ bảng điều khiển mở.',verify:'Xác nhận hoạt động',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED và SHA-256 VERIFIED nghĩa là nút hoạt động bình thường.',bonus:'Tốc độ khai thác +25%',bonusText:'Heartbeat hợp lệ đầu tiên kích hoạt +25% ngay. Đóng nút sẽ tạm dừng sau khoảng hai phút và khôi phục khi kết nối lại.',alerts:'Thông báo trạng thái',alertsText:'Thông báo trực tuyến, ngoại tuyến và khôi phục được gửi tới hộp thư ứng dụng và Telegram đã liên kết.',reset:'Đặt lại ghép nối',resetText:'Khi chuyển PC, dừng nút rồi chạy RESET_NODE_PAIRING.cmd. Không chia sẻ node-config.json.',security:'Cảnh báo bảo mật',securityText:'Không nhập cụm từ hạt giống, khóa riêng, JWT, mật khẩu DB hoặc mã đăng nhập Telegram.',action:'CẤP MÃ TRONG ỨNG DỤNG'},
  id:{title:'Panduan lengkap node',hub:'Pusat node',safe:'KEAMANAN HANYA-BACA',intro:'Node hanya membantu cache publik, pemantauan, dan verifikasi SHA-256. Node tidak mengakses saldo, dompet, KYC, atau administrasi.',download:'Unduh dan ekstrak',downloadText:'Unduh ZIP di Windows 10/11 lalu ekstrak semua berkas. Node.js tidak diperlukan.',pair:'Terbitkan kode pairing',pairText:'Di Lainnya → Node Komunitas, terbitkan kode sekali pakai yang berlaku 10 menit.',run:'Jalankan node',runText:'Klik dua kali SpaceNovaX_Node.exe, masukkan kode sekali, dan biarkan konsol terbuka.',verify:'Pastikan operasi',verifyText:'NODE ONLINE, HEARTBEAT VERIFIED, dan SHA-256 VERIFIED menandakan operasi normal.',bonus:'Kecepatan mining +25%',bonusText:'Heartbeat valid pertama langsung mengaktifkan +25%. Setelah ditutup, bonus berhenti sekitar dua menit kemudian dan pulih saat tersambung kembali.',alerts:'Notifikasi status',alertsText:'Notifikasi online, offline, dan pemulihan dikirim ke kotak pesan aplikasi dan Telegram tertaut.',reset:'Atur ulang pairing',resetText:'Untuk pindah PC, hentikan node lalu jalankan RESET_NODE_PAIRING.cmd. Jangan bagikan node-config.json.',security:'Peringatan keamanan',securityText:'Jangan pernah masukkan seed phrase, kunci privat, JWT, sandi DB, atau kode login Telegram.',action:'TERBITKAN KODE DI APLIKASI'},
  ar:{title:'دليل استخدام العقدة بالتفصيل',hub:'مركز العقدة',safe:'أمان للقراءة فقط',intro:'تساعد العقدة فقط في التخزين المؤقت العام والمراقبة والتحقق من SHA-256، ولا تصل إلى الرصيد أو المحفظة أو KYC أو الإدارة.',download:'التنزيل وفك الضغط',downloadText:'نزّل ملف ZIP على Windows 10/11 واستخرج جميع الملفات. لا يلزم تثبيت Node.js.',pair:'إصدار رمز الاقتران',pairText:'من المزيد ← عقدة المجتمع، أصدر رمزاً لمرة واحدة صالحاً لمدة 10 دقائق.',run:'تشغيل العقدة',runText:'شغّل SpaceNovaX_Node.exe وأدخل الرمز مرة واحدة واترك نافذة التشغيل مفتوحة.',verify:'تأكيد التشغيل',verifyText:'ظهور NODE ONLINE وHEARTBEAT VERIFIED وSHA-256 VERIFIED يعني أن العقدة تعمل بشكل طبيعي.',bonus:'سرعة التعدين +25%',bonusText:'أول Heartbeat صالح يفعّل +25% فوراً. عند الإغلاق تتوقف بعد نحو دقيقتين وتعود عند إعادة الاتصال.',alerts:'إشعارات الحالة',alertsText:'تصل إشعارات التشغيل والتوقف والاستعادة إلى صندوق التطبيق وحساب Telegram المرتبط.',reset:'إعادة ضبط الاقتران',resetText:'لنقل العقدة إلى جهاز آخر، أوقفها وشغّل RESET_NODE_PAIRING.cmd. لا تشارك node-config.json.',security:'تحذير أمني',securityText:'لا تدخل أبداً عبارة الاسترداد أو المفتاح الخاص أو JWT أو كلمة مرور قاعدة البيانات أو رمز Telegram.',action:'إصدار رمز الاقتران من التطبيق'}
};

function NodeSetup({ language, setTab }) {
  const n = NODE_GUIDE_COPY[language] || NODE_GUIDE_COPY.en;
  const download = 'https://github.com/spacenovax/spacenovax-v2/releases/download/node-v1.0.0/Genesis_Community_Node_V1_Standalone_2026-08-08.zip';
  const steps=[[n.download,n.downloadText],[n.pair,n.pairText],[n.run,n.runText],[n.verify,n.verifyText],[n.bonus,n.bonusText],[n.alerts,n.alertsText],[n.reset,n.resetText],[n.security,n.securityText]];
  return <main className="v15-page" dir={language === 'ar' ? 'rtl' : 'ltr'}><section className="command-card ops-module node-module node-setup-module">
    <div className="section-heading"><div><small>GENESIS COMMUNITY NODE · V1</small><h2>{n.title}</h2></div><button className="node-back" onClick={() => setTab('nodes')}><Icon name="arrow" size={16}/>{n.hub}</button></div>
    <section className="node-hero"><div><small>{n.safe}</small><strong>SAFE BY DESIGN</strong><p>{n.intro}</p></div><Icon name="shield" size={58}/></section>
    <section className="node-install-grid">
      {steps.map(([title,text],index)=><article key={title}><b>{String(index+1).padStart(2,'0')}</b><h3>{title}</h3><p>{text}</p>{index===0&&<a className="primary-action" href={download} download><Icon name="external"/>SpaceNovaX Node V1</a>}{index===2&&<code>SpaceNovaX_Node.exe</code>}{index===3&&<code>NODE ONLINE<br/>HEARTBEAT VERIFIED<br/>SHA-256 VERIFIED</code>}</article>)}
    </section>
    <button className="node-apply" onClick={() => setTab('nodes')}><Icon name="community"/>{n.action}<Icon name="arrow"/></button>
  </section></main>;
}

function Nodes({ language, setTab, user, setUser }) {
  const ko = language === 'ko';
  const download = 'https://github.com/spacenovax/spacenovax-v2/releases/download/node-v1.0.0/Genesis_Community_Node_V1_Standalone_2026-08-08.zip';
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
    <section className="node-hero"><div><small>{ko ? '창립 노드 프로그램' : 'FOUNDING NODE PROGRAM'}</small><strong>{program.registered} / {program.limit}</strong><p>{ko ? '첫 정상 Heartbeat부터 채굴 속도 +25%가 즉시 활성화됩니다. 연결이 중단되면 보너스가 일시 중지되고 재연결 시 자동 복구됩니다. 노드는 채굴, 보상, 잔액, 지갑, KYC, 관리자 데이터에 접근할 수 없습니다.' : 'Mining speed +25% activates from the first valid heartbeat. It pauses while offline and returns automatically after reconnection. Nodes cannot access mining, rewards, balances, wallets, KYC, or administration data.'}</p></div><Icon name="globe" size={58}/></section>
    <div className="node-actions"><a className="primary-action" href={download} download><Icon name="external"/>{ko ? 'Node V1 다운로드' : 'DOWNLOAD NODE V1'}<Icon name="arrow"/></a><button className="node-guide-link" onClick={() => setTab('node-setup')}><Icon name="mission"/>{ko ? '설치·보안 안내 보기' : 'INSTALLATION & SECURITY GUIDE'}<Icon name="arrow" size={16}/></button></div>
    <div className="node-steps"><article><b>01</b><span><strong>{ko ? '다운로드' : 'Download'}</strong><small>{ko ? 'Node V1 패키지를 내려받습니다.' : 'Download the Node V1 package.'}</small></span></article><article><b>02</b><span><strong>{ko ? '페어링 코드' : 'Pairing code'}</strong><small>{ko ? 'Captain ID에서 1회용 코드를 발급합니다.' : 'Issue a one-time code from your Captain ID.'}</small></span></article><article><b>03</b><span><strong>{ko ? '즉시 활성화' : 'Instant activation'}</strong><small>{ko ? '첫 Heartbeat부터 +25%가 즉시 적용됩니다.' : '+25% starts from the first heartbeat.'}</small></span></article></div>
    <section className="node-security"><Icon name="shield"/><div><b>{node.online ? (ko ? '노드가 구동 중입니다 · 채굴 속도 +25%' : 'Node is running · Mining speed +25%') : node.registered ? (ko ? '노드 연결을 기다리고 있습니다.' : 'Waiting for node heartbeat.') : (ko ? 'Captain ID당 노드는 1대만 등록할 수 있습니다.' : 'One node can be registered per Captain ID.')}</b><p>{node.registered ? `${node.label || node.nodeId} · ${node.status} · ${node.bonusPercent || 0}%` : (ko ? '관리자의 수동 승인은 필요하지 않습니다. 설치 후 첫 Heartbeat부터 중앙 서버가 상태를 검증합니다.' : 'No manual administrator approval is required. The central server starts verification from the first heartbeat.')}</p></div></section>
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
  const [sessionReady, setSessionReady] = useState(false);
  const t = COPY[language] || COPY.en;
  const setLanguage = (value) => { localStorage.setItem('spnx_language', value); setLanguageState(value); document.documentElement.lang = value; };
  const sync = useCallback(async () => {
    try { const data = await api('/api/session', { method: 'POST', body: {} }); if (data.user) setUser({ ...fallbackUser, ...data.user, mining: { ...fallbackUser.mining, ...(data.user.mining || {}) } }); } catch {} finally { setSessionReady(true); }
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
  if (tab === 'home') page = <Home user={user} t={t} onStart={() => miningAction('/api/mining/start')} onClaim={() => miningAction('/api/mining/claim')} busy={busy} setTab={setTab} language={language} requiresCaptain={sessionReady && Boolean(user.isGuest) && !Boolean(window.Telegram?.WebApp?.initData)}/>;
  else if (tab === 'orbit') page = <Suspense fallback={<main className="v15-page"><section className="command-card ops-module"><div className="section-heading"><div><small>EARTH NAVIGATION NETWORK</small><h2>Orbit Control</h2></div><span className="live-state"><i/>CONNECTING</span></div></section></main>}><OrbitV20 language={language} user={user} onOpenMining={() => setTab('home')}/></Suspense>;
  else if (tab === 'game') page = <Game user={user} t={t} language={language}/>;
  else if (tab === 'ai') page = <NovaAI user={user} t={t} language={language}/>;
  else if (tab === 'community') page = <Community user={user} setUser={setUser} language={language} setTab={setTab}/>;
  else if (tab === 'global-chat') page = <GlobalChat user={user} language={language} setTab={setTab}/>;
  else if (tab === 'missions') page = <Missions user={user} setUser={setUser} t={t} language={language}/>;
  else if (tab === 'nodes') page = <Nodes language={language} setTab={setTab} user={user} setUser={setUser}/>;
  else if (tab === 'node-setup') page = <NodeSetup language={language} setTab={setTab}/>;
  else if (tab === 'messages') page = <PersonalMessages language={language} onRead={sync}/>;
  else if (tab === 'announcements') page = <Announcements language={language} onRead={sync}/>;
  else if (tab === 'more') page = <More t={t} setTab={setTab} language={language}/>;
  else if (tab === 'fleet') page = <Fleet user={user} setUser={setUser} t={t} language={language}/>;
  else if (tab === 'whitepaper') page = <Whitepaper language={language}/>;
  else if (tab === 'rank') page = <Ranking user={user} t={t}/>;
  else if (tab === 'wallet') page = <Wallet user={user} setUser={setUser} t={t} language={language}/>;
  else if (tab === 'kyc') page = <Kyc t={t} language={language}/>;
  else page = <More t={t} setTab={setTab}/>;
  return <>
    {!launched && <Splash done={() => setLaunched(true)}/>}
    <div className={`v15-shell ${launched ? 'ready' : ''}`}><Header user={user} language={language} setLanguage={setLanguage} t={t} onPreview={() => setPreviewOpen(true)} onMessages={() => setTab('messages')} onAnnouncements={() => setTab('announcements')}/>{user.latestAnnouncement?.showBanner && <button className={`global-announcement-banner priority-${user.latestAnnouncement.priority || 'normal'}`} onClick={() => setTab('announcements')}><strong>NEW · {language === 'ko' ? '공지' : 'NOTICE'}</strong><span>{user.latestAnnouncement.title}</span><Icon name="arrow" size={15}/></button>}{page}<Nav tab={tab} setTab={setTab} t={t}/>{tab !== 'orbit' && <NovaGuide tab={tab} language={language} setTab={setTab}/>}</div>
    <NovaVoiceDelayNotice language={language}/>
    <PreviewPanel open={previewOpen && launched} close={() => setPreviewOpen(false)} t={t}/>
  </>;
}
