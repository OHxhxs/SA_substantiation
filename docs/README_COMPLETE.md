# 🏥 Medical Questionnaire System - 완벽 가이드

## 📋 목차

1. [시스템 개요](#-시스템-개요)
2. [빠른 시작](#-빠른-시작)
3. [아키텍처](#-아키텍처)
4. [기능](#-기능)
5. [보안](#-보안)
6. [API 문서](#-api-문서)
7. [배포](#-배포)

---

## 🎯 시스템 개요

**의료 문진 시스템 with AI 통합**

- **프론트엔드**: React + Vite + Tailwind CSS
- **백엔드**: Node.js + Express + OpenAI API
- **배포**: Docker + Docker Compose
- **포트**: Frontend (8755), Backend (3001)
- **보안**: API 키 완전 격리, Rate Limiting, Helmet.js

---

## 🚀 빠른 시작

### 1단계: API 키 설정

```bash
cd /home/dev/workspace/mo/SA_valid
echo "OPENAI_API_KEY=sk-your-api-key-here" > .env
```

### 2단계: Docker 실행

```bash
docker compose up --build -d
```

### 3단계: 접속

- **프론트엔드**: http://localhost:8755
- **백엔드 API**: http://localhost:3001
- **헬스체크**: http://localhost:3001/health

### 4단계: 로그 확인

```bash
# 전체 로그
docker compose logs -f

# 백엔드만
docker compose logs -f backend

# 프론트엔드만
docker compose logs -f frontend
```

---

## 🏗️ 아키텍처

### 전체 구조

```
┌─────────────────────────────────────────────────────┐
│                    사용자 브라우저                      │
│              http://localhost:8755                   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              Docker Compose Network                  │
│                 (medical-network)                    │
│                                                      │
│  ┌──────────────────────┐  ┌────────────────────┐  │
│  │     Frontend         │  │     Backend        │  │
│  │   (React + Vite)     │──▶│  (Express API)    │  │
│  │   Port: 8755         │  │   Port: 3001       │  │
│  │   - 문진 UI          │  │   - Rate Limiting  │  │
│  │   - AI 채팅          │  │   - 입력 검증      │  │
│  │   - 다국어 지원      │  │   - 보안 헤더      │  │
│  └──────────────────────┘  └─────────┬──────────┘  │
│                                       │              │
└───────────────────────────────────────┼──────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │   OpenAI API     │
                              │   (ChatGPT)      │
                              │   API 키 보관    │
                              └──────────────────┘
```

### 데이터 흐름

```
1. 사용자가 프론트엔드에서 메시지 입력
   ↓
2. Frontend → Backend API (/api/chat)
   - API 키 없이 전송
   ↓
3. Backend가 요청 검증
   - Rate Limiting 체크
   - 입력 길이 검증
   - 민감 정보 필터링
   ↓
4. Backend → OpenAI API
   - 백엔드에 저장된 API 키 사용
   ↓
5. OpenAI 응답 처리
   ↓
6. Backend → Frontend
   - AI 응답 전달
   ↓
7. 사용자에게 표시
```

---

## 🎨 기능

### 1. 스마트 문진 (Rule-Based)

#### 카테고리
- 배가 아파요 (CAT001)
- 소화가 안돼요 (CAT002)

#### Red Flag 질문 (9개)
위험 신호를 조기에 감지:
- 급성 증상
- 출혈 징후
- 쇼크 증상
- 등등...

#### 일반 문진 (7개)
상세한 증상 수집:
- 통증 위치
- 발생 시점
- 동반 증상
- 악화/완화 요인

#### 동적 분기 로직
- FlowLogic 기반 질문 흐름
- Red Flag 감지 시 즉시 경고
- 조건부 질문 표시

### 2. AI 어드바이저 (Chat-Based)

#### 특징
- ✅ ChatGPT-4 기반
- ✅ 실시간 대화형 상담
- ✅ 다국어 지원 (한국어, 베트남어, 인도네시아어)
- ✅ 전문적이고 공감하는 응답
- ✅ 의료 면책 조항 자동 포함

#### 보안
- ✅ API 키 프론트엔드 미노출
- ✅ Rate Limiting (15분당 100회)
- ✅ 메시지 길이 제한 (2000자)
- ✅ 세션 ID 추적

### 3. 다국어 지원

- 🇰🇷 **한국어** (ko)
- 🇻🇳 **베트남어** (vi)
- 🇮🇩 **인도네시아어** (id)

UI 및 AI 응답 모두 지원

---

## 🔒 보안

### 1. API 키 보호

#### ✅ 안전한 구조
```
❌ 프론트엔드에 API 키 하드코딩
✅ 백엔드에만 환경변수로 저장
✅ .dockerignore로 이미지 제외
✅ .gitignore로 Git 제외
```

#### 환경 변수 관리
```bash
# 호스트 시스템
.env 파일 → OPENAI_API_KEY

# Docker Compose
환경변수 주입 → 백엔드 컨테이너

# 백엔드
process.env.OPENAI_API_KEY
```

### 2. Rate Limiting

```javascript
// 15분당 100 요청으로 제한
windowMs: 15 * 60 * 1000
max: 100
```

### 3. 입력 검증

- 메시지 타입 확인
- 길이 제한 (최대 2000자)
- XSS 방지
- SQL Injection 방지

### 4. 보안 헤더 (Helmet.js)

- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security

### 5. CORS 정책

```javascript
// 개발 환경
cors: { origin: '*' }

// 프로덕션 (권장)
cors: { origin: 'https://yourdomain.com' }
```

---

## 📡 API 문서

### Base URL

```
http://localhost:3001
```

### 엔드포인트

#### 1. 헬스체크

```http
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

#### 2. AI 채팅

```http
POST /api/chat
```

**요청**:
```json
{
  "message": "배가 아파요. 어떻게 해야 하나요?",
  "language": "ko",
  "sessionId": "abc123"
}
```

**응답**:
```json
{
  "response": "배가 아프시다니 걱정이시겠네요. 증상에 대해 좀 더 자세히 말씀해 주시겠어요?...",
  "tokens": 234,
  "timestamp": "2026-01-26T10:00:00.000Z"
}
```

**에러 응답**:
```json
{
  "error": "메시지가 너무 깁니다. (최대 2000자)"
}
```

#### 3. 문진 분석 (선택사항)

```http
POST /api/analyze
```

**요청**:
```json
{
  "category": "배가 아파요",
  "responses": [
    {
      "question": "통증의 위치는 어디인가요?",
      "answers": ["상복부", "우상복부"]
    },
    {
      "question": "언제, 어떻게 시작했나요?",
      "answers": ["며칠 전부터 서서히"]
    }
  ],
  "language": "ko"
}
```

**응답**:
```json
{
  "analysis": "1. 증상 요약\n상복부와 우상복부에서 통증이 며칠 전부터...",
  "category": "배가 아파요",
  "timestamp": "2026-01-26T10:00:00.000Z"
}
```

---

## 🐳 Docker 관리

### 기본 명령어

```bash
# 시작 (백그라운드)
docker compose up -d

# 시작 (재빌드 포함)
docker compose up --build -d

# 중지
docker compose stop

# 재시작
docker compose restart

# 로그
docker compose logs -f

# 상태 확인
docker compose ps

# 완전 삭제
docker compose down

# 이미지까지 삭제
docker compose down --rmi all
```

### 개별 서비스 관리

```bash
# 백엔드만 재시작
docker compose restart backend

# 프론트엔드만 로그
docker compose logs -f frontend

# 백엔드 쉘 접속
docker compose exec backend sh
```

---

## 🚀 배포

### Docker Hub에 푸시

```bash
# 이미지 빌드
docker build -t username/medical-frontend:latest ./frontend
docker build -t username/medical-backend:latest ./backend

# Docker Hub 로그인
docker login

# 푸시
docker push username/medical-frontend:latest
docker push username/medical-backend:latest
```

### 프로덕션 서버에서 실행

```bash
# .env 파일 생성
echo "OPENAI_API_KEY=sk-xxxxx" > .env

# Docker Compose 실행
docker compose -f docker-compose.prod.yml up -d
```

---

## 📊 모니터링

### 로그 수준

```javascript
// 백엔드 로그
console.log('[timestamp] Chat request - Language: ko')
console.log('[timestamp] Response sent - Tokens: 234')
console.error('AI Chat Error:', error)
```

### 헬스체크

```bash
# 백엔드 헬스
curl http://localhost:3001/health

# Docker 헬스체크
docker compose ps
# STATUS 열에서 healthy 확인
```

---

## 🔧 문제 해결

### 1. 백엔드 연결 실패

```bash
docker compose logs backend
# API 키 확인
# 포트 충돌 확인
```

### 2. API 키 오류

```bash
cat .env
# OPENAI_API_KEY 확인
docker compose restart backend
```

### 3. Rate Limit 초과

15분 대기 또는 백엔드 설정 조정

### 4. 포트 충돌

```bash
lsof -i :8755
lsof -i :3001
# 포트 사용 중인 프로세스 종료
```

---

## 📚 참고 문서

- [README.md](./README.md) - 기술 문서
- [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) - Docker 상세 가이드
- [BACKEND_SETUP.md](./BACKEND_SETUP.md) - 백엔드 설정 가이드
- [START.md](./START.md) - 빠른 시작

---

## 🎯 체크리스트

### 실행 전

- [ ] `.env` 파일 생성 및 API 키 설정
- [ ] Docker 및 Docker Compose 설치 확인
- [ ] 포트 8755, 3001 사용 가능 확인

### 실행 후

- [ ] `docker compose ps`로 서비스 상태 확인
- [ ] http://localhost:8755 접속 확인
- [ ] http://localhost:3001/health 응답 확인
- [ ] AI 채팅 기능 테스트

### 배포 전

- [ ] 프로덕션 환경 변수 설정
- [ ] CORS 설정 특정 도메인으로 제한
- [ ] Rate Limiting 설정 조정
- [ ] 로그 수준 조정
- [ ] SSL/TLS 인증서 설정

---

**버전**: 2.0.0  
**최종 업데이트**: 2026-01-26  
**상태**: ✅ 프로덕션 준비 완료
