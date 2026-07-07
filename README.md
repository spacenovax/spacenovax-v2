# SpaceNovaX V6 Mission Fleet DB

실제 사용자 DB, 미션, Fleet 보너스, 랭킹, Wallet 저장, Admin V6가 추가된 버전입니다.

## 핵심 추가
- 공식 SPNX 로고 적용
- 파일 기반 사용자 DB 저장
- Telegram/Guest 사용자 자동 생성
- Mission Center
- 1회 미션 보상
- Daily Check-in
- Fleet Bonus 최대 +20%
- Top Miners Ranking
- 내 순위 확인 API
- Solana Wallet 주소 저장
- Admin V6 통계 확장
- 반감기 Phase 표시

## API
- POST /api/session
- POST /api/mining/start
- POST /api/mining/claim
- GET /api/missions
- POST /api/missions/claim
- GET /api/ranking
- POST /api/ranking/me
- POST /api/wallet/save
- GET /api/admin/stats
- GET /api/admin/users
- POST /api/admin/points

## Render 설정
Build Command:
npm install && npm run build

Start Command:
npm start

배포 후:
Manual Deploy → Clear build cache & deploy
