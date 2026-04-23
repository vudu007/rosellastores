@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging settings access fix...
git add "src/components/shared/Sidebar.tsx"
git add "src/app/(dashboard)/dashboard/settings/page.tsx"
git add "src/types/qz-tray.d.ts"

echo Committing...
git commit -m "fix: show Settings page to OWNER and MANAGER roles, not just ADMIN; add qz-tray type declaration"

echo Pushing to GitHub...
git push

echo.
echo Done! Vercel will rebuild automatically.
pause
