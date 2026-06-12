@echo off
echo ======================================================
echo   Revenue Analytics Platform - Startup Script
echo ======================================================

echo [1/4] Ensuring dependencies are installed...
call npm install agentation --silent
call pip install graphifyy --quiet

echo [2/4] Building shared domain engine...
call npm run build:shared

echo [3/4] Starting Backend API...
start "Revenue API" cmd /c "npm run dev -w apps/api"

echo [4/4] Starting Frontend Web...
start "Revenue Web" cmd /c "npm run dev -w apps/web"

echo ======================================================
echo   System is initializing. 
echo   API: http://localhost:8000
echo   WEB: http://localhost:5173
echo ======================================================
pause
