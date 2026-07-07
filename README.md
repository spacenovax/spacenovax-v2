# SpaceNovaX V5.1 Admin Connected

관리자 페이지를 실제 서버 API와 연결한 버전입니다.

## 관리자 접속
배포 후:
https://spacenovax-v2.onrender.com/admin

또는 앱 More 탭 → Admin Dashboard

## 연결된 API
- GET /api/admin/stats
- GET /api/admin/users
- POST /api/admin/points

## 관리자 기능
- 총 사용자 수
- 채굴 중 사용자 수
- 총 SPNX Point
- 오늘 접속/채굴/Claim 통계
- Top Users
- User ID로 포인트 지급

## Render
Build Command:
npm install && npm run build

Start Command:
npm start

배포 후:
Render → Manual Deploy → Clear build cache & deploy
