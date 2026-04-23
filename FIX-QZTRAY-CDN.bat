@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging QZ Tray fix...
git add "src/lib/qztray.ts"

echo Committing...
git commit -m "fix: load sha-256 before qz-tray, normalise printers.find() result to array"

echo Pushing to GitHub...
git push

echo.
echo ============================================================
echo  DONE — Vercel will redeploy in ~1-2 min.
echo.
echo  Changes in this fix:
echo    1. Loads SHA-256 dependency before qz-tray.js
echo    2. Uses qz.printers.find() with no argument (not '')
echo    3. Normalises result to array (handles string/array/null)
echo    4. connect() uses retries:1 for faster timeout
echo.
echo  After deploy, go to Settings > Thermal Printer
echo  and click Detect Printers — make sure QZ Tray is running!
echo ============================================================
echo.
pause
