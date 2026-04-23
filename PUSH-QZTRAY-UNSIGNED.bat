@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging QZ Tray revert to unsigned mode...
git add "src/lib/qztray.ts"

echo Committing...
git commit -m "revert: qz-tray back to unsigned mode (self-signed cert shows Invalid Certificate)"

echo Pushing to GitHub...
git push

echo.
echo ============================================================
echo  DONE.
echo.
echo  To avoid the Allow dialog every time, on the computer
echo  running the thermal printer:
echo.
echo  1. Right-click the QZ Tray icon in the system tray
echo  2. Click "Site Manager"
echo  3. Add:  wholesale-rp.vercel.app
echo  4. Set it as "Allowed"
echo  5. Save — QZ Tray will never prompt again for that site
echo ============================================================
echo.
pause
