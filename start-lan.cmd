@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 20.19 or newer is required.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo Starting the LAN game server...
echo Keep this window open, then open the Network URL on the iPad.
echo The PC and iPad must use the same Wi-Fi network.
call npm run dev:lan
