# Builds a distributable archive of the project source.
#
# Excludes dependency and build output; INCLUDES .env files, so the resulting
# archive contains live credentials and must be handled as a secret.
#
# Usage: pwsh -File scripts/make-archive.ps1 [-OutFile <path>]

param(
    [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $OutFile) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmm"
    $OutFile = Join-Path (Split-Path -Parent $root) "ecom-sara-$stamp.zip"
}

# Directory names dropped anywhere in the tree.
$excludeDirs = @(
    "node_modules", ".next", ".expo", ".git", ".vercel",
    ".playwright-mcp", ".scrape-probe", "out", "dist", "build",
    "android", "ios", "_expo_check", "_chk"
)

# File patterns dropped anywhere in the tree.
$excludeFiles = @("*.log", "*.tsbuildinfo", "*.tgz", ".DS_Store", "Thumbs.db")

Write-Host "Collecting files..." -ForegroundColor Cyan

$rootPrefix = $root.TrimEnd('\') + '\'
$files = Get-ChildItem -Path $root -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
    $rel = $_.FullName.Substring($rootPrefix.Length)
    $parts = $rel.Split('\')
    $dirHit = $false
    foreach ($p in $parts[0..([Math]::Max(0, $parts.Length - 2))]) {
        if ($excludeDirs -contains $p) { $dirHit = $true; break }
    }
    if ($dirHit) { return $false }
    foreach ($pat in $excludeFiles) { if ($_.Name -like $pat) { return $false } }
    return $true
}

$totalMB = [math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "  $($files.Count) files, $totalMB MB uncompressed" -ForegroundColor Cyan

if (Test-Path -LiteralPath $OutFile) { Remove-Item -LiteralPath $OutFile -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($OutFile, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $n = 0
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($rootPrefix.Length).Replace('\', '/')
        try {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $f.FullName, $rel,
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            $n++
        } catch {
            Write-Warning "skipped $rel : $($_.Exception.Message)"
        }
    }
    Write-Host "  archived $n files" -ForegroundColor Cyan
} finally {
    $zip.Dispose()
}

$zipMB = [math]::Round((Get-Item -LiteralPath $OutFile).Length / 1MB, 1)

Write-Host ""
Write-Host "Created: $OutFile" -ForegroundColor Green
Write-Host "Size   : $zipMB MB" -ForegroundColor Green

# Surface anything sensitive that made it in, so it is never a surprise.
Write-Host ""
Write-Host "SENSITIVE CONTENT INCLUDED:" -ForegroundColor Yellow
$zipRead = [System.IO.Compression.ZipFile]::OpenRead($OutFile)
try {
    $zipRead.Entries |
        Where-Object { $_.FullName -match '(^|/)\.env|order_dump|order_debug_dump|service-account|\.pem$|\.key$' } |
        ForEach-Object { Write-Host ("  " + $_.FullName) -ForegroundColor Yellow }
} finally {
    $zipRead.Dispose()
}
Write-Host ""
Write-Host "Share over a private channel only." -ForegroundColor Yellow
