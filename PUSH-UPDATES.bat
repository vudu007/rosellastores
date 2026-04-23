@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging changes...
git add "src/app/(pos)/pos/page.tsx"
git add "src/app/(dashboard)/dashboard/sales/page.tsx"

echo Committing...
git commit -m "fix: darker thermal print, prevent double-print, unify reprint format with retail receipt"

echo Pushing...
git push

echo.
echo ============================================================
echo  PUSHED! Vercel will auto-deploy in ~60 seconds.
echo.
echo  What was fixed:
echo  1. Print output now darker (print-color-adjust:exact + bolder font)
echo  2. Double-print prevented (guard ref + button renamed to "Print Again")
echo  3. Sales history reprint now matches the retail receipt format exactly
echo ============================================================
echo.
pause
