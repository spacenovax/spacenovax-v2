# Genesis Community Node V1 설치 및 보안 안내

## 이 노드가 하는 일

Genesis Community Node는 SpaceNovaX 중앙 게이트웨이가 배정한 공개 캐시·번역 정적 리소스·서비스 상태 모니터링 작업만 수행합니다. 노드는 Captain ID, 채굴, 보상, 잔액, 지갑, DB, KYC, 관리자 기능에 접근하거나 수정할 수 없습니다.

## 자동 등록 방식

1. SpaceNovaX 앱의 **더보기 → 커뮤니티 노드**에서 1회용 페어링 코드를 발급합니다.
2. 이 패키지를 내려받아 압축을 풀고 `.env.example`을 `.env`로 복사합니다.
3. `.env`에 `COMMUNITY_NODE_URL`과 `COMMUNITY_NODE_PAIRING_CODE`를 입력합니다.
4. `node agent.mjs`를 실행하면 중앙 서버에 자동 등록됩니다. 관리자 수동 승인은 없습니다.
5. 터미널에 한 번만 표시되는 `COMMUNITY_NODE_ID`와 `COMMUNITY_NODE_SECRET`을 `.env`에 저장합니다. 페어링 코드는 삭제합니다.

## +25% 채굴 속도 보너스

보너스는 노드가 지급하거나 계산하지 않습니다. 중앙 서버가 노드의 검증 결과를 확인한 뒤 채굴 속도에만 적용합니다.

- 최소 24시간 기여 및 가동률 90% 이상
- Heartbeat 성공률 95% 이상
- 중앙 서버의 무작위 공용 캐시·모니터링 작업 성공률 98% 이상, 최소 10회
- 평균 API 응답시간 1,500ms 이하
- 변조 파일, 허위 응답, 중복 PC 노드가 없어야 함

노드가 오프라인이 되거나 검증에 실패하면 +25%는 자동으로 중지됩니다. Captain ID·Telegram 계정·PC당 노드는 1대만 허용됩니다. 첫 1,000대에서 신규 등록은 자동 마감됩니다.

## 보안 경계

- 토큰은 읽기·캐시·모니터링 권한만 가지며 15분 후 만료됩니다.
- 노드 비밀값은 중앙 서버에 `scrypt` 해시로만 보관됩니다.
- 앱의 JWT, 관리자 비밀번호, DB 비밀번호, 지갑 키, 보상 서명키를 이 노드에 입력하지 마세요.
- 미니앱과 웹사이트는 노드에 직접 연결하지 않습니다. 중앙 게이트웨이가 검증된 정상 노드만 선택합니다.

## 검증

```bash
npm test
node agent.mjs
```

`communityNode.js` 및 `tests/community-node-integrity.mjs`는 Node V1의 독립 보안 경계 검증 자료입니다. 실제 앱 연동에는 `agent.mjs`만 사용합니다.
