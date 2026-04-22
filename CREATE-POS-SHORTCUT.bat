@echo off
:: CREATE-POS-SHORTCUT.bat
:: Creates a Desktop shortcut that opens the POS in Chrome with silent printing enabled.
:: Run this ONCE — then always open the POS using that shortcut.

set "TARGET=%USERPROFILE%\Desktop\MekaERP POS.lnk"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "URL=https://wholesale-rp.vercel.app/pos"

:: Find Chrome (try 32-bit path too)
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
    echo ERROR: Chrome not found. Please install Google Chrome first.
    pause
    exit /b 1
)

:: Use PowerShell to create the shortcut
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s  = $ws.CreateShortcut('%TARGET%'); ^
   $s.TargetPath = '%CHROME%'; ^
   $s.Arguments  = '--kiosk-printing --app=https://wholesale-rp.vercel.app/pos'; ^
   $s.IconLocation = '%CHROME%,0'; ^
   $s.Description = 'MekaERP POS - Silent Print Mode'; ^
   $s.Save()"

if exist "%TARGET%" (
    echo.
    echo ============================================================
    echo  SHORTCUT CREATED on your Desktop: "MekaERP POS"
    echo.
    echo  IMPORTANT STEPS:
    echo  1. Go to Windows Settings ^> Printers ^> Set your
    echo     thermal printer (POS-80C) as the DEFAULT printer
    echo.
    echo  2. Always open the POS using the new Desktop shortcut
    echo     "MekaERP POS" — NOT from a regular browser tab
    echo.
    echo  3. Receipts will now print silently with zero dialogs!
    echo ============================================================
    echo.
) else (
    echo ERROR: Shortcut creation failed. Try running as Administrator.
)
pause
