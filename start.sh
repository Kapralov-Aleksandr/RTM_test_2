#!/usr/bin/env bash
# Requirements Tracker Launcher
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  Requirements Tracker Launcher"
echo "============================================================"

# ---------- Backend ----------
if command -v python3 >/dev/null 2>&1; then
  if [ ! -d backend/venv ]; then
    echo "[*] Creating virtual environment backend/venv ..."
    python3 -m venv backend/venv
  fi
  echo "[*] Installing backend dependencies ..."
  backend/venv/bin/python -m pip install -q -r backend/requirements.txt

  echo "[*] Starting FastAPI on http://localhost:8000 (Swagger: /docs)"
  (cd backend && ../backend/venv/bin/python -m uvicorn main:app --reload --port 8000 &)
else
  echo "[!] Python3 not found - backend not started, continuing with frontend."
fi

# ---------- Frontend ----------
if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js not found. Install LTS from nodejs.org."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[*] Installing frontend dependencies (npm install) ..."
  npm install
fi

echo "[*] Starting frontend on http://localhost:3000"
npm run dev
