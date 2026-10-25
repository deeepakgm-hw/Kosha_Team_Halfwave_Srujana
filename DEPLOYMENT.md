# 🚀 KOSHA Deployment Guide

This repository is configured for **Unified Full-Stack Deployment**. A single production container/process serves the built React SPA frontend, REST API endpoints, and real-time Server-Sent Events (SSE) from a single URL without cross-origin (CORS) complexity.

---

## ⚡ Option 1: 1-Click Deploy on Render (Recommended)

Render can build and run this unified application directly from GitHub:

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Configure unified production deployment for Render/Docker"
   git push origin main
   ```

2. **Connect on Render:**
   - Log in to [dashboard.render.com](https://dashboard.render.com).
   - Click **New +** > **Web Service**.
   - Select your repository: `deeepakgm-hw/Kosha_Team_Halfwave_Srujana`.
   - Render will detect the `Dockerfile` and `render.yaml` automatically.
   - Or click **New +** > **Blueprint** and select your repository to provision directly using [`render.yaml`](./render.yaml).

3. **Configure Environment Variables in Render Dashboard:**
   | Variable | Value / Description |
   | :--- | :--- |
   | `ENVIRONMENT` | `production` |
   | `CORS_ORIGINS` | `*` |
   | `RAZORPAY_MODE` | `test` (or `live`) |
   | `RAZORPAY_KEY_ID` | Your Razorpay API Key ID (`rzp_test_...` or `rzp_live_...`) |
   | `RAZORPAY_KEY_SECRET` | Your Razorpay Key Secret |
   | `RAZORPAY_WEBHOOK_SECRET` | Your Razorpay Webhook Secret |

4. **Deploy:**
   Render builds the multi-stage Docker container:
   - Stage 1 compiles the React + Vite frontend to `/app/frontend/dist`.
   - Stage 2 boots the FastAPI server with dynamic `$PORT` routing.
   Your app will be live at `https://<your-service-name>.onrender.com`.

---

## 🐳 Option 2: Docker / Docker Compose (Local or VPS)

To run the containerized production stack anywhere Docker is available:

```bash
# Build and run container in background
docker compose up --build -d

# Check live logs
docker compose logs -f

# Verify service health
curl http://localhost:8000/api/health
```

The entire platform will be available at `http://localhost:8000`.

---

## 🚂 Option 3: Railway / Fly.io

Because this repository contains a root [`Dockerfile`](./Dockerfile) that respects the dynamic `$PORT` environment variable:
- **Railway:** Click **New Project** > **Deploy from GitHub repo**. Railway detects the Dockerfile and deploys instantly.
- **Fly.io:** Run `fly launch` and follow the prompts.

---

## 🔍 Verification After Deployment

Once deployed, verify:
1. **Health Check:** Visit `https://<your-domain>/api/health` -> Returns `{"status": "healthy"}`.
2. **API Documentation:** Visit `https://<your-domain>/docs` -> Interactive Swagger UI.
3. **Web Application:** Visit `https://<your-domain>/` -> React application loads directly.
4. **Shopkeeper Receivables Ledger:** Visit `https://<your-domain>/shopkeeper/credit`.
5. **Customer Dashboard:** Visit `https://<your-domain>/customer/dashboard`.
