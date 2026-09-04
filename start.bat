@echo off
chcp 65001 >nul
title Requirements Tracker
echo ============================================================
echo   Requirements Tracker: запуск стека (backend + frontend)
echo   Браузер откроется автоматически на http://localhost:3000
echo ============================================================

cd /d "%~dp0"

:: ---------- Backend: Python + venv + uvicorn (в свёрнутом окне) ----------
where python >nul 2>nul
if errorlevel 1 (
    echo [!] Python не найден. Установите Python 3.11+ с python.org
    echo     (отметьте "Add to PATH"). Продолжаю только с фронтендом (демо-режим).
    goto frontend
)

if not exist backend\venv (
    echo [*] Создаю виртуальное окружение backend\venv ...
    python -m venv backend\venv
)

echo [*] Устанавливаю зависимости backend ...
backend\venv\Scripts\python -m pip install -q -r backend\requirements.txt

echo [*] Запускаю FastAPI на http://localhost:8000 (Swagger: /docs) — окно свёрнуто
start "RMS Backend" /min cmd /k "backend\venv\Scripts\python -m uvicorn main:app --app-dir backend --reload --port 8000"

:: Ждём, пока backend поднимется (до ~15 секунд)
echo [*] Ожидаю готовности backend ...
set /a tries=0
:wait_backend
curl -s -o nul http://localhost:8000/api/health >nul 2>nul
if not errorlevel 1 goto backend_ready
set /a tries+=1
if %tries% GEQ 15 (
    echo [!] Backend не ответил — фронтенд стартует в демо-режиме (localStorage).
    goto frontend
)
timeout /t 1 /nobreak >nul
goto wait_backend

:backend_ready
echo [OK] Backend готов: данные будут сохраняться в data/app.db

:frontend
:: ---------- Frontend: Node + Vite (в этом окне, браузер откроется сам) ----------
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

echo [*] Запускаю фронтенд: http://localhost:3000 (браузер откроется автоматически)
call npm run dev
