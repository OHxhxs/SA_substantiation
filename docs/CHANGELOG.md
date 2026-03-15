# SA_valid 프로젝트 변경 기록

> 작업 날짜 기준으로 누적 기록합니다.

---

## 2026-03-11

### 1. 로컬 실행 환경 설정

**문제**
- `frontend/vite.config.js` 프록시 타겟이 Docker 호스트명(`http://backend:3001`)으로 설정되어 있어 로컬 실행 불가

**수정 파일**: `frontend/vite.config.js`
```diff
- target: 'http://backend:3001',
+ target: 'http://localhost:3001',
```

**추가 작업**
- 루트의 `.env`를 `backend/.env`로 복사 (백엔드가 자체 디렉토리에서 `.env` 탐색)
- `backend/` 의존성 미설치 상태 → `npm install` 실행
- `frontend/node_modules` 손상 → 재설치 (`rm -rf node_modules && npm install`)

**실행 결과**
| 서비스 | URL | 포트 |
|--------|-----|------|
| 프론트엔드 (Vite) | http://localhost:8755 | 8755 |
| 백엔드 (Express) | http://localhost:3001 | 3001 |

---

### 2. 문진 데이터 교체 — `Gas_historyTalking_v2.1.json`

**배경**
- 기존 데이터: `interview_system_db.xlsx` → `questionnaireData.json` (구 형식)
- 신규 데이터: `Gas_historyTalking_v2.1.json` (새 형식)
- 요구사항: 카테고리 6개 유지, 문진 내용 전면 교체

**신규 JSON 구조**
```
{
  "abd_pain":     { "title": "배가 아파요",            "redFlags": [...], "questions": [...] },
  "indigestion":  { "title": "소화가 안돼요",          "redFlags": [...], "questions": [...] },
  "vomiting":     { "title": "토를 했어요",            "redFlags": [...], "questions": [...] },
  "diarrhea":     { "title": "설사를 해요",            "redFlags": [...], "questions": [...] },
  "jaundice":     { "title": "피부·눈이 노랗게 변했어요", "redFlags": [...], "questions": [...] },
  "constipation": { "title": "변을 잘 못봐요",         "redFlags": [...], "questions": [...] }
}
```

**변환 방식**
- 신규 형식 → App.jsx가 읽는 기존 테이블 형식(`Category / Question / Option / ResponseType / FlowLogic`)으로 변환
- 변환 스크립트 신규 생성: `convert_new_data.py`

**변환 규칙**
| 신규 필드 | 구 테이블 매핑 |
|-----------|---------------|
| `redFlags[i]` | Question (is_red_flag=true, response_type_id=RT001) |
| `questions[i].type == "radio"` | response_type_id=RT003 (SINGLE_SELECT) |
| `questions[i].type == "checkbox"` | response_type_id=RT002 (MULTI_SELECT) |
| Red Flag YES 선택 | FlowLogic → ALERT_RED_FLAG |
| Red Flag NO 선택 | FlowLogic → 다음 질문 |
| 일반 질문 완료 | FlowLogic → ALWAYS → 다음 질문 or END |

**변환 결과**
| 카테고리 | Red Flag | 일반 문진 | 총 질문 |
|----------|----------|-----------|---------|
| 배가 아파요 | 9 | 7 | 16 |
| 소화가 안돼요 | 3 | 10 | 13 |
| 토를 했어요 | 9 | 12 | 21 |
| 설사를 해요 | 6 | 10 | 16 |
| 피부·눈이 노랗게 변했어요 | 6 | 11 | 17 |
| 변을 잘 못봐요 | 4 | 8 | 12 |
| **합계** | **37** | **58** | **95** |

- 선택지(Option): 325개
- FlowLogic: 132개 (ALERT_RED_FLAG 분기 37개, END 분기 6개)
- display_order 연속성: 전 카테고리 ✅

**수정/생성 파일**
- `convert_new_data.py` — 신규 생성 (변환 스크립트)
- `frontend/src/data/questionnaireData.json` — 데이터 전면 교체

---

---

### 3. 베트남어 언어 옵션 제거

**수정 파일**: `frontend/src/App.jsx`

| 위치 | 수정 내용 |
|------|-----------|
| line 728 (LanguageSelectionStep) | `{ id: 'vn', label: 'Tiếng Việt (Vietnamese)', flag: '🇻🇳' }` 항목 제거 |
| line 839 (헤더 언어 스위처) | `['ko', 'vn', 'id']` → `['ko', 'id']` |

언어 선택 페이지와 헤더 토글에서 베트남어(VN) 제거. 한국어/인도네시아어만 표시.

---

### 4. 대상자 정보 입력 단계 제거

**수정 파일**: `frontend/src/App.jsx`

| 위치 | 수정 내용 |
|------|-----------|
| LanguageSelectionStep `onClick` | `setModalStep(2)` → `setShowUserModal(false)` (언어 선택 즉시 모달 닫기) |
| 모달 progress bar | step 조건부 렌더링 제거, 항상 full width |
| 모달 내부 렌더링 | `modalStep === 1 ? <LanguageSelectionStep /> : <UserInfoStep />` → `<LanguageSelectionStep />` 고정 |
| `checkUserInfoAndFinish` | userData 체크 및 모달 재오픈 로직 제거, 바로 `finishSurvey` 호출 |
| 헤더 유저 ID 표시 | `userData.id && !showUserModal` 조건부 블록 제거 |

언어 선택 후 바로 메인 화면으로 진입. 대상자 ID / 성별 / 나이 입력 단계 없음.

---

### 5. 복부 통증 위치 Body Map 인터랙션 추가

**배경**
- `배가 아파요` 카테고리의 첫 번째 일반 문진(Q1: "통증의 위치는 어디인가요?")에서
  신체 이미지 위에 존(zone)을 클릭하면 해당 선택지가 하이라이트 되도록 구현

**추가 파일**
- `frontend/public/body-map.svg` — 복부 위치 도식 SVG (Frame 1984078575.svg 복사)

**수정 파일**: `frontend/src/App.jsx`
- `AbdomenBodyMap` 컴포넌트 추가 (return문 직전)
- 질문 렌더링 영역에서 `currentQuestion.question_id === 'CAT001_Q01'` 조건부로 Body Map 표시

**존(Zone) 좌표 매핑** (SVG 651×511 기준)
| 선택지 | SVG x | SVG y | w | h |
|--------|-------|-------|---|---|
| 상복부(명치) | 277 | 119 | 97 | 151 |
| 우상복부 | 170 | 119 | 97 | 151 |
| 좌상복부 | 384 | 119 | 97 | 151 |
| 우하복부 | 170 | 276 | 153 | 166 |
| 좌하복부 | 332 | 276 | 149 | 166 |

- `전 복부 / 흩어져 있음`, `모르겠다 / 잘 모르겠음` 2개는 기존 버튼 형태로 맵 아래 표시
- 선택 시 파란색 오버레이(22% 투명도) + 파란 테두리로 하이라이트
- 단일 선택(radio)이므로 다른 존 클릭 시 이전 선택 자동 해제

**[수정] Body Map 색상 및 특수 옵션 처리 개선**
- SVG 내 하드코딩된 우상복부 청록색 제거 → 미선택 시 흰색 반투명 오버레이로 덮음
- 선택 시 색상: SVG 원본과 동일한 청록색 (`rgba(19,249,235,0.35)` + `border #00C1CD`)
- **전 복부 / 흩어져 있음** 선택 → 5개 존 전체 하이라이트
- **모르겠다 / 잘 모르겠음** 선택 → 모든 존 하이라이트 소거

---

### 6. 동의서 화면 추가 (언어 선택 → 동의서 → 메인)

**흐름 변경**: 언어 선택 → `view='consent'` → 전체 동의 후 `view='selection'`

**수정 파일**: `frontend/src/App.jsx`
- `consentChecked` state (3개 항목), `consentDetail` state (보기 모달 인덱스) 추가
- 언어 선택 `onClick`에 `setView('consent')` 추가
- `view === 'consent'` 렌더 블록 추가

**동의서 구성 (3개 항목)**
| 항목 | 내용 |
|------|------|
| (Wajib) Tujuan & Prosedur Penelitian | 연구 목적 및 절차 |
| (Wajib) Kerahasiaan & Perlindungan Data Pribadi | 데이터 보호 및 개인정보, 응답자 권리 |
| (Wajib) Pernyataan Persetujuan | 최종 동의 선언 |

**UI 구조 (v2)**
- 스크롤 가능한 단일 컨테이너에 8개 섹션 전문 표시 (높이 420px, overflow-y scroll)
- 별도 컨테이너(border box)에 단일 체크박스 "Saya setuju"
- 체크박스 체크 시만 "확인" 버튼 활성화 (녹색)
- 뒤로가기 → 언어 선택 모달 재표시, 체크 초기화

원본 문서: `LEMBAR PERSETUJUAN MENGIKUTI PENELITIAN` (Sirka × MENINBLOX 공동 연구)

---

---

## 2026-03-16

### 7. AI 서버 분리 및 Gemma 추론 파이프라인 구축

**배경**
- 선택형(rule) 문진 결과 분석을 OpenAI에서 자체 GPU 서버 Gemma 모델로 전환
- ai_server/ 폴더 신설하여 GPU 서버 코드 분리

**신규 파일**: `ai_server/inference_server.py`
- FastAPI 서버 (port 8755), vLLM 래퍼
- 라운드로빈 로드밸런서 (`itertools.cycle`)
- MediKoGPT 프롬프트 포맷 (`###history_talking`)
- 5단계 후처리: `step2_calibrate_confidence` / `step3_apply_weights` / `step4_red_flag_gate` / `step5_common_disease_fallback`

**신규 파일**: `ai_server/start.sh`
- GPU 1+2 Tensor Parallel (TP=2), vLLM 서버 + FastAPI 연속 실행
- Base model: `aisingapore/Gemma-SEA-LION-v3-9B-IT`
- LoRA: `MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172` (alias: `gastro`)

**수정 파일**: `backend/server.js`
- `gpuClient` (OpenAI SDK → vLLM 직접 호출) 제거
- `GPU_SERVER_URL` 환경변수 추가 (기본: `http://121.167.147.14:8755`)
- `surveyType` 기반 라우팅:
  - `rule` → GPU 서버 (Gemma)
  - `chat` → OpenAI gpt-4o

**수정 파일**: `.github/workflows/deploy.yml`
- `GPU_SERVER_URL=${{ secrets.GPU_SERVER_URL }}` Cloud Run 환경변수 추가

---

### 8. 프로덕션 JSON 파싱 오류 수정

**문제**: Firebase에서 `/api/analyze` 호출 시 `Unexpected token '<'...` 오류
**원인**: `API_URL = ''` — Vite 프록시가 프로덕션 환경에서 작동하지 않아 HTML 반환
**수정 파일**: `frontend/src/App.jsx`

```diff
- const API_URL = '';
+ const API_URL = import.meta.env.VITE_API_URL || '';
```

---

## 알려진 이슈

| 파일 | 위치 | 내용 |
|------|------|------|
| `frontend/src/App.jsx` | 결과 카드 | `safety_note` 필드 표시 UI 미구현 (암 배제 권고 경고 박스) |
| `ai_server/inference_server.py` | step2 | Temperature Scaling 보정 테이블 미완성 (val set 측정 필요) |
