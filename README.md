# SpaceNovaX V13.4.2 Real Game Over Final

이번 버전은 추정 패치가 아니라 GamePage + NovaArcadeCanvas 전체를 교체한 버전입니다.

## 핵심 규칙
- 운석 충돌 + Shield 없음 = 즉시 죽음 처리
- 죽는 순간:
  - 오브젝트 생성 중지
  - 우주선 조작 중지
  - 우주선 표시 제거
  - 폭발 파티클
  - 화면 흔들림
  - 데미지 플래시
  - 1초 후 GAME OVER 화면
- Shield가 있으면 1회 방어 후 게임 계속
- Play Again 누르기 전까지 재시작 없음

## 포함
- Sound ON/OFF
- Crystal/Boost/Shield/Explosion sound
- Galaxy Leaderboard
- Result screen
- Daily 20 SPNX reward limit 유지

## 적용
기존 파일 일부만 교체하지 말고 ZIP 전체를 GitHub에 덮어쓰기.
Render에서 Clear build cache & deploy 필수.
