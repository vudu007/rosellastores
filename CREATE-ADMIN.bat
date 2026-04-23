@echo off
cd /d "%~dp0"

echo Creating ADMIN user in the database...
echo This will NOT delete any existing data.
echo.

npx ts-node scripts/create-admin.ts

echo.
pause
