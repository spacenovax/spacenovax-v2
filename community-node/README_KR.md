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

`+25%`는 코인 지급이 아니라 해당 Captain ID의 **채굴 속도 상승**입니다. 첫 정상 Heartbeat가 중앙 서버에 확인되는 즉시 활성화되고, 노드가 온라인인 동안 유지됩니다.

- 정상 인증된 노드 한 대
- 유효한 Heartbeat와 공개 데이터 검증 작업
- 변조·중복 PC 탐지 없음

Heartbeat가 약 2분간 끊기면 보너스는 자동으로 일시 중지되고, 재연결 시 복구됩니다. 상태 변화는 앱 개인 쪽지와 연결된 텔레그램 계정으로 안내됩니다. 노드는 코인을 계산하거나 지급하지 않으며, 중앙 서버 원장만이 보너스를 반영합니다.

## Windows 독립 실행형

1. 앱에서 1회용 페어링 코드를 발급합니다.
2. `SpaceNovaX_Node.exe`를 더블클릭합니다.
3. 최초 한 번만 페어링 코드를 입력합니다.
4. `NODE ONLINE`, `HEARTBEAT VERIFIED`, `+25%`가 표시되면 정상입니다.

Windows 10/11에서 Node.js를 따로 설치할 필요가 없습니다. 아래 명령 방식은 개발자용 원본 실행 방법입니다.

## 개발자용 실행

```bash
cp .env.example .env
# .env에 COMMUNITY_NODE_URL과 앱에서 발급한 COMMUNITY_NODE_PAIRING_CODE를 입력
node agent.mjs
```

첫 실행이 완료되면 인증정보는 실행 파일 옆 `node-config.json`에 자동 저장됩니다.

```bash
COMMUNITY_NODE_ID=... COMMUNITY_NODE_SECRET=... node agent.mjs
```

자세한 설치와 운영 주의사항은 `INSTALL_GUIDE_KR.md`를 확인하세요.
