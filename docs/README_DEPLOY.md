# 문진 시스템 배포 가이드

## 프로젝트 구조

```
SA_valid/
├── frontend/                # React 앱
│   ├── src/
│   │   ├── App.jsx         # 메인 컴포넌트
│   │   ├── main.jsx        # 진입점
│   │   ├── index.css       # 스타일
│   │   └── data/
│   │       └── questionnaireData.json  # 문진 데이터
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── convert_excel_to_json.py  # 엑셀 변환 스크립트
└── interview_system_db.xlsx   # 원본 데이터
```

## 설치 및 실행

### 1. 의존성 설치

```bash
cd frontend
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 OpenAI API 키를 추가:

```bash
cp .env.example .env
# .env 파일을 열어서 API 키 입력
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 4. 프로덕션 빌드

```bash
npm run build
npm run preview  # 빌드 결과 미리보기
```

## 데이터 업데이트

엑셀 파일(`interview_system_db.xlsx`)을 수정한 후:

```bash
# 프로젝트 루트에서
uv run python convert_excel_to_json.py
```

이렇게 하면 `frontend/src/data/questionnaireData.json`이 자동으로 업데이트됩니다.

## 주요 기능

### 1. 스마트 문진 (Rule-Based)
- 카테고리 선택 (배가 아파요, 소화가 안돼요 등)
- Red Flag 질문 (9개) - 위험 신호 감지
- 일반 문진 (7개) - 상세 증상 수집
- 분기 로직에 따른 동적 질문 흐름
- Red Flag 감지 시 즉시 경고

### 2. AI 어드바이저 (Chat-Based)
- ChatGPT API 연동
- 자연어 대화형 상담
- 다국어 지원 (한국어, 베트남어, 인도네시아어)

### 3. 다국어 지원
- 헤더에서 언어 전환 가능
- UI 텍스트 자동 변환

## API 설정

### ChatGPT API 사용

`App.jsx`에서 API 키를 환경변수로 설정:

```javascript
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
```

또는 코드에 직접 입력 (테스트용):

```javascript
const apiKey = "sk-...your-api-key...";
```

## 기술 스택

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI**: OpenAI ChatGPT API
- **Data**: JSON (Excel에서 변환)

## 문제 해결

### 1. npm install 실패 시

```bash
rm -rf node_modules package-lock.json
npm install
```

### 2. API 통신 오류

- `.env` 파일에 올바른 API 키가 설정되었는지 확인
- CORS 이슈: API 프록시 설정 필요할 수 있음

### 3. 데이터 로딩 오류

- `questionnaireData.json` 파일이 올바른 위치에 있는지 확인
- JSON 형식이 유효한지 검증

## 라이센스

Medical Questionnaire System © 2025
