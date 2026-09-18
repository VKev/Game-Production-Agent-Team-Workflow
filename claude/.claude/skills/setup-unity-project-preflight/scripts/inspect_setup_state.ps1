#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [string]$UnityEditorPath,
    [string]$CheckpointPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$requiredUnityVersion = '6000.3.21f1'

function Normalize-Path {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Same-Path {
    param([string]$Left, [string]$Right)
    if ([string]::IsNullOrWhiteSpace($Left) -or [string]::IsNullOrWhiteSpace($Right)) { return $false }
    return [string]::Equals((Normalize-Path $Left), (Normalize-Path $Right), [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-PropertyValue {
    param($Object, [string[]]$Names)
    if ($null -eq $Object) { return $null }
    foreach ($name in $Names) {
        $property = $Object.PSObject.Properties[$name]
        if ($null -ne $property) { return $property.Value }
    }
    return $null
}

function Get-Sha256OrNull {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
        finally { $sha.Dispose() }
    }
    finally { $stream.Dispose() }
}

function Read-JsonFile {
    param([string]$Path, [string]$Label)
    try {
        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "$Label is not valid JSON: $($_.Exception.Message)"
    }
}

function Resolve-UnityEditorPath {
    param([string]$RequestedPath)
    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        return Normalize-Path $RequestedPath
    }

    $candidates = [System.Collections.Generic.List[string]]::new()
    foreach ($candidate in @(
        $env:UNITY_6000_3_21F1_EDITOR,
        'D:\Apps\Unity\6000.3.21f1\Editor\Unity.exe',
        (Join-Path $env:ProgramFiles 'Unity\Hub\Editor\6000.3.21f1\Editor\Unity.exe')
    )) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and
            (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            $normalized = Normalize-Path $candidate
            if (-not ($candidates | Where-Object { Same-Path $_ $normalized })) {
                $candidates.Add($normalized)
            }
        }
    }

    if ($candidates.Count -eq 0) {
        throw 'Unity 6000.3.21f1 was not found at a registered exact path. Pass -UnityEditorPath or set UNITY_6000_3_21F1_EDITOR.'
    }
    if ($candidates.Count -gt 1) {
        throw "Multiple Unity 6000.3.21f1 candidates were found; pass -UnityEditorPath explicitly: $($candidates -join ', ')"
    }
    return $candidates[0]
}

$root = Normalize-Path $ProjectRoot
$editorPath = Resolve-UnityEditorPath $UnityEditorPath
$projectVersionPath = Join-Path $root 'ProjectSettings\ProjectVersion.txt'
$manifestPath = Join-Path $root 'Packages\manifest.json'
$packageLockPath = Join-Path $root 'Packages\packages-lock.json'

if (-not (Test-Path -LiteralPath (Join-Path $root 'Assets') -PathType Container) -or
    -not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $projectVersionPath -PathType Leaf)) {
    throw "Not a Unity project root: $root"
}
if (-not (Test-Path -LiteralPath $editorPath -PathType Leaf) -or
    [System.IO.Path]::GetFileName($editorPath) -ine 'Unity.exe') {
    throw "UnityEditorPath is not an existing Unity.exe: $editorPath"
}

$versionText = Get-Content -LiteralPath $projectVersionPath -Raw -Encoding UTF8
if ($versionText -notmatch '(?m)^m_EditorVersion:\s*(?<version>\S+)\s*$') {
    throw 'ProjectVersion.txt has no m_EditorVersion.'
}
$projectVersion = [string]$Matches.version
if ($projectVersion -ne $requiredUnityVersion) {
    throw "This portable setup requires Unity $requiredUnityVersion; project declares $projectVersion."
}
$projectRevision = $null
if ($versionText -match '(?m)^m_EditorVersionWithRevision:\s*\S+\s+\((?<revision>[0-9a-fA-F]+)\)\s*$') {
    $projectRevision = [string]$Matches.revision
}
$editorProductVersion = [string](Get-Item -LiteralPath $editorPath).VersionInfo.ProductVersion
if (-not $editorProductVersion.StartsWith("$requiredUnityVersion`_", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unity executable product version '$editorProductVersion' does not match $requiredUnityVersion."
}
if ($null -ne $projectRevision -and -not $editorProductVersion.EndsWith("_$projectRevision", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unity executable revision '$editorProductVersion' does not match project revision '$projectRevision'."
}

$blockers = [System.Collections.Generic.List[string]]::new()
$gitState = 'missing'
$gitRoot = $null
$gitHead = $null
$stagedPaths = @()
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if ($null -eq $gitCommand) {
    $gitState = 'command-missing'
    $blockers.Add('git-command-missing')
}
else {
    $savedErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $gitRootOutput = & $gitCommand.Source -C $root rev-parse --show-toplevel 2>$null
    $gitRootExit = $LASTEXITCODE
    $ErrorActionPreference = $savedErrorPreference
}
if ($null -ne $gitCommand -and $gitRootExit -eq 0) {
    $gitRoot = Normalize-Path ([string]($gitRootOutput | Select-Object -First 1))
    if (-not (Same-Path $gitRoot $root)) {
        $gitState = 'ambiguous-parent'
        $blockers.Add('git-root-does-not-match-project-root')
    }
    else {
        $gitState = 'exact'
        $ErrorActionPreference = 'Continue'
        $headOutput = & $gitCommand.Source -C $root rev-parse --verify HEAD 2>$null
        $headExit = $LASTEXITCODE
        if ($headExit -eq 0) { $gitHead = [string]($headOutput | Select-Object -First 1) }
        $stagedPaths = @(& $gitCommand.Source -C $root diff --cached --name-only -- 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $stagedExit = $LASTEXITCODE
        $ErrorActionPreference = $savedErrorPreference
        if ($stagedExit -ne 0) { $blockers.Add('cannot-read-staged-index') }
        elseif ($stagedPaths.Count -gt 0) { $blockers.Add('staged-index-not-empty') }
    }
}

$lockPath = Join-Path $root 'Temp\UnityLockfile'
$instancePath = Join-Path $root 'Library\EditorInstance.json'
$lockExists = Test-Path -LiteralPath $lockPath
$instanceExists = Test-Path -LiteralPath $instancePath -PathType Leaf
$instancePid = $null
$instanceVersion = $null
$instanceAppPath = $null
$processAlive = $false
$processPathMatches = $false

if ($instanceExists) {
    try {
        $instance = Read-JsonFile $instancePath 'EditorInstance.json'
        $instancePidValue = Get-PropertyValue $instance @('process_id', 'processId', 'editor_pid', 'editorPid')
        if ($null -ne $instancePidValue) { $instancePid = [int]$instancePidValue }
        $instanceVersion = [string](Get-PropertyValue $instance @('version', 'unity_version', 'unityVersion'))
        $instanceAppPath = [string](Get-PropertyValue $instance @('app_path', 'appPath', 'editor_path', 'editorPath'))
        if ($instanceVersion -ne $projectVersion) { $blockers.Add('editor-instance-version-mismatch') }
        if (-not (Same-Path $instanceAppPath $editorPath)) { $blockers.Add('editor-instance-path-mismatch') }
        if ($null -ne $instancePid -and $instancePid -gt 0) {
            $process = Get-Process -Id $instancePid -ErrorAction SilentlyContinue
            if ($null -ne $process) {
                $processAlive = $true
                try { $processPathMatches = Same-Path $process.Path $editorPath } catch { $processPathMatches = $false }
                if (-not $processPathMatches) { $blockers.Add('editor-process-path-mismatch') }
            }
        }
    }
    catch {
        $blockers.Add('editor-instance-invalid')
    }
}

$editorOpen = $lockExists -and $instanceExists -and $processAlive -and $processPathMatches
if ($lockExists -and -not $editorOpen) { $blockers.Add('unity-lock-without-exact-live-editor') }

if ([string]::IsNullOrWhiteSpace($CheckpointPath)) {
    $CheckpointPath = Join-Path $root '.agent-temp\setup-checkpoints\setup-agents.json'
}
$checkpointFullPath = Normalize-Path $CheckpointPath
$checkpointExists = Test-Path -LiteralPath $checkpointFullPath -PathType Leaf
$checkpointPhase = $null
$checkpointReusable = $false
$checkpointReasons = [System.Collections.Generic.List[string]]::new()
if ($checkpointExists) {
    try {
        $checkpoint = Read-JsonFile $checkpointFullPath 'setup checkpoint'
        $checkpointPhase = [string](Get-PropertyValue $checkpoint @('phase', 'status'))
        $savedRoot = [string](Get-PropertyValue $checkpoint @('projectRoot', 'project_root'))
        $savedUnity = [string](Get-PropertyValue $checkpoint @('unityVersion', 'unity_version'))
        $savedManifest = [string](Get-PropertyValue $checkpoint @('manifestAfterZLinqUnitySha256', 'manifestFinalSha256', 'manifest_final_sha256', 'manifestAfterSha256', 'manifest_after_sha256', 'manifestSha256', 'manifest_sha256'))
        $savedPackageLock = [string](Get-PropertyValue $checkpoint @('packageLockAfterZLinqUnitySha256', 'packageLockFinalSha256', 'package_lock_final_sha256', 'packageLockPhaseBSha256', 'package_lock_phase_b_sha256'))
        if (-not (Same-Path $savedRoot $root)) { $checkpointReasons.Add('project-root-mismatch') }
        if ($savedUnity -ne $projectVersion) { $checkpointReasons.Add('unity-version-mismatch') }
        if (-not [string]::IsNullOrWhiteSpace($savedManifest) -and $savedManifest.ToLowerInvariant() -ne (Get-Sha256OrNull $manifestPath)) {
            $checkpointReasons.Add('manifest-hash-mismatch')
        }
        if (-not [string]::IsNullOrWhiteSpace($savedPackageLock) -and $savedPackageLock.ToLowerInvariant() -ne (Get-Sha256OrNull $packageLockPath)) {
            $checkpointReasons.Add('package-lock-hash-mismatch')
        }
        $checkpointReusable = $checkpointReasons.Count -eq 0
        if (-not $checkpointReusable) { $blockers.Add('checkpoint-stale') }
    }
    catch {
        $checkpointReasons.Add('invalid-json')
        $blockers.Add('checkpoint-invalid')
    }
}

$statusDirectory = if ([string]::IsNullOrWhiteSpace($env:UNITY_MCP_STATUS_DIR)) {
    Join-Path ([Environment]::GetFolderPath('UserProfile')) '.unity\mcp\connections'
} else { $env:UNITY_MCP_STATUS_DIR }
$discoveryMatches = 0
if (Test-Path -LiteralPath $statusDirectory -PathType Container) {
    foreach ($file in Get-ChildItem -LiteralPath $statusDirectory -Filter 'bridge-*.json' -File -ErrorAction SilentlyContinue) {
        try {
            $discovery = Read-JsonFile $file.FullName 'Unity MCP discovery file'
            $discoveryRoot = [string](Get-PropertyValue $discovery @('project_path', 'projectPath', 'project_root', 'projectRoot'))
            $discoveryPid = Get-PropertyValue $discovery @('editor_pid', 'editorPid', 'process_id', 'processId')
            if ((Same-Path $discoveryRoot $root) -and ($null -eq $instancePid -or [int]$discoveryPid -eq $instancePid)) {
                $discoveryMatches++
            }
        }
        catch { }
    }
}
if ($discoveryMatches -gt 1) { $blockers.Add('multiple-target-mcp-discovery-records') }

$recommendedPhase = 'phase-a'
if ($blockers.Count -gt 0) {
    $recommendedPhase = 'ambiguous'
}
elseif ($checkpointExists -and $checkpointReusable) {
    switch ($checkpointPhase) {
        { $_ -in @('editor-closed-checkpoint', 'phase-a-complete') } { $recommendedPhase = if ($editorOpen) { 'phase-b' } else { 'await-unity-open' }; break }
        'pending-codex-restart' {
            $recommendedPhase = if (-not $editorOpen) { 'ambiguous' } elseif ($discoveryMatches -eq 1) { 'phase-b' } else { 'pending-codex-restart' }
            break
        }
        'phase-b' { $recommendedPhase = if ($editorOpen) { 'phase-b' } else { 'ambiguous' }; break }
        { $_ -in @('complete', 'completed') } { $recommendedPhase = 'verify-complete'; break }
        default { $recommendedPhase = if ($editorOpen) { 'ambiguous' } else { 'phase-a' } }
    }
}
elseif ($editorOpen) {
    $recommendedPhase = 'ambiguous'
}

$parallelSafe = $recommendedPhase -eq 'phase-a' -and $stagedPaths.Count -eq 0
$parallelLanes = [System.Collections.Generic.List[string]]::new()
if ($parallelSafe) {
    foreach ($lane in @('tool-source-audit', 'unity-package-resolution', 'archive-audit-preparation')) {
        $parallelLanes.Add($lane)
    }
}

$result = [pscustomobject][ordered]@{
    schema_version = 1
    status = if ($recommendedPhase -eq 'ambiguous') { 'blocked' } else { 'ready' }
    recommended_phase = $recommendedPhase
    project = [pscustomobject][ordered]@{
        root = $root
        unity_version = $projectVersion
        unity_revision = $projectRevision
        manifest_sha256 = Get-Sha256OrNull $manifestPath
        package_lock_sha256 = Get-Sha256OrNull $packageLockPath
    }
    editor = [pscustomobject][ordered]@{
        path = $editorPath
        product_version = $editorProductVersion
        lock_exists = $lockExists
        instance_exists = $instanceExists
        process_id = $instancePid
        exact_live_editor = $editorOpen
    }
    git = [pscustomobject][ordered]@{
        state = $gitState
        root = $gitRoot
        head = $gitHead
        staged_paths = $stagedPaths
    }
    checkpoint = [pscustomobject][ordered]@{
        path = $checkpointFullPath
        exists = $checkpointExists
        phase = $checkpointPhase
        reusable = $checkpointReusable
        stale_reasons = @($checkpointReasons)
    }
    clients = [pscustomobject][ordered]@{
        codex = (Test-Path (Join-Path $root '.codex\agents\setup_agents.toml') -PathType Leaf)
        claude = (Test-Path (Join-Path $root '.claude\agents\setup-agents.md') -PathType Leaf)
    }
    unity_mcp = [pscustomobject][ordered]@{
        discovery_directory = Normalize-Path $statusDirectory
        target_discovery_count = $discoveryMatches
        discovery_state = if ($discoveryMatches -eq 1) { 'one-target-record' } elseif ($discoveryMatches -eq 0) { 'missing' } else { 'ambiguous-multiple' }
    }
    parallel_safe = $parallelSafe
    parallel_lanes = $parallelLanes
    blockers = @($blockers | Select-Object -Unique)
}

$result | ConvertTo-Json -Depth 8
