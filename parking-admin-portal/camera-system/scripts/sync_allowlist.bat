@echo off
setlocal EnableDelayedExpansion

:: ─────────────────────────────────────────────────────────
::  CONFIG (Defaults overridden by .env if present)
:: ─────────────────────────────────────────────────────────
:: ── Read from .env file if available ────────────────────────
set "ENV_FILE=%~dp0..\.env"
if not exist "%ENV_FILE%" set "ENV_FILE=%~dp0.env"
if exist "%ENV_FILE%" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        set "ENV_KEY=%%A"
        set "ENV_VAL=%%B"
        if /i "!ENV_KEY!"=="CAM_PASS" set "PASS=!ENV_VAL!"
        if /i "!ENV_KEY!"=="PASS" set "PASS=!ENV_VAL!"
        if /i "!ENV_KEY!"=="CAM_USER" set "USER=!ENV_VAL!"
        if /i "!ENV_KEY!"=="CAM_HOST" set "CAM=!ENV_VAL!"
        if /i "!ENV_KEY!"=="ENTRY_CAM_IP" set "CAM=!ENV_VAL!"
        if /i "!ENV_KEY!"=="ALLOWED_PLATES_API" set "PLATES_API=!ENV_VAL!"
    )
)
:: ─────────────────────────────────────────────────────────

echo.
echo =============================================
echo  Honeywell ANPR -- Sync Allowlist from API
echo =============================================
echo.

:: ── STEP 1: Login with Digest Auth ────────────────────────
echo [1/4] Logging in to camera at %CAM%...
curl -k -s -c cookies.txt -D headers.txt --anyauth -u %USER%:%PASS% ^
  -X POST "https://%CAM%/API/Web/Login" ^
  -H "Content-Type: application/json" ^
  -d "{\"data\":{\"remote_terminal_info\":\"WEB,chrome\"}}"

if errorlevel 1 (
    echo ERROR: curl failed. Is the camera reachable at %CAM%?
    goto :end
)
if not exist headers.txt (
    echo ERROR: headers.txt not created -- login request did not complete.
    goto :end
)

:: ── STEP 2: Extract CSRF token (pure CMD) ─────────────────
echo [2/4] Extracting CSRF token...
set CSRF_LINE=
for /f "tokens=*" %%L in ('findstr /i "Csrftoken" headers.txt') do set CSRF_LINE=%%L
if "!CSRF_LINE!"=="" (
    echo ERROR: Login failed -- no CSRF token in response.
    echo        Raw response headers:
    type headers.txt
    goto :end
)
set CSRF=!CSRF_LINE:*Csrftoken: =!
for /f "tokens=*" %%C in ("!CSRF!") do set CSRF=%%C
echo        CSRF : !CSRF!

:: ── STEP 3: Fetch plates from portal + Generate Local DB ──
echo [3/4] Fetching plates from portal API...
powershell -NoProfile -Command ^
  "$d = Invoke-RestMethod '%PLATES_API%';" ^
  "$n = $d.plates.Count;" ^
  "Write-Host ('        Loaded ' + $n + ' plates from portal API');" ^
  "[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath('local_plates.json'), ($d.plates | ConvertTo-Json -Compress));" ^
  "Write-Host ('        Saved local database to local_plates.json');" ^
  "$info = $d.plates | ForEach-Object {" ^
  "    @{ Id=$_; GrpId=1; PlateColor=0; Sex=0;" ^
  "       CarBrand=''; CarType=''; Owner=''; IdCode='';" ^
  "       Domicile=''; EnableChnAlarm=@(); Job=''; Phone=''; Remark='' }" ^
  "};" ^
  "$body = ([ordered]@{ version='1.0'; data=@{ MsgId=''; PlateInfo=$info } } | ConvertTo-Json -Depth 5 -Compress);" ^
  "[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath('payload.json'), $body);" ^
  "Write-Host ('        Payload size: ' + [math]::Round($body.Length/1KB,1) + ' KB')"

if not exist payload.json (
    echo ERROR: payload.json not created. Check your internet connection or PowerShell version.
    goto :end
)

:: ── STEP 4: Push all plates to camera in one request ──────
echo [4/4] Pushing all plates to camera allowlist...
curl -k -s -b cookies.txt ^
  -X POST "https://%CAM%/API/AI/Plates/Add" ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json; charset=utf-8" ^
  -H "X-Csrftoken: !CSRF!" ^
  --data-binary @payload.json

echo.
echo =============================================
echo  Sync complete.
echo =============================================

:end
del cookies.txt headers.txt payload.json 2>nul
echo.
endlocal