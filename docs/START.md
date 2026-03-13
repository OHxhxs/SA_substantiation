# 🚀 빠른 시작 가이드

## Docker로 실행하기 (권장)

### 1️⃣ 실행 명령

```bash
cd /home/dev/workspace/mo/SA_valid
docker-compose up --build -d
```

### 2️⃣ 접속

```
http://localhost:8755
```

### 3️⃣ 로그 확인

```bash
docker-compose logs -f
```

### 4️⃣ 종료

```bash
docker-compose down
```

---

## 포트 정보

- **호스트 포트**: 8755
- **컨테이너 내부 포트**: 8755
- **접속 URL**: http://localhost:8755

---

## 주요 명령어

```bash
# 실행
docker-compose up -d

# 재시작
docker-compose restart

# 로그 보기
docker-compose logs -f

# 중지
docker-compose stop

# 완전 삭제
docker-compose down
```

---

## 문제 해결

### 포트가 이미 사용 중인 경우

```bash
# 8755 포트를 사용하는 프로세스 확인
lsof -i :8755

# 또는
netstat -tuln | grep 8755
```

### 캐시 문제

```bash
# 캐시 없이 재빌드
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## ✅ 완료!

이제 브라우저에서 `http://localhost:8755`로 접속하세요! 🎉
