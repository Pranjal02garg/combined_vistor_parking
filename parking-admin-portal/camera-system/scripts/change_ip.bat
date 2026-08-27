batch
@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "CONFIG_DB=%SCRIPT_DIR%..\config.db"
set "SQL_TEMP=%TEMP%\change_ip_temp.sql"

if "%~1"=="" goto usage
if "%~2"=="" goto usage
if not "%~3"=="" goto usage

set "ENTRY_IP=%~1"
set "EXIT_IP=%~2"

set "SQLITE=%SCRIPT_DIR%sqlite3.exe"
if not exist "!SQLITE!" (
    where sqlite3 >nul 2>&1
    if errorlevel 1 (
        echo ERROR: sqlite3.exe not found.
        echo Download from https://www.sqlite.org/download.html
        echo and place sqlite3.exe in the same folder as this script or add it to PATH.
        exit /b 1
    )
    set "SQLITE=sqlite3"
)

echo PRAGMA journal_mode=WAL;> "%SQL_TEMP%"
echo PRAGMA synchronous=NORMAL;>> "%SQL_TEMP%"
echo CREATE TABLE IF NOT EXISTS cameras (role TEXT PRIMARY KEY, ip TEXT NOT NULL);>> "%SQL_TEMP%"
echo INSERT INTO cameras (role, ip) VALUES ('entry', '%ENTRY_IP%') ON CONFLICT(role) DO UPDATE SET ip = excluded.ip;>> "%SQL_TEMP%"
echo INSERT INTO cameras (role, ip) VALUES ('exit', '%EXIT_IP%') ON CONFLICT(role) DO UPDATE SET ip = excluded.ip;>> "%SQL_TEMP%"

"!SQLITE!" "%CONFIG_DB%" < "%SQL_TEMP%"

if errorlevel 1 (
    echo ERROR: sqlite3 returned an error.
    del "%SQL_TEMP%" >nul 2>&1
    exit /b 1
)

del "%SQL_TEMP%" >nul 2>&1

echo.
echo config.db updated:
echo   entry camera -^> %ENTRY_IP%
echo   exit  camera -^> %EXIT_IP%
echo.
echo Restart the occupancy tracker for the new IPs to take effect.

endlocal
exit /b 0

:usage
echo.
echo Usage:   %~nx0 ^<entry_ip^> ^<exit_ip^>
echo.
echo   entry_ip   IP address of the ENTRY camera
echo   exit_ip    IP address of the EXIT  camera
echo.
echo Example: %~nx0 192.168.1.2 192.168.1.3
echo.
endlocal
exit /b 1
