@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging files...
git add "src/middleware.ts"
git add "src/lib/qztray.ts"
git add "src/app/api/qz/sign/route.ts"
git add "src/app/api/qz/certificate/route.ts"

echo Committing...
git commit -m "fix: PKCS#1 RSA key, robust newline handling, exclude api/qz from auth"

echo Pushing to GitHub...
git push

echo.
echo ============================================================
echo  PUSHED. Now update Vercel env vars:
echo.
echo  1. Go to Vercel > Settings > Environment Variables
echo  2. DELETE old QZ_CERTIFICATE and QZ_PRIVATE_KEY
echo  3. Add the NEW values from QZ-TRAY-ENV-VARS.txt
echo  4. Redeploy
echo.
echo  Then test: https://wholesale-rp.vercel.app/api/qz/sign?request=test
echo  You should see a base64 string, not an error.
echo ============================================================
echo.
pause
