# ==========================================
# Stage 1: Build Frontend React SPA
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Unified Production Server
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy Backend Application
COPY backend/ ./backend/

# Copy Built Frontend Assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose default port (Render & Railway inject $PORT dynamically)
ENV PORT=8000
ENV HOST=0.0.0.0
ENV ENVIRONMENT=production
EXPOSE 8000

# Start unified FastAPI server with shell interpolation for dynamic $PORT
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
