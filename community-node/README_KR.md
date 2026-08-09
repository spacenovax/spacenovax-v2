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

## 자동 등록과 보너스 검증

관리자가 개별 노드를 승인하지 않습니다. Captain ID당 한 대만 등록할 수 있으며, 앱의 **더보기 → 커뮤니티 노드**에서 발급한 10분짜리 1회용 페어링 코드를 노드 PC에 입력하면 자동 등록됩니다.

`+25%`는 등록 직후 지급되는 보상이 아닙니다. 중앙 서버가 아래 기여 조건을 확인하고, 모두 충족된 동안에만 해당 Captain ID의 **채굴 속도**에 적용합니다.

- 최근 24시간 기여·가동률 90% 이상
- Heartbeat 성공률 95% 이상
- 중앙 게이트웨이가 무작위로 배정한 검증 작업 성공률 98% 이상(최소 10회)
- 평균 API 응답시간 1,500ms 이하
- 변조·중복 PC·오프라인 탐지 없음

Heartbeat가 끊기거나 검증에 실패하면 보너스는 자동으로 중지됩니다. 노드는 코인을 계산하거나 지급하지 않으며, 중앙 서버 원장만이 보너스를 반영합니다.

## 빠른 실행

```bash
cp .env.example .env
# .env에 COMMUNITY_NODE_URL과 앱에서 발급한 COMMUNITY_NODE_PAIRING_CODE를 입력
node agent.mjs
```

첫 실행이 완료되면 터미널에 `COMMUNITY_NODE_ID`와 `COMMUNITY_NODE_SECRET`이 한 번 표시됩니다. 이를 `.env`에 저장하고 `COMMUNITY_NODE_PAIRING_CODE`는 제거하세요.

```bash
COMMUNITY_NODE_ID=... COMMUNITY_NODE_SECRET=... node agent.mjs
```

자세한 설치와 운영 주의사항은 `INSTALL_GUIDE_KR.md`를 확인하세요.
