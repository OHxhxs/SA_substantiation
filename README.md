# 문진 시스템 기술 문서 (README)

**Medical Questionnaire System Technical Documentation**
버전 1.0 | 2025-01-26

—

## 1. 개요

본 문서는 웹 기반 의료 문진 시스템의 데이터베이스 스키마 구조와 문진 진행 로직, 그리고 AI API 연동 방법을 설명합니다.

### 1.1 시스템 목적

환자의 증상을 체계적으로 수집하여 의료진에게 전달
- Red Flag (위험 신호) 증상 조기 발견 및 즉시 경고
- AI 분석을 통한 예비 진단 정보 제공
- 다국어 지원을 통한 글로벌 서비스 확장
### 1.2 문진 흐름 요약

사용자가 증상 카테고리 선택 (예: 배가 아파요)
2. Red Flag 질문 9개를 순차적으로 진행
3. Red Flag에서 ‘예’ 선택 시 즉시 경고 및 병원 방문 권고
4. 모든 Red Flag 통과 시 일반 문진 7개 진행
5. 문진 완료 후 AI API 호출하여 분석 결과 생성
6. 결과를 사용자 및 의료진에게 전달
—

## 2. 데이터베이스 스키마

문진 시스템은 6개의 핵심 테이블로 구성됩니다.

### 2.1 Category (증상 카테고리)

증상의 대분류를 정의합니다. 사용자가 처음 선택하는 메인 증상입니다.

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| category_id | STRING | 고유 식별자 (예: CAT001) |
| category_code | STRING | 코드명 (예: STOMACH_PAIN) |
| category_name_ko | STRING | 한국어 표시명 (예: 배가 아파요) |
| display_order | INTEGER | 화면 표시 순서 |
| is_active | BOOLEAN | 활성화 여부 |

### 2.2 Question (문진 질문)

모든 문진 질문을 저장합니다. Red Flag 질문과 일반 문진 질문을 구분합니다.

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| question_id | STRING | 고유 식별자 (예: Q001) |
| question_index | STRING | 원본 인덱스 코드 (예: 120101000) |
| category_id | STRING | 소속 카테고리 FK |
| question_type | STRING | 질문 유형 (Red Flag1~9, 일반문진1~7) |
| question_text_ko | STRING | 질문 텍스트 (한국어) |
| response_type_id | STRING | 응답 유형 FK (RT001 등) |
| is_red_flag | BOOLEAN | 위험 신호 질문 여부 |
| display_order | INTEGER | 표시 순서 |
| is_active | BOOLEAN | 활성화 여부 |

### 2.3 Option (선택지)

각 질문에 대한 선택 가능한 답변 옵션을 정의합니다.

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| option_id | STRING | 고유 식별자 (예: OPT001) |
| option_index | STRING | 원본 인덱스 (예: 120101001) |
| question_id | STRING | 소속 질문 FK |
| option_text_ko | STRING | 선택지 텍스트 (한국어) |
| display_order | INTEGER | 표시 순서 |
| is_exclusive | BOOLEAN | 배타적 옵션 여부 (선택 시 다른 옵션 해제) |
| next_question_id | STRING | 다음 질문 ID (분기 로직용) |

> 💡 **is_exclusive 예시**: ‘모르겠다/해당없음’ 옵션 선택 시 이미 선택된 다른 옵션들이 자동 해제됩니다.

### 2.4 ResponseType (응답 유형)

질문의 응답 방식을 정의합니다.

| type_id | type_code | 설명 |
|---------|-----------|------|
| RT001 | YES_NO | 예/아니오 단일 선택 (Red Flag용) |
| RT002 | MULTI_SELECT | 중복 선택 가능 (통증 위치, 동반 증상 등) |
| RT003 | BRANCH_3 | 3가지 중 단일 선택 (시작 시점 등) |
| RT004 | BRANCH_5 | 5가지 중 단일 선택 (식사 연관성 등) |
| RT005 | ADDITIONAL_SYMPTOM | 추가 증상 중복 선택 (통증 양상 등) |

### 2.5 FlowLogic (분기 로직)

질문 간 이동 및 조건부 분기 로직을 정의합니다.

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| flow_id | STRING | 고유 식별자 |
| from_question_id | STRING | 출발 질문 ID |
| condition_option_id | STRING | 조건 옵션 ID (선택된 옵션) |
| condition_value | STRING | 조건 값 (YES/NO/ALWAYS) |
| to_question_id | STRING | 도착 질문 ID 또는 특수값 |
| priority | INTEGER | 우선순위 (낮을수록 먼저 평가) |

**특수 to_question_id 값:**
`ALERT_RED_FLAG`: 위험 경고 표시
- `END`: 문진 종료
### 2.6 StringTable (다국어 문자열)

UI 텍스트 및 다국어 지원을 위한 문자열 테이블입니다.

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| string_id | STRING | 고유 식별자 |
| string_key | STRING | 참조 키 (예: BTN_YES) |
| ko | STRING | 한국어 텍스트 |
| en | STRING | 영어 텍스트 |
| category | STRING | 분류 (BUTTON, MESSAGE 등) |

—

## 3. 테이블 관계도 (ERD)

| 관계 | 유형 | 설명 |
|------|------|------|
| Category → Question | 1 : N | 하나의 카테고리에 여러 질문 |
| Question → Option | 1 : N | 하나의 질문에 여러 선택지 |
| Question → ResponseType | N : 1 | 여러 질문이 하나의 응답유형 참조 |
| Question → FlowLogic | 1 : N | 하나의 질문에서 여러 분기 가능 |

—

## 4. 문진 진행 로직

### 4.1 전체 플로우

```
[카테고리 선택] → [Red Flag 1~9] → [일반문진 1~7] → [AI 분석] → [결과 표시]
```

### 4.2 Red Flag 처리 로직

Red Flag 질문은 위험 신호를 조기에 감지하기 위한 핵심 질문입니다.

**순차 진행**: Red Flag 1부터 9까지 순서대로 진행
2. **’예’ 선택 시**: 즉시 ALERT_RED_FLAG 상태로 전환, 병원 방문 권고 메시지 표시
3. **’아니오’ 선택 시**: 다음 Red Flag 질문으로 이동
4. **모든 Red Flag 통과**: 일반 문진으로 진입 (Q010부터 시작)
### 4.3 일반 문진 처리 로직

**중복 선택 질문 (RT002, RT005)**: 여러 옵션 선택 가능, is_exclusive=TRUE인 옵션 선택 시 다른 선택 해제
- **단일 선택 질문 (RT003, RT004)**: 하나의 옵션만 선택 가능
- **순차 이동**: FlowLogic의 ALWAYS 조건에 따라 Q010 → Q011 → … → Q016 → END
### 4.4 구현 의사코드

```javascript
function processQuestion(questionId, selectedOptions) {
  const flows = getFlowLogic(questionId);
  
  // 우선순위 순으로 조건 평가
  for (const flow of flows.sortBy(‘priority’)) {
    if (flow.condition_value === ‘ALWAYS’) {
      return flow.to_question_id;
    }
    
    if (selectedOptions.includes(flow.condition_option_id)) {
      if (flow.to_question_id === ‘ALERT_RED_FLAG’) {
        showRedFlagAlert();
        return ‘END’;
      }
      return flow.to_question_id;
    }
  }
}
```

—

## 5. 웹 서비스 구현 가이드

### 5.1 데이터 로딩

Google Sheets API 또는 JSON Export를 통해 데이터를 로드합니다.

```javascript
// 초기 데이터 로드
const categories = await fetchSheet(‘Category’);
const questions = await fetchSheet(‘Question’);
const options = await fetchSheet(‘Option’);
const responseTypes = await fetchSheet(‘ResponseType’);
const flowLogic = await fetchSheet(‘FlowLogic’);

// 인덱싱 (빠른 조회용)
const questionMap = new Map(questions.map(q => [q.question_id, q]));
const optionsByQuestion = groupBy(options, ‘question_id’);
const flowsByQuestion = groupBy(flowLogic, ‘from_question_id’);
```

### 5.2 UI 렌더링

```javascript
function renderQuestion(questionId) {
  const question = questionMap.get(questionId);
  const opts = optionsByQuestion.get(questionId);
  const responseType = responseTypes.find(rt => rt.type_id === question.response_type_id);
  
  return {
    text: question.question_text_ko,
    options: opts.map(opt => ({
      id: opt.option_id,
      text: opt.option_text_ko,
      isExclusive: opt.is_exclusive === ‘TRUE’
    })),
    isMultiple: responseType.is_multiple === ‘TRUE’,
    isRedFlag: question.is_red_flag === ‘TRUE’
  };
}
```

### 5.3 응답 데이터 구조

사용자 응답은 다음 형식으로 저장합니다.

```json
{
  “session_id”: “uuid-xxxx-xxxx”,
  “category_id”: “CAT001”,
  “started_at”: “2025-01-26T10:00:00Z”,
  “completed_at”: “2025-01-26T10:05:00Z”,
  “red_flag_triggered”: false,
  “responses”: [
    {
      “question_id”: “Q001”,
      “question_text”: “6시간 이내 갑자기 시작해…”,
      “selected_options”: [“OPT002”],
      “selected_texts”: [“아니오”]
    },
    {
      “question_id”: “Q010”,
      “question_text”: “통증의 위치는 어디인가요?”,
      “selected_options”: [“OPT019”, “OPT020”],
      “selected_texts”: [“상복부(명치)”, “우상복부”]
    }
  ]
}
```

—

## 6. AI API 연동 (문진 완료 후)

문진이 완료되면 수집된 데이터를 AI API로 전송하여 분석 결과를 받습니다.

### 6.1 API 호출 시점

**정상 완료**: 모든 질문(Q016)까지 완료 후 자동 호출
- **Red Flag 발생**: 경고 메시지와 함께 부분 데이터로 호출 (긴급 분석용)
### 6.2 API 요청 구조

```
POST /api/v1/analyze-symptoms
Content-Type: application/json
```

```json
{
  “patient_info”: {
    “age”: 35,
    “gender”: “female”,
    “session_id”: “uuid-xxxx-xxxx”
  },
  “questionnaire_data”: {
    “category”: “배가 아파요”,
    “red_flag_triggered”: false,
    “responses”: [
      {
        “question”: “6시간 이내 갑자기 시작해 참기 힘들 정도로 심해졌나요?”,
        “answer”: “아니오”,
        “is_red_flag”: true
      },
      {
        “question”: “통증의 위치는 어디인가요?”,
        “answer”: [“상복부(명치)”, “우상복부”],
        “is_red_flag”: false
      }
    ]
  }
}
```

### 6.3 AI 프롬프트 예시

AI API 내부에서 사용할 시스템 프롬프트 예시입니다.

```
당신은 의료 문진 분석 AI입니다.
환자가 작성한 문진 데이터를 분석하여 다음을 제공하세요:

**증상 요약**: 환자의 주요 증상을 간결하게 정리
2. **가능한 원인**: 증상과 관련될 수 있는 일반적인 원인들 (진단이 아님)
3. **권장 사항**: 생활 습관 개선, 추가 검사 필요성, 진료과 추천 등
4. **주의 사항**: 이 분석은 의료 진단이 아니며, 정확한 진단을 위해 전문 의료진 상담이 필요함을 명시
응답은 환자가 이해하기 쉬운 언어로 작성하되, 의학적 정확성을 유지하세요.
```

### 6.4 API 응답 구조

```json
{
  “analysis_id”: “analysis-xxxx-xxxx”,
  “status”: “completed”,
  “result”: {
    “summary”: “상복부 통증이 수 주에 걸쳐 점진적으로 발생했으며…”,
    “possible_causes”: [
      “위염 또는 위궤양”,
      “기능성 소화불량”,
      “담낭 관련 문제”
    ],
    “recommendations”: [
      “소화기내과 진료 권장”,
      “기름진 음식, 카페인 섭취 줄이기”,
      “식후 바로 눕지 않기”
    ],
    “urgency_level”: “moderate”,
    “disclaimer”: “이 분석은 참고용이며 의료 진단이 아닙니다…”
  },
  “created_at”: “2025-01-26T10:05:30Z”
}
```

### 6.5 구현 코드 예시

```javascript
async function analyzeWithAI(sessionData) {
  const prompt = buildAnalysisPrompt(sessionData);
  
  const response = await fetch(‘https://api.anthropic.com/v1/messages’, {
    method: ‘POST’,
    headers: {
      ‘Content-Type’: ‘application/json’,
      ‘x-api-key’: process.env.ANTHROPIC_API_KEY,
      ‘anthropic-version’: ‘2023-06-01’
    },
    body: JSON.stringify({
      model: ‘claude-sonnet-4-20250514’,
      max_tokens: 2000,
      system: MEDICAL_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: ‘user’, content: prompt }]
    })
  });
  
  const result = await response.json();
  return parseAnalysisResult(result.content[0].text);
}

function buildAnalysisPrompt(sessionData) {
  const responses = sessionData.responses
    .map(r => `Q: ${r.question_text}\nA: ${r.selected_texts.join(‘, ‘)}`)
    .join(‘\n\n’);
  
  return `환자 문진 데이터:\n\n${responses}\n\n위 문진 결과를 분석해주세요.`;
}
```

—

## 7. 부록

### 7.1 Red Flag 질문 목록 (배가 아파요)

| 번호 | 질문 내용 |
|------|-----------|
| 1 | 6시간 이내 갑자기 시작해 참기 힘들 정도로 심해졌나요? |
| 2 | 어지럽거나 심장이 빨리 뛰면서 식은땀이 나거나 쇼크 증상이 있나요? |
| 3 | 검은색 대변·선홍색 혈변·피 섞인 구토 등 위장관 출혈 징후가 있나요? |
| 4 | 배를 눌렀다 떼면 더 아프고 배 전체가 딱딱하게 굳어 있나요? |
| 5 | 24시간 이상 방귀·대변이 전혀 나오지 않고 배가 점점 불러오나요? |
| 6 | 배에서 만져지는 혹이 있나요? |
| 7 | 38℃ 이상의 고열에 열감·오한이 있나요? |
| 8 | 임신 중이거나 가능성이 높은데 질출혈이 동반되나요? |
| 9 | 초록·노란 담즙색 구토가 24시간 이상 계속되고 음식 물도 전혀 넘기지 못하나요? |

### 7.2 긴급도 레벨 정의

| 레벨 | 상태 | 권장 조치 |
|------|------|-----------|
| 🔴 critical | Red Flag 감지 | 즉시 응급실 방문 권고 |
| 🟠 high | 주의 필요 | 24시간 내 진료 권장 |
| 🟡 moderate | 중등도 | 1주일 내 진료 권장 |
| 🟢 low | 경증 | 자가 관리 가능, 증상 지속 시 진료 |

### 7.3 스프레드시트 링크

실제 데이터가 저장된 Google Spreadsheet:
https://docs.google.com/spreadsheets/d/11U3yslOo5a9MCZ2SIUFnG5ITNiaLk-KqITu4a6xnJOg

—

*— End of Document —*
