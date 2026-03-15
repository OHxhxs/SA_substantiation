"""
inference_server.py — Gemma 추론 + 5단계 후처리 FastAPI 서버

실행:
    uvicorn inference_server:app --host 0.0.0.0 --port 8755

환경변수:
    VLLM_URLS  : vLLM 서버 URL (기본: http://localhost:8754)
    VLLM_MODEL : 모델명/alias (기본: gastro)

GPU 서버 실행: start.sh 참고 (GPU 1+2 TP2 + LoRA)
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
_raw_urls  = os.getenv("VLLM_URLS", "http://localhost:8754")
VLLM_URLS  = [u.strip() for u in _raw_urls.split(",") if u.strip()]
VLLM_MODEL = os.getenv("VLLM_MODEL", "gastro")

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

    # ── 프롬프트 조립 ─────────────────────────────────────
    lang = req.language

    # history_talking 형식으로 변환
    history_lines = []
    for r in req.responses:
        question = r.get("question", "")
        answers = r.get("answers", "")
        if isinstance(answers, list):
            answers = ", ".join(answers)
        red_flag_mark = " [⚠️ Red Flag]" if r.get("is_red_flag") else ""
        history_lines.append(f"dokter : {question}{red_flag_mark}")
        history_lines.append(f"pasien : {answers}")

    history_text = "\n".join(history_lines)

    system_prompt = (
        "You are MediKoGPT, a gastroenterology diagnostic support AI agent developed by MENINBLOX.\n"
        "Your role is to analyze the doctor-patient interview content in the section marked ###history_talking "
        "and determine the patient's condition.\n"
        "The output must be in JSON format, and no other output should be provided outside of the section "
        "marked ###Output Format\n"
        "```json\n"
        "{\n"
        '  "result": [\n'
        '    {\n'
        '      "no": 1,\n'
        '      "disease": ["First suspected disease name"],\n'
        '      "symptom_summary": "Key symptom summary in Indonesian",\n'
        '      "red_flags": ["red flag symptoms"],\n'
        '      "differential_reasoning": {\n'
        '        "supporting": ["evidence supporting this diagnosis"],\n'
        '        "against": ["evidence against this diagnosis"]\n'
        '      },\n'
        '      "confidence": "high/medium/low",\n'
        '      "patient_edu": ["Patient education content"]\n'
        '    },\n'
        '    {\n'
        '      "no": 2,\n'
        '      "disease": ["..."],\n'
        '      "symptom_summary": "...",\n'
        '      "red_flags": ["..."],\n'
        '      "differential_reasoning": {"supporting": ["..."], "against": ["..."]},\n'
        '      "confidence": "...",\n'
        '      "patient_edu": ["..."]\n'
        '    },\n'
        '    {\n'
        '      "no": 3,\n'
        '      "disease": ["..."],\n'
        '      "symptom_summary": "...",\n'
        '      "red_flags": ["..."],\n'
        '      "differential_reasoning": {"supporting": ["..."], "against": ["..."]},\n'
        '      "confidence": "...",\n'
        '      "patient_edu": ["..."]\n'
        '    }\n'
        '  ]\n'
        '}\n'
        "```"
    )

    user_prompt = f"###history_talking\n{history_text}"

    # ── vLLM 호출 ─────────────────────────────────────────
    payload = {
        "model": VLLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "max_tokens": 1500,
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
