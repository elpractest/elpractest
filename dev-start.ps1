<# 
.SYNOPSIS
    Start e-Learning Practest Local Development Environment (Windows PowerShell)

.DESCRIPTION
    Starts Laravel API, React SPA, and Astro Public Site for local development.
    Run from project root: .\dev-start.ps1
#>

param(
    [switch]$NoLogs = $false
)

Write-Host "🚀 Starting e-Learning Practest Local Development Environment" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "api\artisan") -or -not (Test-Path "app\package.json") -or -not (Test-Path "web\package.json")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Function to check if a port is in use
function Test-PortInUse {
    param([int]$Port)
    $listener = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return $listener.Port -contains $Port
}

# Kill existing processes on our ports
Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Yellow
Get-Process -Name "php" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*artisan serve*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*vite*" -or $_.CommandLine -like "*astro*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start Laravel API
Write-Host "📡 Starting Laravel API on http://localhost:8000" -ForegroundColor Blue
Set-Location api
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    php artisan key:generate
}
$apiProcess = Start-Process php -ArgumentList "artisan", "serve", "--port=8000" -PassThru -WindowStyle Hidden
Set-Location ..

# Wait for API to be ready
Write-Host -NoNewline "   Waiting for API..."
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/me" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
            Write-Host " ✓" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host -NoNewline "."
        Start-Sleep -Seconds 1
    }
}

# Start React SPA
Write-Host "⚛️  Starting React SPA on http://localhost:3000" -ForegroundColor Blue
Set-Location app
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}
$appProcess = Start-Process npm -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden
Set-Location ..

# Start Astro Site
Write-Host "🌐 Starting Astro Site on http://localhost:4321" -ForegroundColor Blue
Set-Location web
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}
$webProcess = Start-Process npm -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden
Set-Location ..

# Save PIDs for cleanup
"$($apiProcess.Id) $($appProcess.Id) $($webProcess.Id)" | Out-File -FilePath ".dev-pids" -Encoding UTF8

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Service URLs:" -ForegroundColor Cyan
Write-Host "   📡 Laravel API:      http://localhost:8000"
Write-Host "   ⚛️  React SPA:        http://localhost:3000"
Write-Host "   🌐 Astro Public Site: http://localhost:4321"
Write-Host ""
Write-Host "📋 Test Credentials (from SuperAdminSeeder):" -ForegroundColor Cyan
Write-Host "   👤 Super-Admin: thevinstitution@gmail.com / Vevgvbsm@vpdmns2710."
Write-Host ""
Write-Host "📋 To view logs (in separate terminals):" -ForegroundColor Cyan
Write-Host "   Get-Content storage\logs\api.log -Wait"
Write-Host "   Get-Content storage\logs\app.log -Wait"
Write-Host "   Get-Content storage\logs\web.log -Wait"
Write-Host ""
Write-Host "🛑 To stop all services: .\dev-stop.ps1" -ForegroundColor Yellow
Write-Host ""
if (-not $NoLogs) {
    Write-Host "Press Ctrl+C to stop this script (services will keep running)" -ForegroundColor Gray
    Write-Host "Or run .\dev-stop.ps1 in another terminal to stop all services" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Showing API log (Ctrl+C to exit log view, services keep running):" -ForegroundColor Gray
    Get-Content "storage\logs\api.log" -Wait -ErrorAction SilentlyContinue
}