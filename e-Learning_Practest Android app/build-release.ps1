#!/usr/bin/env pwsh
# Build a PRODUCTION release of the Practest Android app with the LIVE API URL
# baked in, so a shipped build can never silently point at a dev server.
#
#   ./build-release.ps1              # -> app-release.aab  (upload to Google Play)
#   ./build-release.ps1 -Format apk  # -> app-release.apk  (side-load / device test)
#
# Requires Flutter on PATH (or set $env:FLUTTER_BIN). For a Play-signable
# artifact, android/key.properties must be present; without it the build is
# debug-signed — testable on a device but rejected by Google Play.
param(
  [ValidateSet('aab', 'apk')] [string]$Format = 'aab'
)
$ErrorActionPreference = 'Stop'

# Single source of truth for the production API base URL.
$ApiUrl = 'https://api.practest.live/api'

$flutter =
  if ($env:FLUTTER_BIN) { $env:FLUTTER_BIN }
  elseif (Get-Command flutter -ErrorAction SilentlyContinue) { 'flutter' }
  elseif (Test-Path 'C:\flutter\bin\flutter.bat') { 'C:\flutter\bin\flutter.bat' }
  else { throw 'flutter not found. Add it to PATH or set $env:FLUTTER_BIN.' }

$target = if ($Format -eq 'aab') { 'appbundle' } else { 'apk' }

Write-Host "Building $target (release) against $ApiUrl" -ForegroundColor Cyan
& $flutter build $target --release --dart-define=API_BASE_URL=$ApiUrl
if ($LASTEXITCODE -ne 0) { throw "flutter build failed (exit $LASTEXITCODE)" }

$out = if ($Format -eq 'aab') {
  'build/app/outputs/bundle/release/app-release.aab'
} else {
  'build/app/outputs/flutter-apk/app-release.apk'
}
Write-Host "`nDone -> $out" -ForegroundColor Green
if (-not (Test-Path 'android/key.properties')) {
  Write-Host 'WARNING: android/key.properties missing - this artifact is DEBUG-signed and Google Play will reject it. See android/key.properties.example.' -ForegroundColor Yellow
}
