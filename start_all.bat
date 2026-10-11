@echo off
title CyberShield AI - Launching All Services
color 0A

echo ============================================================
echo   CyberShield AI - Starting All 5 Services
echo ============================================================
echo.

echo [1/5] Starting Django Backend - port 8000...
start "Django Backend" cmd /k "cd /d E:\sentinelzone\backend && call venv\Scripts\activate && python manage.py runserver"
timeout /t 6 /nobreak >nul

echo [2/5] Starting ML Microservice - port 8001...
start "ML Microservice" cmd /k "cd /d E:\sentinelzone\ml_service && call venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
timeout /t 6 /nobreak >nul

echo [3/5] Starting Alert WebSocket Server - ports 4000 and 4001...
start "Alert Server" cmd /k "cd /d E:\sentinelzone\alert_server && npm start"
timeout /t 4 /nobreak >nul

echo [4/5] Starting ngrok tunnel for port 8000...
start "ngrok" cmd /k "ngrok http 8000"
timeout /t 4 /nobreak >nul

echo [5/5] Starting React Frontend - port 3000...
start "React Frontend" cmd /k "cd /d E:\sentinelzone\frontend && npm start"
timeout /t 4 /nobreak >nul

echo.
echo ============================================================
echo   All 5 services launched!
echo ============================================================
echo.
echo   Django Backend    : http://localhost:8000
echo   ML Microservice   : http://localhost:8001/docs
echo   Alert Server      : ws://localhost:4000
echo   ngrok             : check the "ngrok" window for the public URL
echo   React Frontend    : http://localhost:3000
echo.
echo   IMPORTANT:
echo   Copy the ngrok URL from the "ngrok" window and paste it into:
echo     Meta Dashboard -^> Instagram -^> Webhooks -^> Callback URL
echo   (The URL changes every time you restart ngrok on the free plan.)
echo.
echo   Verify token: cybershield_secret_2026
echo.
pause