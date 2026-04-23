@echo off
cd /d "%~dp0"

echo Removing git lock files if present...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging fix...
git add "src/app/api/dashboard/stats/route.ts"

echo Committing...
git commit -m "Fix TS: Date.getTime() comparison, use SaleItem.total not subtotal"

echo Pushing to GitHub...
git push

echo.
echo Done! Vercel will deploy automatically.
pause
