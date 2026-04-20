@echo off
cd /d "%~dp0"

echo Removing git lock files if present...
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

echo Installing dependencies (resend)...
call npm install

echo Staging all files...
git add "package.json"
git add "package-lock.json"
git add "src/lib/email.ts"
git add "src/app/layout.tsx"
git add "src/app/page.tsx"
git add "src/auth.config.ts"
git add "src/app/(auth)/login/page.tsx"
git add "src/app/(dashboard)/dashboard/expenses/page.tsx"
git add "src/app/(dashboard)/dashboard/sales/page.tsx"
git add "src/app/(dashboard)/dashboard/inventory/page.tsx"
git add "src/app/(dashboard)/dashboard/customers/page.tsx"
git add "src/app/(dashboard)/dashboard/page.tsx"
git add "src/app/(dashboard)/dashboard/reports/page.tsx"
git add "src/app/(dashboard)/dashboard/staff/page.tsx"
git add "src/app/(pos)/pos/page.tsx"
git add "src/app/(wholesale)/wholesale/page.tsx"
git add "src/app/api/customers/[id]/route.ts"
git add "src/app/api/expenses/[id]/route.ts"
git add "src/app/api/dashboard/stats/route.ts"
git add "src/app/api/reports/inventory/route.ts"
git add "src/app/api/reports/tax/route.ts"
git add "src/app/api/reports/eod/send/route.ts"
git add "src/app/api/inventory/restock/route.ts"
git add "src/app/api/cron/low-stock/route.ts"
git add "src/components/shared/Sidebar.tsx"
git add "src/components/shared/Navbar.tsx"
git add "src/components/shared/DashboardShell.tsx"
git add "src/app/globals.css"
git add "src/app/(dashboard)/layout.tsx"
git add "src/app/(dashboard)/dashboard/categories/page.tsx"
git add "src/app/(dashboard)/dashboard/reports/page.tsx"
git add "src/app/(dashboard)/dashboard/settings/page.tsx"
git add "src/app/(dashboard)/dashboard/suppliers/page.tsx"

echo Committing...
git add "prisma/schema.prisma"
git add "src/app/(dashboard)/dashboard/categories/page.tsx"
git add "src/components/shared/IdleTimer.tsx"
git add "src/app/(pos)/layout.tsx"
git add "src/app/(wholesale)/layout.tsx"
git add "src/lib/auth.ts"
git add "src/app/api/staff/route.ts"
git add "src/app/api/products/route.ts"
git add "src/app/api/products/[id]/route.ts"

git commit -m "feat: ADMIN role, multi-barcode per product, 24h temporary accounts"

echo Pushing to GitHub...
git push

echo.
echo Done! Vercel will deploy automatically.
echo.
echo REMINDER: Ensure these env vars are set in Vercel dashboard:
echo   RESEND_API_KEY     = your key from resend.com/api-keys
echo   RESEND_FROM_EMAIL  = MekaERP ^<reports@yourdomain.com^>
echo.
pause
