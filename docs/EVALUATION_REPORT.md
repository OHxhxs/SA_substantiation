# Evaluation Report — SA Substantiation

**평가 일시**: 2026-03-12
**테스트 샘플**: 1,452건
**추론 엔진**: vLLM 0.17.1 (배치 추론)
**하드웨어**: NVIDIA GH200 480GB GPU

---

## 모델 개요

| 모델 | Base Model | 학습 Epochs | Best Eval Loss |
|------|-----------|-------------|----------------|
| Gemma | aisingapore/Gemma-SEA-LION-v3-9B-IT | 3 | 0.3009 |
| Qwen VL | aisingapore/Qwen-SEA-LION-v4-8B-VL | 3 | 0.2507 |
| Apertus | aisingapore/Apertus-SEA-LION-v4-8B-IT | 3 | 0.2955 |

- 모든 모델은 QLoRA (4-bit) 파인튜닝
- LoRA r=32, alpha=64, dropout=0.05
- 학습 데이터: 11,578건 / 검증 데이터: 1,452건

---

## 전체 성능 비교

| 지표 | Gemma | Qwen VL | Apertus |
|------|:-----:|:-------:|:-------:|
| JSON 파싱 성공률 | **100.0%** | 99.7% | 99.3% |
| 스키마 준수율 | **100.0%** | 99.7% | 99.3% |
| Top-1 정확도 | **96.7%** | 92.8% | 70.4% |
| Top-3 정확도 | **98.5%** | 96.1% | 82.7% |
| Exact Match (Top-3) | **59.8%** | 58.0% | 35.3% |

---

## 카테고리별 Top-1 정확도

| 카테고리 | Gemma | Qwen VL | Apertus |
|----------|:-----:|:-------:|:-------:|
| Esofagus | 98.0% | 98.0% | 66.7% |
| Hati | 98.1% | 98.1% | 66.2% |
| Kandung Empedu & Saluran Empedu | 98.3% | 95.0% | 56.7% |
| Kolon & Rektum | 96.8% | 90.0% | 62.6% |
| Kondisi Akut & Bedah GI | 87.0% | 78.0% | 72.0% |
| Lambung & Duodenum | 97.5% | 96.3% | 79.7% |
| Pankreas | 98.7% | 98.7% | 74.7% |
| Usus Halus | 96.0% | 87.0% | 93.0% |

---

## 카테고리별 Top-3 정확도

| 카테고리 | Gemma | Qwen VL | Apertus |
|----------|:-----:|:-------:|:-------:|
| Esofagus | 98.0% | 98.0% | 72.7% |
| Hati | 98.1% | 98.1% | 75.6% |
| Kandung Empedu & Saluran Empedu | 99.2% | 99.2% | 56.7% |
| Kolon & Rektum | 98.6% | 93.4% | 86.1% |
| Kondisi Akut & Bedah GI | 98.0% | 98.0% | 86.0% |
| Lambung & Duodenum | 99.2% | 98.3% | 86.2% |
| Pankreas | 98.7% | 98.7% | 96.2% |
| Usus Halus | 96.0% | 88.0% | 94.0% |

---

## Confidence 분포

| Confidence | Gemma | Qwen VL | Apertus |
|------------|:-----:|:-------:|:-------:|
| high | 2,505 | 2,631 | 3,732 |
| medium | 1,851 | 1,713 | 594 |

---

## 추론 성능 (vLLM)

| 모델 | 총 소요 시간 | 건당 소요 시간 |
|------|:----------:|:------------:|
| Gemma | 528.0초 | 0.36초/건 |
| Apertus | 291.5초 | 0.20초/건 |
| Qwen VL | 406.4초 | 0.28초/건 |

---

## 분석

### Gemma (Top 성능)
- 모든 지표에서 가장 높은 성능을 기록
- JSON 파싱 및 스키마 준수 100% 달성
- Top-1 정확도 96.7%로, 대부분의 카테고리에서 95% 이상의 정확도
- 상대적으로 약한 카테고리: Kondisi Akut & Bedah GI (87.0%)

### Qwen VL (준수한 성능)
- Eval loss가 가장 낮았음에도 (0.2507) 추론 정확도는 Gemma보다 낮음
- Top-1 92.8%, Top-3 96.1%로 전반적으로 우수
- Esofagus, Hati, Pankreas에서 Gemma와 동일한 정확도
- 상대적으로 약한 카테고리: Kondisi Akut & Bedah GI (78.0%), Usus Halus (87.0%)

### Apertus (개선 필요)
- Top-1 70.4%로 다른 두 모델 대비 큰 성능 차이
- Confidence가 대부분 high로 출력되어 과신(overconfidence) 경향
- Kandung Empedu & Saluran Empedu (56.7%)가 가장 낮은 카테고리
- Usus Halus (93.0%)에서는 Qwen VL보다 높은 성능을 보여 카테고리별 편차가 큼
