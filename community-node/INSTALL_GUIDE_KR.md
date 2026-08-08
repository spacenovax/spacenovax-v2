# 설치 및 보안 안내

## 요구사항

- Node.js 18 이상
- 외부 공개 서비스와 분리된 노드 게이트웨이 환경

## 1. 게이트웨이 실행

1. `.env.example`을 참고해 안전한 별도 키를 준비합니다.
2. `COMMUNITY_NODE_SIGNING_KEY`와 `COMMUNITY_NODE_ADMIN_KEY`는 기존 앱의 `JWT_SECRET`, DB 비밀번호, 지갑 키와 절대 공유하지 않습니다.
3. `node communityNode.js`로 실행합니다.
4. `GET /health`가 `{ "ok": true }`를 반환하는지 확인합니다.

## 2. 노드 등록

`POST /v1/nodes/register`에 선택적 `label`을 전달합니다. 응답의 `nodeSecret`은 이 시점에만 표시됩니다. 운영자는 이를 기록하지 말고 해당 노드의 안전한 환경변수에만 저장합니다.

## 3. 에이전트 실행

에이전트 환경변수에 `COMMUNITY_NODE_URL`, `COMMUNITY_NODE_ID`, `COMMUNITY_NODE_SECRET`을 설정한 뒤 `node agent.mjs`를 실행합니다. 에이전트는 토큰을 요청하고 Heartbeat와 공개 캐시 작업을 한 번 처리합니다.

## 관리자 안전 규칙

- 노드 조회/강제 폐기는 `X-Community-Node-Admin-Key` 헤더로만 수행합니다.
- 이 키는 운영자만 보유하며 웹 프런트엔드에 넣지 않습니다.
- 노드가 의심되면 `POST /v1/admin/nodes/revoke`로 즉시 폐기합니다.
- PostgreSQL 원장·지갑·KYC·채굴 API를 이 서비스에 연결하지 않습니다.

## 검증

```bash
npm test
```

테스트는 15분 토큰, scrypt 비밀키 보관, SHA-256 결과 검증, 금지된 지갑 작업 거부, 폐기 노드 차단을 확인합니다.
