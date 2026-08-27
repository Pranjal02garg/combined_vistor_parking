@echo off
REM ═══════════════════════════════════════════════════════════════════════
REM  launch_kiosk.bat  —  Parking Display  (Windows)
REM  Opens Chrome in TRUE kiosk mode (no title bar, no taskbar,
REM  no address bar, pure full-screen always-on-top)
REM ═══════════════════════════════════════════════════════════════════════

SET SCRIPT_DIR=%~dp0
SET HTML_FILE=%SCRIPT_DIR%..\kiosk-display\index.html

REM ── Try Google Chrome first ──────────────────────────────────
SET CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
IF EXIST %CHROME% GOTO :RUN_CHROME

SET CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
IF EXIST %CHROME% GOTO :RUN_CHROME

REM ── Try Chromium (common on Jetson / ARM) ────────────────────
SET CHROME="C:\Program Files\Chromium\Application\chrome.exe"
IF EXIST %CHROME% GOTO :RUN_CHROME

REM ── Try Microsoft Edge ──────────────────────────────────────
SET CHROME="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
IF EXIST %CHROME% GOTO :RUN_EDGE

REM ── Fallback: open with default browser ─────────────────────
echo [WARNING] Chrome/Edge not found. Opening with default browser.
start "" "%HTML_FILE%"
GOTO :EOF

:RUN_CHROME
echo [PARKING DISPLAY] Launching Chrome in kiosk mode...
start "" %CHROME% ^
  --kiosk ^
  --fullscreen ^
  --start-fullscreen ^
  --start-maximized ^
  --no-first-run ^
  --noerrdialogs ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  --disable-restore-session-state ^
  --disable-translate ^
  --disable-features=TranslateUI ^
  --overscroll-history-navigation=0 ^
  --disable-pinch ^
  --no-default-browser-check ^
  --disable-component-update ^
  --check-for-update-interval=31536000 ^
  --app="%HTML_FILE%"
GOTO :EOF

:RUN_EDGE
echo [PARKING DISPLAY] Launching Edge in kiosk mode...
start "" %CHROME% ^
  --kiosk ^
  --kiosk-type=fullscreen ^
  --fullscreen ^
  --start-fullscreen ^
  --no-first-run ^
  --noerrdialogs ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  --app="%HTML_FILE%"
GOTO :EOF
