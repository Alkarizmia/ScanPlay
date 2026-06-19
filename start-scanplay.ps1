# ScanPlay - Script PowerShell (Terminal Visual Studio / VS Code)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ScanPlay - Installation et demarrage" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] Node.js n'est pas installe." -ForegroundColor Red
    Write-Host "Telechargez LTS : https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

Write-Host "Node:" (node -v)
Write-Host "npm: " (npm -v)
Write-Host "Dossier:" (Get-Location)
Write-Host ""

Write-Host "Installation des dependances..." -ForegroundColor Green
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] npm install a echoue." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

Write-Host ""
Write-Host "PC : http://localhost:5173" -ForegroundColor Green
Write-Host "Sur ton telephone (meme Wi-Fi) :" -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    ForEach-Object { Write-Host "  http://$($_.IPAddress):5173" -ForegroundColor Cyan }
Write-Host "Ctrl+C pour arreter" -ForegroundColor DarkGray
Write-Host ""

npm run dev
