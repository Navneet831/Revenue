@echo off
title SKU Entropy Engine & Demand Analytics
echo =======================================================
echo     SKU TEMPORAL ENTROPY ENGINE & DEMAND ANALYTICS
echo =======================================================
echo.
echo Database: Grewdb on localhost:5433
echo Host: http://127.0.0.1:5000
echo.
echo Launching default browser...
start "" http://127.0.0.1:5000
echo Starting Flask application...
python app.py
pause
