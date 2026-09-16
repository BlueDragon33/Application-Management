@echo off
setlocal
cd /d "%~dp0"
echo ===============================================================
echo   APPLICATION MANAGEMENT - OFFLINE CORE
echo   BAUMAN HUB + CAC MON BEN TRONG + BOI ECH
echo ===============================================================
for /f "delims=" %%i in ('git rev-parse --short HEAD 2^>nul') do set SOURCE_COMMIT=%%i
if defined SOURCE_COMMIT echo   SOURCE COMMIT: %SOURCE_COMMIT%
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js. Can Node.js 22.13.0 tro len.
  pause
  exit /b 1
)
if exist "node_modules\.vite" (
  echo [offline-core] Xoa cache bien dich Vite cu...
  rmdir /s /q "node_modules\.vite"
)
start "" /b node scripts\open-local-bauman.mjs
node scripts\run-local-offline-v2.mjs
if errorlevel 1 (
  echo.
  echo [ERROR] He thong local dung voi loi. Xem thong bao phia tren.
  pause
  exit /b 1
)
endlocal
