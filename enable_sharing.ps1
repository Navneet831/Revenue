Write-Host "Setting up Windows Defender Firewall rule for GrewAnalytics..." -ForegroundColor Cyan

# Check if running as Admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Warning "This script requires Administrator privileges!"
    Write-Host "Requesting Administrator permission..."
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    Exit
}

# Create firewall rule for Vite dev server (port 5173)
Remove-NetFirewallRule -DisplayName "Allow GrewAnalytics Sharing" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Allow GrewAnalytics Sharing" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Enabled True

Write-Host ""
Write-Host "✅ Firewall rule added successfully!" -ForegroundColor Green
Write-Host "👉 Your colleagues can now access the app at: http://10.77.36.126:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..."
$x = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
