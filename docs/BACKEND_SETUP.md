# 🔧 백엔드 프록시 서버 가이드

## 📋 개요

백엔드 API 서버가 추가되어 **보안**과 **확장성**이 크게 개선되었습니다!

### 🏗️ 아키텍처

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   브라우저     │────▶│   Backend    │────▶│  OpenAI API  │
│  (React)     │     │  API Server  │     │  (ChatGPT)   │
│  포트: 8755   │     │  포트: 3001   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
     ↑                      ↑
     │                      │
  프론트엔드              백엔드만
  (API 키 없음)          API 키 보관
```

---

## ✅ 주요 개선 사항

### 1. **보안 강화** 🔒
- ✅ API 키가 프론트엔드에 **절대 노출되지 않음**
- ✅ 브라우저 개발자 도구에서 확인 불가
- ✅ Docker 이미지에도 키 미포함
- ✅ Helmet.js로 보안 헤더 적용

### 2. **비용 관리** 💰
- ✅ Rate Limiting (15분당 100회 제한)
- ✅ 메시지 길이 제한 (최대 2000자)
- ✅ 토큰 사용량 로깅
- ✅ 남용 방지

### 3. **확장성** 📈
- ✅ 여러 AI 모델 전환 가능
- ✅ 캐싱 구현 가능
- ✅ 로깅 및 모니터링
- ✅ 데이터베이스 연동 준비

---

## 🚀 실행 방법

### 1. 환경 변수 설정

`.env` 파일 생성:

```bash
cd /home/dev/workspace/mo/SA_valid
cp .env.example .env
```

`.env` 파일 수정:

```bash
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

### 2. Docker Compose 실행

```bash
docker compose up --build -d
```

### 3. 서비스 확인

```bash
# 전체 상태
docker compose ps

# 백엔드 로그
docker compose logs -f backend

# 프론트엔드 로그
docker compose logs -f frontend
```

### 4. 헬스체크

```bash
# 백엔드 API 상태 확인
curl http://localhost:3001/health

# 응답 예시:
# {"status":"healthy","timestamp":"2026-01-26T...","service":"medical-questionnaire-backend"}
```

---

## 🔌 API 엔드포인트

### 1. **헬스체크**
```
GET /health
```

**응답**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-26T10:00:00.000Z",
  "service": "medical-questionnaire-backend"
}
```

### 2. **AI 채팅**
```
POST /api/chat
```

**요청**:
```json
{
  "message": "배가 아파요",
  "language": "ko",
  "sessionId": "abc123"
}
```

**응답**:
```json
{
  "response": "배가 아프시다니 걱정이시겠네요...",
  "tokens": 234,
  "timestamp": "2026-01-26T10:00:00.000Z"
}
```

### 3. **문진 분석** (선택사항)
```
POST /api/analyze
```

**요청**:
```json
{
  "category": "배가 아파요",
  "responses": [
    {
      "question": "통증의 위치는?",
      "answers": ["상복부", "우상복부"]
    }
  ],
  "language": "ko"
}
```

---

## 🐳 Docker 구성

### 서비스 구조

```yaml
services:
  backend:
    - 포트: 3001
    - 환경변수: OPENAI_API_KEY
    - 헬스체크: 30초마다
    
  frontend:
    - 포트: 8755
    - backend 의존
    - 백엔드 연결: http://backend:3001
```

### 네트워크

- `medical-network` (Bridge)
- 서비스 간 통신: 컨테이너 이름으로 접근
  - Frontend → `http://backend:3001`
  - Backend → 외부 OpenAI API

---

## 📊 보안 기능

### 1. **Rate Limiting**
- 15분당 최대 100 요청
- IP 기반 제한
- 초과 시: 429 에러

### 2. **입력 검증**
- 메시지 길이: 최대 2000자
- 타입 검증
- XSS 방지

### 3. **Helmet.js**
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- 기타 보안 헤더

### 4. **CORS**
- 개발: 모든 Origin 허용
- 프로덕션: 특정 도메인만 허용

---

## 🔧 환경 변수

### 백엔드 (`backend/.env`)

```bash
# OpenAI API 키 (필수)
OPENAI_API_KEY=sk-xxxxx

# 서버 포트
PORT=3001

# 환경 설정
NODE_ENV=development

# CORS 설정
CORS_ORIGIN=*
```

### 프론트엔드 (docker-compose.yml)

```yaml
environment:
  - VITE_API_URL=http://backend:3001
```

---

## 📝 로그 확인

### 백엔드 로그

```bash
# 실시간 로그
docker compose logs -f backend

# 최근 100줄
docker compose logs --tail=100 backend
```

**로그 예시**:
```
[2026-01-26T10:00:00.000Z] Chat request - Language: ko, Session: abc123
[2026-01-26T10:00:02.000Z] Response sent - Tokens: 234
```

---

## 🧪 테스트

### 백엔드 API 테스트

```bash
# 헬스체크
curl http://localhost:3001/health

# AI 채팅 테스트
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "안녕하세요",
    "language": "ko"
  }'
```

### 프론트엔드 테스트

브라우저에서 `http://localhost:8755` 접속 후:
1. AI 어드바이저 모드 선택
2. 메시지 입력
3. 응답 확인

---

## 🚨 문제 해결

### 1. 백엔드 연결 실패

**증상**: `AI 시스템과 통신 중 오류`

**해결**:
```bash
# 백엔드 상태 확인
docker compose ps backend

# 백엔드 로그 확인
docker compose logs backend

# 백엔드 재시작
docker compose restart backend
```

### 2. API 키 오류

**증상**: `AI 서비스 설정이 완료되지 않았습니다`

**해결**:
```bash
# .env 파일 확인
cat .env

# API 키 재설정
echo "OPENAI_API_KEY=sk-xxxxx" > .env

# Docker 재시작
docker compose down
docker compose up -d
```

### 3. Rate Limit 초과

**증상**: `너무 많은 요청이 발생했습니다`

**해결**: 15분 후 재시도 또는 백엔드의 Rate Limit 설정 조정

---

## 🎯 다음 단계

### 추가 가능한 기능:

1. **데이터베이스 연동**
   - PostgreSQL/MongoDB 추가
   - 문진 결과 저장
   - 사용자 히스토리

2. **인증/인가**
   - JWT 토큰
   - 사용자 관리
   - 권한 제어

3. **캐싱**
   - Redis 추가
   - 자주 사용되는 응답 캐싱
   - 비용 절감

4. **모니터링**
   - Prometheus + Grafana
   - API 사용량 추적
   - 에러 알림

---

**작성일**: 2026-01-26  
**백엔드**: Node.js + Express + OpenAI  
**보안**: ✅ API 키 완전 격리
