# NOVA AI 무료 우선 모듈

이 폴더는 기존 SpaceNovaX 화면과 게임 로직을 변경하지 않고 NOVA AI의
음성·텍스트 처리만 분리합니다.

## 처리 순서

1. 브라우저 Web Speech API(STT/TTS)
2. 로컬 응답 캐시 및 FAQ
3. 로컬 명령어 규칙 엔진
4. 동일 질문 응답 캐시
5. Groq **텍스트** API (기본: 빠른 일반 대화)
6. Groq 한도 초과·일시 오류 시에만 Gemini Flash **텍스트** API

Gemini Voice, Live Voice, Audio Generation은 이 모듈에서 사용하지 않습니다.

## 구성

- `voice/BrowserSpeechProvider.js`: 브라우저 음성 인식과 합성, 11개 언어 로케일
- `voice/LocalAudioProvider.js`: 선택적 로컬 MP3 이벤트 큐 재생
- `cache/NovaCacheStore.js`: 브라우저 메모리·localStorage 응답/FAQ 캐시
- `engines/FAQEngine.js`: 무료 고정 FAQ 응답
- `engines/RuleEngine.js`: 채굴·지갑·랭킹·미션·추천·네비게이션·커뮤니티 명령
- `providers/GeminiTextProvider.js`: 앱과 서버의 텍스트 요청 경계
- `NovaAIRouter.js`: Provider 우선순위 및 캡틴별 요청 직렬 큐

## 로컬 이벤트 음성

`public/audio/nova/README.md`에 적힌 이름으로 사전 녹음한 MP3 또는 WAV를
추가할 수 있습니다. 파일이 없거나 재생이 막히면 브라우저의 무료 Speech
Synthesis가 자동으로 대신 읽습니다.

## 백그라운드 보호

문서가 숨겨지면 음성 재생·음성 입력을 중지하며, 대기 중인 Gemini 요청도
새로 시작하지 않습니다.

## 서버 환경변수

```text
GROQ_API_KEY=...                 # 1차 필수 권장
GROQ_MODEL=llama-3.1-8b-instant  # 빠른 일반 대화
GEMINI_API_KEY=...               # 2차 백업
GEMINI_MODEL=gemini-2.5-flash
NOVA_RESPONSE_MAX_TOKENS=220     # 기본 2~3문장 짧은 답변
```

앱에는 어떤 공급자 이름도 표시하지 않습니다. NOVA AI는 기본적으로 2~3개의
짧은 문장으로 답하고, 캡틴이 상세 설명을 요청할 때만 최대 5개 짧은 항목으로
확장해 답합니다.
