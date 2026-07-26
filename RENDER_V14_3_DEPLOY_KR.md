# Render V14.3 필수 설정

`https://spacenovax-v2.onrender.com` 배포 서비스의 Environment에 아래 값을 등록합니다.

```text
NODE_ENV=production
ADMIN_ID=관리자아이디
ADMIN_PASSWORD=충분히_긴_관리자비밀번호
JWT_SECRET=32자_이상의_무작위_비밀값
TELEGRAM_BOT_TOKEN=BotFather에서_발급된_봇토큰
OPENAI_API_KEY=서버용_OpenAI_API_키
OPENAI_MODEL=gpt-5.6-sol
```

## 데이터 저장

현재 버전은 기존 회원 데이터 호환을 위해 JSON 저장 방식을 유지합니다. Render 재배포 후에도 데이터를 유지하려면 Persistent Disk를 연결하고 다음 환경변수를 지정합니다.

```text
DATA_FILE=/var/data/spacenovax-data.json
```

중장기 운영 전에는 PostgreSQL로 전환해야 합니다. JSON은 초기 커뮤니티 테스트에는 사용할 수 있지만, 여러 서버 인스턴스가 동시에 쓰는 대규모 운영에는 적합하지 않습니다.

## 배포 전 확인

- `ADMIN_PASSWORD`와 `JWT_SECRET`은 GitHub에 저장하지 않습니다.
- `TELEGRAM_BOT_TOKEN`이 없으면 Telegram 사용자는 안전을 위해 인증 계정으로 처리되지 않습니다.
- `OPENAI_API_KEY`가 없으면 NOVA AI는 오프라인 안내 모드로 작동합니다.
- 이전 `spacenovax-data.json`을 삭제하지 말고 Persistent Disk로 먼저 복사합니다.
- 관리자 페이지에서 NOVA AI, 게임 보상, 일일 한도 및 유지보수 설정을 확인합니다.

