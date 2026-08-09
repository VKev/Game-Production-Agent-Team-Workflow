#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repository = "https://github.com/CoplayDev/unity-mcp"
$repositorySlug = "CoplayDev/unity-mcp"
$ref = "main"
$remoteSubtree = "unity-mcp-skill"
$localSkillName = "dev-unity-mcp"
$upstreamSkillName = "unity-mcp-orchestrator"
$markerName = ".unity-mcp-skill-sync"
$apiHeaders = @{
    Accept = "application/vnd.github+json"
    "User-Agent" = "Agents-Tu-Build-UnityMcpSkillSync/2.0"
}

function Get-NormalizedFullPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
}

function Assert-PathUnderProject {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Root
    )

    $fullPath = Get-NormalizedFullPath -Path $Path
    $fullRoot = Get-NormalizedFullPath -Path $Root
    $separator = [System.IO.Path]::DirectorySeparatorChar
    $comparison = if ($separator -eq '\') {
        [System.StringComparison]::OrdinalIgnoreCase
    }
    else {
        [System.StringComparison]::Ordinal
    }

    if (-not $fullPath.StartsWith($fullRoot + $separator, $comparison)) {
        throw "Refusing path outside project root: $fullPath"
    }

    return $fullPath
}

function Get-GitBlobSha1 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $header = [System.Text.Encoding]::UTF8.GetBytes("blob $($bytes.Length)`0")
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    try {
        [void]$sha1.TransformBlock($header, 0, $header.Length, $null, 0)
        [void]$sha1.TransformFinalBlock($bytes, 0, $bytes.Length)
        return ([System.BitConverter]::ToString($sha1.Hash)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha1.Dispose()
    }
}

function Test-SkillDeclaration {
    param(
        [Parameter(Mandatory = $true)][string]$SkillRoot,
        [Parameter(Mandatory = $true)][string]$ExpectedName
    )

    $skillFile = Join-Path $SkillRoot "SKILL.md"
    if (-not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
        return $false
    }

    $content = Get-Content -LiteralPath $skillFile -Raw
    $escapedName = [regex]::Escape($ExpectedName)
    return $content -match "(?m)^name:\s*$escapedName\s*$"
}

function Convert-ToLocalSkillName {
    param([Parameter(Mandatory = $true)][string]$SkillRoot)

    $skillFile = Join-Path $SkillRoot "SKILL.md"
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    $content = [System.IO.File]::ReadAllText($skillFile, $utf8)
    $pattern = "(?m)^name:\s*$([regex]::Escape($upstreamSkillName))\s*$"
    $matches = [regex]::Matches($content, $pattern)
    if ($matches.Count -ne 1) {
        throw "Downloaded SKILL.md must declare exactly one '$upstreamSkillName' name field."
    }

    $converted = [regex]::Replace($content, $pattern, "name: $localSkillName", 1)
    [System.IO.File]::WriteAllText($skillFile, $converted, $utf8)
}

function Get-LocalFiles {
    param([Parameter(Mandatory = $true)][string]$SkillRoot)

    $files = @{}
    if (-not (Test-Path -LiteralPath $SkillRoot -PathType Container)) {
        return $files
    }

    $root = Get-NormalizedFullPath -Path $SkillRoot
    foreach ($file in Get-ChildItem -LiteralPath $root -File -Recurse) {
        $relative = $file.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
        if ($relative -eq $markerName) {
            continue
        }
        $files[$relative] = $file.FullName
    }
    return $files
}

function Test-FileMapsMatch {
    param(
        [Parameter(Mandatory = $true)][hashtable]$ActualFiles,
        [Parameter(Mandatory = $true)][hashtable]$ExpectedFiles
    )

    if ($ActualFiles.Count -ne $ExpectedFiles.Count) {
        return $false
    }

    foreach ($relative in $ExpectedFiles.Keys) {
        if (-not $ActualFiles.ContainsKey($relative)) {
            return $false
        }
        if ((Get-GitBlobSha1 -Path $ActualFiles[$relative]) -ne
            (Get-GitBlobSha1 -Path $ExpectedFiles[$relative])) {
            return $false
        }
    }
    return $true
}

function Get-FileHashes {
    param([Parameter(Mandatory = $true)][hashtable]$Files)

    $hashes = @{}
    foreach ($relative in $Files.Keys) {
        $hashes[$relative] = Get-GitBlobSha1 -Path $Files[$relative]
    }
    return $hashes
}

function Test-FilesMatchHashes {
    param(
        [Parameter(Mandatory = $true)][hashtable]$ActualFiles,
        [Parameter(Mandatory = $true)][hashtable]$ExpectedHashes
    )

    if ($ActualFiles.Count -ne $ExpectedHashes.Count) {
        return $false
    }

    foreach ($relative in $ExpectedHashes.Keys) {
        if (-not $ActualFiles.ContainsKey($relative) -or
            (Get-GitBlobSha1 -Path $ActualFiles[$relative]) -ne $ExpectedHashes[$relative]) {
            return $false
        }
    }
    return $true
}

function Test-FilesMatchRemote {
    param(
        [Parameter(Mandatory = $true)][hashtable]$ActualFiles,
        [Parameter(Mandatory = $true)][hashtable]$RemoteFiles
    )

    if ($ActualFiles.Count -ne $RemoteFiles.Count) {
        return $false
    }

    foreach ($relative in $RemoteFiles.Keys) {
        if (-not $ActualFiles.ContainsKey($relative) -or
            (Get-GitBlobSha1 -Path $ActualFiles[$relative]) -ne $RemoteFiles[$relative]) {
            return $false
        }
    }
    return $true
}

function Test-ManagedMarker {
    param([Parameter(Mandatory = $true)][string]$SkillRoot)

    $markerPath = Join-Path $SkillRoot $markerName
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        return $false
    }

    try {
        $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
        $knownOwner = [string]$marker.managed_by -in @("setup-unity-mcp", "unity-mcp-project-setup")
        return $knownOwner -and
            [string]$marker.repository -eq $repository -and
            [string]$marker.subtree -eq $remoteSubtree
    }
    catch {
        return $false
    }
}

function Write-SyncResult {
    param([Parameter(Mandatory = $true)][hashtable]$Result)
    $Result | ConvertTo-Json -Depth 4 -Compress
}

$resolvedProjectRoot = Get-NormalizedFullPath -Path $ProjectRoot
if (-not (Test-Path -LiteralPath $resolvedProjectRoot -PathType Container)) {
    throw "Project root does not exist: $resolvedProjectRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $resolvedProjectRoot "Packages/manifest.json") -PathType Leaf)) {
    throw "Not a Unity project: Packages/manifest.json is missing."
}

$targetRoot = Assert-PathUnderProject -Path (Join-Path $resolvedProjectRoot ".agents/skills/$localSkillName") -Root $resolvedProjectRoot
$legacyRoot = Assert-PathUnderProject -Path (Join-Path $resolvedProjectRoot ".agents/skills/unity-mcp-skill") -Root $resolvedProjectRoot
$markerPath = Join-Path $targetRoot $markerName
$hadValidLocalSkill = Test-SkillDeclaration -SkillRoot $targetRoot -ExpectedName $localSkillName
$hadValidLegacySkill = Test-SkillDeclaration -SkillRoot $legacyRoot -ExpectedName $upstreamSkillName

try {
    $branch = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$repositorySlug/branches/$ref" `
        -Headers $apiHeaders `
        -TimeoutSec 30
    $commitSha = [string]$branch.commit.sha
    if ($commitSha -notmatch '^[0-9a-f]{40}$') {
        throw "GitHub returned an invalid commit SHA."
    }

    $treeResponse = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$repositorySlug/git/trees/$commitSha`?recursive=1" `
        -Headers $apiHeaders `
        -TimeoutSec 30
    if ($treeResponse.truncated) {
        throw "GitHub returned a truncated tree; sync was aborted."
    }

    $subtreeEntry = $treeResponse.tree |
        Where-Object { $_.path -eq $remoteSubtree -and $_.type -eq "tree" } |
        Select-Object -First 1
    if ($null -eq $subtreeEntry -or [string]$subtreeEntry.sha -notmatch '^[0-9a-f]{40}$') {
        throw "Official unity-mcp-skill subtree was not found."
    }

    $remoteFiles = @{}
    $prefix = "$remoteSubtree/"
    foreach ($entry in $treeResponse.tree) {
        if ($entry.type -ne "blob" -or -not ([string]$entry.path).StartsWith($prefix)) {
            continue
        }
        $relative = ([string]$entry.path).Substring($prefix.Length)
        if ([string]::IsNullOrWhiteSpace($relative) -or $relative -match '(^|/)\.\.(/|$)') {
            throw "Unsafe remote skill path: $relative"
        }
        if ([string]$entry.sha -notmatch '^[0-9a-f]{40}$') {
            throw "Invalid Git blob SHA for: $relative"
        }
        $remoteFiles[$relative] = ([string]$entry.sha).ToLowerInvariant()
    }
    if (-not $remoteFiles.ContainsKey("SKILL.md") -or $remoteFiles.Count -eq 0) {
        throw "Official skill snapshot is incomplete."
    }
}
catch {
    if ($hadValidLocalSkill -or $hadValidLegacySkill) {
        Write-SyncResult -Result @{
            status = "update-unverified"
            target = if ($hadValidLocalSkill) { $targetRoot } else { $legacyRoot }
            desired_target = $targetRoot
            repository = $repository
            ref = $ref
            error = $_.Exception.Message
        }
        exit 0
    }
    throw
}

$tempParent = Assert-PathUnderProject -Path (Join-Path $resolvedProjectRoot ".agent-temp") -Root $resolvedProjectRoot
$tempRoot = Assert-PathUnderProject -Path (Join-Path $tempParent ("unity-mcp-skill-sync-" + [guid]::NewGuid().ToString("N"))) -Root $resolvedProjectRoot
$stageRoot = Assert-PathUnderProject -Path (Join-Path $tempRoot "staged") -Root $resolvedProjectRoot
$backupRoot = Assert-PathUnderProject -Path (Join-Path $tempRoot "previous") -Root $resolvedProjectRoot
$legacyBackupRoot = Assert-PathUnderProject -Path (Join-Path $tempRoot "legacy-previous") -Root $resolvedProjectRoot
$targetWasPresent = Test-Path -LiteralPath $targetRoot -PathType Container
$legacyWasPresent = Test-Path -LiteralPath $legacyRoot -PathType Container
$stageWasInstalled = $false
$legacyWasMoved = $false
$fallbackToExistingSkillAllowed = $true

try {
    $null = New-Item -ItemType Directory -Path $stageRoot -Force
    foreach ($relative in ($remoteFiles.Keys | Sort-Object)) {
        $destination = Assert-PathUnderProject -Path (Join-Path $stageRoot $relative) -Root $resolvedProjectRoot
        $destinationParent = Split-Path -Parent $destination
        $null = New-Item -ItemType Directory -Path $destinationParent -Force

        $remotePath = "$remoteSubtree/$relative"
        $encodedPath = (($remotePath -split '/') | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join '/'
        $rawUrl = "https://raw.githubusercontent.com/$repositorySlug/$commitSha/$encodedPath"
        Invoke-WebRequest -UseBasicParsing -Uri $rawUrl -Headers $apiHeaders -OutFile $destination -TimeoutSec 60

        if ((Get-GitBlobSha1 -Path $destination) -ne $remoteFiles[$relative]) {
            throw "Downloaded file hash mismatch: $relative"
        }
    }

    if (-not (Test-SkillDeclaration -SkillRoot $stageRoot -ExpectedName $upstreamSkillName)) {
        throw "Downloaded SKILL.md does not declare $upstreamSkillName."
    }
    Convert-ToLocalSkillName -SkillRoot $stageRoot
    if (-not (Test-SkillDeclaration -SkillRoot $stageRoot -ExpectedName $localSkillName)) {
        throw "Local Unity MCP skill-name overlay failed."
    }

    $expectedFiles = Get-LocalFiles -SkillRoot $stageRoot
    $expectedHashes = Get-FileHashes -Files $expectedFiles
    $localFiles = Get-LocalFiles -SkillRoot $targetRoot

    if ($targetWasPresent -and -not (Test-ManagedMarker -SkillRoot $targetRoot)) {
        if (-not $hadValidLocalSkill) {
            $fallbackToExistingSkillAllowed = $false
            throw "Target skill folder exists but does not declare '$localSkillName': $targetRoot"
        }
        foreach ($relative in $localFiles.Keys) {
            if (-not $expectedFiles.ContainsKey($relative)) {
                $fallbackToExistingSkillAllowed = $false
                throw "Target skill folder contains unmanaged file: $relative"
            }
        }
    }

    if ($legacyWasPresent) {
        $legacyFiles = Get-LocalFiles -SkillRoot $legacyRoot
        $legacyIsManaged = Test-ManagedMarker -SkillRoot $legacyRoot
        $legacyIsExactSnapshot = $hadValidLegacySkill -and (Test-FilesMatchRemote -ActualFiles $legacyFiles -RemoteFiles $remoteFiles)
        if (-not $legacyIsManaged -and -not $legacyIsExactSnapshot) {
            $fallbackToExistingSkillAllowed = $false
            throw "Legacy Unity MCP skill folder is unmanaged; refusing automatic removal: $legacyRoot"
        }
        if ($legacyIsManaged -and -not $hadValidLegacySkill) {
            $fallbackToExistingSkillAllowed = $false
            throw "Managed legacy Unity MCP skill has an unexpected declaration: $legacyRoot"
        }
    }

    $isCurrent = Test-FileMapsMatch -ActualFiles $localFiles -ExpectedFiles $expectedFiles
    $marker = [ordered]@{
        managed_by = "setup-unity-mcp"
        repository = $repository
        ref = $ref
        commit = $commitSha
        subtree = $remoteSubtree
        subtree_sha = ([string]$subtreeEntry.sha).ToLowerInvariant()
        local_name = $localSkillName
        upstream_name = $upstreamSkillName
    }

    if ($isCurrent) {
        $status = if ($legacyWasPresent) {
            "migrated"
        }
        elseif (Test-Path -LiteralPath $markerPath -PathType Leaf) {
            "current"
        }
        else {
            "adopted"
        }

        if (-not (Test-ManagedMarker -SkillRoot $targetRoot)) {
            $marker | ConvertTo-Json | Set-Content -LiteralPath $markerPath -Encoding UTF8
        }
        if ($legacyWasPresent) {
            Move-Item -LiteralPath $legacyRoot -Destination $legacyBackupRoot
            $legacyWasMoved = $true
        }

        Write-SyncResult -Result @{
            status = $status
            target = $targetRoot
            repository = $repository
            ref = $ref
            commit = $commitSha
            subtree_sha = $marker.subtree_sha
            files = $expectedFiles.Count
            legacy_removed = $legacyWasPresent
        }
        exit 0
    }

    $marker | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stageRoot $markerName) -Encoding UTF8

    $targetParent = Split-Path -Parent $targetRoot
    $null = New-Item -ItemType Directory -Path $targetParent -Force
    if ($targetWasPresent) {
        Move-Item -LiteralPath $targetRoot -Destination $backupRoot
    }

    try {
        Move-Item -LiteralPath $stageRoot -Destination $targetRoot
        $stageWasInstalled = $true
        if ($legacyWasPresent) {
            Move-Item -LiteralPath $legacyRoot -Destination $legacyBackupRoot
            $legacyWasMoved = $true
        }
    }
    catch {
        if ($legacyWasMoved -and -not (Test-Path -LiteralPath $legacyRoot)) {
            Move-Item -LiteralPath $legacyBackupRoot -Destination $legacyRoot
            $legacyWasMoved = $false
        }
        if ($targetWasPresent -and
            (Test-Path -LiteralPath $backupRoot -PathType Container) -and
            -not (Test-Path -LiteralPath $targetRoot)) {
            Move-Item -LiteralPath $backupRoot -Destination $targetRoot
        }
        throw
    }

    if (-not (Test-SkillDeclaration -SkillRoot $targetRoot -ExpectedName $localSkillName) -or
        -not (Test-ManagedMarker -SkillRoot $targetRoot)) {
        throw "Installed Unity MCP skill failed post-swap validation."
    }

    $installedFiles = Get-LocalFiles -SkillRoot $targetRoot
    if (-not (Test-FilesMatchHashes -ActualFiles $installedFiles -ExpectedHashes $expectedHashes)) {
        throw "Installed Unity MCP skill does not match the transformed official snapshot."
    }

    Write-SyncResult -Result @{
        status = if ($legacyWasPresent) { "migrated" } elseif ($targetWasPresent) { "updated" } else { "created" }
        target = $targetRoot
        repository = $repository
        ref = $ref
        commit = $commitSha
        subtree_sha = $marker.subtree_sha
        files = $expectedFiles.Count
        legacy_removed = $legacyWasPresent
    }
    exit 0
}
catch {
    if ($legacyWasMoved -and (Test-Path -LiteralPath $legacyBackupRoot -PathType Container) -and
        -not (Test-Path -LiteralPath $legacyRoot)) {
        Move-Item -LiteralPath $legacyBackupRoot -Destination $legacyRoot
        $legacyWasMoved = $false
    }
    if ($stageWasInstalled -and (Test-Path -LiteralPath $targetRoot -PathType Container)) {
        $validatedTarget = Assert-PathUnderProject -Path $targetRoot -Root $resolvedProjectRoot
        Remove-Item -LiteralPath $validatedTarget -Recurse -Force
    }
    if ((Test-Path -LiteralPath $backupRoot -PathType Container) -and
        -not (Test-Path -LiteralPath $targetRoot)) {
        Move-Item -LiteralPath $backupRoot -Destination $targetRoot
    }

    if ($fallbackToExistingSkillAllowed -and $hadValidLocalSkill -and
        (Test-SkillDeclaration -SkillRoot $targetRoot -ExpectedName $localSkillName)) {
        Write-SyncResult -Result @{
            status = "update-unverified"
            target = $targetRoot
            repository = $repository
            ref = $ref
            commit = $commitSha
            error = $_.Exception.Message
        }
        exit 0
    }
    throw
}
finally {
    if (Test-Path -LiteralPath $tempRoot -PathType Container) {
        $validatedTemp = Assert-PathUnderProject -Path $tempRoot -Root $resolvedProjectRoot
        Remove-Item -LiteralPath $validatedTemp -Recurse -Force
    }
}
