@echo off
setlocal
cd /d "%~dp0"
for %%I in ("%CD%\..") do set WORKSPACE_NAME=%%~nxI
if /I not "%WORKSPACE_NAME%"=="BaumanWeb" (
  echo ===============================================================
  echo   APPLICATION MANAGEMENT - CANONICAL WORKSPACE REQUIRED
  echo ===============================================================
  echo [ERROR] Ban dang chay ban sao legacy ngoai thu muc BaumanWeb.
  echo [ERROR] Tu nay chi su dung: ^<drive^>:\BaumanWeb\Application-Management
  echo [ERROR] Thu muc hien tai: %CD%
  echo.
  echo Hay dong bo/cap nhat ban trong BaumanWeb roi chay RUN_LOCAL_SYSTEM.bat tai do.
  pause
  exit /b 2
)
echo ===============================================================
echo   APPLICATION MANAGEMENT - OFFLINE CORE
echo   BAUMAN HUB + CAC MON BEN TRONG + BOI ECH
echo ===============================================================
echo   WORKSPACE: %CD%
for /f "delims=" %%i in ('git rev-parse --short HEAD 2^>nul') do set SOURCE_COMMIT=%%i
if defined SOURCE_COMMIT echo   SOURCE COMMIT: %SOURCE_COMMIT%
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js. Can Node.js 22.13.0 tro len.
  pause
  exit /b 1
)
echo [local-system] Kiem tra va don cac runtime local cu...
node scripts\cleanup-local-runtime.mjs
if errorlevel 1 (
  echo.
  echo [ERROR] Khong the giai phong day du cac port local. Xem thong bao phia tren.
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
