@echo off
title RetailPro Setup
color 0A
cd /d "%~dp0"

echo.
echo ========================================
echo    RetailPro - Full Setup ^& Launch
echo ========================================
echo.

echo [1/4] Installing dependencies...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)
echo Done!

echo.
echo [2/4] Pushing schema to MongoDB...
call npx prisma db push
if %errorlevel% neq 0 (
    echo ERROR: Could not connect to MongoDB.
    echo Make sure MongoDB is running on localhost:27017
    echo Or update the DATABASE_URL in the .env file with your MongoDB Atlas URL.
    pause
    exit /b 1
)
echo Done!

echo.
echo [3/4] Seeding demo data...
call npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed.ts
if %errorlevel% neq 0 (
    echo Trying alternative seed method...
    call npx prisma db seed
)
echo Done!

echo.
echo [4/4] Starting RetailPro...
echo.
echo ========================================
echo    App running at http://localhost:3000
echo.
echo    Owner:   owner@store.com / owner123
echo    Manager: manager@store.com / manager123
echo    Cashier: cashier1@store.com / cashier123
echo ========================================
echo.

call npm run dev
pause
