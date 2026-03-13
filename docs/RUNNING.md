# ✅ 시스템 실행 완료!

## 🎉 현재 상태

**컨테이너**: `medical-questionnaire-frontend`  
**상태**: ✅ 실행 중 (Up)  
**포트**: 8755 → 8755  
**서버**: Vite 개발 서버

## 🌐 접속 URL

```
http://localhost:8755
```

또는

```
http://127.0.0.1:8755
```

## 📊 주요 명령어

### 로그 확인 (실시간)
```bash
docker compose logs -f frontend
```

### 컨테이너 상태 확인
```bash
docker compose ps
```

### 재시작
```bash
docker compose restart
```

### 중지
```bash
docker compose stop
```

### 완전 종료 및 삭제
```bash
docker compose down
```

### 다시 시작
```bash
docker compose up -d
```

## 🔧 개발 중 주의사항

### 코드 수정 시
- `frontend/src/` 디렉토리의 파일들을 수정하면 자동으로 핫 리로드됩니다
- 저장하면 브라우저가 자동으로 새로고침됩니다

### API 키 설정
`frontend/src/App.jsx` 파일의 117번째 줄에서 API 키를 설정하세요:

```javascript
const apiKey = "your-openai-api-key-here";
```

### 데이터 업데이트
엑셀 파일(`interview_system_db.xlsx`)을 수정한 후:

```bash
uv run python convert_excel_to_json.py
```

그러면 `frontend/src/data/questionnaireData.json`이 자동으로 업데이트됩니다.

## 🎨 주요 기능

### 1. 스마트 문진 (Rule-Based)
- ✅ 카테고리 선택 (배가 아파요, 소화가 안돼요)
- ✅ Red Flag 질문 9개 (위험 신호 감지)
- ✅ 일반 문진 7개 (상세 증상)
- ✅ 동적 분기 로직
- ✅ Red Flag 경고 화면

### 2. AI 어드바이저 (Chat-Based)
- ✅ ChatGPT API 연동
- ✅ 실시간 대화형 상담
- ✅ 다국어 지원

### 3. 다국어
- 🇰🇷 한국어
- 🇻🇳 베트남어
- 🇮🇩 인도네시아어

## 📝 문제 해결

### 브라우저에서 접속이 안 되는 경우
1. 컨테이너 상태 확인: `docker compose ps`
2. 로그 확인: `docker compose logs frontend`
3. 포트 확인: `netstat -tuln | grep 8755`

### 수정 사항이 반영 안 되는 경우
```bash
# 컨테이너 재시작
docker compose restart

# 또는 완전 재빌드
docker compose down
docker compose up --build -d
```

### 캐시 문제
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🚀 현재 실행 중!

브라우저에서 **http://localhost:8755**로 접속하세요!

**작성 시간**: 2026-01-26 16:53  
**Docker**: ✅ 실행 중  
**Vite**: ✅ Ready
