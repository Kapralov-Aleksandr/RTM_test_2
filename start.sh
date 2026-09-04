#!/usr/bin/env bash
# Requirements Tracker: запуск стека (backend + frontend)
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  Requirements Tracker: запуск стека (backend + frontend)"
echo "============================================================"

# ---------- Backend ----------
if command -v python3 >/dev/null 2>&1; then
  if [ ! -d backend/venv ]; then
    echo "[*] Создаю виртуальное окружение backend/venv ..."
    python3 -m venv backend/venv
  fi
  echo "[*] Устанавливаю зависимости backend ..."
  backend/venv/bin/python -m pip install -q -r backend/requirements.txt

  echo "[*] Запускаю FastAPI на http://localhost:8000 (Swagger: /docs)"
  (cd backend && ../backend/venv/bin/python -m uvicorn main:app --reload --port 8000 &)
else
  echo "[!] Python3 не найден — backend не запущен, продолжаю с фронтендом."
fi

# ---------- Frontend ----------
if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js не найден. Установите LTS с nodejs.org."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[*] Устанавливаю зависимости фронтенда (npm install) ..."
  npm install
fi

echo "[*] Запускаю фронтенд на http://localhost:5173"
npm run dev
