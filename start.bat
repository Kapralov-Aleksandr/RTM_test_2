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
    echo [*] Creating virtual environment...
    python -m venv backend\venv
)

echo [*] Installing backend dependencies...
backend\venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt

echo [*] Starting backend server...
cd backend
start "RMS Backend" /min cmd /c "venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"
cd ..

timeout /t 5 /nobreak >nul

where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js not found. Install LTS from nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    echo [*] Installing frontend dependencies...
    call npm install
)

echo [*] Starting frontend server...
start "RMS Frontend" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul
echo [*] Opening browser...
start http://localhost:3000

echo.
echo ============================================================
echo   Servers started:
echo   - Backend: http://localhost:8000 (Swagger: http://localhost:8000/docs)
echo   - Frontend: http://localhost:3000
echo ============================================================
echo.
echo Press any key to close this window (servers will continue running)...
pause >nul
