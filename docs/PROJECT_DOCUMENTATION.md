# SA_idn — Indonesian Gastroenterology Diagnostic AI

인도네시아어 위장내과 감별진단 AI 모델 학습 프로젝트.
의사-환자 대화를 입력받아 Chain-of-Thought(CoT) 기반 감별진단 Top-3을 출력하는 SEA-LION 모델을 QLoRA로 파인튜닝한다.

---

## 1. 프로젝트 구조

```
SA_idn/
├── data_pipeline/                # 데이터 전처리 파이프라인
│   ├── filter_gastro.py          # 소화기내과 데이터 필터링
│   ├── convert_to_cot.py         # GPT-4o-mini로 CoT 변환
│   ├── collect_cot.py            # OpenAI Batch 결과 수집
│   └── peek_one.py               # 샘플 1건 확인 유틸
│
├── training/                     # 모델 학습 스크립트
│   ├── prepare_data.py           # HF 데이터 다운로드 → 분할 → Chat Format 변환
│   ├── train_gemma.py            # Gemma-SEA-LION-v3-9B-IT 학습
│   ├── train_apertus.py          # Apertus-SEA-LION-v4-8B-IT 학습
│   ├── train_qwen_vl.py          # Qwen-SEA-LION-v4-8B-VL 학습
│   └── run_all_sequential.sh     # Apertus → Qwen VL 순차 실행 스크립트
│
├── output/                       # 데이터 파일 (gitignored: *.jsonl)
│   ├── train.jsonl / val.jsonl / test.jsonl          # 원본 분할 데이터
│   ├── train_chat.jsonl / val_chat.jsonl / test_chat.jsonl  # Chat Format
│   ├── diagnosis_list.json       # 질환 목록
│   └── sample_one.json           # 샘플 1건 (확인용)
│
├── checkpoints/                  # 학습 체크포인트 (gitignored)
├── logs/                         # 학습 로그 (gitignored)
├── docs/                         # 문서
├── .env                          # API 키 (HUGGINGFACE_API_KEY, WANDB_API_KEY)
├── pyproject.toml                # 의존성 정의
└── .gitignore
```

---

## 2. 데이터

### 2.1 데이터셋 출처

| 항목 | 값 |
|------|-----|
| HuggingFace ID | `MENINBLOX/Idn_GAS_cpx_CoT_v1` |
| 원본 데이터 | `MENINBLOX/Idn_GAS_cpx_summary_v1` (CoT 변환 전) |
| 언어 | 인도네시아어 (의사-환자 대화), 한국어 (원본 스크립트) |
| 도메인 | 위장내과 (Gastroenterology) |
| 분할 | Train 11,578 / Val 1,452 / Test 1,452 |
| 분할 방식 | Stratified Split (80/10/10) — 1st disease 기준 |

### 2.2 원본 데이터 컬럼 (`train.jsonl`)

| 컬럼 | 설명 |
|------|------|
| `ko_script` | 한국어 의사-환자 대화 원본 |
| `idn_script` | 인도네시아어 의사-환자 대화 (번역) |
| `ko_result` | 한국어 진단 결과 (disease, reason, patient_edu) |
| `idn_result` | 인도네시아어 진단 결과 |
| `idn_input` | `###history_talking` 형식의 인도네시아어 대화 (모델 입력) |
| `idn_output` | CoT 포함 JSON 진단 결과 (모델 출력) |
| `idn_instruction` | 시스템 프롬프트 + Output Format 정의 |
| `cot_raw` | GPT-4o-mini가 생성한 CoT 원본 JSON |

### 2.3 Chat Format (`train_chat.jsonl`)

학습에 직접 사용되는 형식. 각 행이 `messages` 배열:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "Anda adalah asisten dokter spesialis gastroenterologi. Berdasarkan percakapan antara dokter dan pasien, lakukan reasoning diferensial diagnosis dan tentukan 3 diagnosis yang paling mungkin."
    },
    {
      "role": "user",
      "content": "<instruction>\n\n<###history_talking 의사-환자 대화>"
    },
    {
      "role": "assistant",
      "content": "<JSON 형식 CoT 진단 결과>"
    }
  ]
}
```

### 2.4 모델 Input / Output

**Input (user message):**
```
You are MediKoGPT, a gastroenterology diagnostic support AI agent...
###history_talking
dokter : Apa jenis kelamin Anda?
pasien : Saya perempuan.
dokter : Usia Anda berapa?
pasien : 45 tahun.
dokter : Boleh tahu keluhan utamanya apa sampai datang ke sini?
pasien : Perut saya sakit sekali, Dok.
...
```

**Output (assistant message):**
```json
{
  "result": [
    {
      "no": 1,
      "disease": ["Kolesistitis akut"],
      "symptom_summary": "Pasien mengalami nyeri hebat di perut kanan atas...",
      "red_flags": ["nyeri menjalar ke bahu kanan", "demam", "muntah"],
      "differential_reasoning": {
        "supporting": ["Nyeri perut kanan atas setelah makan makanan berminyak", "..."],
        "against": ["Tidak ada tanda-tanda jaundice..."]
      },
      "confidence": "high",
      "patient_edu": ["Berdasarkan gejala yang Anda alami..."]
    },
    { "no": 2, "disease": ["Kolangitis"], "..." : "..." },
    { "no": 3, "disease": ["Pankreatitis akut"], "..." : "..." }
  ]
}
```

### 2.5 대상 질환 (53개)

| 분류 | 질환 |
|------|------|
| Esofagus | GERD, Esofagitis refluks, Varises esofagus, Kanker esofagus, Sindrom Mallory-Weiss |
| Lambung & Duodenum | Ulkus duodenum, Ulkus lambung, Gastritis, Kanker lambung, Dispepsia fungsional, Gastroparesis diabetik, Stenosis pilorus |
| Usus Halus | Intoleransi laktosa, Intususepsi, Divertikulum Meckel, Obstruksi usus |
| Kolon & Rektum | Kanker rektum, Kanker kolon, IBS, IBD, Kolitis iskemik, Penyakit Crohn, Kolitis infeksius, Perdarahan divertikel, Konstipasi fungsional, Konstipasi akibat obat, Diare akibat obat, Wasir (Hemoroid), Rektocele, Polip pediatrik |
| Hati | Hepatitis akut/virus/kronis/toksik, Sirosis hati, Kanker hati, Sindrom Gilbert, Penyakit Wilson |
| Kandung & Saluran Empedu | Kolesistitis akut/kronis, Kolelitiasis, Kolangitis, Kolangiokarsinoma |
| Pankreas | Pankreatitis akut/kronis, Kanker kepala pankreas |
| Kondisi Akut & Bedah | Perforasi ulkus peptikum, Apendisitis akut, Gastroenteritis akut, Keracunan makanan |

---

## 3. 데이터 파이프라인

데이터는 아래 순서로 처리되었다:

```
[원본 HF 데이터] ──filter_gastro.py──> [소화기 필터링]
       │
       └──convert_to_cot.py──> [GPT-4o-mini CoT 변환] ──collect_cot.py──> [최종 데이터]
                                                                              │
                                                             [HF 업로드: Idn_GAS_cpx_CoT_v1]
                                                                              │
                                                          prepare_data.py ──> [train/val/test_chat.jsonl]
```

### 3.1 `filter_gastro.py`
- `MENINBLOX/Idn_GAS_cpx_summary_v1`에서 소화기내과 데이터만 필터링
- `idn_instruction`에 소화기 질환명(`Ulkus duodenum` 등) 포함 여부로 판별
- 출력: `output/gastro_only.jsonl`

### 3.2 `convert_to_cot.py`
- 한국어 진단 reason (`ko_result`)을 GPT-4o-mini로 인도네시아어 CoT 구조로 변환
- OpenAI Batch API 지원 (`--submit`) 및 동기 처리 (`--pilot`, `--full`)
- CoT 구조: `symptom_summary`, `red_flags`, `differential_reasoning`, `confidence`
- 품질 검수 자동화 (`validate_cot`)

### 3.3 `collect_cot.py`
- OpenAI Batch 결과 다운로드 및 원본 데이터와 결합
- 출력: `output/cot_final.jsonl`

### 3.4 `prepare_data.py`
- HuggingFace에서 최종 CoT 데이터셋 다운로드
- Stratified Split (80/10/10) 수행 (1st disease 기준)
- Chat Format 변환 (system/user/assistant messages)
- 출력: `output/{train,val,test}_chat.jsonl`

```bash
# 실행
python3 training/prepare_data.py
```

---

## 4. 학습 (Training)

### 4.1 학습 대상 모델 (3종)

| 스크립트 | 모델 | 베이스 | 파라미터 | 비고 |
|----------|------|--------|----------|------|
| `train_gemma.py` | `aisingapore/Gemma-SEA-LION-v3-9B-IT` | Gemma2 | 9B | 텍스트 전용 |
| `train_apertus.py` | `aisingapore/Apertus-SEA-LION-v4-8B-IT` | Qwen | 8B | 텍스트 전용 |
| `train_qwen_vl.py` | `aisingapore/Qwen-SEA-LION-v4-8B-VL` | Qwen3VL | 8B | VL 모델, 텍스트 전용 학습 (IT vs VL 비교) |

3개 모델 모두 **system role을 지원**한다 (AI Singapore이 chat template에 추가).

### 4.2 학습 설정

| 항목 | 값 |
|------|-----|
| **방법** | QLoRA (4-bit NF4 Quantization) |
| **LoRA r** | 32 |
| **LoRA alpha** | 64 |
| **LoRA dropout** | 0.05 |
| **Target modules** | `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| **Epochs** | 3 |
| **Batch size** | 4 |
| **Gradient accumulation** | 4 (effective batch = 16) |
| **Learning rate** | 2e-4 |
| **LR scheduler** | Cosine |
| **Warmup ratio** | 0.1 |
| **Max sequence length** | 4096 |
| **Precision** | bf16 |
| **Eval strategy** | Every 200 steps |
| **Save strategy** | Every 200 steps (best 3 kept) |
| **Best model metric** | eval_loss (lower is better) |
| **Attention** | SDPA (flash-attention-2 미지원, ARM64 환경) |

### 4.3 학습 실행

```bash
# 개별 실행
python3 training/train_gemma.py
python3 training/train_apertus.py
python3 training/train_qwen_vl.py

# 옵션
python3 training/train_gemma.py --no-wandb          # wandb 비활성화
python3 training/train_gemma.py --dry-run            # 데이터 확인만
python3 training/train_gemma.py --epochs 5 --lr 1e-4 # 하이퍼파라미터 변경

# 순차 실행 (Apertus → Qwen VL)
bash training/run_all_sequential.sh
```

### 4.4 CLI 인자

| 인자 | 기본값 | 설명 |
|------|--------|------|
| `--epochs` | 3 | 학습 에폭 수 |
| `--batch-size` | 4 | 배치 크기 |
| `--grad-accum` | 4 | Gradient accumulation steps |
| `--lr` | 2e-4 | Learning rate |
| `--max-seq-length` | 4096 | 최대 시퀀스 길이 |
| `--no-wandb` | False | wandb 로깅 비활성화 |
| `--dry-run` | False | 데이터 샘플만 확인 |

### 4.5 출력물

```
checkpoints/
├── sealion-v3-9b-gemma/       # Gemma 체크포인트
│   ├── checkpoint-200/
│   ├── checkpoint-400/
│   ├── final/                 # 최종 LoRA adapter + tokenizer
│   └── train_log.json         # 학습 로그 (loss, eval 기록)
├── sealion-v4-8b-it/          # Apertus 체크포인트
└── sealion-v4-8b-vl/          # Qwen VL 체크포인트
```

### 4.6 wandb 로깅

- **Project**: `sealion-gastro-finetune`
- Run name은 모델별로 자동 설정 (`sealion-v3-9b-gemma`, `sealion-v4-8b-it`, `sealion-v4-8b-vl`)
- 기록 항목: train_loss, eval_loss, learning_rate, epoch 등
- `.env`에 `WANDB_API_KEY` 설정 필요

---

## 5. 환경 설정

### 5.1 요구사항

- Python 3.12+
- CUDA GPU (GH200 480GB 또는 동급)
- HuggingFace API 토큰 (gated model 접근)
- wandb API 키 (선택)

### 5.2 의존성 설치

```bash
pip3 install torch==2.5.1 --index-url https://download.pytorch.org/whl/cu124  # ARM64 CUDA
pip3 install transformers peft trl bitsandbytes accelerate
pip3 install datasets huggingface-hub scikit-learn wandb python-dotenv openai
```

> ARM64(aarch64) 환경에서는 PyPI 기본 torch가 CPU 전용이므로, 반드시 `--index-url`로 CUDA 빌드를 지정해야 한다.
> `flash-attn`은 ARM64에서 빌드 불가하므로 SDPA(`attn_implementation="sdpa"`)를 사용한다.

### 5.3 환경 변수 (`.env`)

```
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxx
WANDB_API_KEY=wandb_v1_xxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx     # CoT 변환 시에만 필요
```

---

## 6. 전체 워크플로우

```
1. 데이터 준비
   python3 training/prepare_data.py
   → output/{train,val,test}_chat.jsonl 생성

2. 학습 실행
   python3 training/train_gemma.py        # Gemma 9B
   python3 training/train_apertus.py      # Apertus 8B
   python3 training/train_qwen_vl.py      # Qwen VL 8B

3. 결과 확인
   - wandb 대시보드에서 train/eval loss 비교
   - checkpoints/{run_name}/final/ 에 최종 LoRA adapter 저장됨

4. 추론 (예정)
   - 최종 adapter를 base model에 merge 또는 PEFT로 로딩
   - 의사-환자 대화 입력 → JSON 감별진단 출력
```

---

## 7. 모델별 참고사항

### Gemma-SEA-LION-v3-9B-IT
- Google Gemma2 기반, AI Singapore이 SEA 언어 추가 학습
- `AutoModelForCausalLM`으로 로딩
- System role 지원 (AI Singapore이 chat template에 추가)

### Apertus-SEA-LION-v4-8B-IT
- Qwen 기반, AI Singapore의 최신 SEA-LION v4 시리즈
- `AutoModelForCausalLM`으로 로딩
- System role 지원

### Qwen-SEA-LION-v4-8B-VL
- Qwen3VL 기반 Vision-Language 모델
- `Qwen3VLForConditionalGeneration`으로 로딩 (AutoModelForCausalLM 아님)
- 텍스트 전용 학습 수행 (visual 파라미터는 모두 optional → None으로 무시)
- LoRA는 language model 레이어에만 적용, vision encoder는 frozen
- IT 모델과의 비교 실험 목적

---

## 8. 주요 기술적 결정 & 트러블슈팅

| 이슈 | 해결 |
|------|------|
| ARM64에서 flash-attn 빌드 실패 | `attn_implementation="sdpa"` 사용 |
| ARM64에서 PyPI torch가 CPU 전용 | `pip3 install torch==2.5.1 --index-url .../cu124` |
| SFTConfig `max_seq_length` 미존재 (trl 0.29) | `max_length` 파라미터로 변경 |
| Gemma2 원본은 system role 미지원 | SEA-LION v3 Gemma IT는 지원 (AI Singapore이 추가) |
| VL 모델의 forward()에 visual input 필수? | `pixel_values` 등 모두 `default=None` → 텍스트 전용 학습 가능 |
| CoT 데이터 생성 비용 | OpenAI Batch API 활용 (50% 할인) |
