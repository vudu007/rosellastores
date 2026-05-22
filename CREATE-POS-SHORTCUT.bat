@echo off
cd /d "%~dp0"

echo Looking for Chrome or Edge...

set "CHROME="
set "BROWSER_NAME="
set "POS_URL=https://wholesale-rp.vercel.app/pos"

:: Search common Chrome locations
for %%P in (
  "%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"
  "%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe"
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) do (
  if exist %%P (
    set "CHROME=%%~P"
    set "BROWSER_NAME=Google Chrome"
  )
)

:: Fall back to Edge if Chrome not found
if not defined CHROME (
  for %%P in (
    "%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe"
    "%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe"
    "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
  ) do (
    if exist %%P (
      set "CHROME=%%~P"
      set "BROWSER_NAME=Microsoft Edge"
    )
  )
)

if not defined CHROME (
  echo ERROR: Could not find Chrome or Edge. Please install one of them.
  pause
  exit /b 1
)

echo Found: %BROWSER_NAME% at %CHROME%

:: Write a temporary PowerShell script to avoid escaping issues
set "PS1=%TEMP%\make_pos_shortcut.ps1"
set "SHORTCUT=%USERPROFILE%\Desktop\Rosella Stores POS.lnk"
set "PROFILE_DIR=%LOCALAPPDATA%\RosellaStores\ChromeKioskProfile"

(
echo $ws = New-Object -ComObject WScript.Shell
echo $s = $ws.CreateShortcut('%SHORTCUT%'^)
echo $s.TargetPath = '%CHROME%'
echo $posUrl = '%POS_URL%'
echo $profileDir = '%PROFILE_DIR%'
echo if (-not (Test-Path $profileDir^)) { New-Item -ItemType Directory -Force -Path $profileDir ^| Out-Null }
echo $s.Arguments = ('--user-data-dir="' + $profileDir + '" --kiosk-printing --disable-print-preview --app="' + $posUrl + '"'^)
echo $s.Description = 'Rosella Stores POS Silent Print'
echo $s.Save(^)
echo Write-Host "Done"
) > "%PS1%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
del "%PS1%" 2>nul

if exist "%SHORTCUT%" (
  echo.
  echo ============================================================
  echo  SUCCESS! "Rosella Stores POS" shortcut created on your Desktop.
  echo.
  echo  NEXT STEPS:
  echo  1. Set your thermal printer as Windows DEFAULT printer
  echo     (Settings - Printers - click POS-80C - Set as default^)
  echo  2. Always open the POS using that Desktop shortcut
  echo  3. Receipts will print silently - no dialogs at all!
  echo ============================================================
) else (
  echo.
  echo ERROR: Shortcut was not created.
  echo Try right-clicking this bat file and choosing "Run as Administrator"
)

echo.
pause
