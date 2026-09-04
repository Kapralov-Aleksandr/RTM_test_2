@echo off
chcp 65001 >nul
title Requirements Tracker
echo ============================================================
echo   Requirements Tracker: запуск стека (backend + frontend)
echo ============================================================

cd /d "%~dp0"

:: ---------- Backend: Python + venv + uvicorn ----------
where python >nul 2>nul
if errorlevel 1 (
    echo [!] Python не найден. Установите Python 3.11+ с python.org
    echo     (отметьте "Add to PATH"). Продолжаю только с фронтендом.
    goto frontend
)

if not exist backend\venv (
    echo [*] Создаю виртуальное окружение backend\venv ...
    python -m venv backend\venv
)

echo [*] Устанавливаю зависимости backend ...
backend\venv\Scripts\python -m pip install -q -r backend\requirements.txt

echo [*] Запускаю FastAPI на http://localhost:8000 (Swagger: /docs)
start "RMS Backend" cmd /k "backend\venv\Scripts\python -m uvicorn main:app --app-dir backend --reload --port 8000"

:frontend
:: ---------- Frontend: Node + Vite ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js не найден. Установите LTS с nodejs.org и повторите.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [*] Устанавливаю зависимости фронтенда (npm install) ...
    call npm install
)

echo [*] Запускаю фронтенд на http://localhost:5173
call npm run dev
