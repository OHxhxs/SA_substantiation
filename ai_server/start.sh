#!/bin/bash
# AI 서버 전체 실행 스크립트 (vLLM × 2 + FastAPI)

MODEL="MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172"

echo "▶ Starting vLLM instance 0 (GPU 0, port 8754)..."
CUDA_VISIBLE_DEVICES=0 python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL" \
  --dtype bfloat16 \
  --gpu-memory-utilization 0.8 \
  --max-model-len 4096 \
  --port 8754 &

echo "▶ Starting vLLM instance 1 (GPU 1, port 8756)..."
CUDA_VISIBLE_DEVICES=1 python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL" \
  --dtype bfloat16 \
  --gpu-memory-utilization 0.8 \
  --max-model-len 4096 \
  --port 8756 &

echo "⏳ Waiting for vLLM instances to be ready..."
sleep 30

echo "▶ Starting FastAPI inference server (port 8755)..."
VLLM_URLS="http://localhost:8754,http://localhost:8756" \
VLLM_MODEL="$MODEL" \
uvicorn inference_server:app --host 0.0.0.0 --port 8755

wait
