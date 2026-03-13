# Docker 실행 가이드 🐳

## 빠른 시작 (개발 모드)

### 1. Docker Compose로 실행

```bash
cd /home/dev/workspace/mo/SA_valid

# 컨테이너 빌드 및 실행
docker-compose up --build
```

### 2. 브라우저 접속

```
http://localhost:8755
```

### 3. 종료

```bash
# Ctrl+C 또는
docker-compose down
```

## 개발 환경 상세 설명

### 자동 리로드
- `src/` 디렉토리의 코드 변경 시 자동으로 핫 리로드됩니다
- 볼륨 마운트로 실시간 개발 가능

### 로그 확인
```bash
docker-compose logs -f frontend
```

### 컨테이너 재시작
```bash
docker-compose restart
```

## 프로덕션 빌드

### 1. 프로덕션 이미지 빌드

```bash
docker build -f Dockerfile.prod -t medical-questionnaire:latest .
```

### 2. 프로덕션 컨테이너 실행

```bash
docker run -d \
  --name medical-questionnaire \
  -p 80:80 \
  medical-questionnaire:latest
```

### 3. 접속

```
http://localhost
```

## Docker 명령어 모음

### 개발 모드

```bash
# 백그라운드 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 컨테이너 상태 확인
docker-compose ps

# 컨테이너 중지
docker-compose stop

# 컨테이너 삭제
docker-compose down

# 이미지까지 삭제
docker-compose down --rmi all
```

### 프로덕션 모드

```bash
# 이미지 빌드
docker build -f Dockerfile.prod -t medical-questionnaire:prod .

# 컨테이너 실행
docker run -d -p 80:80 --name medical-app medical-questionnaire:prod

# 로그 확인
docker logs -f medical-app

# 컨테이너 중지
docker stop medical-app

# 컨테이너 삭제
docker rm medical-app

# 이미지 삭제
docker rmi medical-questionnaire:prod
```

## 환경 변수 설정

### ChatGPT API 키 설정

#### 방법 1: docker-compose.yml 수정

```yaml
services:
  frontend:
    environment:
      - VITE_OPENAI_API_KEY=your-api-key-here
```

#### 방법 2: .env 파일 사용

```bash
# frontend/.env 파일 생성
echo "VITE_OPENAI_API_KEY=your-api-key-here" > frontend/.env
```

그리고 docker-compose.yml에 추가:

```yaml
services:
  frontend:
    env_file:
      - ./frontend/.env
```

## 포트 정보

현재 설정된 포트: **8755**

- 호스트 포트: 8755
- 컨테이너 내부 포트: 8755

포트 변경이 필요한 경우:
1. `vite.config.js`에서 `port: 8755` 수정
2. `docker-compose.yml`에서 `"8755:8755"` 수정
3. `frontend/Dockerfile`에서 `EXPOSE 8755` 수정

## 문제 해결

### 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :8755

# 또는 다른 포트 사용 (docker-compose.yml에서 포트 수정)
```

### 캐시 문제

```bash
# 캐시 없이 재빌드
docker-compose build --no-cache
docker-compose up
```

### 볼륨 초기화

```bash
# 모든 볼륨 삭제하고 재시작
docker-compose down -v
docker-compose up --build
```

## Docker 설치 확인

```bash
# Docker 버전 확인
docker --version

# Docker Compose 버전 확인
docker-compose --version

# Docker 실행 확인
docker ps
```

## 장점

### ✅ Node.js 버전 문제 해결
- 컨테이너 내부에서 Node.js 18 사용
- 호스트 환경과 독립적

### ✅ 일관된 개발 환경
- 모든 개발자가 동일한 환경 사용
- "내 컴퓨터에서는 되는데" 문제 해결

### ✅ 쉬운 배포
- 프로덕션 빌드를 Nginx로 서빙
- 최적화된 정적 파일 제공

### ✅ 격리된 환경
- 호스트 시스템에 영향 없음
- 깔끔한 개발 환경

## 다음 단계

1. ✅ `docker-compose up --build` 실행
2. ✅ `http://localhost:8755` 접속
3. ✅ API 키 설정 (필요 시)
4. ✅ 개발 시작!

---

**작성일**: 2026-01-26  
**Docker 환경**: Node.js 18 + Alpine Linux
