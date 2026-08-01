# SpaceNovaX 출시 전 최종 QA 및 부분 수정 보고서

검증 대상: `spacenovax-v17-earth-navigation@17.6.0`  
작업 원칙: 기존 구조와 정상 기능을 유지하고, 재현된 결함만 국소 수정

## 최종 판정

- 프로덕션 빌드: **통과**
- 자동 회귀 테스트: **통과**
- 채굴 재접속 및 보상 원장 흐름: **통과**
- 게임 보상 및 중복 지급 방지: **통과**
- Home·Wallet·Ranking·Admin 잔액 일치: **통과**
- 관리자 조회 및 가역 변경 API: **통과**
- NOVA 단일 표시·다국어 음성 선택·Orbit 수명주기: **통과**
- 배포 보류 조건: Render 임시 파일 시스템에서 JSON 원장은 재배포/인스턴스 교체 시 유실될 수 있으므로, 실제 커뮤니티 운영 전 영구 DB 또는 영구 디스크가 필요함

## Priority 1

### 1. Home TOTAL BALANCE

**문제 원인**

완료된 채굴 주기는 서버에서 `claimable` 상태가 되지만, 채굴 화면의 메인 반응로 터치가 `start`를 먼저 실행했습니다. 서버의 `/api/mining/start`도 미수령 보상을 보호하지 않아, 완료 주기가 새 주기로 덮어써질 수 있었습니다. 이 경우 원장에 채굴 보상이 생성되지 않으므로 Home 잔액은 계속 `0.00`으로 보입니다.

**수정한 파일**

- `server.js`
- `src/V15App.jsx`
- `tests/critical-reward-flow.mjs`

**수정 내용**

- 서버가 미수령 완료 주기 위에 새 채굴을 시작하지 못하도록 `409`로 차단했습니다.
- 채굴 반응로 터치 시 `claimable`이면 수령을 최우선으로 실행하도록 변경했습니다.
- 채굴·게임·관리자 조정은 모두 기존 해시 체인 원장과 동일한 `user.balance`를 사용하도록 실제 API 흐름을 검증했습니다.

**테스트 결과**

- 채굴 수령 후 Home/Wallet 공통 세션 잔액: 일치
- Ranking 잔액: 일치
- Admin 회원 잔액과 전체 합계: 일치
- 원장 `balanceAfter`: 일치

### 2. Mining 영속성

**문제 원인**

채굴 시간 계산 자체는 이미 서버의 `startedAt` 기준이었으나, 완료 후 잘못된 재시작으로 보상이 덮어써질 수 있었습니다.

**수정한 파일**

- `server.js`
- `src/V15App.jsx`
- `tests/critical-reward-flow.mjs`

**수정 내용**

- 서버 종료 후 재시작하는 통합 테스트를 추가했습니다.
- 24시간 이상 오프라인 상태를 모사하여 서버가 경과 시간을 계산하고 `claimable`로 복원하는지 검증했습니다.
- 미수령 주기는 새 시작 요청으로 덮어쓸 수 없고, 수령 후에만 다음 주기를 시작할 수 있게 했습니다.

**테스트 결과**

- Telegram/앱 종료를 모사한 서버 재시작 후 Resume: 통과
- Catch-up 완료 및 `remainingMs = 0`: 통과
- 미수령 주기 보호: 통과
- 수령 원장 기록: 통과

### 3. 게임 보상

**문제 원인**

확인된 서버 원장 연결 단절은 없었습니다. 다만 출시 전 실제 경로를 자동으로 증명하는 통합 테스트가 부족했습니다.

**수정한 파일**

- `tests/critical-reward-flow.mjs`

**수정 내용**

- 보스 보상 이벤트를 서버에 제출하고 Database 원장, 세션 잔액, Wallet/Home 공통 값, Ranking, 커뮤니티 게임 점수, Admin까지 추적했습니다.
- 같은 `eventId`를 재전송하여 idempotency 차단을 검증했습니다.

**테스트 결과**

- 게임 보상 원장 생성: 통과
- Home/Wallet 잔액 반영: 통과
- Ranking/Admin 반영: 통과
- 게임 점수 반영: 통과
- 동일 이벤트 중복 지급 차단: 통과
- 운영 환경의 Telegram 검증 및 게임 서명 조건: 기존 안전장치 유지

### 4. Admin Dashboard

**문제 원인**

관리자 화면은 여러 API를 사용하므로, 화면 존재만으로 전체 연결을 보장할 수 없었습니다. 자동 계약 및 변경 경로 테스트가 부족했습니다.

**수정한 파일**

- `tests/critical-reward-flow.mjs`

**수정 내용**

- 관리자 인증 후 회원, 통계, 로그, 미션, 위험도, 라이브 모니터, 설정, 변환 대기열, 분배 시뮬레이터, 전체 랭킹, 채굴 엔진, 신고, 운영 API를 검증했습니다.
- 격리된 임시 원장에서 포인트 `+1/-1`, 차단/해제, 미션 무변경 저장, 일반 설정 저장, 채굴 설정 저장을 실행해 쓰기 연결도 검증했습니다.

**테스트 결과**

- 관리자 조회 계약: 통과
- 가역 관리자 변경: 통과
- 관리자 포인트 조정 원장 기록: 통과
- 최종 사용자 잔액 원복: 통과
- 원장 해시 무결성: 통과

## Priority 2

### NOVA AI 단일 표시

**문제 원인**

중복 표시는 현재 코드에서 재현되지 않았습니다. 일반 탭은 전역 NOVA 한 개, Orbit은 Orbit 전용 NOVA 한 개를 표시하도록 분기되어 있습니다.

**수정한 파일**

- `tests/frontend-lifecycle.mjs`

**수정 내용 및 결과**

- 일반 화면 전역 NOVA 한 개: 통과
- Orbit 전용 NOVA 한 개: 통과
- Orbit에서 중복 전역 NOVA가 나오지 않음: 통과

### 다국어 음성 혼용

**문제 원인**

- 음성 인식 언어가 한국어와 영어만 하드코딩되어 있었습니다.
- 번역문이 없는 정적 안내는 영어 문장을 선택된 타 언어 음성으로 읽어 혼용처럼 들릴 수 있었습니다.

**수정한 파일**

- `src/V15App.jsx`
- `src/orbit/OrbitV20/OrbitV20.jsx`
- `tests/frontend-lifecycle.mjs`

**수정 내용**

- 지원 11개 언어의 음성 인식 locale을 연결했습니다.
- 번역문이 없는 정적 안내는 영어 문장과 영어 음성을 함께 사용하도록 맞췄습니다.
- Orbit 정적 한국어/영어 안내도 표시 문장과 음성 locale이 일치하도록 했습니다.

**테스트 결과**

- 11개 locale 매핑: 통과
- 선택 언어 음성 인식: 통과
- 정적 안내 문장·음성 불일치 방지: 통과

### Orbit UI, NASA 지구 품질, 모바일 반응형

**문제 원인 및 판단**

제공된 현재 버전에는 사실적 지구 텍스처, 대기권, 구름, 야간광과 반응형 규칙이 이미 적용되어 있으며 이번 자동 점검에서 기능 결함이 재현되지 않았습니다. 지시사항에 따라 정상 UI의 디자인을 임의로 변경하지 않았습니다.

**수정한 파일**

- 없음

**테스트 결과**

- 프로덕션 빌드: 통과
- 실제 Android/iOS/Telegram WebView 육안 검증은 이 실행 환경에 브라우저 자동화 런타임이 없어 별도 실기기 확인 필요

## Priority 3

### 메모리 누수 및 Three.js 수명주기

**문제 원인**

- EarthEngine의 포인터·휠·터치 이벤트가 익명 함수로 등록되어 탭 재진입 시 제거할 수 없었습니다.
- Three.js geometry/material/texture와 WebGL context 정리가 불완전했습니다.
- PerformanceManager의 배터리 이벤트가 해제되지 않았습니다.
- 위성 비동기 로딩이 화면 종료 뒤 완료되면 interval이 남을 수 있었습니다.

**수정한 파일**

- `src/orbit/EarthEngine.js`
- `src/orbit/PerformanceManager.js`
- `src/orbit/OrbitV20/OrbitV20.jsx`
- `tests/frontend-lifecycle.mjs`

**수정 내용**

- 등록한 입력 핸들러를 저장하고 `dispose()`에서 정확히 해제했습니다.
- scene의 geometry, material, texture, uniform texture, render list와 WebGL context를 정리했습니다.
- 배터리 이벤트와 비동기 콜백에 disposed guard를 추가했습니다.
- 위성 로딩과 interval에 unmount guard를 추가했습니다.
- 기존 단일 MasterRenderLoop 구조와 adaptive FPS는 유지했습니다.

**테스트 결과**

- Earth 입력 이벤트 해제: 통과
- GPU 리소스 정리: 통과
- 배터리 이벤트 해제: 통과
- 비동기 위성 타이머 정리: 통과
- Orbit render task 제거: 통과

### API 오류 및 중복 렌더링

**수정한 파일**

- `tests/critical-reward-flow.mjs`
- `tests/frontend-lifecycle.mjs`
- `package.json`

**테스트 결과**

- API 계약/원장 흐름: 통과
- 보상 중복 요청 차단: 통과
- NOVA 중복 표시 방지: 통과
- 전체 테스트 4개 파일, 실패 0

## 실행한 최종 명령

```bash
npm test
```

이 명령은 프로덕션 빌드 후 다음을 실행합니다.

- `tests/backend-integrity.mjs`
- `tests/critical-reward-flow.mjs`
- `tests/frontend-lifecycle.mjs`
- `tests/nova-ai-gemini.mjs`

## 남은 출시 전 운영 확인

1. **영구 저장소**: 현재 JSON 원장은 같은 파일을 유지하는 프로세스 재시작에서는 정상 복구되지만, Render 무료 인스턴스의 재배포/교체에서는 파일이 유실될 수 있습니다. 실제 회원 보상을 시작하기 전 PostgreSQL 또는 Render 영구 디스크가 필요합니다.
2. **실기기 테스트**: Android Telegram, iOS Telegram, PC Chrome에서 언어별 음성 권한과 화면 하단 safe-area를 최종 확인해야 합니다.
3. **운영 서명 테스트**: 실제 `TELEGRAM_BOT_TOKEN`과 `GAME_REWARD_SECRET`이 설정된 스테이징에서 Telegram initData 검증 및 서명 게임 보상 1회를 확인해야 합니다.
4. **번들 경고**: 빌드는 통과했지만 단일 JS 청크가 약 856 kB입니다. 이번 작업은 재설계 금지 범위이므로 코드 분할은 적용하지 않았습니다. 저사양 실기기 FPS 측정 후 별도 성능 릴리스에서 다루는 것이 안전합니다.

