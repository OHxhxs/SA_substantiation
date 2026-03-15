"""
inference_server.py — Gemma 추론 + 5단계 후처리 FastAPI 서버

실행:
    uvicorn inference_server:app --host 0.0.0.0 --port 8755

환경변수:
    VLLM_URLS  : 쉼표로 구분된 vLLM 서버 URL 목록 (기본: http://localhost:8754,http://localhost:8756)
    VLLM_MODEL : 모델명 (기본: MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172)

GPU 서버 실행 예시:
    CUDA_VISIBLE_DEVICES=0 vllm serve MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172 --dtype bfloat16 --port 8754
    CUDA_VISIBLE_DEVICES=1 vllm serve MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172 --dtype bfloat16 --port 8756
    uvicorn inference_server:app --host 0.0.0.0 --port 8755
"""

import os
import json
import time
import logging
import itertools
import threading
from typing import Any

import httpx
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── 로깅 ──────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── 설정 ──────────────────────────────────────────────────
_raw_urls  = os.getenv("VLLM_URLS", "http://localhost:8754,http://localhost:8756")
VLLM_URLS  = [u.strip() for u in _raw_urls.split(",") if u.strip()]
VLLM_MODEL = os.getenv("VLLM_MODEL", "MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172")

# ── 라운드로빈 ─────────────────────────────────────────────
_rr_cycle = itertools.cycle(VLLM_URLS)
_rr_lock  = threading.Lock()

def next_vllm_url() -> str:
    with _rr_lock:
        return next(_rr_cycle)

log.info(f"vLLM instances: {VLLM_URLS}")

# ── 프롬프트 로드 ──────────────────────────────────────────
PROMPTS_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "prompts.yaml")
with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
    PROMPTS = yaml.safe_load(f)

# ── 후처리 상수 ───────────────────────────────────────────

CANCER_DISEASES = {
    "Kanker lambung", "Kanker kolon", "Kanker rektum",
    "Kanker esofagus", "Kanker hati", "Kanker kepala pankreas",
    "Kanker saluran empedu",
}

SERIOUS_DISEASES = CANCER_DISEASES | {
    "Sirosis hati", "Varises esofagus", "Perforasi tukak peptikum",
    "Gagal hati", "Ensefalopati hepatik",
}

COMMON_DISEASES = {
    "Penyakit refluks gastroesofageal", "Esofagitis", "Gastritis",
    "Gastritis akut", "Gastritis kronis", "Dispepsia fungsional",
    "Sindrom iritasi usus", "Gastroenteritis akut", "Konstipasi fungsional",
    "Diare akibat obat",
}

# 실제 유병률 기반 가중치 (1.0 = 변화 없음)
DISEASE_WEIGHTS: dict[str, float] = {
    "Penyakit refluks gastroesofageal": 1.8,
    "Esofagitis":                       1.8,
    "Gastritis":                        1.7,
    "Gastritis akut":                   1.7,
    "Gastritis kronis":                 1.7,
    "Dispepsia fungsional":             1.7,
    "Sindrom iritasi usus":             1.6,
    "Gastroenteritis akut":             1.6,
    "Konstipasi fungsional":            1.5,
    "Kanker lambung":                   0.4,
    "Kanker kolon":                     0.4,
    "Kanker rektum":                    0.4,
    "Kanker esofagus":                  0.3,
    "Kanker hati":                      0.3,
    "Kanker kepala pankreas":           0.3,
    "Kanker saluran empedu":            0.3,
    "Sirosis hati":                     0.4,
    "Gagal hati":                       0.35,
}

CONFIDENCE_TO_SCORE = {"high": 0.9, "medium": 0.6, "low": 0.3}

def score_to_confidence(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


# ── 후처리 함수 ───────────────────────────────────────────

def step2_calibrate_confidence(result: list, red_flag_triggered: bool) -> list:
    """단계 2: 암/중증 + Red Flag 없음 → confidence 강제 하향"""
    out = []
    for item in result:
        diseases = item.get("disease", [])
        if isinstance(diseases, str):
            diseases = [diseases]
        is_serious = any(d in SERIOUS_DISEASES for d in diseases)
        if is_serious and not red_flag_triggered and item.get("confidence") == "high":
            item = {**item, "confidence": "medium"}
        out.append(item)
    return out


def step3_apply_weights(result: list) -> list:
    """단계 3: 질환별 가중치 보정 + score 기준 재정렬"""
    scored = []
    for item in result:
        diseases = item.get("disease", [])
        if isinstance(diseases, str):
            diseases = [diseases]
        # 여러 질환 중 가장 낮은 가중치 적용
        weight = min((DISEASE_WEIGHTS.get(d, 1.0) for d in diseases), default=1.0)
        raw = CONFIDENCE_TO_SCORE.get(item.get("confidence", "low"), 0.3)
        adjusted = min(raw * weight, 1.0)
        scored.append({**item, "_score": adjusted, "confidence": score_to_confidence(adjusted)})

    scored.sort(key=lambda x: x["_score"], reverse=True)
    # _score 제거 및 no 재부여
    return [{k: v for k, v in item.items() if k != "_score"} | {"no": idx + 1}
            for idx, item in enumerate(scored)]


def step4_red_flag_gate(result: list, red_flag_triggered: bool) -> list:
    """단계 4: Red Flag Safety Gate"""
    out = []
    for item in result:
        diseases = item.get("disease", [])
        if isinstance(diseases, str):
            diseases = [diseases]
        is_serious = any(d in SERIOUS_DISEASES for d in diseases)

        if not is_serious:
            out.append(item)
            continue

        if not red_flag_triggered:
            # Red Flag 없음 → 추가 감점 + 배제 권고
            raw = CONFIDENCE_TO_SCORE.get(item.get("confidence", "low"), 0.3)
            penalized = raw * 0.3
            out.append({
                **item,
                "_score": penalized,
                "confidence": score_to_confidence(penalized),
                "safety_note": (
                    "Pemeriksaan lanjutan diperlukan untuk menyingkirkan kondisi ini. "
                    "Silakan konsultasikan dengan dokter spesialis."
                ),
            })
        else:
            # Red Flag 있음 → 유지 + 정밀검사 권장
            out.append({
                **item,
                "safety_note": (
                    "Berdasarkan gejala yang Anda alami, disarankan untuk segera "
                    "melakukan pemeriksaan lebih lanjut (endoskopi/USG/CT scan)."
                ),
            })

    # Red Flag Gate 이후 재정렬
    if any("_score" in item for item in out):
        out.sort(key=lambda x: x.get("_score", CONFIDENCE_TO_SCORE.get(x.get("confidence", "low"), 0.3)), reverse=True)
        out = [{k: v for k, v in item.items() if k != "_score"} | {"no": idx + 1}
               for idx, item in enumerate(out)]

    return out


def step5_common_disease_fallback(result: list) -> list:
    """단계 5: Top-3에 흔한 질환 없으면 3순위에 강제 삽입"""
    has_common = any(
        d in COMMON_DISEASES
        for item in result
        for d in (item.get("disease", []) if isinstance(item.get("disease"), list) else [item.get("disease", "")])
    )
    if has_common:
        return result

    log.warning("No common disease in Top-3 — applying fallback (Dispepsia fungsional)")
    fallback = {
        "no": 3,
        "disease": ["Dispepsia fungsional"],
        "red_flags": [],
        "differential_reasoning": {
            "supporting": ["Kondisi umum yang perlu dipertimbangkan berdasarkan gejala pencernaan."],
            "against": ["Diperlukan pemeriksaan lebih lanjut untuk konfirmasi."],
        },
        "confidence": "low",
        "patient_edu": [
            "Konsultasikan dengan dokter untuk evaluasi lebih lanjut.",
            "Perhatikan pola makan dan hindari makanan pemicu.",
        ],
        "_fallback": True,
    }
    return list(result[:2]) + [fallback]


def apply_postprocessing(analysis: dict, red_flag_triggered: bool) -> dict:
    result = analysis.get("result")
    if not isinstance(result, list):
        return analysis

    result = step2_calibrate_confidence(result, red_flag_triggered)
    result = step3_apply_weights(result)
    result = step4_red_flag_gate(result, red_flag_triggered)
    result = step5_common_disease_fallback(result)

    return {**analysis, "result": result}


# ── FastAPI ───────────────────────────────────────────────

app = FastAPI(title="SA Inference Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    category:          str | None = None
    responses:         list[dict]
    language:          str = "id"
    gender:            str = "unknown"
    age:               str = "unknown"
    redFlagTriggered:  bool = False


@app.get("/health")
async def health():
    """각 vLLM 인스턴스 상태 확인"""
    results = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for url in VLLM_URLS:
            try:
                r = await client.get(f"{url}/health")
                results[url] = "ok" if r.status_code == 200 else f"status={r.status_code}"
            except Exception as e:
                results[url] = f"error: {e}"
    return {"status": "ok", "model": VLLM_MODEL, "instances": results}


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    t0 = time.time()

    # ── 질병 리스트 선택 ──────────────────────────────────
    lang = req.language
    if lang == "ko":
        disease_list = "\n".join(f"- {d}" for d in PROMPTS["diseases"]["korean"])
    elif lang in ("vn", "vi"):
        disease_list = "\n".join(f"- {d}" for d in PROMPTS["diseases"].get("vietnamese", PROMPTS["diseases"]["indonesian"]))
    else:
        disease_list = "\n".join(f"- {d}" for d in PROMPTS["diseases"]["indonesian"])

    language_name_map = {"ko": "Korean (한국어)", "id": "Indonesian (Bahasa Indonesia)", "vn": "Vietnamese (Tiếng Việt)"}
    language_name = language_name_map.get(lang, "Indonesian (Bahasa Indonesia)")

    red_flag_status = "Ya (Sinyal bahaya terdeteksi)" if req.redFlagTriggered else "Tidak"
    if lang == "ko":
        red_flag_status = "예 (위험 신호 감지됨)" if req.redFlagTriggered else "아니오"

    questionnaire_text = "\n\n".join(
        f"{i+1}. {r.get('question', '')}{' [⚠️ Red Flag]' if r.get('is_red_flag') else ''}\n   Answer: "
        + (", ".join(r["answers"]) if isinstance(r.get("answers"), list) else str(r.get("answers", "")))
        for i, r in enumerate(req.responses)
    )

    prompt = (
        PROMPTS["analysis_prompt"]
        .replace("{language}", language_name)
        .replace("{gender}", req.gender)
        .replace("{age}", req.age)
        .replace("{category}", req.category or "General")
        .replace("{red_flag_status}", red_flag_status)
        .replace("{questionnaire_data}", questionnaire_text)
        .replace("{disease_list}", disease_list)
    )

    # ── vLLM 호출 ─────────────────────────────────────────
    payload = {
        "model": VLLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 3000,
        "temperature": 0.1,
    }

    vllm_url = next_vllm_url()
    log.info(f"Calling vLLM: {vllm_url}/v1/chat/completions")
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(f"{vllm_url}/v1/chat/completions", json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            log.error(f"vLLM error ({vllm_url}): {e}")
            raise HTTPException(status_code=502, detail=f"vLLM request failed: {e}")

    vllm_data = resp.json()
    raw_content: str = vllm_data["choices"][0]["message"]["content"]
    total_tokens: int = vllm_data.get("usage", {}).get("total_tokens", 0)

    # ── JSON 파싱 ──────────────────────────────────────────
    try:
        analysis_json: dict[str, Any] = json.loads(raw_content)
    except json.JSONDecodeError:
        cleaned = raw_content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            analysis_json = json.loads(cleaned)
        except json.JSONDecodeError as e:
            log.error(f"JSON parse error: {e}\nRaw: {raw_content[:500]}")
            raise HTTPException(status_code=500, detail="Model returned invalid JSON")

    # ── 5단계 후처리 ──────────────────────────────────────
    analysis_json = apply_postprocessing(analysis_json, req.redFlagTriggered)

    elapsed = round(time.time() - t0, 2)
    log.info(f"Done in {elapsed}s | tokens={total_tokens}")

    return {
        "analysis":         analysis_json,
        "category":         req.category,
        "gender":           req.gender,
        "age":              req.age,
        "language":         lang,
        "redFlagTriggered": req.redFlagTriggered,
        "timestamp":        time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tokens":           total_tokens,
        "elapsed_sec":      elapsed,
        "model":            VLLM_MODEL,
    }
