@echo off
title CyberForge Launcher
cd /d "%~dp0"

echo Starting CyberForge...

REM Start backend (Python FastAPI)
start "" /min cmd /c "C:\Users\Victor\AppData\Local\Programs\Python\Python312\python.exe start_backend.py"

REM Wait for backend to initialize
timeout /t 2 /nobreak >nul

REM Start frontend (Node static server)
start "" /min cmd /c "node start_frontend.cjs"

REM Wait for frontend to initialize
timeout /t 2 /nobreak >nul

REM Open in default browser
start "" "http://127.0.0.1:5173"

exit
