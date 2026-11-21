param([string]$Repository = 'hardikguptaofficialgit/betterview')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$iss = Join-Path $PSScriptRoot 'BetterView.iss'
$compilerCandidates = @(
  "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
)
$compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue; if ($command) { $compiler = $command.Source } }
if (-not $compiler) { throw 'Inno Setup 6 is required. Install it from https://jrsoftware.org/isinfo.php, then rerun: powershell -ExecutionPolicy Bypass -File installer/build.ps1' }
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Repository must be in owner/name format.' }
$env:BETTERVIEW_REPOSITORY = $Repository
Push-Location $PSScriptRoot
try { & $compiler "/DAppVersion=$((Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version)" $iss; if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed: $LASTEXITCODE" } }
finally { Pop-Location }
$output = Join-Path $root 'release\BetterView-Setup.exe'
if (-not (Test-Path -LiteralPath $output)) { throw 'Installer compiler completed but BetterView-Setup.exe was not created.' }
Write-Host "Created $output"

