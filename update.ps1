# PowerShell script to update version, zip extension, and create GitHub release

# Get current version from manifest.json
$manifestPath = "browser-ninja/manifest.json"
$manifest = Get-Content $manifestPath | ConvertFrom-Json

# Increment patch version
$versionParts = $manifest.version -split '\.'
$versionParts[2] = [int]$versionParts[2] + 1
$newVersion = $versionParts -join '.'

# Update manifest.json
$manifest.version = $newVersion
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath

# Commit the version change
git add .
git commit -m "Bump version to $newVersion"
git push

# Zip the extension contents (not the directory itself)
# Chrome Web Store requires files at root level of zip, not in a subfolder

# Prepare releases folder and zip path
$releasesDir = "releases"
if (!(Test-Path $releasesDir)) {
	New-Item -ItemType Directory -Path $releasesDir | Out-Null
}
$zipName = "browser-ninja-v$newVersion.zip"
$zipPath = Join-Path $releasesDir $zipName
Compress-Archive -Path "browser-ninja\*" -DestinationPath $zipPath -Force

# Commit all changes (including new zip and version bump)
git add .
git commit -m "Bump version to $newVersion and add release zip"
git push

# Tag the new version in git
git tag v$newVersion
git push origin v$newVersion

# Create GitHub release and upload the zip using gh CLI
gh release create v$newVersion $zipPath --title "Release v$newVersion" --notes "Automated release for version $newVersion"