@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging type declaration fix...
git add "src/types/qz-tray.d.ts"

echo Committing...
git commit -m "fix: add qz-tray module declaration to satisfy TypeScript strict mode"

echo Pushing to GitHub...
git push

echo.
echo Done! Vercel will rebuild automatically.
pause
