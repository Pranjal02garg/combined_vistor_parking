@echo off
REM ═══════════════════════════════════════════════════════════════════════
REM  start_parking.bat  —  Master Startup Script for WINDOWS
REM  Runs occupancy_tracker, display_api, and the Chrome Kiosk together.
REM ═══════════════════════════════════════════════════════════════════════

SET SCRIPT_DIR=%~dp0
SET PROJECT_DIR=%SCRIPT_DIR%..

cd /d "%PROJECT_DIR%"

echo [SYSTEM] Starting Parking OS...

REM 1. Start the main ANPR dual camera backend in a new window
echo [SYSTEM] Launching dual.py...
start "ANPR Backend (dual)" cmd /c "python -m src.dual & pause"

REM 2. Start the Display API in a new window
echo [SYSTEM] Launching display_api.py...
start "Display API" cmd /c "python -m src.display_api & pause"

REM 3. Start the Display API in a new window
echo [SYSTEM] Launching plate_sync.py...
start "Plate Sync" cmd /c "python -m src.plate_sync & pause"

REM Wait a moment for the API to start
timeout /t 3 /nobreak >nul

REM 3. Launch the Kiosk UI
echo [SYSTEM] Launching Kiosk Display...
call "%SCRIPT_DIR%launch_kiosk.bat"

echo [SYSTEM] System started successfully!
