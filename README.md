# SpaceNovaX V2 Final Render Ready

SPNX모음.zip을 기준으로, 중복 버전 문제 없이 Render에 바로 배포할 수 있게 새로 정리한 최종본입니다.

## 핵심
- 기존 v10~v45 누적 코드 제거
- Header는 1개만 존재
- Express `app.get('*')` 오류 제거
- React + Vite + Express 구조
- Render 배포 가능
- 모바일/PC 반응형
- Canvas 별/유성 효과
- 채굴 잔액 증가 애니메이션
- 우주선 애니메이션

## Render 설정
Build Command:
npm install && npm run build

Start Command:
npm start

## 업로드 방법
1. 이 ZIP 압축 해제
2. GitHub spacenovax-v2 저장소에 전체 파일 덮어쓰기
3. Commit changes
4. Render → Manual Deploy → Clear build cache & deploy
