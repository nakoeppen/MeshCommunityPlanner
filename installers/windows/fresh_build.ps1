# =============================================================================
# Mesh Community Planner — Windows Fresh Build
# =============================================================================
#
# Performs a complete clean build cycle:
#   1. Kills any running instances
#   2. Removes old build artifacts
#   3. Cleans and re-clones the repo
#   4. Sets up Python venv and installs dependencies
#   5. Builds frontend and PyInstaller bundle
#   6. Creates release zip
#
# Usage (PowerShell):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\fresh_build.ps1
#
# Prerequisites:
#   - Python 3.12 installed and in PATH
#   - Node.js 18+ installed and in PATH
#   - Git installed and in PATH
#   - SSH key registered on GitHub for this machine
#
# If you forked this repo, update $RepoSSH below to your fork's SSH URL.
# =============================================================================

$ErrorActionPreference = "Stop"

$RepoSSH = "git@github.com:PapaSierra555/MeshCommunityPlanner.git"
$RepoDir = "$env:USERPROFILE\MeshCommunityPlanner"
$AppVersion = "1.2.0"

Write-Host "=== Mesh Community Planner - Windows Fresh Build ===" -ForegroundColor Cyan
Write-Host ""

# ---- Step 1: Kill running instances ----
Write-Host "[1/7] Stopping any running instances..."
Get-Process -Name "MeshCommunityPlanner" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# ---- Step 2: Remove old clone ----
Write-Host "[2/7] Removing old repo clone..."
if (Test-Path $RepoDir) {
    Remove-Item -Recurse -Force $RepoDir
}

# ---- Step 3: Fresh clone ----
Write-Host "[3/7] Cloning fresh repo..."
git clone $RepoSSH $RepoDir
Set-Location $RepoDir

# ---- Step 4: Python venv ----
Write-Host "[4/7] Setting up Python virtual environment..."
python -m venv venv
& "$RepoDir\venv\Scripts\Activate.ps1"
pip install --quiet -r requirements.txt pyinstaller

# ---- Step 5: Build frontend ----
Write-Host "[5/7] Building frontend..."
Set-Location "$RepoDir\frontend"
npm install --silent
npx vite build
Set-Location $RepoDir

# ---- Step 6: PyInstaller bundle ----
Write-Host "[6/7] Building PyInstaller bundle..."
python -m PyInstaller installers\mesh_planner.spec --noconfirm

# ---- Step 7: Create release zip ----
Write-Host "[7/7] Creating release zip..."
$ZipPath = "$RepoDir\dist\MeshCommunityPlanner-$AppVersion-win.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath }
Compress-Archive -Path "$RepoDir\dist\MeshCommunityPlanner" -DestinationPath $ZipPath

Write-Host ""
Write-Host "=== Build complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Executable: $RepoDir\dist\MeshCommunityPlanner\MeshCommunityPlanner.exe"
Write-Host "Release zip: $ZipPath"
