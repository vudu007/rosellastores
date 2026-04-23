@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging certificate fix...
git add "src/app/api/qz/certificate/route.ts"

echo Committing...
git commit -m "fix: re-wrap QZ certificate PEM so QZ Tray can parse it"

echo Pushing...
git push

echo.
echo ============================================================
echo  PUSHED. Now go to Vercel and Redeploy.
echo  After redeploy, test: https://wholesale-rp.vercel.app/api/qz/certificate
echo  You should see proper PEM with each line on its own line (not spaces).
echo  Then try printing — QZ Tray should auto-allow with no dialog.
echo ============================================================
echo.
pause
