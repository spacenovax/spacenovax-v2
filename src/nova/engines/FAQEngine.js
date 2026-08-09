import { normalizeNOVAQuestion } from '../cache/NovaCacheStore.js';

const REPLIES = {
  en: {
    greeting: 'Welcome, Captain. NOVA AI command link is online. How can I assist you?',
    thanks: 'You are welcome, Captain. NOVA remains on standby.',
    mining: 'Open Mining Command and activate your 24-hour cycle. Your server-authoritative balance updates after verified settlement.',
    wallet: 'Open Wallet to review your SPNX Points and wallet connection status. Never share a seed phrase or private key.',
    ranking: 'Open Ranking to view the verified captain, fleet, and game leaderboards.',
    mission: 'Open Mission Control to review official missions and verified reward status.',
    referral: 'Open Community to find your fleet code, referral status, and Security Circle progress.',
    navigation: 'Open Global Navigation to view Orbit Control, saved bases, distance, and public Earth layers.',
    community: 'Open Community to review fleet information and trusted captain posts.',
  },
  ko: {
    greeting: '환영합니다, 캡틴. NOVA AI 지휘 링크가 연결되었습니다. 무엇을 도와드릴까요?',
    thanks: '천만에요, 캡틴. NOVA는 대기 중입니다.',
    mining: '채굴 관제에서 24시간 주기를 시작하세요. 잔액은 검증된 서버 정산 후 반영됩니다.',
    wallet: '지갑에서 SPNX 포인트와 지갑 연결 상태를 확인하세요. 시드 구문이나 개인 키는 절대 공유하지 마세요.',
    ranking: '랭킹에서 검증된 캡틴·함대·게임 순위를 확인할 수 있습니다.',
    mission: '미션 관제에서 공식 미션과 검증된 보상 상태를 확인할 수 있습니다.',
    referral: '커뮤니티에서 함대 코드, 추천 현황, 보안 서클 진행도를 확인할 수 있습니다.',
    navigation: '국제 네비게이션에서 Orbit Control, 저장한 기지, 거리와 공개 지구 레이어를 확인할 수 있습니다.',
    community: '커뮤니티에서 함대 정보와 신뢰할 수 있는 캡틴 게시물을 확인할 수 있습니다.',
  },
};

const KEYWORDS = {
  greeting: ['hello', 'hi', 'hey', '안녕', '반가', 'こんにちは', 'hola', 'bonjour', 'hallo', 'привет', 'xin chào', 'halo'],
  thanks: ['thank', 'thanks', '고마', '감사', 'arigato', 'gracias', 'merci', 'danke', 'obrigad', 'спасибо', 'terima kasih'],
  mining: ['mining', 'mine', '채굴', '마이닝'],
  wallet: ['wallet', '지갑'],
  ranking: ['ranking', 'rank', 'leaderboard', '랭킹', '순위'],
  mission: ['mission', 'missions', '미션', '임무'],
  referral: ['referral', 'refer', 'fleet', '추천', '함대', '보안 서클'],
  navigation: ['navigation', 'orbit', 'satellite', '위성', '네비', '내비', '항법'],
  community: ['community', '게시', '커뮤니티'],
};

export class FAQEngine {
  answer(question, language = 'en') {
    const normalized = normalizeNOVAQuestion(question);
    if (!normalized) return null;
    const intent = Object.entries(KEYWORDS).find(([, words]) => words.some((word) => normalized.includes(word)))?.[0];
    if (!intent) return null;
    const dictionary = REPLIES[language] || REPLIES.en;
    return { intent, reply: dictionary[intent] || REPLIES.en[intent], source: 'faq' };
  }
}
