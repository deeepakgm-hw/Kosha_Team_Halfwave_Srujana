# KOSHA — Makefile
# Note: For Windows environments without make, use the direct PowerShell commands documented in README.md.

.PHONY: help install dev test backend frontend clean

help:
	@echo "Available commands:"
	@echo "  make install   - Install backend and frontend dependencies"
	@echo "  make backend   - Start FastAPI backend dev server"
	@echo "  make frontend  - Start Vite React frontend dev server"
	@echo "  make dev       - Instructions to run both frontend and backend concurrently"
	@echo "  make test      - Run all backend and frontend unit tests"
	@echo "  make clean     - Clean temporary build and cache artifacts"

install:
	@echo "Installing backend dependencies..."
	python -m pip install -r backend/requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

backend:
	@echo "Starting FastAPI backend on http://localhost:8000..."
	python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

frontend:
	@echo "Starting Vite frontend on http://localhost:5173..."
	cd frontend && npm run dev

dev:
	@echo "To run concurrently, open two terminals:"
	@echo "  Terminal 1: make backend"
	@echo "  Terminal 2: make frontend"

test:
	@echo "Running backend pytest..."
	python -m pytest backend/tests -v
	@echo "Running frontend vitest..."
	cd frontend && npm test

clean:
	@echo "Cleaning caches..."
	rm -rf backend/.pytest_cache frontend/dist frontend/node_modules/.vite
