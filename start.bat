@echo off
cd /d "%~dp0.."
title GrewEnergy Revenue Analytics
echo =======================================================
echo     GREW ENERGY - REVENUE ANALYTICS PLATFORM
echo =======================================================
echo.
echo Starting backend server on port 8000...
echo Opening app...
echo.
python launcher.py
if errorlevel 1 (
    echo.
    echo Launcher encountered an error. Starting server directly...
    python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
)
pause
