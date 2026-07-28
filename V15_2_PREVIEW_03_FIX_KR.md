# V15.2.1-PREVIEW-03 긴급 수정

## 원인

PREVIEW-02의 원클릭 파일이 Vite 화면 서버만 실행하고 Express API 서버를 실행하지 않았습니다. 이 때문에 Mission Control 화면은 열렸지만 `/api/missions` 데이터를 불러오지 못해 `0/6` 아래 목록이 비어 있었습니다.

## 수정

- `START_PREVIEW.bat`가 먼저 안전 프리뷰를 빌드
- 빌드 후 Express API 서버까지 실행
- 접속 주소를 `http://localhost:3000`으로 변경
- 미션 6종 API 연결 확인
- 메인 NOVA-X1 이미지를 확대 자르기에서 `contain` 배치로 변경
- PC와 모바일에서 전체 기체가 프레임 안에 표시되도록 폭·높이·위치 조정

반드시 PREVIEW-03 ZIP을 새 폴더에 완전히 압축 해제한 뒤 `START_PREVIEW.bat`를 실행해야 합니다.
