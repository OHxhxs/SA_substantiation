# SA Substantiation — 마스터 기술 문서

**프로젝트**: 인도네시아어 위장내과 AI 문진 + 감별진단 시스템
**운영사**: MENINBLOX
**최종 업데이트**: 2026-03-15

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [데이터 처리](#2-데이터-처리)
3. [모델 학습](#3-모델-학습)
4. [평가 결과](#4-평가-결과)
5. [시스템 아키텍처](#5-시스템-아키텍처)
6. [프론트엔드](#6-프론트엔드)
7. [백엔드 (Node.js)](#7-백엔드-nodejs)
8. [추론 서버 (GPU)](#8-추론-서버-gpu)
9. [안전성 설계 — 5단계 후처리](#9-안전성-설계--5단계-후처리)
10. [배포 인프라](#10-배포-인프라)
11. [알려진 이슈](#11-알려진-이슈)

---

## 1. 프로젝트 개요

### 목적
환자가 웹에서 증상을 입력하면:
1. Red Flag(위험 신호) 즉시 감지 → 응급 경고
2. 일반 문진 완료 후 AI 감별진단 Top-3 제시

### 두 가지 서브 프로젝트

| 프로젝트 | 설명 | 상태 |
|---------|------|------|
| **SA_valid** | 웹 문진 시스템 (프론트 + 백엔드) | 프로덕션 운영 중 |
| **SA_idn** | Gemma 파인튜닝 (인도네시아어 감별진단 모델) | 학습 완료, 배포 준비 중 |

### 언어 지원
한국어(ko), 인도네시아어(id)

---

## 2. 데이터 처리

### 2.1 문진 데이터 (SA_valid)

원본 데이터는 `Gas_historyTalking_v2.1.json`으로 관리되며, 변환 스크립트(`convert_new_data.py`)를 통해 앱이 사용하는 6-테이블 JSON 포맷으로 변환된다.

**문진 데이터 규모**

| 카테고리 | Red Flag | 일반 문진 | 총 질문 |
|---------|---------|---------|--------|
| 배가 아파요 | 9 | 7 | 16 |
| 소화가 안돼요 | 3 | 10 | 13 |
| 토를 했어요 | 9 | 12 | 21 |
| 설사를 해요 | 6 | 10 | 16 |
| 피부·눈이 노랗게 변했어요 | 6 | 11 | 17 |
| 변을 잘 못봐요 | 4 | 8 | 12 |
| **합계** | **37** | **58** | **95** |

- 선택지(Option): 325개
- FlowLogic: 132개 (ALERT_RED_FLAG 37개, END 6개)

**DB 스키마 (6 테이블)**

| 테이블 | 설명 |
|-------|------|
| Category | 증상 대분류 6개 |
| Question | 문진 질문 (Red Flag / 일반) |
| Option | 선택지 (is_exclusive 지원) |
| ResponseType | YES_NO / MULTI_SELECT / SINGLE_SELECT |
| FlowLogic | 분기 로직 (ALWAYS / YES / NO → ALERT_RED_FLAG / END / 다음질문) |
| StringTable | 다국어 UI 문자열 |

### 2.2 학습 데이터 (SA_idn)

**출처**: HuggingFace `MENINBLOX/Idn_GAS_cpx_CoT_v1`
**원본**: `MENINBLOX/Idn_GAS_cpx_summary_v1` (CoT 변환 전)

**데이터 파이프라인**

```
[원본 HF 데이터]
    │
    ├── filter_gastro.py ──▶ 소화기내과 필터링
    │
    └── convert_to_cot.py ──▶ GPT-4o-mini로 CoT 변환 (Batch API, 50% 할인)
            │
            └── collect_cot.py ──▶ 결과 수집 및 병합
                    │
                    └── prepare_data.py ──▶ Stratified Split (80/10/10)
                            │
                            └── train/val/test_chat.jsonl
```

**데이터 규모**

| 분할 | 건수 |
|------|------|
| Train | 11,578 |
| Val | 1,452 |
| Test | 1,452 |
| **합계** | **14,482** |

**Chat Format 구조**

```json
{
  "messages": [
    { "role": "system", "content": "Anda adalah asisten dokter spesialis gastroenterologi..." },
    { "role": "user",   "content": "<instruction>\n\n###history_talking\ndokter: ...\npasien: ..." },
    { "role": "assistant", "content": "{ JSON CoT 감별진단 결과 }" }
  ]
}
```

**CoT 출력 구조**

```json
{
  "result": [
    {
      "no": 1,
      "disease": ["Kolesistitis akut"],
      "symptom_summary": "...",
      "red_flags": ["nyeri menjalar ke bahu kanan", "demam"],
      "differential_reasoning": {
        "supporting": ["..."],
        "against": ["..."]
      },
      "confidence": "high",
      "patient_edu": ["..."]
    }
  ]
}
```

**대상 질환**: 53개 (GERD, 위암, 간암, 담낭염, 췌장염 등 위장내과 전 범위)

---

## 3. 모델 학습

### 3.1 학습 대상 모델 3종

| 모델 | 베이스 | 파라미터 | 비고 |
|------|-------|---------|------|
| Gemma | aisingapore/Gemma-SEA-LION-v3-9B-IT | 9B | **최종 선택** |
| Apertus | aisingapore/Apertus-SEA-LION-v4-8B-IT | 8B | 성능 미달 |
| Qwen VL | aisingapore/Qwen-SEA-LION-v4-8B-VL | 8B | 텍스트 전용 학습 (비교용) |

### 3.2 학습 설정

| 항목 | 값 |
|------|-----|
| 방법 | QLoRA (4-bit NF4) |
| LoRA r / alpha / dropout | 32 / 64 / 0.05 |
| Target modules | q/k/v/o_proj, gate/up/down_proj |
| Epochs | 3 |
| Batch size | 4 (gradient accum 4 = effective 16) |
| Learning rate | 2e-4 (Cosine scheduler, warmup 0.1) |
| Max sequence length | 4096 |
| Precision | bfloat16 |
| Attention | SDPA (ARM64 환경, flash-attn 불가) |
| Eval / Save | 200 steps마다 (best 3 보존) |

### 3.3 트러블슈팅 기록

| 이슈 | 해결 |
|------|------|
| ARM64에서 flash-attn 빌드 실패 | `attn_implementation="sdpa"` |
| ARM64 PyPI torch가 CPU 전용 | `pip install torch==2.5.1 --index-url .../cu124` |
| trl 0.29에서 `max_seq_length` 미존재 | `max_length`로 변경 |
| Gemma2 원본은 system role 미지원 | SEA-LION v3 IT는 AI Singapore이 chat template에 추가 |
| VL 모델 forward()에 visual input 필수? | `pixel_values` 등 모두 `default=None` → 텍스트 전용 학습 가능 |
| CoT 데이터 생성 비용 | OpenAI Batch API 활용 (50% 할인) |

---

## 4. 평가 결과

**평가 일시**: 2026-03-12
**테스트 샘플**: 1,452건
**추론 엔진**: vLLM 0.17.1 / NVIDIA GH200 480GB

### 4.1 전체 성능 비교

| 지표 | Gemma | Qwen VL | Apertus |
|------|:-----:|:-------:|:-------:|
| Best Eval Loss | 0.3009 | **0.2507** | 0.2955 |
| JSON 파싱 성공률 | **100%** | 99.7% | 99.3% |
| Top-1 정확도 | **96.7%** | 92.8% | 70.4% |
| Top-3 정확도 | **98.5%** | 96.1% | 82.7% |
| Exact Match (Top-3) | **59.8%** | 58.0% | 35.3% |
| 추론 속도 (GH200) | 0.36초/건 | 0.28초/건 | **0.20초/건** |

### 4.2 카테고리별 Top-1 정확도

| 카테고리 | Gemma | Qwen VL | Apertus |
|---------|:-----:|:-------:|:-------:|
| Esofagus | 98.0% | 98.0% | 66.7% |
| Hati | 98.1% | 98.1% | 66.2% |
| Kandung & Saluran Empedu | 98.3% | 95.0% | 56.7% |
| Kolon & Rektum | 96.8% | 90.0% | 62.6% |
| Kondisi Akut & Bedah | 87.0% | 78.0% | 72.0% |
| Lambung & Duodenum | 97.5% | 96.3% | 79.7% |
| Pankreas | 98.7% | 98.7% | 74.7% |
| Usus Halus | 96.0% | 87.0% | 93.0% |

### 4.3 모델 선택 근거

- **Gemma 채택**: 전 지표 1위, JSON 100% 완벽, 임상 사용 기준 충족
- **Qwen VL 탈락**: eval loss는 가장 낮으나 실제 정확도에서 Gemma에 뒤짐 (loss ≠ 정확도)
- **Apertus 탈락**: Top-1 70.4%는 임상 부적합, 대부분 confidence를 "high"로 출력하는 과신(overconfidence) 문제

---

## 5. 시스템 아키텍처

### 현재 (OpenAI 사용 중)

```
사용자 브라우저
    ↓
Firebase Hosting (프론트엔드 — React 정적 파일, 서울 CDN)
    ↓ /api/* 요청
Cloud Run (백엔드 — Node.js Express, asia-northeast3 서울)
    ↓
OpenAI API (gpt-4o)
```

### 목표 (Gemma 전환 후)

```
사용자 브라우저
    ↓
Firebase Hosting (프론트엔드)
    ↓ /api/* 요청
Cloud Run (백엔드 — Node.js Express)
    ↓
FastAPI 추론 서버 (GPU 서버, port 8755)  ← inference_server.py
    ↓
vLLM × 2 인스턴스 (RTX 4090 각 1개, port 8754 / 8756)
    ↓
Gemma-SEA-LION-v3-9B-IT (bfloat16, LoRA adapter 로딩)
```

### 인프라 현황

| 구성요소 | 플랫폼 | 스펙 |
|--------|-------|------|
| 프론트엔드 | Firebase Hosting | 글로벌 CDN |
| 백엔드 | GCP Cloud Run | 512Mi, asia-northeast3 |
| GPU 서버 | 자체 서버 | RTX 4090 × 2 (각 24GB VRAM) |

---

## 6. 프론트엔드

**스택**: React 18 + Vite + Tailwind CSS
**진입점**: `frontend/src/App.jsx` (단일 파일 SPA)
**문진 데이터**: `frontend/src/data/questionnaireData.json`

### 6.1 화면 흐름

```
언어 선택 모달
    ↓
동의서 화면 (Lembar Persetujuan — 인도네시아어 연구 동의)
    ↓
증상 카테고리 선택
    ↓
문진 진행 (Rule-based or Chat-based)
    ├── Red Flag YES → 즉시 경고
    └── 완료 → /api/analyze 호출
    ↓
결과 페이지 (감별진단 Top-3 + AI 채팅)
```

### 6.2 주요 state

| state | 설명 |
|-------|------|
| `view` | selection / rule_survey / chat_survey / results / consent |
| `lang` | ko / id |
| `selectedCategory` | 선택된 증상 카테고리 |
| `answers` | 문진 응답 배열 |
| `redFlagTriggered` | Red Flag 발생 여부 |
| `aiAnalysis` | AI 분석 결과 |

### 6.3 API 연결

```js
// 프로덕션: VITE_API_URL (Cloud Run URL)
// 로컬: Vite proxy → http://backend:3001
const API_URL = import.meta.env.VITE_API_URL || '';
```

### 6.4 Body Map

`배가 아파요` 카테고리 첫 질문(통증 위치)에서 복부 SVG 인터랙션 제공.
파일: `frontend/public/body-map.svg`
5개 존(상복부, 우상복부, 좌상복부, 우하복부, 좌하복부) + 버튼 2개(전 복부, 모르겠다)

---

## 7. 백엔드 (Node.js)

**스택**: Express + OpenAI SDK
**포트**: 3001 (로컬), Cloud Run (프로덕션)
**파일**: `backend/server.js`, `backend/prompts.yaml`

### 7.1 주요 엔드포인트

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /health` | 헬스체크 |
| `POST /api/analyze` | 문진 결과 → AI 감별진단 (non-streaming) |
| `POST /api/chat` | 실시간 AI 채팅 (SSE streaming) |
| `GET /api/assign-survey` | rule/chat 모드 배정 |

### 7.2 /api/analyze 흐름

```
요청 수신 (responses, language, redFlagTriggered 등)
    ↓
prompts.yaml에서 언어별 질병 리스트 + 프롬프트 조립
    ↓
OpenAI gpt-4o 호출 (response_format: json_object)
    ↓
JSON 파싱 (code block 제거 후 재시도 포함)
    ↓
res.json() 반환
    ↓ (비동기)
Google Sheets 저장
```

### 7.3 보안

- Helmet.js 보안 헤더
- Rate limiting: 15분당 100회 (IP 기반)
- API 키 서버 측 보관 (프론트엔드 미노출)
- CORS: 프로덕션에서 특정 도메인만 허용

### 7.4 환경변수

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 |
| `GOOGLE_SHEET_URL` | Google Apps Script 웹훅 URL |
| `NODE_ENV` | development / production |

---

## 8. 추론 서버 (GPU)

**파일**: `scripts/inference_server.py`
**역할**: vLLM 래퍼 + 5단계 후처리
**스택**: FastAPI + httpx + vLLM

### 8.1 구성

```
FastAPI (port 8755)
    ├── 라운드로빈 로드밸런서
    ├── vLLM instance 0 (GPU 0, port 8754) — bfloat16, Gemma 9B
    └── vLLM instance 1 (GPU 1, port 8756) — bfloat16, Gemma 9B
```

**왜 독립 인스턴스 2개인가?**
- RTX 4090 24GB에 Gemma 9B bfloat16(~18GB) + KV cache(~6GB)가 딱 맞게 들어감
- Tensor Parallel보다 처리량이 2배 높음 (100명 커버 목적)
- 양자화 없이 bfloat16 원본 정확도 유지

### 8.2 실행

```bash
# GPU 0
CUDA_VISIBLE_DEVICES=0 vllm serve MENINBLOX/Idn_Gas_Gemma_v1 \
  --dtype bfloat16 --port 8754

# GPU 1
CUDA_VISIBLE_DEVICES=1 vllm serve MENINBLOX/Idn_Gas_Gemma_v1 \
  --dtype bfloat16 --port 8756

# FastAPI
VLLM_URLS="http://localhost:8754,http://localhost:8756" \
VLLM_MODEL="MENINBLOX/Idn_Gas_Gemma_v1" \
uvicorn scripts.inference_server:app --host 0.0.0.0 --port 8755
```

### 8.3 처리 용량 (RTX 4090 × 2 기준)

| 시나리오 | 판정 |
|---------|------|
| 하루 100명 (분산) | ✅ 여유 있음 |
| 동시 접속 ~10명 | ✅ 정상 |
| 동시 접속 100명 | 🔶 큐 대기 발생 (최대 30~60초) |

---

## 9. 안전성 설계 — 5단계 후처리

**배경**: 학습 데이터가 53개 질환 균등 분포 → 경미한 증상에도 암이 Top-1으로 나올 위험.
모델 재학습 없이 추론 후처리로 해결. `inference_server.py`의 `apply_postprocessing()`에 구현.

### 단계별 요약

| # | 단계 | 설명 | 구현 위치 |
|---|------|------|----------|
| 1 | 균등 학습 유지 | 리밸런싱 없이 53개 균등 학습 | ✅ 학습 완료 |
| 2 | Temperature Scaling | val set 기준 confidence 보정 | `step2_calibrate_confidence()` |
| 3 | 질환별 가중치 보정 | 흔한 질환 ×1.5~1.8, 암 ×0.3~0.5 | `step3_apply_weights()` |
| 4 | Red Flag Safety Gate | Red Flag 없으면 암 score ×0.3 + "배제 검사 권고" 문구 | `step4_red_flag_gate()` |
| 5 | Common Disease Fallback | Top-3에 흔한 질환 없으면 Dispepsia 강제 삽입 | `step5_common_disease_fallback()` |

### 핵심 로직

**단계 3 — 가중치 예시**
```
Gastritis (원래 confidence: high, score 0.9) × 1.7 = 1.0 → high 유지
Kanker lambung (confidence: high, score 0.9) × 0.4 = 0.36 → low로 하락
```

**단계 4 — Red Flag Gate**
```
Red Flag 없음 + 암 Top-1 → score × 0.3 → 순위 밀림 + safety_note 표시
Red Flag 있음 + 암 Top-1 → 삭제 안 함 + "정밀검사 권장" 문구
```

**프론트엔드 처리 필요**: 결과 카드에서 `safety_note` 필드가 있으면 노란색 경고 박스 표시 (미구현)

---

## 10. 배포 인프라

### 10.1 CI/CD

`main` 브랜치 push → GitHub Actions 자동 실행

```
[1단계] 백엔드: Docker 빌드 → GCR 푸시 → Cloud Run 배포
[2단계] 프론트엔드: npm build (VITE_API_URL 주입) → Firebase Hosting 배포
```

### 10.2 GitHub Secrets

| Secret | 설명 |
|--------|------|
| `GCP_PROJECT_ID` | GCP 프로젝트 ID |
| `GCP_SA_KEY` | 서비스 계정 키 (JSON) |
| `CLOUD_RUN_URL` | 백엔드 Cloud Run URL |
| `OPENAI_API_KEY` | OpenAI API 키 |
| `GOOGLE_SHEET_URL` | Google Apps Script URL |
| `FIREBASE_TOKEN` | Firebase CI 토큰 |

### 10.3 주요 URL

| 서비스 | URL |
|-------|-----|
| 프론트엔드 | `https://sasubstantiation-70423.web.app` |
| 백엔드 (Cloud Run) | `https://sa-backend-w5ygptw5ya-du.a.run.app` |

### 10.4 Cloud Run 설정

| 항목 | 값 |
|------|-----|
| 리전 | asia-northeast3 (서울) |
| 메모리 | 512Mi |
| 최대 인스턴스 | 10 |
| 타임아웃 | 300초 |

### 10.5 롤백

```bash
# Cloud Run 이전 리비전으로 즉시 전환
gcloud run services update-traffic sa-backend \
  --to-revisions [REVISION_NAME]=100 \
  --region asia-northeast3
```

---

## 11. 알려진 이슈

| 파일 | 위치 | 내용 | 우선순위 |
|------|------|------|---------|
| `backend/server.js` | line 257 | `model: 'gpt-5-mini'` → `gpt-4o-mini`로 수정 필요 | 낮음 (현재 `/api/analyze`는 gpt-4o 사용) |
| `frontend/src/App.jsx` | 결과 카드 | `safety_note` 필드 표시 UI 미구현 | 중간 (후처리 전환 전 구현 필요) |
| `scripts/inference_server.py` | step2 | Temperature Scaling 보정 테이블 미완성 (val set 측정 필요) | 중간 |

---

*이 문서는 `PROJECT_DOCUMENTATION.md`, `EVALUATION_REPORT.md`, `POSTPROCESS_PLAN.md`, `DEPLOY_POLICY.md`, `BACKEND_SETUP.md`, `CHANGELOG.md`, `README.md`를 통합하여 작성되었습니다.*
