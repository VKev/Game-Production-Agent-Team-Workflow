#Requires -Version 5.1

<#
.SYNOPSIS
    Read-only classification of a Cocos Creator project before any setup mutation.

.DESCRIPTION
    Emits the same JSON contract as the Unity inspector (project / git / checkpoint /
    clients / blockers / recommended_phase) with an `engine` section describing the
    Cocos Creator project and a `cocos_mcp` section describing the embedded
    funplay-cocos-mcp server. Nothing is written, launched, or installed.
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$CheckpointPath,
    [int]$HealthTimeoutMs = 1500
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$schemaVersion = 1
$blockers = New-Object 'System.Collections.Generic.List[string]'

function Normalize-Path([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return '' }
    return ([IO.Path]::GetFullPath($value)).TrimEnd('\', '/')
}

function Get-Sha256OrNull([string]$path) {
    if (-not (Test-Path $path -PathType Leaf)) { return $null }
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
}

function Has-Prop($object, [string]$name) {
    if ($null -eq $object) { return $false }
    $properties = $object.PSObject.Properties
    if ($null -eq $properties) { return $false }
    foreach ($property in $properties) { if ($property.Name -eq $name) { return $true } }
    return $false
}

function Read-JsonFile([string]$path, [string]$label) {
    if (-not (Test-Path $path -PathType Leaf)) { return $null }
    try { return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json) }
    catch { $blockers.Add("unreadable-$label"); return $null }
}

$root = Normalize-Path $ProjectRoot
if (-not (Test-Path $root -PathType Container)) { throw "Project root is missing: $root" }

# --- project identity --------------------------------------------------------
$packageJsonPath = Join-Path $root 'package.json'
$package = Read-JsonFile $packageJsonPath 'package-json'
$creatorVersion = ''
if ($null -ne $package -and (Has-Prop $package 'creator')) {
    if (Has-Prop $package.creator 'version') {
        $creatorVersion = [string]$package.creator.version
    }
}
$assetsDir = Join-Path $root 'assets'
if (-not (Test-Path $assetsDir -PathType Container) -or [string]::IsNullOrWhiteSpace($creatorVersion)) {
    throw "Not a Cocos Creator project root: $root"
}

$projectSettingsPath = Join-Path $root 'settings\v2\packages\project.json'
$builderSettingsPath = Join-Path $root 'settings\v2\packages\builder.json'
$tsconfigPath = Join-Path $root 'tsconfig.json'
$importedMarker = Join-Path $root 'temp\tsconfig.cocos.json'

# Asset bundle contract, read from the authored directory .meta files.
$bundles = New-Object 'System.Collections.Generic.List[object]'
Get-ChildItem -LiteralPath $assetsDir -Filter '*.meta' -File -ErrorAction SilentlyContinue |
    Sort-Object Name |
    ForEach-Object {
        $meta = Read-JsonFile $_.FullName 'asset-meta'
        if ($null -eq $meta) { return }
        if ((-not (Has-Prop $meta 'userData'))) { return }
        $userData = $meta.userData
        if ($null -eq $userData -or (-not (Has-Prop $userData 'isBundle'))) { return }
        if (-not $userData.isBundle) { return }
        $folder = $_.Name.Substring(0, $_.Name.Length - 5)
        $bundleName = $folder
        if ((Has-Prop $userData 'bundleName') -and $userData.bundleName) {
            $bundleName = [string]$userData.bundleName
        }
        $bundles.Add([pscustomobject][ordered]@{ folder = "assets/$folder"; bundle_name = $bundleName })
    }

# --- git ---------------------------------------------------------------------
$gitState = 'missing'; $gitRoot = ''; $gitHead = ''
$stagedPaths = @()
$git = Get-Command git -ErrorAction SilentlyContinue
if ($null -eq $git) {
    $gitState = 'command-missing'
} else {
    try {
        $top = & git -C $root rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and $top) {
            $gitRoot = Normalize-Path $top
            $gitState = if ($gitRoot -eq $root) { 'exact' } else { 'ambiguous-parent' }
            $head = & git -C $root rev-parse --verify HEAD 2>$null
            if ($LASTEXITCODE -eq 0 -and $head) { $gitHead = $head.Trim() }
            $staged = & git -C $root diff --cached --name-only 2>$null
            if ($LASTEXITCODE -eq 0 -and $staged) { $stagedPaths = @($staged -split "`r?`n" | Where-Object { $_ }) }
        }
    } catch { $gitState = 'missing' }
}
if ($gitState -eq 'ambiguous-parent') { $blockers.Add('git-root-outside-project') }
if ($stagedPaths.Count -gt 0) { $blockers.Add('non-empty-staged-index') }

# --- funplay-cocos-mcp -------------------------------------------------------
$mcpConfigPath = Join-Path $root 'funplay-cocos-mcp.config.json'
$mcpConfig = Read-JsonFile $mcpConfigPath 'cocos-mcp-config'
$mcpHost = '127.0.0.1'
$mcpPort = 0
$toolProfile = ''
$safetyChecks = $true
if ($null -ne $mcpConfig) {
    if ((Has-Prop $mcpConfig 'host') -and $mcpConfig.host) { $mcpHost = [string]$mcpConfig.host }
    if ((Has-Prop $mcpConfig 'port') -and $mcpConfig.port) { $mcpPort = [int]$mcpConfig.port }
    if ((Has-Prop $mcpConfig 'toolProfile')) { $toolProfile = [string]$mcpConfig.toolProfile }
    if ((Has-Prop $mcpConfig 'executeJavascriptSafetyChecks')) {
        $safetyChecks = [bool]$mcpConfig.executeJavascriptSafetyChecks
    }
}

$extensionRoots = @()
$extensionsDir = Join-Path $root 'extensions'
if (Test-Path $extensionsDir -PathType Container) {
    $extensionRoots = @(Get-ChildItem -LiteralPath $extensionsDir -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name | ForEach-Object { "extensions/$($_.Name)" })
}
$mcpExtensionPath = ''
foreach ($candidate in $extensionRoots) {
    $packagePath = Join-Path $root ($candidate.Replace('/', '\') + '\package.json')
    $extensionPackage = Read-JsonFile $packagePath 'extension-package'
    if ($null -ne $extensionPackage -and (Has-Prop $extensionPackage 'name')) {
        if ([string]$extensionPackage.name -eq 'funplay-cocos-mcp') {
            $mcpExtensionPath = $candidate
            $mcpExtensionVersion = [string]$extensionPackage.version
            break
        }
    }
}
if (-not $mcpExtensionPath) { $mcpExtensionVersion = '' }

# A reachable health endpoint is the only proof the Cocos Editor is open with the
# extension running. Never launch the editor to make this true.
$mcpReachable = $false
$mcpToolCount = 0
if ($mcpPort -gt 0) {
    try {
        $uri = "http://${mcpHost}:${mcpPort}/health"
        $response = Invoke-WebRequest -Uri $uri -TimeoutSec ([Math]::Max(1, [int][Math]::Ceiling($HealthTimeoutMs / 1000))) -UseBasicParsing -ErrorAction Stop
        $mcpReachable = ($response.StatusCode -eq 200)
    } catch { $mcpReachable = $false }
    if ($mcpReachable) {
        try {
            $tools = Invoke-WebRequest -Uri "http://${mcpHost}:${mcpPort}/tools" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            $parsed = $tools.Content | ConvertFrom-Json
            if ($null -ne $parsed) {
                if ($parsed -is [System.Array]) { $mcpToolCount = $parsed.Count }
                elseif ((Has-Prop $parsed 'tools')) { $mcpToolCount = @($parsed.tools).Count }
            }
        } catch { $mcpToolCount = 0 }
    }
}

# --- checkpoint --------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($CheckpointPath)) {
    $CheckpointPath = Join-Path $root '.agent-temp\setup-checkpoints\setup-agents-cocos.json'
}
$checkpointFullPath = Normalize-Path $CheckpointPath
$checkpoint = Read-JsonFile $checkpointFullPath 'checkpoint'
$checkpointExists = ($null -ne $checkpoint)
$checkpointPhase = ''
$checkpointReasons = New-Object 'System.Collections.Generic.List[string]'
$packageSha = Get-Sha256OrNull $packageJsonPath
$settingsSha = Get-Sha256OrNull $projectSettingsPath
if ($checkpointExists) {
    if ((Has-Prop $checkpoint 'phase')) { $checkpointPhase = [string]$checkpoint.phase }
    if ((Has-Prop $checkpoint 'project_root') -and (Normalize-Path ([string]$checkpoint.project_root)) -ne $root) {
        $checkpointReasons.Add('project-root-changed')
    }
    if ((Has-Prop $checkpoint 'creator_version') -and [string]$checkpoint.creator_version -ne $creatorVersion) {
        $checkpointReasons.Add('creator-version-changed')
    }
    if ((Has-Prop $checkpoint 'package_json_sha256') -and [string]$checkpoint.package_json_sha256 -ne $packageSha) {
        $checkpointReasons.Add('package-json-changed')
    }
}
$checkpointReusable = ($checkpointExists -and $checkpointReasons.Count -eq 0)

# --- client bundles ----------------------------------------------------------
$clients = [pscustomobject][ordered]@{
    codex  = (Test-Path (Join-Path $root '.codex\agents\setup_agents.toml') -PathType Leaf)
    claude = (Test-Path (Join-Path $root '.claude\agents\setup-agents.md') -PathType Leaf)
}

# --- phase routing -----------------------------------------------------------
$editorImported = (Test-Path $importedMarker -PathType Leaf)
$recommendedPhase = 'phase-a'
if ($checkpointReusable -and $checkpointPhase) {
    switch ($checkpointPhase) {
        'phase-a' { $recommendedPhase = if ($mcpReachable) { 'phase-b' } else { 'await-editor-open' } }
        'await-editor-open' { $recommendedPhase = if ($mcpReachable) { 'phase-b' } else { 'await-editor-open' } }
        'pending-client-restart' { $recommendedPhase = if ($mcpReachable) { 'phase-b' } else { 'await-editor-open' } }
        'phase-b' { $recommendedPhase = if ($mcpReachable) { 'phase-b' } else { 'await-editor-open' } }
        'verify-complete' { $recommendedPhase = 'verify-complete' }
        default { $recommendedPhase = 'phase-a' }
    }
}
if ($blockers.Count -gt 0) { $recommendedPhase = 'ambiguous' }

$parallelSafe = ($blockers.Count -eq 0)
$status = if ($blockers.Count -gt 0) { 'blocked' } else { 'ready' }
$mcpConfigReported = if (Test-Path $mcpConfigPath -PathType Leaf) { Normalize-Path $mcpConfigPath } else { '' }
$parallelLanes = @('tool-source-audit', 'cocos-mcp-source-audit', 'project-gate-audit')

$projectInfo = [pscustomobject][ordered]@{
    root                 = $root
    engine               = 'cocos'
    creator_version      = $creatorVersion
    package_json_sha256  = $packageSha
    settings_sha256      = $settingsSha
    has_tsconfig         = (Test-Path $tsconfigPath -PathType Leaf)
    has_builder_settings = (Test-Path $builderSettingsPath -PathType Leaf)
    bundles              = $bundles.ToArray()
    extensions           = @($extensionRoots)
}

$engineInfo = [pscustomobject][ordered]@{
    editor_imported_project = $editorImported
    editor_reachable        = $mcpReachable
}

$cocosMcpInfo = [pscustomobject][ordered]@{
    config_path       = $mcpConfigReported
    extension_path    = $mcpExtensionPath
    extension_version = $mcpExtensionVersion
    host              = $mcpHost
    port              = $mcpPort
    tool_profile      = $toolProfile
    safety_checks     = $safetyChecks
    reachable         = $mcpReachable
    tool_count        = $mcpToolCount
}

$gitInfo = [pscustomobject][ordered]@{
    state        = $gitState
    root         = $gitRoot
    head         = $gitHead
    staged_paths = @($stagedPaths)
}

$checkpointInfo = [pscustomobject][ordered]@{
    path          = $checkpointFullPath
    exists        = $checkpointExists
    phase         = $checkpointPhase
    reusable      = $checkpointReusable
    stale_reasons = $checkpointReasons.ToArray()
}

$result = [pscustomobject][ordered]@{
    schema_version    = $schemaVersion
    status            = $status
    recommended_phase = $recommendedPhase
    project           = $projectInfo
    engine            = $engineInfo
    cocos_mcp         = $cocosMcpInfo
    git               = $gitInfo
    checkpoint        = $checkpointInfo
    clients           = $clients
    parallel_safe     = $parallelSafe
    parallel_lanes    = @($parallelLanes)
    blockers          = [string[]]@($blockers | Select-Object -Unique)
}

$result | ConvertTo-Json -Depth 8
