@echo off
setlocal
title SpaceNovaX V16.6 Preview
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [SpaceNovaX] Node.js is not installed.
  echo Install the LTS version from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [SpaceNovaX] Installing preview components...
  call npm install
  if errorlevel 1 (
    echo [SpaceNovaX] Installation failed.
    pause
    exit /b 1
  )
)

if "%GEMINI_API_KEY%"=="" (
  echo.
  echo [NOVA AI] A server-side NOVA AI key is required for real answers.
  echo The key entered here is used only in this command window and is not saved.
  set /p GEMINI_API_KEY=Paste GEMINI_API_KEY, or press Enter to continue without live AI: 
)

if "%GEMINI_MODEL%"=="" set "GEMINI_MODEL=gemini-2.5-flash"

echo [SpaceNovaX] Building the safe preview...
call npm run build:preview
if errorlevel 1 (
  echo [SpaceNovaX] Preview build failed.
  pause
  exit /b 1
)

echo [SpaceNovaX] Starting V16.6 PREVIEW with API server...
echo The browser will open at http://localhost:3000
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"
call npm start

endlocal
