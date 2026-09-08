@echo off
title Requirements Tracker
echo ============================================================
echo   Requirements Tracker Launcher
echo ============================================================

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo [!] Python not found. Install from python.org (add to PATH)
    pause
    exit /b 1
)

if not exist backend\venv (
    python -m venv backend\venv
)

backend\venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt

start "RMS Backend" /min cmd /c "cd backend && venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

timeout /t 5 /nobreak >nul

where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js not found. Install LTS from nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    call npm install
)

start "RMS Frontend" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul
start http://localhost:3000
