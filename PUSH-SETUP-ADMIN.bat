@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging files...
git add "src/app/api/setup/admin/route.ts"
git add "src/components/shared/Sidebar.tsx"
git add "src/app/(dashboard)/dashboard/settings/page.tsx"
git add "src/types/qz-tray.d.ts"

echo Committing...
git commit -m "fix: rebuild admin setup route, fix Settings access for OWNER/MANAGER, add qz-tray types"

echo Pushing to GitHub...
git push

echo.
echo ============================================================
echo  NEXT STEP after Vercel finishes deploying:
echo.
echo  Open this URL in your browser:
echo  https://wholesale-rp.vercel.app/api/setup/admin
echo.
echo  Then login with:
echo    Email:    admin@mekaerp.com
echo    Password: Admin2025!
echo ============================================================
echo.
pause
