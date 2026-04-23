@echo off
cd /d "%~dp0"

echo ============================================================
echo  QZ TRAY TRUST FIX — Add certificate as trusted root CA
echo ============================================================
echo.

:: Copy the certificate to AppData\qz as override.crt
set "QZDIR=%APPDATA%\qz"
set "CERTDEST=%QZDIR%\override.crt"
set "CERTSRC=%~dp0digital-certificate.txt"

:: Create qz config directory if it doesn't exist
if not exist "%QZDIR%" (
    mkdir "%QZDIR%"
    echo Created: %QZDIR%
)

:: Copy certificate as override.crt
echo Copying certificate to QZ Tray config folder...
copy /Y "%CERTSRC%" "%CERTDEST%"
if errorlevel 1 (
    echo ERROR: Could not copy certificate!
    echo Make sure digital-certificate.txt exists in this folder.
    pause
    exit /b 1
)
echo Done: %CERTDEST%

:: Update qz-tray.properties to point at the override cert
set "PROPSFILE=%QZDIR%\qz-tray.properties"

:: Check if properties file exists
if not exist "%PROPSFILE%" (
    echo Creating qz-tray.properties...
    echo authcert.override=%CERTDEST%> "%PROPSFILE%"
) else (
    :: Remove any existing authcert.override line and add the new one
    echo Updating qz-tray.properties...
    set "TMPFILE=%QZDIR%\qz-tray.properties.tmp"
    findstr /v "authcert.override" "%PROPSFILE%" > "%TMPFILE%"
    echo authcert.override=%CERTDEST%>> "%TMPFILE%"
    move /Y "%TMPFILE%" "%PROPSFILE%"
)

echo.
echo ============================================================
echo  DONE! Now do these 2 steps:
echo.
echo  1. RIGHT-CLICK the QZ Tray icon in the system tray
echo     (bottom-right corner, near the clock)
echo     and choose EXIT (fully quit it — not just minimize)
echo.
echo  2. Open QZ Tray again from the Start Menu or Desktop
echo     (it needs to restart to pick up the new certificate)
echo.
echo  After restarting, go to Settings ^> Thermal Printer ^>
echo  Detect Printers. The QZ Tray dialog will show your cert
echo  as TRUSTED. Check "Remember this decision" + Allow.
echo  It will never prompt again!
echo ============================================================
echo.
pause
