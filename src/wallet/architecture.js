// NOVA Wallet V1 module registry.
// This is product configuration only: it does not create a wallet, hold a key,
// or enable a blockchain transaction. Feature activation remains server and
// contract controlled after testnet validation.
export const NOVA_WALLET_ARCHITECTURE = Object.freeze({
  version: '1.0',
  network: 'TON',
  modules: Object.freeze([
    Object.freeze({ id: 'points', icon: '✦', label: { en: 'SPNX Points Ledger', ko: 'SPNX Points 원장' }, detail: { en: 'Server-settled mining and rewards', ko: '서버 확정 채굴·보상' } }),
    Object.freeze({ id: 'ton-connect', icon: '◌', label: { en: 'TON Connect', ko: 'TON 지갑 연결' }, detail: { en: 'External wallet connection only', ko: '외부 TON 지갑 연결 전용' } }),
    Object.freeze({ id: 'vesting', icon: '⌁', label: { en: 'Conversion & Vesting', ko: '전환·자동 락업' }, detail: { en: 'Immutable release schedules', ko: '고정 해제 일정' } }),
    Object.freeze({ id: 'claims', icon: '↓', label: { en: 'Claim Center', ko: '수령 신청' }, detail: { en: 'User-signed, fee-previewed claims', ko: '사용자 서명·가스비 사전 안내' } }),
    Object.freeze({ id: 'staking', icon: '◆', label: { en: 'SPNX Staking', ko: 'SPNX 스테이킹' }, detail: { en: 'Optional claimed-token programs', ko: '수령 완료분 선택 예치' } }),
    Object.freeze({ id: 'security', icon: '◈', label: { en: 'Security Center', ko: '보안 센터' }, detail: { en: 'PIN, biometrics and audit trail', ko: 'PIN·생체인증·감사 기록' } }),
  ]),
});

export function walletModuleCopy(module, language) {
  return module.label[language] ? module : {
    ...module,
    label: { ...module.label, [language]: module.label.en },
    detail: { ...module.detail, [language]: module.detail.en },
  };
}
