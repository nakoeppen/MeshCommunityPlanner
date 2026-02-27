# =============================================================================
# Mesh Community Planner — Windows Clean Uninstall
# =============================================================================
#
# Removes ALL traces of Mesh Community Planner from this Windows system:
#   - PyInstaller build output (dist/, build/, frontend/dist/)
#   - Application data directory
#   - Cloned source repo (if in default location)
#
# Usage (PowerShell — run as Administrator if needed):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\clean_uninstall.ps1
#
# Safe to run multiple times. Will not error if files are already gone.
#
# If you forked this repo and are building locally, run this before
# each fresh build/test cycle to ensure no stale artifacts remain.
# =============================================================================

Write-Host "=== Mesh Community Planner - Windows Clean Uninstall ===" -ForegroundColor Cyan
Write-Host ""

# 1. Kill running instances
Write-Host "[1/6] Stopping any running instances..."
Get-Process -Name "MeshCommunityPlanner" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# 2. Remove build artifacts (if running from repo root)
Write-Host "[2/6] Removing build artifacts..."
$repoLocations = @(
    "$env:USERPROFILE\MeshCommunityPlanner",
    "$env:USERPROFILE\source\repos\MeshCommunityPlanner",
    "$env:USERPROFILE\Documents\MeshCommunityPlanner"
)

foreach ($repo in $repoLocations) {
    if (Test-Path "$repo\dist") {
        Remove-Item -Recurse -Force "$repo\dist"
        Write-Host "  Removed $repo\dist"
    }
    if (Test-Path "$repo\build") {
        Remove-Item -Recurse -Force "$repo\build"
        Write-Host "  Removed $repo\build"
    }
    if (Test-Path "$repo\frontend\dist") {
        Remove-Item -Recurse -Force "$repo\frontend\dist"
        Write-Host "  Removed $repo\frontend\dist"
    }
}

# 3. Remove application data
Write-Host "[3/6] Removing application data..."
$appDataDir = "$env:LOCALAPPDATA\MeshCommunityPlanner"
if (Test-Path $appDataDir) {
    Remove-Item -Recurse -Force $appDataDir
    Write-Host "  Removed $appDataDir"
} else {
    Write-Host "  No app data found — skipping"
}

# 4. Remove crash logs
Write-Host "[4/6] Removing crash logs..."
$crashLog = "$env:LOCALAPPDATA\MeshCommunityPlanner\crash.log"
if (Test-Path $crashLog) {
    Remove-Item -Force $crashLog
    Write-Host "  Removed $crashLog"
}

# 5. Remove extracted zip (common download location)
Write-Host "[5/6] Checking common download/extract locations..."
$extractLocations = @(
    "$env:USERPROFILE\Downloads\MeshCommunityPlanner",
    "$env:USERPROFILE\Desktop\MeshCommunityPlanner"
)

foreach ($loc in $extractLocations) {
    if (Test-Path $loc) {
        Remove-Item -Recurse -Force $loc
        Write-Host "  Removed $loc"
    }
}

# 6. Verify cleanup
Write-Host "[6/6] Verifying cleanup..."
Write-Host ""
$clean = $true

$checkPaths = @(
    "$env:LOCALAPPDATA\MeshCommunityPlanner"
)

foreach ($path in $checkPaths) {
    if (Test-Path $path) {
        Write-Host "  [WARN] Still exists: $path" -ForegroundColor Yellow
        $clean = $false
    }
}

$runningProcs = Get-Process -Name "MeshCommunityPlanner" -ErrorAction SilentlyContinue
if ($runningProcs) {
    Write-Host "  [WARN] Process still running" -ForegroundColor Yellow
    $clean = $false
}

if ($clean) {
    Write-Host "  [OK] All clear - no traces of Mesh Community Planner found." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Uninstall complete ===" -ForegroundColor Cyan
