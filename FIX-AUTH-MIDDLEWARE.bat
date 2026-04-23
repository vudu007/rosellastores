@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging fixes...
git add "src/auth.config.ts"
git add "src/app/(dashboard)/layout.tsx"

echo Committing...
git commit -m "fix: allow ADMIN role in dashboard layout, add trustHost to authConfig"

echo Pushing to GitHub...
git push

echo.
echo ============================================================
echo  DONE — Vercel will now redeploy.
echo.
echo  Once deployed (~1-2 min), log in at:
echo    https://wholesale-rp.vercel.app/login
echo  with:
echo    Email:    admin@mekaerp.com
echo    Password: Admin2025!
echo ============================================================
echo.
pause
