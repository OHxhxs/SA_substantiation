#!/bin/bash
# AI 서버 전체 실행 스크립트 (vLLM TP2 on GPU 1+2 + FastAPI)

BASE_MODEL="aisingapore/Gemma-SEA-LION-v3-9B-IT"
LORA_ADAPTER="MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172"

echo "▶ Starting vLLM (GPU 1+2 tensor-parallel, port 8754)..."
CUDA_VISIBLE_DEVICES=1,2 python -m vllm.entrypoints.openai.api_server \
  --model "$BASE_MODEL" \
  --enable-lora \
  --lora-modules "gastro=$LORA_ADAPTER" \
  --max-lora-rank 32 \
  --dtype bfloat16 \
  --tensor-parallel-size 2 \
  --gpu-memory-utilization 0.8 \
  --max-model-len 4096 \
  --host 0.0.0.0 \
  --port 8754 &

echo "⏳ Waiting for vLLM to be ready..."
sleep 120

echo "▶ Starting FastAPI inference server (port 8755)..."
VLLM_URLS="http://localhost:8754" \
VLLM_MODEL="gastro" \
uvicorn inference_server:app --host 0.0.0.0 --port 8755

wait
