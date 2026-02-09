<#
Build a WordPress plugin zip with POSIX-style paths.

Why:
- Some host extractors treat backslashes (\\) in zip entry names as literal characters.
- That breaks WP plugin installs by flattening folders.

This script uses Windows bsdtar via `tar -a` to reliably produce zip entries with forward slashes (/).

Usage:
  ./build-plugin-zip.ps1
  ./build-plugin-zip.ps1 -PluginDir kitchen-iq -OutFile kitchen-iq.zip
#>

[CmdletBinding()]
param(
  [Parameter()] [string] $PluginDir = "kitchen-iq",
  [Parameter()] [string] $OutFile = "kitchen-iq.zip",
  [Parameter()] [switch] $Verify
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSCommandPath
Set-Location $repoRoot

if (-not (Test-Path $PluginDir -PathType Container)) {
  throw "PluginDir not found: $PluginDir (cwd: $repoRoot)"
}

$tar = (Get-Command tar -ErrorAction Stop).Source
Write-Host "Using tar: $tar"

# Stage into a clean temp dir so the zip has a single top-level folder named like $PluginDir
$stageRoot = Join-Path $env:TEMP ("kiq_zip_stage_" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $stageRoot | Out-Null

try {
  $stagedPlugin = Join-Path $stageRoot $PluginDir
  Copy-Item -Recurse -Force -LiteralPath (Join-Path $repoRoot $PluginDir) -Destination $stagedPlugin

  $outPath = Join-Path $repoRoot $OutFile
  if (Test-Path $outPath) { Remove-Item -LiteralPath $outPath -Force }

  # Create zip with forward-slash paths
  & $tar -a -c -f $outPath -C $stageRoot $PluginDir

  $info = Get-Item -LiteralPath $outPath
  Write-Host ("Created: {0} ({1} bytes)" -f $info.FullName, $info.Length)

  if ($Verify) {
    Write-Host "Verifying zip entries..."
    $entries = & $tar -tf $outPath

    if ($entries | Where-Object { $_ -match "\\\\" }) {
      throw "Zip contains backslash (\\) entry names - NOT SAFE for WP installs on Linux hosts."
    }

    if (-not ($entries -contains "$PluginDir/$PluginDir.php") -and -not ($entries -contains "$PluginDir/kitchen-iq.php")) {
      Write-Warning "Could not find expected main plugin file inside zip. Check plugin root file name."
    }

    Write-Host "OK: entries are POSIX-style (/)"
  }
}
finally {
  if (Test-Path $stageRoot) {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
  }
}
