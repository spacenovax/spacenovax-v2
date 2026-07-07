# SpaceNovaX V8 Unified Platform

이번 버전은 덧붙이기 방식이 아니라 App.jsx를 하나의 플랫폼 구조로 재구성했습니다.

## 핵심 수정
- 화면 겹침 제거
- 메뉴별 독립 페이지
  - Home
  - Mining
  - Missions
  - Friends
  - Ranking
  - Wallet
  - Game
  - More
- 실사 시네마틱 느낌의 Nova-X1 우주선 스타일
- 바둑판 현상 없는 랜덤 별 배경
- 유성 효과
- 24시간 = 24 SPNX 채굴 정책 표시
- Mission 보상 고정
  - Website +100, 1회
  - Telegram +300, 1회
  - X +300, 1회
  - Discord +300, 1회
  - YouTube Subscribe +300, 1회
  - YouTube Like +100, 1회
  - Daily Check-in +20, 하루 1회
- Friends 추천 링크 메뉴 포함
- Nova-X1 Game Preview 포함

## 적용
분리형 구조라면 우선 GitHub spacenovax-v2에 업로드하세요.
그 다음 Render spacenovax-v2에서 Clear build cache & deploy.
