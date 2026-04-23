@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging ESLint fixes...
git add "src/lib/qztray.ts"
git add "src/app/(dashboard)/dashboard/settings/page.tsx"
git add "src/app/(pos)/pos/page.tsx"
git add "src/app/(dashboard)/dashboard/sales/page.tsx"
git add "package.json"
git add "package-lock.json"

echo Committing...
git commit -m "fix: ESLint build errors — escape JSX quotes, remove invalid eslint-disable directive in qztray.ts; add QZ Tray silent thermal printing + Settings printer tab"

echo Pushing to GitHub...
git push

echo.
echo Done! Vercel will rebuild automatically.
pause
