#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter(Mandatory = $true)]
    [string]$UnityEditorPath,

    [Parameter(Mandatory = $true)]
    [string[]]$PackageId,

    [string]$MinimumVersionJson = '{}',

    [string]$PreserveMajorJson = '{}',

    [ValidateRange(5, 120)]
    [int]$TimeoutSec = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$requiredUnityVersion = '6000.3.21f1'
$editorCatalogAuthoritativeIds = @('com.unity.visualeffectgraph')

function Get-PropertyValue {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }
    return $property.Value
}

function ConvertFrom-MapJson {
    param(
        [Parameter(Mandatory = $true)][string]$Json,
        [Parameter(Mandatory = $true)][string]$Label
    )

    try {
        $value = $Json | ConvertFrom-Json
    }
    catch {
        throw "$Label must be a JSON object: $($_.Exception.Message)"
    }

    if ($null -eq $value -or $value -isnot [pscustomobject]) {
        throw "$Label must be a JSON object."
    }
    return $value
}

function ConvertTo-StableSemVer {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value -notmatch '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$') {
        return $null
    }

    return [version]::new(
        [int]$Matches.major,
        [int]$Matches.minor,
        [int]$Matches.patch
    )
}

function Get-UnityReleaseTuple {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value -notmatch '^(?<patch>\d+)(?<stage>[abfp])(?<build>\d+)$') {
        return $null
    }

    $stageRanks = @{ a = 0; b = 1; f = 2; p = 3 }
    return [pscustomobject]@{
        Patch = [int]$Matches.patch
        Stage = [int]$stageRanks[$Matches.stage]
        Build = [int]$Matches.build
    }
}

function Compare-UnityReleaseTuple {
    param(
        [Parameter(Mandatory = $true)]$Left,
        [Parameter(Mandatory = $true)]$Right
    )

    foreach ($name in @('Patch', 'Stage', 'Build')) {
        if ($Left.$name -lt $Right.$name) {
            return -1
        }
        if ($Left.$name -gt $Right.$name) {
            return 1
        }
    }
    return 0
}

function Test-UnityCompatibility {
    param(
        [Parameter(Mandatory = $true)]$Manifest,
        [Parameter(Mandatory = $true)][int]$TargetMajor,
        [Parameter(Mandatory = $true)][int]$TargetMinor,
        [Parameter(Mandatory = $true)]$TargetRelease
    )

    $minimumUnity = [string](Get-PropertyValue -Object $Manifest -Name 'unity')
    if ([string]::IsNullOrWhiteSpace($minimumUnity)) {
        return $true
    }
    if ($minimumUnity -notmatch '^(?<major>\d+)\.(?<minor>\d+)$') {
        return $false
    }

    $minimumMajor = [int]$Matches.major
    $minimumMinor = [int]$Matches.minor
    if ($TargetMajor -lt $minimumMajor) {
        return $false
    }
    if ($TargetMajor -gt $minimumMajor) {
        return $true
    }
    if ($TargetMinor -lt $minimumMinor) {
        return $false
    }
    if ($TargetMinor -gt $minimumMinor) {
        return $true
    }

    $minimumReleaseText = [string](Get-PropertyValue -Object $Manifest -Name 'unityRelease')
    if ([string]::IsNullOrWhiteSpace($minimumReleaseText)) {
        return $true
    }

    $minimumRelease = Get-UnityReleaseTuple -Value $minimumReleaseText
    if ($null -eq $minimumRelease) {
        return $false
    }

    return (Compare-UnityReleaseTuple -Left $TargetRelease -Right $minimumRelease) -ge 0
}

$resolvedProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
if (-not (Test-Path -LiteralPath $resolvedProjectRoot -PathType Container)) {
    throw "Project root does not exist: $resolvedProjectRoot"
}

$projectVersionPath = Join-Path $resolvedProjectRoot 'ProjectSettings\ProjectVersion.txt'
$projectManifestPath = Join-Path $resolvedProjectRoot 'Packages\manifest.json'
if (-not (Test-Path -LiteralPath $projectVersionPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $projectManifestPath -PathType Leaf)) {
    throw 'The target is not a Unity project with ProjectVersion.txt and Packages/manifest.json.'
}

$projectVersionText = Get-Content -LiteralPath $projectVersionPath -Raw
if ($projectVersionText -notmatch '(?m)^m_EditorVersion:\s*(?<version>\d+\.\d+\.\d+[abfp]\d+)\s*$') {
    throw 'ProjectVersion.txt does not contain one supported m_EditorVersion value.'
}
$projectUnityVersion = $Matches.version
if ($projectUnityVersion -ne $requiredUnityVersion) {
    throw "This portable setup requires Unity $requiredUnityVersion; project declares '$projectUnityVersion'."
}
if ($projectUnityVersion -notmatch '^(?<major>\d+)\.(?<minor>\d+)\.(?<release>\d+[abfp]\d+)$') {
    throw "Unsupported Unity version format: $projectUnityVersion"
}
$targetMajor = [int]$Matches.major
$targetMinor = [int]$Matches.minor
$targetRelease = Get-UnityReleaseTuple -Value $Matches.release
if ($null -eq $targetRelease) {
    throw "Unsupported Unity release format: $projectUnityVersion"
}

$resolvedEditorPath = [System.IO.Path]::GetFullPath($UnityEditorPath)
if (-not (Test-Path -LiteralPath $resolvedEditorPath -PathType Leaf) -or
    [System.IO.Path]::GetFileName($resolvedEditorPath) -ne 'Unity.exe') {
    throw "UnityEditorPath must name an existing Unity.exe: $resolvedEditorPath"
}
$editorProductVersion = [string](Get-Item -LiteralPath $resolvedEditorPath).VersionInfo.ProductVersion
if (-not $editorProductVersion.StartsWith("$projectUnityVersion`_", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unity executable version '$editorProductVersion' does not match project version '$projectUnityVersion'."
}

$editorDirectory = [System.IO.Path]::GetDirectoryName($resolvedEditorPath)
$packageManagerRoot = Join-Path $editorDirectory 'Data\Resources\PackageManager'
$catalogPath = Join-Path $packageManagerRoot 'Editor\manifest.json'
if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) {
    throw "Unity Package Manager editor catalog is missing: $catalogPath"
}
try {
    $editorCatalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
}
catch {
    throw "Unity Package Manager editor catalog is invalid JSON: $($_.Exception.Message)"
}

$minimumVersions = ConvertFrom-MapJson -Json $MinimumVersionJson -Label 'MinimumVersionJson'
$preservedMajors = ConvertFrom-MapJson -Json $PreserveMajorJson -Label 'PreserveMajorJson'
$uniquePackageIds = @($PackageId | Sort-Object -Unique)
if ($uniquePackageIds.Count -ne $PackageId.Count) {
    throw 'PackageId contains duplicates.'
}

$headers = @{
    Accept = 'application/json'
    'User-Agent' = 'Agents-Tu-Build-UnityRegistryResolver/1.0'
    'X-Unity-Version' = $projectUnityVersion
}
$resolvedPackages = @()

foreach ($id in $uniquePackageIds) {
    if ($id -notmatch '^com\.unity\.[a-z0-9][a-z0-9._-]*$') {
        throw "Only official com.unity.* registry package ids are accepted: $id"
    }

    $minimumText = [string](Get-PropertyValue -Object $minimumVersions -Name $id)
    $minimumSemVer = $null
    if (-not [string]::IsNullOrWhiteSpace($minimumText)) {
        $minimumSemVer = ConvertTo-StableSemVer -Value $minimumText
        if ($null -eq $minimumSemVer) {
            throw "Minimum version for '$id' is not stable semantic version text: $minimumText"
        }
    }

    $majorText = [string](Get-PropertyValue -Object $preservedMajors -Name $id)
    $preservedMajor = $null
    if (-not [string]::IsNullOrWhiteSpace($majorText)) {
        if ($majorText -notmatch '^\d+$') {
            throw "Preserved major for '$id' is invalid: $majorText"
        }
        $preservedMajor = [int]$majorText
    }

    $registryUri = "https://packages.unity.com/$([System.Uri]::EscapeDataString($id))"
    try {
        $metadata = Invoke-RestMethod -Uri $registryUri -Headers $headers -TimeoutSec $TimeoutSec
    }
    catch {
        throw "Unity Registry metadata request failed for '$id': $($_.Exception.Message)"
    }
    if ([string](Get-PropertyValue -Object $metadata -Name 'name') -ne $id) {
        throw "Unity Registry returned the wrong package identity for '$id'."
    }

    $candidates = @{}
    $versions = Get-PropertyValue -Object $metadata -Name 'versions'
    if ($null -eq $versions) {
        throw "Unity Registry returned no versions object for '$id'."
    }
    foreach ($property in $versions.PSObject.Properties) {
        $semVer = ConvertTo-StableSemVer -Value $property.Name
        if ($null -eq $semVer) {
            continue
        }
        if ($null -ne $minimumSemVer -and $semVer -lt $minimumSemVer) {
            continue
        }
        if ($null -ne $preservedMajor -and $semVer.Major -ne $preservedMajor) {
            continue
        }
        if (-not (Test-UnityCompatibility `
            -Manifest $property.Value `
            -TargetMajor $targetMajor `
            -TargetMinor $targetMinor `
            -TargetRelease $targetRelease)) {
            continue
        }

        $dist = Get-PropertyValue -Object $property.Value -Name 'dist'
        $tarball = [string](Get-PropertyValue -Object $dist -Name 'tarball')
        $sha1 = [string](Get-PropertyValue -Object $dist -Name 'shasum')
        if ($tarball -notmatch '^https://download\.packages\.unity\.com/' -or $sha1 -notmatch '^[0-9a-fA-F]{40}$') {
            continue
        }

        $candidates[$property.Name] = [pscustomobject]@{
            Version = $property.Name
            SortVersion = $semVer
            Source = 'unity-registry'
            Manifest = $property.Value
            EditorCatalogMatch = $false
            Tarball = $tarball
            Sha1 = $sha1.ToLowerInvariant()
            CatalogManifestSha256 = $null
        }
    }

    $catalogPackages = Get-PropertyValue -Object $editorCatalog -Name 'packages'
    $catalogEntry = if ($null -eq $catalogPackages) {
        $null
    }
    else {
        Get-PropertyValue -Object $catalogPackages -Name $id
    }
    $catalogVersion = if ($null -eq $catalogEntry) {
        $null
    }
    else {
        [string](Get-PropertyValue -Object $catalogEntry -Name 'version')
    }
    if (-not [string]::IsNullOrWhiteSpace($catalogVersion)) {
        $catalogSemVer = ConvertTo-StableSemVer -Value $catalogVersion
        if ($null -ne $catalogSemVer -and
            ($null -eq $minimumSemVer -or $catalogSemVer -ge $minimumSemVer) -and
            ($null -eq $preservedMajor -or $catalogSemVer.Major -eq $preservedMajor)) {
            if ($candidates.ContainsKey($catalogVersion)) {
                $candidates[$catalogVersion].EditorCatalogMatch = $true
            }
            else {
                $builtInManifestPath = Join-Path $packageManagerRoot "BuiltInPackages\$id\package.json"
                $builtInManifest = if (Test-Path -LiteralPath $builtInManifestPath -PathType Leaf) {
                    Get-Content -LiteralPath $builtInManifestPath -Raw | ConvertFrom-Json
                }
                else {
                    [pscustomobject]@{}
                }
                $candidates[$catalogVersion] = [pscustomobject]@{
                    Version = $catalogVersion
                    SortVersion = $catalogSemVer
                    Source = 'unity-editor-catalog'
                    Manifest = $builtInManifest
                    EditorCatalogMatch = $true
                    Tarball = $null
                    Sha1 = $null
                    CatalogManifestSha256 = if (Test-Path -LiteralPath $builtInManifestPath -PathType Leaf) { (Get-FileHash -LiteralPath $builtInManifestPath -Algorithm SHA256).Hash.ToLowerInvariant() } else { $null }
                }
            }
        }
    }

    $selected = if ($id -in $editorCatalogAuthoritativeIds) {
        @($candidates.Values | Where-Object EditorCatalogMatch | Sort-Object SortVersion -Descending | Select-Object -First 1)
    }
    else {
        @($candidates.Values | Sort-Object SortVersion -Descending | Select-Object -First 1)
    }
    if ($selected.Count -ne 1) {
        $constraint = if ($null -ne $preservedMajor) {
            "major $preservedMajor"
        }
        elseif ($null -ne $minimumSemVer) {
            "minimum $minimumText"
        }
        else {
            'no additional version constraint'
        }
        throw "No stable '$id' version compatible with Unity $projectUnityVersion satisfied $constraint."
    }

    $selectedManifest = $selected[0].Manifest
    $dependencies = Get-PropertyValue -Object $selectedManifest -Name 'dependencies'
    if ($null -eq $dependencies) {
        $dependencies = [pscustomobject]@{}
    }
    $resolvedPackages += [pscustomobject][ordered]@{
        package_id = $id
        version = $selected[0].Version
        source = $selected[0].Source
        editor_catalog_match = [bool]$selected[0].EditorCatalogMatch
        minimum_unity = [string](Get-PropertyValue -Object $selectedManifest -Name 'unity')
        minimum_unity_release = [string](Get-PropertyValue -Object $selectedManifest -Name 'unityRelease')
        dependencies = $dependencies
        registry_url = $registryUri
        tarball = $selected[0].Tarball
        tarball_sha1 = $selected[0].Sha1
        editor_catalog_manifest_sha256 = $selected[0].CatalogManifestSha256
        selection_policy = if ($id -in $editorCatalogAuthoritativeIds) { 'matching-editor-catalog' } else { 'highest-compatible-stable' }
        stable_compatible_candidate_count = $candidates.Count
    }
}

$resolvedById = @{}
foreach ($package in $resolvedPackages) {
    $resolvedById[$package.package_id] = $package
}
foreach ($package in $resolvedPackages) {
    foreach ($dependency in $package.dependencies.PSObject.Properties) {
        if (-not $resolvedById.ContainsKey($dependency.Name)) {
            continue
        }
        $requiredVersion = ConvertTo-StableSemVer -Value ([string]$dependency.Value)
        if ($null -eq $requiredVersion) {
            throw "Selected '$($package.package_id)' declares an unsupported constraint '$($dependency.Name)=$($dependency.Value)'."
        }
        $actualVersion = ConvertTo-StableSemVer -Value ([string]$resolvedById[$dependency.Name].version)
        if ($null -eq $actualVersion -or $actualVersion -lt $requiredVersion) {
            throw "Selected '$($resolvedById[$dependency.Name].package_id)@$($resolvedById[$dependency.Name].version)' does not satisfy '$($package.package_id)' minimum '$($dependency.Name)@$($dependency.Value)'."
        }
    }
}

[pscustomobject][ordered]@{
    status = 'verified-compatible-set'
    cross_package_constraints_verified = $true
    project_root = $resolvedProjectRoot
    unity_version = $projectUnityVersion
    unity_editor_path = $resolvedEditorPath
    editor_catalog = $catalogPath
    packages = $resolvedPackages
} | ConvertTo-Json -Depth 12
