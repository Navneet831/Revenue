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
echo   PLEASE OPEN: http://127.0.0.1:8000/auth/callback
echo   (IGNORE ports 5173/5175 if shown in secondary windows)
echo ======================================================
pause
