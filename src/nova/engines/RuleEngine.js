import { normalizeNOVAQuestion } from '../cache/NovaCacheStore.js';

const COMMANDS = [
  ['mining', ['start mining', 'start mine', '채굴 시작', '채굴해'], 'Open Mining Command and select Start mining.', '채굴 관제를 열고 채굴 시작을 선택해 주세요.'],
  ['wallet', ['open wallet', 'wallet', '지갑'], 'Opening Wallet guidance.', '지갑 안내를 엽니다.'],
  ['ranking', ['open ranking', 'ranking', 'rank', '랭킹', '순위'], 'Opening Ranking guidance.', '랭킹 안내를 엽니다.'],
  ['mission', ['open mission', 'mission', '미션', '임무'], 'Opening Mission Control guidance.', '미션 관제 안내를 엽니다.'],
  ['referral', ['open referral', 'referral', 'fleet', '추천', '함대'], 'Opening Community and Fleet guidance.', '커뮤니티와 함대 안내를 엽니다.'],
  ['navigation', ['open navigation', 'navigation', 'orbit', '내비', '네비', '항법'], 'Opening Global Navigation guidance.', '국제 네비게이션 안내를 엽니다.'],
  ['community', ['open community', 'community', '커뮤니티'], 'Opening Community guidance.', '커뮤니티 안내를 엽니다.'],
];

export class RuleEngine {
  answer(question, language = 'en') {
    const normalized = normalizeNOVAQuestion(question);
    const command = COMMANDS.find(([, phrases]) => phrases.some((phrase) => normalized.includes(phrase)));
    if (!command) return null;
    return { intent: command[0], reply: language === 'ko' ? command[3] : command[2], source: 'rule' };
  }
}
