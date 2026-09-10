@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo   Application Management - LOCAL DEVELOPMENT
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js. Can Node.js 22.13.0 tro len.
  pause
  exit /b 1
)
node scripts\run-local.mjs
if errorlevel 1 (
  echo.
  echo [ERROR] Local server dung voi loi. Xem thong bao phia tren.
  pause
  exit /b 1
)
endlocal
