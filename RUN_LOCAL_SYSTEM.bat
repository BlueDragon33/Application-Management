@echo off
setlocal
cd /d "%~dp0"
echo ===============================================================
echo   APPLICATION MANAGEMENT - OFFLINE CORE
echo   BAUMAN HUB + CAC MON BEN TRONG + BOI ECH
echo ===============================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js. Can Node.js 22.13.0 tro len.
  pause
  exit /b 1
)
node scripts\run-local-offline-v2.mjs
if errorlevel 1 (
  echo.
  echo [ERROR] He thong local dung voi loi. Xem thong bao phia tren.
  pause
  exit /b 1
)
endlocal
