# SpaceNovaX V16.4 Preview 11 — Backend Integrity

## 이번 버전에서 확정한 경제 규칙

- 기본 채굴: 24시간당 30 SPNX Point
- 활성 레퍼럴: 1명당 채굴 속도 +5%, 최대 1,000명
- 보안 서클: KYC 승인 회원 1명당 +1%, 최대 5명(+5%)
- 공식 미션: 웹사이트, Telegram 채널, Discord, X, YouTube의 5개
- 5개 미션 완료: Mission Passport 및 기본 채굴 속도 +5%
- 게임 보상: 일일 최대 30 SPNX Point
- 다이아몬드 300개: 10 SPNX Point, 하루 최대 2회
- 보급함: 1~5 SPNX Point 무작위, 하루 1회
- 보스 최초 처치: 5 SPNX Point, 하루 1회
- 보상 초기화: 미국 동부시간(America/New_York) 매일 오전 6시
- KYC 및 토큰 전환: 현재 비활성화(Coming Soon)

## 무결성 변경

- 채굴·미션·게임·함대 보상을 해시 체인형 서버 원장에 기록
- 요청별 idempotency key로 중복 지급 차단
- 운영 환경에서 Telegram 검증 없는 게스트의 보상 지급 차단
- 게임 보상은 서버 공유 비밀키로 서명된 결과만 수락
- 관리자 잔액 조정도 원장에 사유와 함께 기록
- 수동 KYC 승인과 토큰 전환 처리 API 잠금
- 미션 링크를 먼저 연 뒤 검증 대기시간을 통과해야 보상 청구 가능

## Telegram 공식 채널

- `https://t.me/spacenovaxteam`
- 미션명: Join SpaceNovaX Telegram Channel

## 배포 전에 필요한 환경변수

- `TELEGRAM_BOT_TOKEN`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `GAME_REWARD_SECRET`
- `OPENAI_API_KEY` (NOVA AI 실시간 답변 사용 시)

## 중요한 운영 제한

현재 저장소는 JSON 파일 원장을 사용합니다. Render 무료 인스턴스의 임시 파일 시스템에서는 재배포나 인스턴스 교체 시 데이터가 보존되지 않을 수 있습니다. 실제 커뮤니티 운영 전에 PostgreSQL 같은 영구 데이터베이스로 원장을 이전해야 합니다.

## V16.4 프리미엄 인터페이스 보강

- PC 마우스와 모바일 터치로 NOVA 안내 도우미의 위치 이동 및 위치 저장
- NOVA 프로필에 호흡, 홀로그램 스캔, 시선광 애니메이션 적용
- 메인 우주기지에 궤도 위성, 셔틀, 통신 신호 및 실시간 궤도 이벤트 연출
- 헤더와 통합 관제 센터에 공식 웹사이트 바로가기 추가
- 협업·미디어·기술 문의 전용 이메일 `spacenovax@hotmail.com` 표시
- 동작 감소 접근성 설정(`prefers-reduced-motion`) 지원
