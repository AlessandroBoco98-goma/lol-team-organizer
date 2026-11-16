@echo off
chcp 65001 >nul
title LoL Team Organizer - Avvio
cd /d "%~dp0"

echo Controllo dipendenze...
if not exist "backend\node_modules\firebase-admin" (
  echo Installo le dipendenze del backend...
  cd /d "%~dp0backend"
  call npm install
  if errorlevel 1 goto errore
)
if not exist "frontend\node_modules\.bin\vite.cmd" (
  echo Installo le dipendenze del frontend...
  cd /d "%~dp0frontend"
  call npm install
  if errorlevel 1 goto errore
)

cd /d "%~dp0"
echo Avvio backend e frontend in due finestre...
start "Backend - LoL Team Organizer" cmd /k "cd /d "%~dp0backend" && npm start"
start "Frontend - LoL Team Organizer" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001
echo.
pause
exit /b 0

:errore
echo.
echo Errore durante l'installazione delle dipendenze.
pause
exit /b 1
