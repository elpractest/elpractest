<#
.SYNOPSIS
    Stop e-Learning Practest Local Development Environment (Windows PowerShell)
#>

Write-Host "🛑 Stopping e-Learning Practest Local Development Environment" -ForegroundColor Yellow

# Kill processes
$phpProcesses = Get-Process -Name "php" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*artisan serve*" }
if ($phpProcesses) {
    $phpProcesses | Stop-Process -Force
    Write-Host "   Stopped Laravel API" -ForegroundColor Green
} else {
    Write-Host "   Laravel API not running" -ForegroundColor Gray
}

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*vite*" -or $_.CommandLine -like "*astro*" }
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "   Stopped React SPA & Astro Site" -ForegroundColor Green
} else {
    Write-Host "   React SPA & Astro Site not running" -ForegroundColor Gray
}

# Clean up PID file
if (Test-Path ".dev-pids") {
    Remove-Item ".dev-pids" -Force
}

Write-Host "✅ All services stopped" -ForegroundColor Green