#Requires -Version 5.1

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositorySlug = "CoplayDev/unity-mcp"
$ref = "main"
$sourcePaths = @(
    "MCPForUnity/package.json",
    "MCPForUnity/Editor/Windows/MCPForUnityEditorWindow.cs",
    "MCPForUnity/Editor/Setup/RoslynInstaller.cs"
)
$apiHeaders = @{
    Accept = "application/vnd.github+json"
    "User-Agent" = "Agents-Tu-Build-UnityMcpDependencySpec/1.0"
}

function Get-GitBlobSha1 {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)

    $header = [System.Text.Encoding]::UTF8.GetBytes("blob $($Bytes.Length)`0")
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    try {
        [void]$sha1.TransformBlock($header, 0, $header.Length, $null, 0)
        [void]$sha1.TransformFinalBlock($Bytes, 0, $Bytes.Length)
        return ([System.BitConverter]::ToString($sha1.Hash)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha1.Dispose()
    }
}

function Get-VerifiedGitHubRawFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedSha,
        [Parameter(Mandatory = $true)][string]$CommitSha
    )

    $encodedPath = (($Path -split "/") | ForEach-Object {
        [System.Uri]::EscapeDataString($_)
    }) -join "/"
    $rawUri = "https://raw.githubusercontent.com/$repositorySlug/$CommitSha/$encodedPath"
    $temporaryFile = [System.IO.Path]::GetTempFileName()
    try {
        Invoke-WebRequest `
            -UseBasicParsing `
            -Headers $apiHeaders `
            -Uri $rawUri `
            -OutFile $temporaryFile `
            -TimeoutSec 60
        $bytes = [System.IO.File]::ReadAllBytes($temporaryFile)
        $actualSha = Get-GitBlobSha1 -Bytes $bytes
        if ($actualSha -ne $ExpectedSha.ToLowerInvariant()) {
            throw "Git blob verification failed for '$Path'. Expected $ExpectedSha, received $actualSha."
        }

        return [System.Text.Encoding]::UTF8.GetString($bytes)
    }
    finally {
        if (Test-Path -LiteralPath $temporaryFile -PathType Leaf) {
            [System.IO.File]::Delete($temporaryFile)
        }
    }
}

$branchUri = "https://api.github.com/repos/$repositorySlug/branches/$ref"
$branch = Invoke-RestMethod -Headers $apiHeaders -Uri $branchUri -TimeoutSec 30
$commitSha = [string]$branch.commit.sha
$treeSha = [string]$branch.commit.commit.tree.sha
if ($commitSha -notmatch "^[0-9a-f]{40}$" -or $treeSha -notmatch "^[0-9a-f]{40}$") {
    throw "GitHub returned an invalid commit or tree SHA for $repositorySlug@$ref."
}

$treeUri = "https://api.github.com/repos/$repositorySlug/git/trees/$treeSha`?recursive=1"
$tree = Invoke-RestMethod -Headers $apiHeaders -Uri $treeUri -TimeoutSec 30
if ($tree.truncated) {
    throw "GitHub returned a truncated tree for $repositorySlug@$commitSha."
}

$sourceFiles = [ordered]@{}
$sourceTexts = @{}
foreach ($path in $sourcePaths) {
    $matches = @($tree.tree | Where-Object { $_.type -eq "blob" -and $_.path -eq $path })
    if ($matches.Count -ne 1) {
        throw "Expected exactly one upstream blob for '$path'; found $($matches.Count)."
    }

    $blobSha = [string]$matches[0].sha
    $sourceTexts[$path] = Get-VerifiedGitHubRawFile `
        -Path $path `
        -ExpectedSha $blobSha `
        -CommitSha $commitSha
    $sourceFiles[$path] = $blobSha
}

$packageManifest = $sourceTexts["MCPForUnity/package.json"] | ConvertFrom-Json
$mcpPackageVersion = [string]$packageManifest.version
if ($mcpPackageVersion -notmatch "^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$") {
    throw "The upstream MCP package version is missing or invalid: '$mcpPackageVersion'."
}

$windowSource = $sourceTexts["MCPForUnity/Editor/Windows/MCPForUnityEditorWindow.cs"]
$upmArrayPattern = "(?s)var\s+upmPackages\s*=\s*new\s*\[\s*\]\s*\{(?<body>.*?)\}\s*;"
$upmArrayMatches = [regex]::Matches($windowSource, $upmArrayPattern)
if ($upmArrayMatches.Count -ne 1) {
    throw "Could not identify exactly one official upmPackages array in MCPForUnityEditorWindow.cs."
}

$upmBody = $upmArrayMatches[0].Groups["body"].Value
$upmStringPattern = '"(?<id>com\.unity\.[a-z0-9][a-z0-9._-]*)"'
$upmMatches = [regex]::Matches($upmBody, $upmStringPattern)
$upmRemainder = [regex]::Replace($upmBody, $upmStringPattern, "") -replace "[\s,]", ""
if ($upmMatches.Count -eq 0 -or $upmRemainder.Length -ne 0) {
    throw "The official UPM dependency declaration changed shape or contains an untrusted package id."
}

$upmPackages = @($upmMatches | ForEach-Object { $_.Groups["id"].Value })
if (@($upmPackages | Sort-Object -Unique).Count -ne $upmPackages.Count) {
    throw "The official UPM dependency declaration contains a duplicate package id."
}

$roslynSource = $sourceTexts["MCPForUnity/Editor/Setup/RoslynInstaller.cs"]
$nugetArrayPattern = "(?s)NuGetEntries\s*=\s*\{(?<body>.*?)\}\s*;"
$nugetArrayMatches = [regex]::Matches($roslynSource, $nugetArrayPattern)
if ($nugetArrayMatches.Count -ne 1) {
    throw "Could not identify exactly one official NuGetEntries array in RoslynInstaller.cs."
}

$nugetBody = $nugetArrayMatches[0].Groups["body"].Value
$nugetTuplePattern = '\(\s*"(?<id>[a-z0-9.]+)"\s*,\s*"(?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)"\s*,\s*"(?<dllPath>[A-Za-z0-9._/-]+)"\s*,\s*"(?<dllName>[A-Za-z0-9._-]+\.dll)"\s*\)'
$nugetMatches = [regex]::Matches($nugetBody, $nugetTuplePattern)
$nugetRemainder = [regex]::Replace($nugetBody, "//[^\r\n]*", "")
$nugetRemainder = [regex]::Replace($nugetRemainder, $nugetTuplePattern, "") -replace "[\s,]", ""
if ($nugetMatches.Count -eq 0 -or $nugetRemainder.Length -ne 0) {
    throw "The official Roslyn dependency declaration changed shape or contains an unsupported entry."
}

$roslynPackages = @()
foreach ($match in $nugetMatches) {
    $id = $match.Groups["id"].Value
    $version = $match.Groups["version"].Value
    $dllPath = $match.Groups["dllPath"].Value
    $dllName = $match.Groups["dllName"].Value

    if ($id -notmatch "^(microsoft\.codeanalysis\.|system\.)" -or
        -not $dllPath.StartsWith("lib/", [System.StringComparison]::Ordinal) -or
        $dllPath.Contains("..") -or
        -not $dllPath.EndsWith("/$dllName", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Rejected unsupported Roslyn dependency entry '$id'."
    }

    $roslynPackages += [pscustomobject][ordered]@{
        id = $id
        version = $version
        dll_path = $dllPath
        dll_name = $dllName
    }
}

if (@($roslynPackages.id | Sort-Object -Unique).Count -ne $roslynPackages.Count) {
    throw "The official Roslyn dependency declaration contains a duplicate package id."
}

$result = [pscustomobject][ordered]@{
    repository = "https://github.com/$repositorySlug"
    ref = $ref
    commit = $commitSha
    mcp_package_version = $mcpPackageVersion
    upm_install_mode = "unversioned-latest-compatible"
    upm_packages = $upmPackages
    roslyn_install_mode = "upstream-pinned"
    roslyn_packages = $roslynPackages
    source_files = $sourceFiles
}

$result | ConvertTo-Json -Depth 6
