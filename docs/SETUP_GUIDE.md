# 문진 시스템 설치 가이드

## ✅ 완료된 작업

### 1. 프로젝트 구조 생성
- ✅ React + Vite 프로젝트 초기화
- ✅ Tailwind CSS 설정
- ✅ 프로젝트 구조 구축

### 2. 데이터 처리
- ✅ 엑셀 파일(`interview_system_db.xlsx`) → JSON 변환
- ✅ `frontend/src/data/questionnaireData.json` 생성 완료
- ✅ 6개 시트 (Category, Question, Option, ResponseType, FlowLogic, StringTable) 파싱 완료

### 3. React 앱 구현
- ✅ 메인 App 컴포넌트 구현
- ✅ 스마트 문진 (Rule-Based) 시스템 구현
  - 카테고리 선택
  - Red Flag 질문 (9개)
  - 일반 문진 (7개)
  - FlowLogic 기반 동적 질문 흐름
  - Red Flag 감지 시 경고 화면
- ✅ AI 어드바이저 (Chat-Based) 시스템 구현
  - ChatGPT API 연동 (OpenAI)
  - 실시간 대화형 상담
- ✅ 다국어 지원 (한국어, 베트남어, 인도네시아어)
- ✅ 제공하신 프리미엄 UI 디자인 적용

### 4. 의존성 설치
- ✅ npm 패키지 설치 완료

## ⚠️ Node.js 버전 업그레이드 필요

**현재 문제**: Node.js v10.19.0 (너무 오래된 버전)
**필요 버전**: Node.js v14.18+ 이상 (권장: v18 이상)

### 해결 방법

#### 방법 1: nvm 사용 (권장)

```bash
# nvm 설치 (아직 없는 경우)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 터미널 재시작 또는
source ~/.bashrc

# Node.js v18 설치
nvm install 18
nvm use 18
nvm alias default 18

# 확인
node --version  # v18.x.x 이상이어야 함
```

#### 방법 2: apt 사용

```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Node.js 설치
sudo apt-get install -y nodejs

# 확인
node --version
```

## 🚀 실행 방법

### 1. Node.js 버전 확인

```bash
node --version  # v14.18 이상이어야 함
```

### 2. 개발 서버 실행

```bash
cd /home/dev/workspace/mo/SA_valid/frontend
npm run dev
```

### 3. 브라우저 접속

```
http://localhost:3000
```

## 🔑 ChatGPT API 설정

`frontend/src/App.jsx` 파일에서 API 키를 설정하세요:

```javascript
const apiKey = "여기에_OpenAI_API_키_입력"; // 약 117번째 줄
```

또는 환경 변수 사용:

```bash
# frontend/.env 파일 생성
echo "VITE_OPENAI_API_KEY=your-api-key-here" > .env
```

그리고 App.jsx에서:

```javascript
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
```

## 📊 데이터 업데이트

엑셀 파일을 수정한 후:

```bash
cd /home/dev/workspace/mo/SA_valid
uv run python convert_excel_to_json.py
```

## 🎨 주요 기능

### 스마트 문진 (Rule-Based)
1. **카테고리 선택**: 배가 아파요, 소화가 안돼요 등
2. **Red Flag 질문**: 9개의 위험 신호 감지 질문
3. **일반 문진**: 7개의 상세 증상 수집 질문
4. **동적 분기**: FlowLogic 기반 질문 흐름
5. **Red Flag 경고**: 위험 신호 감지 시 즉시 경고

### AI 어드바이저 (Chat-Based)
1. **ChatGPT 연동**: OpenAI API 사용
2. **자연어 대화**: 자유로운 증상 상담
3. **다국어 지원**: 한국어, 베트남어, 인도네시아어

### UI/UX
- 프리미엄 디자인 (제공하신 코드 기반)
- Tailwind CSS 스타일링
- Lucide React 아이콘
- 반응형 디자인
- 부드러운 애니메이션

## 📦 프로젝트 구조

```
SA_valid/
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # 메인 컴포넌트
│   │   ├── main.jsx             # 진입점
│   │   ├── index.css            # 글로벌 스타일
│   │   └── data/
│   │       └── questionnaireData.json  # 문진 데이터
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── convert_excel_to_json.py     # 엑셀→JSON 변환
├── interview_system_db.xlsx     # 원본 데이터
├── README.md                    # 기술 문서
└── SETUP_GUIDE.md              # 이 파일
```

## 🔧 기술 스택

- **Frontend Framework**: React 18
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **Icons**: Lucide React
- **AI Integration**: OpenAI ChatGPT API
- **Data Format**: JSON (Excel 변환)
- **Language Support**: 한국어, 베트남어, 인도네시아어

## 📝 다음 단계

1. ✅ Node.js 업그레이드 (v18 이상)
2. ✅ 개발 서버 실행
3. ✅ ChatGPT API 키 설정
4. ✅ 브라우저에서 테스트
5. 필요 시 추가 카테고리 및 질문 추가 (엑셀 파일 수정 → 재변환)

## 🐛 문제 해결

### npm install 오류
```bash
rm -rf node_modules package-lock.json
npm install
```

### 포트 충돌
```bash
# vite.config.js에서 포트 변경
server: {
  port: 3001  # 다른 포트로 변경
}
```

### API CORS 오류
- 프록시 설정 필요할 수 있음
- 또는 백엔드에서 CORS 허용

## 📞 문의

프로젝트 관련 질문이나 이슈가 있으시면 문의해주세요.

---

**작성일**: 2026-01-26
**버전**: 1.0.0
