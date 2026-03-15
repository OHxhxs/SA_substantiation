# SA Substantiation — 인도네시아어 위장내과 AI 문진 시스템

**운영사**: MENINBLOX
**최종 업데이트**: 2026-03-16

---

## 개요

인도네시아어 사용자를 대상으로 한 웹 기반 소화기내과 AI 문진 시스템입니다.

- 증상 입력 → Red Flag(위험 신호) 즉시 감지 → AI 감별진단 Top-3 제시
- 선택형 문진: 자체 파인튜닝 Gemma 모델 (GPU 서버)
- 대화형 문진: OpenAI GPT-4o
- 지원 언어: 인도네시아어(id), 한국어(ko)

---

## 아키텍처

```
사용자 브라우저
    ↓
Firebase Hosting  (React 정적 파일, 글로벌 CDN)
    ↓ /api/*
Cloud Run  (Node.js Express, asia-northeast3 서울)
    ├─ [rule survey]  →  GPU 추론 서버 :8755  →  vLLM Gemma (TP2)
    └─ [chat survey]  →  OpenAI GPT-4o
    ↓ (비동기)
Google Sheets  (응답 로그 저장)
```

### 컴포넌트별 역할

| 컴포넌트 | 위치 | 설명 |
|---------|------|------|
| 프론트엔드 | `frontend/` | React 18 + Vite + Tailwind CSS |
| 백엔드 | `backend/` | Node.js Express, Cloud Run |
| AI 서버 | `ai_server/` | FastAPI + vLLM, GPU 서버 |

---

## 폴더 구조

```
SA_valid/
├── frontend/               # React 프론트엔드
│   ├── src/
│   │   ├── App.jsx         # 단일 파일 SPA (모든 로직)
│   │   └── data/
│   │       └── questionnaireData.json   # 문진 데이터 (6-테이블 JSON)
│   ├── public/
│   │   └── body-map.svg    # 복부 통증 위치 SVG
│   └── vite.config.js
│
├── backend/                # Node.js 백엔드
│   ├── server.js           # Express 서버 (port 3001)
│   └── prompts.yaml        # AI 프롬프트 + 질병 리스트
│
├── ai_server/              # GPU 서버용 AI 추론 코드
│   ├── inference_server.py # FastAPI 서버 (port 8755)
│   ├── start.sh            # vLLM + FastAPI 실행 스크립트
│   └── requirements.txt
│
├── docs/                   # 기술 문서
│   ├── MASTER_DOCUMENT.md  # 통합 기술 문서
│   ├── EVALUATION_REPORT.md
│   ├── POSTPROCESS_PLAN.md
│   ├── PROJECT_DOCUMENTATION.md
│   ├── DATASET_OVERVIEW.md
│   ├── DEPLOY_POLICY.md
│   └── CHANGELOG.md
│
├── .github/workflows/
│   └── deploy.yml          # CI/CD (main push → 자동 배포)
│
└── convert_new_data.py     # 문진 데이터 변환 스크립트
```

---

## 로컬 실행

### 요구사항

- Node.js 18+
- OpenAI API 키

### 백엔드

```bash
cd backend
cp .env.example .env      # OPENAI_API_KEY 입력
npm install
npm start                  # port 3001
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev                # port 5173 (Vite proxy → localhost:3001)
```

---

## GPU 서버 (AI 추론)

**모델**: `aisingapore/Gemma-SEA-LION-v3-9B-IT` + LoRA `MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172`

```bash
cd ai_server
pip install -r requirements.txt
bash start.sh
```

`start.sh` 내용:
- GPU 1+2 Tensor Parallel(TP=2)로 vLLM 서버 실행 (port 8754)
- FastAPI 추론 서버 실행 (port 8755)

### 환경변수

```bash
VLLM_URLS=http://localhost:8754   # vLLM 서버 주소 (콤마로 여러 개 가능)
VLLM_MODEL=gastro                  # LoRA alias
```

---

## 백엔드 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/health` | GET | 헬스체크 |
| `/api/assign-survey` | GET | rule/chat 모드 배정 (A/B 균등 분배) |
| `/api/analyze` | POST | 문진 결과 → AI 감별진단 |
| `/api/chat` | POST | AI 채팅 (SSE 스트리밍) |

### `/api/analyze` 요청 예시

```json
{
  "category": "abd_pain",
  "responses": [
    { "question": "통증이 갑자기 시작됐나요?", "answers": "아니오", "is_red_flag": true },
    { "question": "통증 위치는?", "answers": ["상복부"], "is_red_flag": false }
  ],
  "language": "id",
  "gender": "female",
  "age": "35",
  "redFlagTriggered": false,
  "surveyType": "rule"
}
```

---

## 문진 흐름

```
언어 선택 (ko / id)
    ↓
동의서 화면 (LEMBAR PERSETUJUAN)
    ↓
증상 카테고리 선택 (6개)
    ├─ rule survey (선택형) — A/B 배정
    └─ chat survey (대화형)
    ↓
Red Flag 질문 (YES → 즉시 경고)
    ↓
일반 문진 완료 → /api/analyze 호출
    ↓
결과 페이지 (감별진단 Top-3 + AI 채팅)
```

### 지원 카테고리 (6개)

| 코드 | 카테고리 |
|------|---------|
| `abd_pain` | 배가 아파요 |
| `indigestion` | 소화가 안돼요 |
| `vomiting` | 토를 했어요 |
| `diarrhea` | 설사를 해요 |
| `jaundice` | 피부·눈이 노랗게 변했어요 |
| `constipation` | 변을 잘 못봐요 |

---

## AI 모델 — 5단계 후처리

선택형 문진 결과에 대해 `inference_server.py`에서 자동 적용:

| # | 단계 | 내용 |
|---|------|------|
| 1 | 균등 학습 유지 | 50개 질환 균등 학습 |
| 2 | Confidence 보정 | 암/중증 + Red Flag 없음 → high → medium 강제 하향 |
| 3 | 질환별 가중치 | 흔한 질환 ×1.5~1.8, 암 ×0.3~0.4 |
| 4 | Red Flag Safety Gate | Red Flag 없음 + 암 → score ×0.3 + 배제 검사 권고 문구 |
| 5 | Common Disease Fallback | Top-3에 흔한 질환 없으면 Dispepsia 강제 삽입 |

---

## 배포

`main` 브랜치 push 시 GitHub Actions 자동 배포:
1. 백엔드: Docker 빌드 → GCR → Cloud Run
2. 프론트엔드: Vite 빌드 → Firebase Hosting

### 필수 GitHub Secrets

| Secret | 설명 |
|--------|------|
| `GCP_PROJECT_ID` | GCP 프로젝트 ID |
| `GCP_SA_KEY` | 서비스 계정 키 (JSON) |
| `CLOUD_RUN_URL` | 백엔드 Cloud Run URL |
| `OPENAI_API_KEY` | OpenAI API 키 |
| `GOOGLE_SHEET_URL` | Google Apps Script URL |
| `FIREBASE_TOKEN` | Firebase CI 토큰 |
| `GPU_SERVER_URL` | GPU 추론 서버 URL |

### 운영 URL

| 서비스 | URL |
|-------|-----|
| 프론트엔드 | `https://sasubstantiation-70423.web.app` |
| 백엔드 (Cloud Run) | `https://sa-backend-w5ygptw5ya-du.a.run.app` |

---

## 문서

자세한 기술 내용은 `docs/` 폴더를 참조하세요:

- [`docs/MASTER_DOCUMENT.md`](docs/MASTER_DOCUMENT.md) — 전체 기술 통합 문서
- [`docs/EVALUATION_REPORT.md`](docs/EVALUATION_REPORT.md) — 모델 평가 결과 (Gemma 96.7% Top-1)
- [`docs/POSTPROCESS_PLAN.md`](docs/POSTPROCESS_PLAN.md) — 5단계 후처리 설계
- [`docs/DATASET_OVERVIEW.md`](docs/DATASET_OVERVIEW.md) — 학습 데이터셋 개요 (50개 질환, 14,482건)
- [`docs/DEPLOY_POLICY.md`](docs/DEPLOY_POLICY.md) — 배포 정책 및 CI/CD
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — 변경 이력
