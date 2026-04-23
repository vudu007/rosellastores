# FIX-QZTRAY-ALLOWLIST.ps1
# Directly adds our certificate to QZ Tray's permanent allowlist.
# This is equivalent to clicking "Remember this decision" + Allow in QZ Tray,
# but bypasses the dialog entirely so no trust prompt ever appears again.

$qzDir = Join-Path $env:APPDATA "qz"
$allowedFile = Join-Path $qzDir "allowed.dat"

# Certificate data (SHA-1 fingerprint + details matching digital-certificate.txt)
$fingerprint = "23fe3fdfe332b1fd2570570b056b43cbb75dbd3e"
$cn          = "QZ Tray Demo Cert"
$org         = "QZ Industries, LLC"
$validFrom   = "2026-04-20T19:58:24Z"
$validTo     = "2046-04-20T19:58:24Z"
$trusted     = "false"

$entry = "$fingerprint`t$cn`t$org`t$validFrom`t$validTo`t$trusted"

# Create qz dir if it doesn't exist
if (-not (Test-Path $qzDir)) {
    New-Item -ItemType Directory -Path $qzDir | Out-Null
    Write-Host "Created: $qzDir"
}

# Create allowed.dat if it doesn't exist
if (-not (Test-Path $allowedFile)) {
    New-Item -ItemType File -Path $allowedFile | Out-Null
    Write-Host "Created: $allowedFile"
}

# Check if already present
$existing = Get-Content $allowedFile -ErrorAction SilentlyContinue
$alreadyIn = $existing | Where-Object { $_ -match "^$fingerprint`t" }

if ($alreadyIn) {
    Write-Host "Certificate already in allowlist — nothing to do."
} else {
    Add-Content -Path $allowedFile -Value $entry -Encoding UTF8
    Write-Host "Certificate added to allowlist: $allowedFile"
}

Write-Host ""
Write-Host "Now restarting QZ Tray..."

# Kill QZ Tray if running
$qzProcess = Get-Process -Name "qz-tray" -ErrorAction SilentlyContinue
if ($qzProcess) {
    Stop-Process -Name "qz-tray" -Force
    Write-Host "QZ Tray stopped."
    Start-Sleep -Seconds 2
}

# Find and launch QZ Tray
$qzPaths = @(
    "C:\Program Files\QZ Tray\qz-tray.exe",
    "C:\Program Files (x86)\QZ Tray\qz-tray.exe",
    "$env:LOCALAPPDATA\Programs\QZ Tray\qz-tray.exe"
)
$qzExe = $qzPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($qzExe) {
    Start-Process $qzExe
    Write-Host "QZ Tray started: $qzExe"
} else {
    Write-Host "QZ Tray exe not found — please open QZ Tray manually from the Start Menu."
}

Write-Host ""
Write-Host "============================================================"
Write-Host "DONE! QZ Tray will now auto-allow your certificate forever."
Write-Host "No more print dialogs — just open your app and print."
Write-Host "============================================================"
Write-Host ""
Read-Host "Press Enter to close"
