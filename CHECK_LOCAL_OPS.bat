@echo off
setlocal
cd /d "%~dp0"
echo Local Ops Diagnostic - Application Management
echo.
where node
if errorlevel 1 echo [ERROR] Node.js >= 22.13.0 chua cai dat.
echo.
echo BaumanWeb workspace:
echo %CD%
echo.
node scripts\local-ops-daemon.mjs --start
if errorlevel 1 (
  echo.
  echo [ERROR] Xem them .local-ops-bootstrap.log va .local-ops-runtime.log
  pause
)
