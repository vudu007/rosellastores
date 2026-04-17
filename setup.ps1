# RetailPro - Automated Setup Script (MongoDB)
# Run from inside the retail-system folder

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   RetailPro Setup Wizard" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1 - Navigate to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
Write-Host "[1/5] Working directory: $scriptDir" -ForegroundColor Green

# Step 2 - MongoDB connection string
Write-Host ""
Write-Host "[2/5] MongoDB Configuration" -ForegroundColor Yellow
Write-Host "      Press ENTER to use local MongoDB (mongodb://localhost:27017/retaildb)" -ForegroundColor Gray
Write-Host "      Or paste your MongoDB Atlas connection string:" -ForegroundColor Gray
$mongoInput = Read-Host "      MongoDB URL"

if ([string]::IsNullOrWhiteSpace($mongoInput)) {
    $mongoUrl = "mongodb://localhost:27017/retaildb"
} else {
    $mongoUrl = $mongoInput.Trim()
}

Write-Host "      Using: $mongoUrl" -ForegroundColor Green

# Write .env file
$envContent = @"
DATABASE_URL="$mongoUrl"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="retailpro-secret-$(Get-Random)-change-in-production"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-gmail-app-password"
STRIPE_SECRET_KEY="sk_test_placeholder"
STRIPE_PUBLIC_KEY="pk_test_placeholder"
"@
Set-Content -Path ".env" -Value $envContent
Write-Host "      .env file created!" -ForegroundColor Green

# Step 3 - npm install
Write-Host ""
Write-Host "[3/5] Installing dependencies..." -ForegroundColor Yellow
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "      npm install failed. Exiting." -ForegroundColor Red
    exit 1
}
Write-Host "      Dependencies installed!" -ForegroundColor Green

# Step 4 - Push Prisma schema to MongoDB
Write-Host ""
Write-Host "[4/5] Pushing schema to MongoDB..." -ForegroundColor Yellow
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Schema push failed. Make sure MongoDB is running." -ForegroundColor Red
    Write-Host "      If using local MongoDB, start it with: mongod" -ForegroundColor Yellow
    exit 1
}
Write-Host "      Schema pushed!" -ForegroundColor Green

# Step 5 - Seed database
Write-Host ""
Write-Host "[5/5] Seeding database with demo data..." -ForegroundColor Yellow
npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Trying alternative seed method..." -ForegroundColor Yellow
    npx prisma db seed
}
Write-Host "      Database seeded!" -ForegroundColor Green

# Done
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Demo login credentials:" -ForegroundColor White
Write-Host "   Owner:   owner@store.com    / owner123" -ForegroundColor Gray
Write-Host "   Manager: manager@store.com  / manager123" -ForegroundColor Gray
Write-Host "   Cashier: cashier1@store.com / cashier123" -ForegroundColor Gray
Write-Host ""
Write-Host "   Starting dev server at http://localhost:3000 ..." -ForegroundColor Cyan
Write-Host ""

npm run dev
