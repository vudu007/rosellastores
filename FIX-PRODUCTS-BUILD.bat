@echo off
cd /d "%~dp0"

echo Clearing git lock files...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Staging products route fix...
git add "src/app/api/products/route.ts"

echo Committing...
git commit -m "fix: TypeScript build error in products route — separate select/include branches for Prisma type safety"

echo Pushing to GitHub...
git push

echo.
echo Done! Vercel will rebuild automatically.
pause
