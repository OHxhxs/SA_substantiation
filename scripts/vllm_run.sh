# nohup vllm 모델 서빙 서버 띄우기
CUDA_VISIBLE_DEVICES=1 python -m vllm.entrypoints.openai.api_server   --model MENINBLOX/Idn_Gas_Cat_qwen3_4b_sft_v1-25000  --dtype bfloat16   --gpu-memory-utilization 0.8   --max-model-len 4096   --port 8754  
