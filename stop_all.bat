@echo off
title CyberShield AI - Stopping All Services
color 0C

echo Stopping all services...

taskkill /FI "WINDOWTITLE eq Django Backend*" /T /F >nul 2>&1
echo   Django Backend       - stopped

taskkill /FI "WINDOWTITLE eq ML Microservice*" /T /F >nul 2>&1
echo   ML Microservice      - stopped

taskkill /FI "WINDOWTITLE eq Alert Server*" /T /F >nul 2>&1
echo   Alert Server         - stopped

taskkill /FI "WINDOWTITLE eq ngrok*" /T /F >nul 2>&1
echo   ngrok                - stopped

taskkill /FI "WINDOWTITLE eq React Frontend*" /T /F >nul 2>&1
echo   React Frontend       - stopped

echo.
echo ============================================================
echo   All services stopped.
echo ============================================================
timeout /t 3 /nobreak >nul