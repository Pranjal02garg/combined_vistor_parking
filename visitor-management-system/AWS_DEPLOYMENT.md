# AWS Deployment Guide for Campus VMS (`vsm-deploy`)

This repository is containerized and configured for high-performance deployment on **Amazon Web Services (AWS)** using Next.js standalone mode and multi-stage Docker builds.

---

## 🚀 Option 1: AWS App Runner (Recommended — Easiest & Auto-Scaling)

AWS App Runner provides fully managed container hosting with built-in auto-scaling, SSL certificates, and load balancing.

### Steps:
1. **Push Image to Amazon ECR**:
   ```bash
   # 1. Authenticate Docker with Amazon ECR
   aws ecr get-login-password --region <YOUR_AWS_REGION> | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<YOUR_AWS_REGION>.amazonaws.com

   # 2. Create ECR repository (first time only)
   aws ecr create-repository --repository-name vsm-deploy --region <YOUR_AWS_REGION>

   # 3. Build & Tag Docker Image
   docker build -t vsm-deploy .
   docker tag vsm-deploy:latest <AWS_ACCOUNT_ID>.dkr.ecr.<YOUR_AWS_REGION>.amazonaws.com/vsm-deploy:latest

   # 4. Push Image
   docker push <AWS_ACCOUNT_ID>.dkr.ecr.<YOUR_AWS_REGION>.amazonaws.com/vsm-deploy:latest
   ```

2. **Create App Runner Service**:
   - In AWS Console, open **AWS App Runner** → **Create service**.
   - **Source**: Select *Container registry* → *Amazon ECR*.
   - **Image repository**: Select `vsm-deploy:latest`.
   - **Deployment trigger**: Select *Automatic* (deploys whenever a new image is pushed).
   - **Port**: Set `3000`.
   - **Environment Variables**: Add keys from `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, etc.).
   - Click **Create & Deploy**.

---

## 🏛️ Option 2: AWS ECS Fargate (Serverless Container Orchestration)

1. Create an **ECS Cluster** in AWS Console or via AWS CLI:
   ```bash
   aws ecs create-cluster --cluster-name vsm-cluster --region <YOUR_AWS_REGION>
   ```
2. Register the task definition in [`aws-task-definition.json`](./aws-task-definition.json):
   ```bash
   aws ecs register-task-definition --cli-input-json file://aws-task-definition.json
   ```
3. Create an ECS Service with an Application Load Balancer (ALB) pointing to target port `3000`.

---

## 💻 Option 3: AWS EC2 (Single VM with Docker & Nginx)

1. Launch an **Ubuntu 24.04 / Amazon Linux 2023** EC2 instance.
2. Install Docker:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose
   sudo usermod -aG docker $USER
   ```
3. Clone repository and run:
   ```bash
   git clone https://github.com/Pranjal02garg/vsm-deploy.git
   cd vsm-deploy
   cp .env.example .env
   # Edit .env with your production credentials
   docker compose up -d --build
   ```

---

## 🔑 Production Environment Variables Checklist

Ensure the following environment variables are supplied in AWS (via App Runner Environment Variables, ECS Secrets, or EC2 `.env`):

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (AWS RDS / Aurora / Neon) |
| `AUTH_SECRET` | 32-byte secret (`openssl rand -base64 32`) |
| `AUTH_URL` | Canonical domain URL (e.g., `https://vms.yourdomain.edu`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob or S3 token for selfie images |
| `UPSTASH_REDIS_REST_URL` | Redis URL for OTP rate limiting & locks |
| `UPSTASH_REDIS_REST_TOKEN`| Redis Token |
| `ENABLE_REAL_SMS` | `true` for production SMS delivery |
| `SMS_PROVIDER` | `twilio`, `fast2sms`, `msg91`, or `aws_sns` |
| `SES_FROM_EMAIL` | Verified AWS SES email address |
| `CRON_SECRET` | Secret key for cron expiry endpoints |

---

## 🧪 Local Container Testing

Test the container locally before deploying to AWS:

```bash
# Build the Docker image
docker build -t vsm-deploy .

# Run container locally
docker run -p 3000:3000 \
  -e DATABASE_URL="file:./prisma/dev.db" \
  -e AUTH_SECRET="your-32-byte-secret" \
  -e AUTH_URL="http://localhost:3000" \
  vsm-deploy
```
Open `http://localhost:3000` in your browser.
