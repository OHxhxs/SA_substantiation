# Node.js 18 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 소스 코드 복사
COPY . .

# 포트 노출
EXPOSE 8755

# 개발 서버 실행
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8755"]
