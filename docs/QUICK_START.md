# ⚡ 빠른 시작 가이드

## 3분 안에 실행하기

### 1️⃣ API 키 설정 (30초)

```bash
cd /home/dev/workspace/mo/SA_valid
echo "OPENAI_API_KEY=sk-your-api-key-here" > .env
```

**API 키가 없다면?** → https://platform.openai.com/api-keys

---

### 2️⃣ Docker 실행 (2분)

```bash
# 기존 컨테이너 종료 (실행 중이라면)
docker compose down

# 새로운 구성으로 시작
docker compose up --build -d
```

---

### 3️⃣ 확인 (30초)

```bash
# 서비스 상태 확인
docker compose ps

# 백엔드 헬스체크
curl http://localhost:3001/health

# 로그 확인
docker compose logs -f
```

---

### 4️⃣ 접속! 🎉

**프론트엔드**: http://localhost:8755  
**백엔드 API**: http://localhost:3001

---

## 🎨 기능 테스트

### 스마트 문진
1. "스마트 문진" 선택
2. 카테고리 선택 (예: 배가 아파요)
3. Red Flag 질문 9개 답변
4. 일반 문진 7개 답변
5. 결과 확인

### AI 어드바이저
1. "AI 어드바이저" 선택
2. 증상 입력 (예: "배가 아파요")
3. AI 응답 확인
4. 대화 계속 진행

---

## 🔧 문제가 생긴다면?

### 백엔드 연결 실패
```bash
# API 키 확인
cat .env

# 백엔드 로그
docker compose logs backend
```

### 포트 충돌
```bash
# 포트 사용 확인
lsof -i :8755
lsof -i :3001

# 또는 docker-compose.yml에서 포트 변경
```

### 완전 초기화
```bash
docker compose down --rmi all
docker compose up --build -d
```

---

## 📚 더 자세한 정보

- [README_COMPLETE.md](./README_COMPLETE.md) - 완전한 가이드
- [BACKEND_SETUP.md](./BACKEND_SETUP.md) - 백엔드 상세 설명
- [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) - Docker 사용법

---

**지금 바로 시작하세요!** 🚀
