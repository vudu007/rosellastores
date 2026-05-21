# FIX-QZTRAY-ALLOWLIST.ps1
# Directly adds our certificate to QZ Tray's permanent allowlist.
# This is equivalent to clicking "Remember this decision" + Allow in QZ Tray,
# but bypasses the dialog entirely so no trust prompt ever appears again.

$qzDir = Join-Path $env:APPDATA "qz"
$allowedFile = Join-Path $qzDir "allowed.dat"

function Get-QZCertText {
    $baseUrl = $env:ROSELLA_SITE
    if (-not $baseUrl) { $baseUrl = "https://rosellastores.vercel.app" }
    $baseUrl = $baseUrl.TrimEnd("/")

    try {
        $res = Invoke-WebRequest -Uri "$baseUrl/api/qz/certificate" -UseBasicParsing -TimeoutSec 10
        if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 300 -and $res.Content) {
            return [string]$res.Content
        }
    } catch {}

    $candidates = @(
        (Join-Path $PSScriptRoot ".secrets\qz\qz-certificate.pem"),
        (Join-Path $PSScriptRoot "digital-certificate.txt")
    )
    $path = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($path) {
        return Get-Content -Path $path -Raw
    }

    throw "Unable to load QZ certificate. Set ROSELLA_SITE to your domain, or ensure digital-certificate.txt exists."
}

function Get-QZAllowedEntryFromPem([string]$pemText) {
    $m = [regex]::Match($pemText, "-----BEGIN CERTIFICATE-----\s*(?<b64>[\s\S]+?)\s*-----END CERTIFICATE-----", "Singleline")
    if (-not $m.Success) { throw "Invalid certificate PEM (missing BEGIN/END CERTIFICATE)" }

    $b64 = ($m.Groups["b64"].Value -replace "\s", "")
    $der = [Convert]::FromBase64String($b64)

    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    $fingerprint = ([BitConverter]::ToString($sha1.ComputeHash($der)) -replace "-", "").ToLowerInvariant()

    $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($der)
    $subject = $cert.Subject
    $cn = if ($subject -match "CN=([^,]+)") { $Matches[1].Trim() } else { "Unknown" }
    $org = if ($subject -match "O=([^,]+)") { $Matches[1].Trim() } else { "Unknown" }
    $validFrom = $cert.NotBefore.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $validTo = $cert.NotAfter.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $trusted = "false"

    return @{
        Fingerprint = $fingerprint
        Entry = "$fingerprint`t$cn`t$org`t$validFrom`t$validTo`t$trusted"
    }
}

$pemText = Get-QZCertText
$data = Get-QZAllowedEntryFromPem $pemText
$fingerprint = $data.Fingerprint
$entry = $data.Entry

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
Write-Host "Done."
