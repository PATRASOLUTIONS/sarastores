# Packages the source tree, excluding build output and dependencies.
# .env is included deliberately — it carries live credentials, so treat the zip as a secret.
$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$zipPath = Join-Path (Split-Path $root -Parent) "ecommerce-sara-$stamp.zip"

$excludeDirs = @("node_modules", ".next", ".git", ".vercel", "dist", "coverage", ".turbo")

$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart('\', '/')
    $first = ($rel -split '[\\/]')
    $blocked = $false
    foreach ($seg in $first) { if ($excludeDirs -contains $seg) { $blocked = $true; break } }
    -not $blocked -and $_.Name -ne "build.log"
}

Write-Host "files to archive: $($files.Count)"

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
}
finally { $zip.Dispose() }

$info = Get-Item $zipPath
Write-Host ""
Write-Host "created : $($info.FullName)"
Write-Host "size    : $([math]::Round($info.Length / 1MB, 1)) MB"

# Verify the archive contents rather than trusting the exclusion logic.
$check = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entries = $check.Entries
    Write-Host "entries : $($entries.Count)"
    Write-Host "node_modules entries : $(($entries | Where-Object { $_.FullName -like 'node_modules/*' }).Count)"
    Write-Host ".next entries        : $(($entries | Where-Object { $_.FullName -like '.next/*' }).Count)"
    Write-Host ".git entries         : $(($entries | Where-Object { $_.FullName -like '.git/*' }).Count)"
    Write-Host ".env included        : $(($entries | Where-Object { $_.FullName -eq '.env' }).Count -eq 1)"
    Write-Host "package.json present : $(($entries | Where-Object { $_.FullName -eq 'package.json' }).Count -eq 1)"
    Write-Host "marketing lib files  : $(($entries | Where-Object { $_.FullName -like 'lib/marketing/*' }).Count)"
}
finally { $check.Dispose() }
