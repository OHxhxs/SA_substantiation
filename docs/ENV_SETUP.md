# 🔑 환경 변수 설정 가이드

## 필수 설정

시스템을 실행하기 전에 OpenAI API 키를 설정해야 합니다.

### 방법 1: .env 파일 생성 (권장)

```bash
cd /home/dev/workspace/mo/SA_valid
echo "OPENAI_API_KEY=sk-your-actual-api-key-here" > .env
```

### 방법 2: 직접 파일 생성

`.env` 파일을 만들고 다음 내용을 입력:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## API 키 발급 방법

1. OpenAI 웹사이트 방문: https://platform.openai.com/
2. 로그인 또는 회원가입
3. API Keys 메뉴로 이동
4. "Create new secret key" 클릭
5. 생성된 키 복사 (한 번만 표시됨)
6. `.env` 파일에 붙여넣기

## 확인

```bash
# .env 파일 확인
cat .env

# 출력 예시:
# OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 실행

```bash
# Docker Compose 실행
docker compose up --build -d

# 백엔드 로그에서 API 키 설정 확인
docker compose logs backend | grep "OpenAI API"

# 출력 예시:
# 🔑 OpenAI API: ✅ Configured
```

## 보안 주의사항

⚠️ **절대 하지 말 것**:
- Git에 `.env` 파일 커밋
- 공개 저장소에 API 키 노출
- 프론트엔드 코드에 하드코딩

✅ **안전한 방법**:
- `.env` 파일 사용
- `.gitignore`에 `.env` 포함 (이미 설정됨)
- 백엔드에서만 API 키 사용 (현재 구조)
