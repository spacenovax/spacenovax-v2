# SpaceNovaX Developer GitHub Connect 설정

외부 개발자는 **자기 GitHub 저장소만** 연결합니다. SpaceNovaX 공식 저장소, Render, 지갑, 채굴 원장에는 접근할 수 없습니다.

## GitHub App 생성

GitHub → Settings → Developer settings → GitHub Apps → New GitHub App에서 아래처럼 설정합니다.

- App name: `SpaceNovaX Developer Connect`
- Homepage URL: `https://app.spacenovax.com`
- Callback URL: `https://app.spacenovax.com/api/developer/github/callback`
- Webhook: 끔
- Repository permissions: **Contents: Read-only**, **Metadata: Read-only**만 켬
- 그 외 Repository, Organization, Account permissions: 전부 **No access**
- 설치 범위: **Any account**

`Contents: Write`, `Actions`, `Administration`, `Secrets`, `Deployments`, `Workflows` 권한은 절대 켜지 않습니다.

## Render 환경변수

GitHub App 생성 뒤 Render에 다음만 추가합니다.

- `GITHUB_DEVELOPER_APP_SLUG` = GitHub App URL의 마지막 이름
- `GITHUB_DEVELOPER_CONNECT_SECRET` = 48자 이상의 임의의 강한 문자열

`GITHUB_DEVELOPER_CONNECT_SECRET`는 화면·GitHub·소스코드에 넣거나 공유하지 않습니다.

## 보안 동작

1. 개발자는 GitHub App을 자기 저장소에만 설치합니다.
2. 서버는 10분 만료 서명 state로 연결 요청을 검증합니다.
3. 개발자는 공식 저장소가 아닌 자기 저장소 URL만 제출합니다.
4. 관리자가 검토 후 `verified`로 승인해야 사용할 수 있습니다.
5. 언제든 연결 해제 또는 관리자 revoke가 가능하며, 자동 배포는 절대 실행되지 않습니다.

공식 저장소 `spacenovax/spacenovax-v2` 및 `spacenovax/spacenovax-server-v2`는 외부 개발자 연결 대상으로 거부됩니다.
