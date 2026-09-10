@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo   Application Management - LOCAL SYSTEM DOCTOR
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js. Can Node.js 22.13.0 tro len.
  pause
  exit /b 1
)
node scripts\local-system-doctor.mjs --strict-ports
set EXIT_CODE=%ERRORLEVEL%
echo.
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] He thong local chua san sang. Xem cac dong FAIL o tren.
) else (
  echo [OK] He thong local da san sang de chay RUN_LOCAL_SYSTEM.bat.
)
pause
exit /b %EXIT_CODE%
