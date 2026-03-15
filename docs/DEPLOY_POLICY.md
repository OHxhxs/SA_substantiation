# 배포 정책 — Cloud Run + GitHub Actions CI/CD

## 개요

| 항목 | 내용 |
|---|---|
| 프론트엔드 | Firebase Hosting (정적 CDN) |
| 백엔드 | Google Cloud Run (컨테이너 서버리스) |
| CI/CD | GitHub Actions (`main` 브랜치 push 시 자동 배포) |
| 컨테이너 레지스트리 | Google Artifact Registry (`gcr.io`) |

---

## 브랜치 전략

```
main        ← 프로덕션 배포 트리거 (push 시 자동 배포)
dev         ← 개발 작업 브랜치
feature/*   ← 기능 개발 브랜치
```

- `feature/*` → `dev` : PR 머지, 자동 배포 없음
- `dev` → `main` : PR 머지 후 자동 배포 시작

---

## 아키텍처

```
사용자
  ↓
Firebase Hosting (프론트 — HTML/CSS/JS 정적 파일)
  ↓ /api/* 호출
Cloud Run (백엔드 — Node.js Express 컨테이너)
  ├─ [rule survey]  → GPU 추론 서버 (inference_server.py:8755) → vLLM Gemma
  └─ [chat survey]  → OpenAI API (gpt-4o)
  ↓
Google Sheets (결과 저장)
```

---

## 최초 1회 설정

### 1. GCP 프로젝트 설정

```bash
gcloud config set project [PROJECT_ID]

# Artifact Registry API 활성화
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 2. GCP 서비스 계정 생성

```bash
# 서비스 계정 생성
gcloud iam service-accounts create github-actions \
  --display-name "GitHub Actions"

# 필요 권한 부여
for role in roles/run.admin roles/storage.admin roles/iam.serviceAccountUser roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding [PROJECT_ID] \
    --member="serviceAccount:github-actions@[PROJECT_ID].iam.gserviceaccount.com" \
    --role="$role"
done

# 키 파일 생성 (GitHub Secret에 등록용)
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@[PROJECT_ID].iam.gserviceaccount.com
```

### 3. Firebase 초기화

```bash
npm install -g firebase-tools
firebase login
cd frontend
firebase init hosting
# → Public directory: dist
# → Single-page app: Yes
# → Automatic builds: No

# CI용 토큰 발급
firebase login:ci
```

### 4. GitHub Secrets 등록

GitHub 레포 → Settings → Secrets and variables → Actions → New repository secret

| Secret 이름 | 설명 | 값 |
|---|---|---|
| `GCP_PROJECT_ID` | GCP 프로젝트 ID | `my-project-123` |
| `GCP_SA_KEY` | 서비스 계정 키 | `key.json` 파일 전체 내용 (JSON) |
| `CLOUD_RUN_URL` | 백엔드 Cloud Run URL | `https://backend-xxxx.run.app` |
| `OPENAI_API_KEY` | OpenAI API 키 | `sk-...` |
| `GOOGLE_SHEET_URL` | Google Apps Script URL | `https://script.google.com/...` |
| `FIREBASE_TOKEN` | Firebase CI 토큰 | `firebase login:ci` 결과값 |
| `GPU_SERVER_URL` | GPU 추론 서버 URL | `http://[GPU서버IP]:8755` |

---

## GitHub Actions 워크플로우

`.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  REGION: asia-northeast3
  BACKEND_SERVICE: medical-backend
  FRONTEND_DIR: frontend

jobs:
  # ── 백엔드: Cloud Run 배포 ──────────────────────────────
  deploy-backend:
    name: Backend → Cloud Run
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Build & Push Docker Image
        run: |
          gcloud builds submit ./backend \
            --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/${{ env.BACKEND_SERVICE }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.BACKEND_SERVICE }} \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/${{ env.BACKEND_SERVICE }} \
            --platform managed \
            --region ${{ env.REGION }} \
            --allow-unauthenticated \
            --set-env-vars "OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }},GOOGLE_SHEET_URL=${{ secrets.GOOGLE_SHEET_URL }},GPU_SERVER_URL=${{ secrets.GPU_SERVER_URL }},NODE_ENV=production"

  # ── 프론트엔드: Firebase Hosting 배포 ──────────────────
  deploy-frontend:
    name: Frontend → Firebase Hosting
    runs-on: ubuntu-latest
    needs: deploy-backend  # 백엔드 먼저 배포 후 프론트 배포

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install dependencies
        run: cd ${{ env.FRONTEND_DIR }} && npm ci

      - name: Build
        run: cd ${{ env.FRONTEND_DIR }} && npm run build
        env:
          VITE_API_URL: ${{ secrets.CLOUD_RUN_URL }}

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.GCP_SA_KEY }}
          projectId: ${{ secrets.GCP_PROJECT_ID }}
          channelId: live
          entryPoint: ./${{ env.FRONTEND_DIR }}
```

---

## 배포 흐름

```
1. 로컬에서 작업
   git checkout -b feature/my-feature

2. 개발 완료 후 dev 브랜치로 PR
   git push origin feature/my-feature
   → GitHub에서 PR 생성 → dev 머지

3. 배포 준비 완료 시 main으로 PR
   dev → main PR 머지

4. GitHub Actions 자동 실행
   ├── [1단계] 백엔드 Docker 빌드 → gcr.io 푸시 → Cloud Run 배포
   └── [2단계] 프론트 npm build → Firebase Hosting 배포

5. 배포 완료 확인
   GitHub → Actions 탭에서 진행 상황 확인
```

---

## 환경변수 관리 원칙

- `.env` 파일은 절대 git에 커밋하지 않음 (`.gitignore`에 포함)
- 모든 민감 정보는 **GitHub Secrets** 에서 관리
- 로컬 개발 시에는 `backend/.env` 파일 직접 생성하여 사용

```
# backend/.env (로컬 전용, git 제외)
OPENAI_API_KEY=sk-...
GOOGLE_SHEET_URL=https://script.google.com/...
PORT=3001
NODE_ENV=development
```

---

## Cloud Run 설정 기준값

| 항목 | 값 |
|---|---|
| 리전 | `asia-northeast3` (서울) |
| 최소 인스턴스 | 0 (Cold Start 허용) |
| 최대 인스턴스 | 10 |
| 메모리 | 512Mi |
| CPU | 1 |
| 요청 타임아웃 | 300초 |

Cold Start가 문제가 될 경우 최소 인스턴스를 1로 변경:

```bash
gcloud run services update medical-backend \
  --min-instances 1 \
  --region asia-northeast3
```

---

## 롤백 방법

Cloud Run은 이전 리비전으로 즉시 롤백 가능:

```bash
# 리비전 목록 확인
gcloud run revisions list --service medical-backend --region asia-northeast3

# 특정 리비전으로 트래픽 전환
gcloud run services update-traffic medical-backend \
  --to-revisions [REVISION_NAME]=100 \
  --region asia-northeast3
```
