@echo off
cd /d "%~dp0"

echo Looking for Firefox...

set "CHROME="
set "BROWSER_NAME="
set "POS_URL=https://rosellastores.vercel.app/pos"
set "FIREFOX="

for %%P in (
  "%PROGRAMFILES%\Mozilla Firefox\firefox.exe"
  "%PROGRAMFILES(X86)%\Mozilla Firefox\firefox.exe"
  "%LOCALAPPDATA%\Mozilla Firefox\firefox.exe"
) do (
  if exist %%P (
    set "FIREFOX=%%~P"
    set "BROWSER_NAME=Mozilla Firefox"
  )
)

if not defined FIREFOX (
  echo ERROR: Could not find Firefox. Please install Mozilla Firefox.
  pause
  exit /b 1
)

echo Found: %BROWSER_NAME% at %FIREFOX%

:: Write a temporary PowerShell script to avoid escaping issues
set "PS1=%TEMP%\make_pos_shortcut.ps1"
set "SHORTCUT=%USERPROFILE%\Desktop\Rosella Stores POS - Firefox.lnk"
set "PROFILE_DIR=%LOCALAPPDATA%\RosellaStores\FirefoxKioskProfile"

> "%PS1%" echo $ws = New-Object -ComObject WScript.Shell
>> "%PS1%" echo $s = $ws.CreateShortcut('%SHORTCUT%')
>> "%PS1%" echo $s.TargetPath = '%FIREFOX%'
>> "%PS1%" echo $posUrl = '%POS_URL%'
>> "%PS1%" echo $profileDir = '%PROFILE_DIR%'
>> "%PS1%" echo New-Item -ItemType Directory -Force -Path $profileDir ^| Out-Null
>> "%PS1%" echo $userJs = Join-Path $profileDir 'user.js'
>> "%PS1%" echo Set-Content -Path $userJs -Value 'user_pref("print.always_print_silent", true);' -Encoding ASCII
>> "%PS1%" echo Add-Content -Path $userJs -Value 'user_pref("print.show_print_progress", false);' -Encoding ASCII
>> "%PS1%" echo Add-Content -Path $userJs -Value 'user_pref("print.save_print_settings", true);' -Encoding ASCII
>> "%PS1%" echo Add-Content -Path $userJs -Value 'user_pref("browser.shell.checkDefaultBrowser", false);' -Encoding ASCII
>> "%PS1%" echo $s.Arguments = "-no-remote -new-instance -profile ""$profileDir"" --kiosk ""$posUrl"""
>> "%PS1%" echo $s.Description = 'Rosella Stores POS Silent Print - Firefox'
>> "%PS1%" echo $s.Save()
>> "%PS1%" echo Write-Host "Done"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
del "%PS1%" 2>nul

if exist "%SHORTCUT%" (
  echo.
  echo ============================================================
  echo  SUCCESS! "Rosella Stores POS - Firefox" shortcut created on your Desktop.
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
if "%ROSELLA_NO_PAUSE%"=="1" exit /b 0
pause
