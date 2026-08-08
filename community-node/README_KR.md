# Genesis Community Node V1

SpaceNovaX의 공개 정보 전달을 보조하는 **읽기·캐시·모니터링 전용** 커뮤니티 노드입니다.

## 가능한 작업

- 공개 랭킹·미션·11개 언어 데이터 캐시
- 공개 정적 리소스 캐시
- API 응답시간·서비스 상태·CPU·메모리·디스크·실행시간 Heartbeat
- 중앙 게이트웨이가 선택한 작업의 SHA-256 결과 검증

## 절대 할 수 없는 작업

- 채굴·보상 계산 또는 지급
- 사용자 잔액·원장·지갑·토큰 전환 변경
- PostgreSQL·애플리케이션 DB 수정
- 인증·KYC·관리자 권한 작업
- 임의 외부 URL 접근

노드 비밀키는 서버에 `scrypt` 해시로만 보관됩니다. 액세스 토큰은 읽기·캐시·모니터링 권한만 갖고 15분 후 만료됩니다.

## 빠른 실행

```bash
cp .env.example .env
# .env에 COMMUNITY_NODE_SIGNING_KEY / COMMUNITY_NODE_ADMIN_KEY 설정
npm test
npm start
```

등록 API `POST /v1/nodes/register`가 최초의 `nodeId`, `nodeSecret`을 한 번만 돌려줍니다. 해당 값을 에이전트 환경변수에 넣고 실행합니다.

```bash
COMMUNITY_NODE_ID=... COMMUNITY_NODE_SECRET=... node agent.mjs
```

자세한 설치와 운영 주의사항은 `INSTALL_GUIDE_KR.md`를 확인하세요.
