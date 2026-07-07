# SpaceNovaX V6.1 Admin Login Protected

웹사이트(spacenovax.com)는 건드리지 않고, Telegram Mini App/Admin만 수정한 버전입니다.

## 추가 기능
- /admin 로그인 화면
- Render 환경변수 기반 관리자 ID/비밀번호
- HMAC 토큰 세션 인증
- 관리자 로그아웃
- Admin API 보호
- Audit Logs 표시
- 포인트 지급 로그 기록

## Render 환경변수 설정
Render → Environment → Add Environment Variable

ADMIN_ID=admin
ADMIN_PASSWORD=원하는강력한비밀번호
JWT_SECRET=랜덤64자리문자열

## 관리자 접속
https://spacenovax-v2.onrender.com/admin

환경변수를 설정하지 않으면 기본값:
ID: admin
Password: ChangeMe123!

운영 전 반드시 Render 환경변수로 변경하세요.
