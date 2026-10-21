@echo off
setlocal
cd /d "%~dp0"
title BlackBox
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install the current Node.js LTS version from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing BlackBox dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)
start "" http://localhost:4173
node server.js
pause