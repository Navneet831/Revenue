@echo off
echo ======================================================
echo   Revenue Analytics Platform - Startup Script
echo ======================================================

echo [1/3] Ensuring dependencies are installed...
call npm install agentation --silent
call pip install graphifyy --quiet

echo [2/3] Building production assets...
call npm run build:shared
call npm run build -w apps/web

echo [3/3] Starting Unified Server...
start "Revenue Platform" cmd /c "npm run start -w apps/api"

echo ======================================================
echo   System is ready.
echo   URL: http://127.0.0.1:8000/auth/callback
echo ======================================================
pause
