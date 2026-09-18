#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$UnityEditorPath,
    [string]$MetadataPath,
    [string]$ArchivePath,
    [string]$CacheDirectory,
    [switch]$Offline,
    [ValidateRange(10, 600)][int]$TimeoutSec = 90
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$requiredUnity = '6000.3.21f1'
$packageId = 'com.unity.ai.assistant'
$registryUri = "https://packages.unity.com/$packageId"

function Get-PropertyValue {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function ConvertTo-SemVerParts {
    param([string]$Value)
    if ($Value -notmatch '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<pre>[0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$') {
        return $null
    }
    $prerelease = if ($Matches.ContainsKey('pre')) { [string]$Matches['pre'] } else { '' }
    [pscustomobject]@{ major=[int]$Matches.major; minor=[int]$Matches.minor; patch=[int]$Matches.patch; pre=$prerelease; raw=$Value }
}

function Compare-SemVerParts {
    param($Left, $Right)
    foreach ($field in @('major','minor','patch')) {
        if ($Left.$field -lt $Right.$field) { return -1 }
        if ($Left.$field -gt $Right.$field) { return 1 }
    }
    if ([string]::IsNullOrEmpty($Left.pre) -and [string]::IsNullOrEmpty($Right.pre)) { return 0 }
    if ([string]::IsNullOrEmpty($Left.pre)) { return 1 }
    if ([string]::IsNullOrEmpty($Right.pre)) { return -1 }
    $leftParts = $Left.pre.Split('.')
    $rightParts = $Right.pre.Split('.')
    $count = [Math]::Max($leftParts.Count, $rightParts.Count)
    for ($i=0; $i -lt $count; $i++) {
        if ($i -ge $leftParts.Count) { return -1 }
        if ($i -ge $rightParts.Count) { return 1 }
        $ln=0; $rn=0
        $leftNumeric=[int]::TryParse($leftParts[$i], [ref]$ln)
        $rightNumeric=[int]::TryParse($rightParts[$i], [ref]$rn)
        if ($leftNumeric -and $rightNumeric) { if ($ln -lt $rn) { return -1 }; if ($ln -gt $rn) { return 1 }; continue }
        if ($leftNumeric -ne $rightNumeric) { return $(if ($leftNumeric) { -1 } else { 1 }) }
        $cmp=[string]::CompareOrdinal($leftParts[$i], $rightParts[$i]); if ($cmp -ne 0) { return [Math]::Sign($cmp) }
    }
    return 0
}

function ConvertTo-UnityParts {
    param([string]$Value)
    if ($Value -notmatch '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?<channel>[abfp])(?<revision>\d+)$') { return $null }
    $rank = @{a=0;b=1;f=2;p=3}[[string]$Matches.channel]
    [pscustomobject]@{major=[int]$Matches.major;minor=[int]$Matches.minor;patch=[int]$Matches.patch;channel=$rank;revision=[int]$Matches.revision}
}

function Test-MinimumUnity {
    param($Manifest)
    $unity=[string](Get-PropertyValue $Manifest 'unity')
    $release=[string](Get-PropertyValue $Manifest 'unityRelease')
    if ($unity -notmatch '^\d+\.\d+$' -or $release -notmatch '^\d+[abfp]\d+$') { return $false }
    $minimum=ConvertTo-UnityParts "$unity.$release"
    $target=ConvertTo-UnityParts $requiredUnity
    foreach ($field in @('major','minor','patch','channel','revision')) {
        if ($minimum.$field -lt $target.$field) { return $true }
        if ($minimum.$field -gt $target.$field) { return $false }
    }
    return $true
}

$root=[IO.Path]::GetFullPath($ProjectRoot)
$projectVersionPath=Join-Path $root 'ProjectSettings\ProjectVersion.txt'
$manifestPath=Join-Path $root 'Packages\manifest.json'
if (-not (Test-Path $projectVersionPath -PathType Leaf) -or -not (Test-Path $manifestPath -PathType Leaf)) { throw "Not a Unity project: $root" }
$versionText=Get-Content -Raw $projectVersionPath
if ($versionText -notmatch '(?m)^m_EditorVersion:\s*(?<version>\S+)\s*$') {
    throw "ProjectSettings/ProjectVersion.txt does not declare m_EditorVersion."
}
$declaredUnity = [string]$Matches.version
if ($declaredUnity -ne $requiredUnity) { throw "This portable setup requires Unity $requiredUnity; project declares '$declaredUnity'." }
$editor=[IO.Path]::GetFullPath($UnityEditorPath)
if (-not (Test-Path $editor -PathType Leaf)) { throw "Unity executable not found: $editor" }
$productVersion=[Diagnostics.FileVersionInfo]::GetVersionInfo($editor).ProductVersion
if ([string]::IsNullOrWhiteSpace($productVersion) -or -not $productVersion.StartsWith("$requiredUnity`_", [StringComparison]::OrdinalIgnoreCase)) { throw "Unity executable '$productVersion' is not $requiredUnity." }
if ([string]::IsNullOrWhiteSpace($CacheDirectory)) { $CacheDirectory=Join-Path $root '.agent-temp\unity-mcp-package-cache' }
$cache=[IO.Path]::GetFullPath($CacheDirectory)
New-Item -ItemType Directory -Force $cache | Out-Null
$cachedMetadata=Join-Path $cache 'registry-metadata.json'
$cachedMetadataHash=Join-Path $cache 'registry-metadata.sha256'

function Read-VerifiedCachedMetadata {
    if (-not (Test-Path $cachedMetadata -PathType Leaf) -or -not (Test-Path $cachedMetadataHash -PathType Leaf)) {
        throw "Verified registry metadata cache is incomplete: $cache"
    }
    $expected=([IO.File]::ReadAllText($cachedMetadataHash)).Trim().ToLowerInvariant()
    if ($expected -notmatch '^[0-9a-f]{64}$') { throw 'Cached registry metadata hash is invalid.' }
    $actual=(Get-FileHash $cachedMetadata -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "Cached registry metadata hash mismatch: expected $expected, got $actual" }
    return (Get-Content -Raw $cachedMetadata | ConvertFrom-Json)
}

$source='registry-live'
if (-not [string]::IsNullOrWhiteSpace($MetadataPath)) {
    $metadata=Get-Content -Raw ([IO.Path]::GetFullPath($MetadataPath)) | ConvertFrom-Json
    $source='provided-metadata'
} elseif ($Offline) {
    $metadata=Read-VerifiedCachedMetadata
    $source='verified-offline-cache'
} else {
    try {
        $response=Invoke-WebRequest -UseBasicParsing -Uri $registryUri -Headers @{'X-Unity-Version'=$requiredUnity} -TimeoutSec $TimeoutSec
        $metadataText=[string]$response.Content
        $metadata=$metadataText | ConvertFrom-Json
        $metadataPartial="$cachedMetadata.partial"
        [IO.File]::WriteAllText($metadataPartial, $metadataText, (New-Object Text.UTF8Encoding($false)))
        $metadataSha=(Get-FileHash $metadataPartial -Algorithm SHA256).Hash.ToLowerInvariant()
        Move-Item $metadataPartial $cachedMetadata -Force
        [IO.File]::WriteAllText($cachedMetadataHash, "$metadataSha`n", (New-Object Text.UTF8Encoding($false)))
    } catch {
        $metadata=Read-VerifiedCachedMetadata
        $source='verified-offline-cache'
    }
}

$versions=Get-PropertyValue $metadata 'versions'
if ($null -eq $versions) { throw 'Registry metadata has no versions map.' }
$selected=$null; $selectedParts=$null
foreach ($property in $versions.PSObject.Properties) {
    $parts=ConvertTo-SemVerParts $property.Name
    if ($null -eq $parts -or -not (Test-MinimumUnity $property.Value)) { continue }
    $dist=Get-PropertyValue $property.Value 'dist'
    $tarball=[string](Get-PropertyValue $dist 'tarball')
    $shasum=[string](Get-PropertyValue $dist 'shasum')
    if ($tarball -notmatch '^https://download\.packages\.unity\.com/' -or $shasum -notmatch '^[0-9a-fA-F]{40}$') { continue }
    if ($null -eq $selected -or (Compare-SemVerParts $parts $selectedParts) -gt 0) { $selected=$property.Value; $selectedParts=$parts }
}
if ($null -eq $selected) { throw "No verified $packageId release is compatible with $requiredUnity." }
if ([string](Get-PropertyValue $selected 'name') -ne $packageId -or [string](Get-PropertyValue $selected 'version') -ne $selectedParts.raw) { throw 'Selected registry entry identity mismatch.' }
$dist=Get-PropertyValue $selected 'dist'
$expectedSha1=([string](Get-PropertyValue $dist 'shasum')).ToLowerInvariant()
$tarballUri=[string](Get-PropertyValue $dist 'tarball')
$archive=if ([string]::IsNullOrWhiteSpace($ArchivePath)) { Join-Path $cache "$packageId-$($selectedParts.raw).tgz" } else { [IO.Path]::GetFullPath($ArchivePath) }
if (-not (Test-Path $archive -PathType Leaf)) {
    if ($source -eq 'verified-offline-cache') { throw "Offline cache is missing verified archive: $archive" }
    Invoke-WebRequest -UseBasicParsing -Uri $tarballUri -OutFile $archive -TimeoutSec $TimeoutSec
}
$actualSha1=(Get-FileHash $archive -Algorithm SHA1).Hash.ToLowerInvariant()
if ($actualSha1 -ne $expectedSha1) { throw "Assistant tarball SHA1 mismatch: expected $expectedSha1, got $actualSha1" }

$entries=@(& tar -tzf $archive)
if ($LASTEXITCODE -ne 0 -or $entries.Count -eq 0) { throw 'Assistant tarball cannot be listed.' }
foreach ($entry in $entries) {
    $normalized=[string]$entry -replace '\\','/'
    if ($normalized.StartsWith('/') -or $normalized -match '(^|/)\.\.(/|$)' -or $normalized -match '^[A-Za-z]:') { throw "Unsafe tarball entry: $entry" }
}
$packageJsonText=& tar -xOzf $archive 'package/package.json'
if ($LASTEXITCODE -ne 0) { throw 'Assistant tarball is missing package/package.json.' }
$inside=($packageJsonText -join "`n") | ConvertFrom-Json
if ([string]$inside.name -ne $packageId -or [string]$inside.version -ne $selectedParts.raw) { throw 'Assistant tarball package identity mismatch.' }

[pscustomobject][ordered]@{
    status='verified-official-unity-mcp'
    unity_version=$requiredUnity
    unity_editor_path=$editor
    package_id=$packageId
    version=$selectedParts.raw
    manifest_value=$selectedParts.raw
    tarball=$tarballUri
    sha1=$expectedSha1
    archive_path=$archive
    metadata_source=$source
    dependencies=$inside.dependencies
} | ConvertTo-Json -Depth 10
