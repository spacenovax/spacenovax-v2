# SpaceNovaX V8.0.1 Hotfix

화면이 검은색/빈 화면으로 나오는 문제 수정본입니다.

## 원인
index.html이 `/src/App.jsx`를 직접 불러오고 있었습니다.
React 앱은 반드시 `main.jsx`에서 `createRoot(...).render(<App />)`로 실행되어야 합니다.

## 수정
- `src/main.jsx` 추가
- `index.html` script를 `/src/main.jsx`로 변경
- V8 플랫폼 구조 유지
- 메뉴별 독립 화면 유지
- 미션/추천/게임/채굴 화면 유지

## 적용
GitHub `spacenovax-v2`에 압축 해제한 파일을 덮어쓰기 업로드 후,
Render `spacenovax-v2`에서 Clear build cache & deploy.
