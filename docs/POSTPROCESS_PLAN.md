# 4.5 안전성 설계 — 5단계 후처리 구현 계획

**배경**: 학습 데이터가 53개 질환 균등 분포이므로 모델이 암/중증 질환을 경미한 증상에도 높은 순위로 출력할 위험이 있다. 모델 재학습 없이 추론 후처리로 해결한다.

**구현 위치**: `backend/server.js` — `/api/analyze` 엔드포인트에서 모델 응답 JSON 파싱 직후, `res.json()` 직전에 후처리 함수를 삽입한다.

현재 코드 흐름:
```
모델 응답 → JSON 파싱(line 327) → [여기에 후처리 삽입] → res.json(line 335)
```

---

## 공통 상수 정의

후처리 전체에서 공유하는 질환 분류 테이블을 `server.js` 상단에 정의한다.

```js
// ── 후처리 상수 ───────────────────────────────────────────
const CANCER_DISEASES = [
  'Kanker lambung', 'Kanker kolon', 'Kanker rektum',
  'Kanker esofagus', 'Kanker hati', 'Kanker kepala pankreas',
  'Kolangiokarsinoma'
];

const SERIOUS_DISEASES = [
  ...CANCER_DISEASES,
  'Sirosis hati', 'Varises esofagus', 'Perforasi ulkus peptikum'
];

const COMMON_DISEASES = [
  'GERD', 'Esofagitis refluks', 'Gastritis',
  'Dispepsia fungsional', 'IBS', 'Gastroenteritis akut',
  'Konstipasi fungsional', 'Diare akibat obat'
];

// 실제 유병률 기반 가중치
const DISEASE_WEIGHTS = {
  'GERD':                   1.8,
  'Esofagitis refluks':     1.8,
  'Gastritis':              1.7,
  'Dispepsia fungsional':   1.7,
  'IBS':                    1.6,
  'Gastroenteritis akut':   1.6,
  'Konstipasi fungsional':  1.5,
  'Kanker lambung':         0.4,
  'Kanker kolon':           0.4,
  'Kanker rektum':          0.4,
  'Kanker esofagus':        0.3,
  'Kanker hati':            0.3,
  'Kanker kepala pankreas': 0.3,
  'Kolangiokarsinoma':      0.3,
  'Sirosis hati':           0.4,
};
```

---

## 단계별 구현

### 단계 1 — 균등 학습 유지
**상태**: ✅ 완료 (학습 시 리밸런싱 없이 53개 균등 분포로 학습)

---

### 단계 2 — Temperature Scaling

**목적**: 모델 confidence(`"high"` / `"medium"` / `"low"`)가 실제 정확도와 맞지 않을 수 있으므로 val set 기준으로 보정한다.

**현재 상황**: EVALUATION_REPORT 기준 Gemma의 confidence 분포가 `high` 2,505 / `medium` 1,851로 high 편향 가능성 있음.

**구현 방법**:

val set(1,452건)에서 confidence별 실제 정확도를 측정한 후, 보정 테이블을 만든다.

```js
// confidence 보정 테이블 (val set 측정 후 채워 넣기)
const CONFIDENCE_CALIBRATION = {
  high:   { threshold: 0.85, label: 'high' },   // 실제 정확도 ≥ 0.85 → 그대로
  medium: { threshold: 0.60, label: 'medium' },  // 0.60~0.85 → medium
  low:    { threshold: 0.0,  label: 'low' },     // < 0.60 → low
};

function calibrateConfidence(result, redFlagTriggered) {
  return result.map(item => {
    const diseases = Array.isArray(item.disease) ? item.disease : [item.disease];
    const isSerious = diseases.some(d => SERIOUS_DISEASES.includes(d));

    // 암/중증이고 Red Flag 없으면 confidence 강제 하향
    if (isSerious && !redFlagTriggered && item.confidence === 'high') {
      return { ...item, confidence: 'medium' };
    }
    return item;
  });
}
```

**할 일**:
- [ ] val set에서 confidence별 실제 Top-1 정확도 측정 스크립트 작성
- [ ] 측정값으로 `CONFIDENCE_CALIBRATION` 테이블 채우기

---

### 단계 3 — 질환별 가중치 보정

**목적**: 실제 유병률을 반영해 흔한 질환은 score를 높이고, 암은 score를 낮춘다.

**주의**: 모델 출력에는 수치 score가 없고 `confidence` 문자열만 있다. 따라서 confidence → 수치 변환 → 가중치 적용 → 재정렬 → 다시 confidence 변환 흐름으로 처리한다.

```js
const CONFIDENCE_TO_SCORE = { high: 0.9, medium: 0.6, low: 0.3 };
const SCORE_TO_CONFIDENCE = score =>
  score >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low';

function applyDiseaseWeights(result) {
  return result
    .map(item => {
      const diseases = Array.isArray(item.disease) ? item.disease : [item.disease];
      const weight = diseases.reduce((w, d) => {
        return DISEASE_WEIGHTS[d] !== undefined
          ? Math.min(w, DISEASE_WEIGHTS[d])  // 여러 질환 중 가장 낮은 가중치 적용
          : w;
      }, 1.0);

      const rawScore = CONFIDENCE_TO_SCORE[item.confidence] ?? 0.5;
      const adjustedScore = Math.min(rawScore * weight, 1.0);
      return {
        ...item,
        _score: adjustedScore,
        confidence: SCORE_TO_CONFIDENCE(adjustedScore)
      };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...item }) => item);  // _score 제거 후 반환
}
```

---

### 단계 4 — Red Flag Safety Gate

**목적**: Red Flag 없이 암이 Top-3에 나오면 score를 추가 감점하고 안내 문구를 붙인다. Red Flag 충분히 있으면 암을 삭제하지 않되 "정밀검사 권장" 문구를 붙인다.

```js
function applyRedFlagSafetyGate(result, redFlagTriggered) {
  return result.map(item => {
    const diseases = Array.isArray(item.disease) ? item.disease : [item.disease];
    const isSerious = diseases.some(d => SERIOUS_DISEASES.includes(d));
    if (!isSerious) return item;

    if (!redFlagTriggered) {
      // Red Flag 없음 → 추가 감점 + 배제 권고 문구
      const rawScore = CONFIDENCE_TO_SCORE[item.confidence] ?? 0.5;
      const penalized = rawScore * 0.3;
      return {
        ...item,
        _score: penalized,
        confidence: SCORE_TO_CONFIDENCE(penalized),
        safety_note: 'Pemeriksaan lanjutan diperlukan untuk menyingkirkan kondisi ini. (배제 검사 권고)'
      };
    } else {
      // Red Flag 있음 → score 유지 + 정밀검사 권장 문구
      return {
        ...item,
        safety_note: 'Pemeriksaan lebih lanjut (endoskopi/USG/CT) sangat dianjurkan. (정밀검사 권장)'
      };
    }
  });
}
```

**프론트엔드 처리**:
- `safety_note` 필드가 있으면 해당 질환 카드에 노란색 경고 박스로 표시한다.
- Red Flag 없는 암 항목은 자동으로 순위가 밀려나게 된다(단계 3 정렬 이후이므로 별도 재정렬 필요).

---

### 단계 5 — Common Disease Fallback

**목적**: Top-3에 흔한 질환(GERD, Gastritis 등)이 하나도 없으면 3순위에 강제 삽입한다.

```js
function applyCommonDiseaseFallback(result) {
  const hasCommon = result.some(item => {
    const diseases = Array.isArray(item.disease) ? item.disease : [item.disease];
    return diseases.some(d => COMMON_DISEASES.includes(d));
  });

  if (hasCommon) return result;

  // 흔한 질환 없음 → 3순위에 Dispepsia fungsional 강제 삽입
  const fallback = {
    no: 3,
    disease: ['Dispepsia fungsional'],
    symptom_summary: '-',
    red_flags: [],
    differential_reasoning: {
      supporting: ['Kondisi umum yang perlu dipertimbangkan berdasarkan gejala.'],
      against: []
    },
    confidence: 'low',
    patient_edu: ['Konsultasikan dengan dokter untuk pemeriksaan lebih lanjut.'],
    _fallback: true
  };

  // Top-2만 유지하고 3순위를 fallback으로 교체
  return [...result.slice(0, 2), fallback];
}
```

---

## 후처리 파이프라인 통합

`server.js`의 JSON 파싱 직후(`line 333` 이후)에 아래 함수를 삽입한다:

```js
function applyPostProcessing(analysisJson, redFlagTriggered) {
  if (!analysisJson?.result || !Array.isArray(analysisJson.result)) {
    return analysisJson;
  }

  let result = analysisJson.result;

  // 단계 2: Temperature Scaling (confidence 보정)
  result = calibrateConfidence(result, redFlagTriggered);

  // 단계 3: 질환별 가중치 보정 + 재정렬
  result = applyDiseaseWeights(result);

  // 단계 4: Red Flag Safety Gate (재정렬 이후 적용)
  result = applyRedFlagSafetyGate(result, redFlagTriggered);

  // 단계 4 이후 score 기준으로 다시 정렬
  result = result
    .map((item, idx) => ({ ...item, no: idx + 1 }));

  // 단계 5: Common Disease Fallback
  result = applyCommonDiseaseFallback(result);

  return { ...analysisJson, result };
}

// 기존 코드에서 res.json() 직전에 삽입:
analysisJson = applyPostProcessing(analysisJson, redFlagTriggered);
```

---

## 구현 순서

| 순서 | 작업 | 비고 |
|------|------|------|
| 1 | 상수 정의 (`CANCER_DISEASES`, `DISEASE_WEIGHTS` 등) | `server.js` 상단 |
| 2 | 단계 3 구현 (가중치 보정) | 가장 효과 큼, 먼저 구현 |
| 3 | 단계 4 구현 (Red Flag Safety Gate) | safety_note 프론트 표시 포함 |
| 4 | 단계 5 구현 (Common Disease Fallback) | |
| 5 | 단계 2 구현 (Temperature Scaling) | val set 측정 선행 필요 |
| 6 | 프론트엔드 `safety_note` 표시 UI 추가 | `App.jsx` 결과 카드 부분 |

---

## 테스트 케이스

구현 후 아래 케이스로 검증한다:

| 시나리오 | 입력 | 기대 출력 |
|---------|------|----------|
| 경미한 증상 + Red Flag 없음 + 암 Top-1 | `redFlagTriggered: false` | 암 순위 하락, safety_note 포함 |
| Red Flag 있음 + 암 Top-1 | `redFlagTriggered: true` | 암 유지, "정밀검사 권장" 문구 |
| Top-3에 흔한 질환 없음 | 희귀 질환만 3개 | 3순위에 Dispepsia 삽입 |
| 정상 케이스 (GERD Top-1) | - | 가중치 적용 후 그대로 |
