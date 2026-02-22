# 🚀 Deployment Dashboard — DevOps Project

> Node.js + Docker + Jenkins CI/CD Pipeline on AWS EC2

## 📁 Project Structure

```
devops-project/
├── src/
│   └── server.js          # Express backend + API
├── public/
│   └── index.html         # Dashboard UI
├── test/
│   └── server.test.js     # Jest tests
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Container orchestration
├── Jenkinsfile            # CI/CD Pipeline
├── ec2-setup.sh           # EC2 суулгах script
└── package.json
```

## 🔄 CI/CD Pipeline Flow

```
git push → GitHub Webhook → Jenkins → Test → Docker Build → Push → Deploy → Health Check
```

## ⚡ Хурдан эхлэх

### 1. Local дээр ажиллуулах
```bash
npm install
npm start
# http://localhost:3000 нээнэ
```

### 2. Docker-оор ажиллуулах
```bash
docker build -t dashboard .
docker run -p 3000:3000 dashboard
```

### 3. EC2 дээр суулгах
```bash
# EC2 рүү SSH хийгээд:
bash ec2-setup.sh
```

### 4. Jenkins тохиргоо
1. `http://EC2-IP:8080` нээнэ
2. Initial password: `sudo cat /var/lib/jenkins/secrets/initialAdminPassword`
3. **Manage Jenkins → Credentials** дээр нэмнэ:
   - ID: `dockerhub-credentials`
   - Docker Hub username + password
4. **New Item → Pipeline** үүсгэнэ
5. GitHub repo URL оруулна
6. **GitHub Webhook** тохируулна: `http://EC2-IP:8080/github-webhook/`

## 🌐 API Endpoints

| Endpoint | Тайлбар |
|----------|---------|
| `GET /` | Dashboard UI |
| `GET /health` | Health check |
| `GET /api/deployment` | Version, build info |
| `GET /api/metrics` | CPU, Memory, Disk |
| `GET /api/pipeline` | Pipeline stages |

## 🧪 Tests

```bash
npm test
```
# deployment-dashboard
