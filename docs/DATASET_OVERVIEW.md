# 소화기내과 AI 진단 추론 데이터셋 개요

## 1. 기본 정보


| 항목      | 내용                                               |
| ------- | ------------------------------------------------ |
| 원본 데이터셋 | `MENINBLOX/Idn_GAS_cpx_summary_v1` (HuggingFace) |
| 전체 행 수  | 14,512건                                          |
| 유효 행 수  | 14,482건 (파싱 오류 30건 제외)                           |
| 도메인     | 소화기내과 (Gastroenterologi)                         |
| 언어      | 인도네시아어 (입력/출력), 한국어 (사후 추론 보조)                   |
| 지원 질환 수 | 50개 (8개 장기계 그룹)                                  |


---

## 2. 데이터 스키마

각 row는 다음 필드로 구성:


| 필드명               | 설명                                          |
| ----------------- | ------------------------------------------- |
| `idn_input`       | 환자-의사 대화 (인도네시아어)                           |
| `idn_instruction` | 모델 지시문 + Output Format 정의                   |
| `idn_output`      | CoT 증강된 감별진단 출력 (JSON): 감별진단 Top 3 + reasoning |
| `ko_result`       | 한국어 사후 추론 (reason 포함) — CoT 생성 소스           |
| `idn_result`      | 인도네시아어 결과 (reason 없음)                       |
| `idn_script`      | 원본 대화 스크립트                                  |
| `ko_script`       | 한국어 스크립트                                    |
| `cot_raw`         | GPT-4o-mini가 생성한 CoT 원본 JSON (검수용)           |


### `idn_output` JSON 구조 (CoT 증강 후)

```json
{
  "main_symptoms": ["주요 증상 키워드"],
  "result": [
    {
      "no": 1,
      "disease": ["첫번째 의심 질환명"],
      "symptom_summary": "주요 증상 요약 (인도네시아어)",
      "red_flags": ["발견된 red flag 증상"],
      "differential_reasoning": {
        "supporting": ["이 진단을 지지하는 임상 근거"],
        "against": ["이 진단에 반하는 임상 근거"]
      },
      "confidence": "high | medium | low",
      "patient_edu": ["환자 교육 내용"]
    },
    {"no": 2, "disease": ["..."], "symptom_summary": "...", "red_flags": ["..."],
     "differential_reasoning": {"supporting": ["..."], "against": ["..."]},
     "confidence": "...", "patient_edu": ["..."]},
    {"no": 3, "...": "..."}
  ]
}
```

---

## 3. CoT 증강의 필요성

원본 데이터의 `ko_result.reason`은 **사후 설명(post-hoc rationalization)** 구조:

- 정답 질환을 먼저 정해놓고, 거꾸로 이유를 기술
- 모델이 그대로 학습하면 **reasoning이 아닌 정답 암기**가 발생

**해결책:** GPT-4o-mini를 이용해 각 케이스를 진짜 감별진단 추론 흐름으로 재구성

```
원본 (post-hoc)         →    증강 후 (CoT)
------------------------     --------------------------
답 → 이유 역방향 기술         증상 요약
                              → red flag 식별
                              → 감별진단 후보 3개 비교
                                 (supporting / against)
                              → 최종 진단 + confidence
```

---

## 4. 지원 질환 목록 (50개)

### Esofagus — 식도 (5개)


| 질환명                                     | 한국어         | 건수  |
| --------------------------------------- | ----------- | --- |
| Penyakit refluks gastroesofageal (GERD) | 위식도역류질환     | 198 |
| Esofagitis refluks                      | 역류성 식도염     | 194 |
| Varises esofagus                        | 식도정맥류       | 197 |
| Kanker esofagus                         | 식도암         | 198 |
| Sindrom Mallory-Weiss                   | 말로리-바이스 증후군 | 196 |


### Lambung & Duodenum — 위 & 십이지장 (7개)


| 질환명                    | 한국어      | 건수  |
| ---------------------- | -------- | --- |
| Ulkus duodenum         | 십이지장궤양   | 793 |
| Ulkus lambung          | 위궤양      | 786 |
| Gastritis              | 위염       | 591 |
| Kanker lambung         | 위암       | 594 |
| Dispepsia fungsional   | 기능성 소화불량 | 198 |
| Gastroparesis diabetik | 당뇨성 위마비  | 198 |
| Stenosis pilorus       | 유문 협착증   | 195 |


> `Penyakit ulkus peptikum`(소화성 궤양)은 Ulkus lambung / Ulkus duodenum의 상위 개념으로 통합

### Usus Halus — 소장 (4개)


| 질환명                 | 한국어   | 건수  |
| ------------------- | ----- | --- |
| Intoleransi laktosa | 유당불내증 | 398 |
| Intususepsi         | 장중첩증  | 200 |
| Divertikulum Meckel | 메켈 게실 | 200 |
| Obstruksi usus      | 장폐색   | 200 |


### Kolon & Rektum — 대장 & 직장 (14개)


| 질환명                              | 한국어        | 건수  |
| -------------------------------- | ---------- | --- |
| Kanker rektum                    | 직장암        | 600 |
| Kanker kolon                     | 대장암        | 595 |
| Sindrom iritasi usus besar (IBS) | 과민성 대장 증후군 | 592 |
| Penyakit radang usus (IBD)       | 염증성 장질환    | 398 |
| Kolitis iskemik                  | 허혈성 대장염    | 396 |
| Penyakit Crohn                   | 크론병        | 198 |
| Kolitis infeksius                | 감염성 대장염    | 199 |
| Perdarahan divertikel            | 게실 출혈      | 199 |
| Konstipasi fungsional            | 기능성 변비     | 197 |
| Konstipasi akibat obat           | 약물 유발 변비   | 199 |
| Diare akibat obat                | 약물 유발 설사   | 199 |
| Wasir (Hemoroid)                 | 치질 (치핵)    | 198 |
| Rektocele                        | 직장류        | 199 |
| Polip pediatrik                  | 소아 용종      | 197 |


### Hati — 간 (8개)


| 질환명                  | 한국어         | 건수  |
| -------------------- | ----------- | --- |
| Hepatitis virus akut | 급성 바이러스성 간염 | 200 |
| Hepatitis toksik     | 독성 간염       | 200 |
| Penyakit Wilson      | 윌슨병         | 200 |
| Hepatitis akut       | 급성 간염       | 199 |
| Hepatitis kronis     | 만성 간염       | 199 |
| Sindrom Gilbert      | 길버트 증후군     | 199 |
| Sirosis hati         | 간경변증        | 197 |
| Kanker hati          | 간암          | 195 |


### Kandung Empedu & Saluran Empedu — 담낭 & 담도 (5개)


| 질환명                                       | 한국어    | 건수  |
| ----------------------------------------- | ------ | --- |
| Kolesistitis akut                         | 급성 담낭염 | 401 |
| Kanker saluran empedu (Kolangiokarsinoma) | 담관암    | 202 |
| Kolelitiasis                              | 담석증    | 201 |
| Kolesistitis kronis                       | 만성 담낭염 | 197 |
| Kolangitis                                | 담관염    | 196 |


### Pankreas — 췌장 (3개)


| 질환명                    | 한국어    | 건수  |
| ---------------------- | ------ | --- |
| Pankreatitis akut      | 급성 췌장염 | 202 |
| Pankreatitis kronis    | 만성 췌장염 | 392 |
| Kanker kepala pankreas | 췌두부암   | 199 |


### Kondisi Akut & Bedah GI — 급성 & 외과적 GI 질환 (4개)


| 질환명                      | 한국어       | 건수  |
| ------------------------ | --------- | --- |
| Perforasi ulkus peptikum | 소화성 궤양 천공 | 399 |
| Apendisitis akut         | 급성 충수염    | 201 |
| Gastroenteritis akut     | 급성 위장염    | 200 |
| Keracunan makanan        | 식중독       | 199 |


---

## 5. 건수 분포 요약


| 구간       | 질환 수 | 해당 질환 예시                                                    |
| -------- | ---- | ----------------------------------------------------------- |
| 700건 이상  | 2    | Ulkus duodenum, Ulkus lambung                               |
| 500–699건 | 4    | Kanker rektum, Kanker kolon, IBS, Gastritis, Kanker lambung |
| 300–499건 | 9    | Intoleransi laktosa, IBD, Kolesistitis akut 등               |
| 190–299건 | 35   | 나머지 대부분                                                     |


> 대부분의 질환이 약 **195~202건** 범위로 균등하게 분포 (의도적 균형 샘플링)

---

## 6. 관련 파일


| 파일                              | 설명                                  |
| ------------------------------- | ------------------------------------- |
| `output/cot_normalized.jsonl`   | **최종 학습 데이터** — CoT 증강 + 질환명 정규화 완료 (14,482건) |
| `output/gastro_only.jsonl`      | 필터링된 소화기내과 원본 데이터 (14,512건)          |
| `output/diagnosis_list.json`    | 정제된 질환 목록 (카테고리별 JSON)               |
| `filter_gastro.py`              | 원본 데이터셋 필터링 스크립트                     |
| `convert_to_cot.py`             | GPT-4o-mini CoT 증강 파이프라인             |
| `collect_cot.py`                | Batch API 결과 수집 스크립트                 |


