#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter(Mandatory = $true)]
    [string]$UnityEditorPath,

    [ValidateRange(60, 3600)]
    [int]$TimeoutSec = 1800
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FileSha256OrNull {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Get-PropertyValue {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $Object) {
        return $null
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }
    return $property.Value
}

function Get-NativeGraphNeedsResolution {
    param(
        [Parameter(Mandatory = $true)]$Manifest,
        $Lock
    )

    $manifestDependencies = Get-PropertyValue -Object $Manifest -Name 'dependencies'
    $lockDependencies = Get-PropertyValue -Object $Lock -Name 'dependencies'
    foreach ($id in @('com.unity.burst', 'com.unity.collections')) {
        $declared = [string](Get-PropertyValue -Object $manifestDependencies -Name $id)
        if ([string]::IsNullOrWhiteSpace($declared)) {
            continue
        }
        if ($declared -notmatch '^\d+\.\d+\.\d+$') {
            return $true
        }
        $locked = Get-PropertyValue -Object $lockDependencies -Name $id
        $lockedVersion = [string](Get-PropertyValue -Object $locked -Name 'version')
        if ($lockedVersion -ne $declared) {
            return $true
        }
    }
    return $false
}

function Invoke-UnityPass {
    param(
        [Parameter(Mandatory = $true)][int]$Pass,
        [Parameter(Mandatory = $true)][string]$LogPath
    )

    $arguments = @(
        '-batchmode',
        '-quit',
        '-projectPath', "`"$resolvedProjectRoot`"",
        '-logFile', "`"$LogPath`""
    )
    $process = Start-Process `
        -FilePath $resolvedEditorPath `
        -ArgumentList $arguments `
        -PassThru `
        -WindowStyle Hidden

    if (-not $process.WaitForExit($TimeoutSec * 1000)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        throw "Unity package stabilization pass $Pass exceeded ${TimeoutSec}s. See $LogPath"
    }
    if (-not (Test-Path -LiteralPath $LogPath -PathType Leaf)) {
        throw "Unity package stabilization pass $Pass produced no log: $LogPath"
    }

    $hardFailure = Select-String -LiteralPath $LogPath -Pattern @(
        'Failed to resolve packages',
        'No valid Unity Editor license',
        'Licensing Client.*failed'
    ) -CaseSensitive:$false | Select-Object -First 1
    if ($null -ne $hardFailure) {
        throw "Unity package stabilization pass $Pass logged a blocking package/license failure at line $($hardFailure.LineNumber). See $LogPath"
    }

    $nativeRestartEvidence = Select-String -LiteralPath $LogPath -Pattern @(
        'Burst failed to compile',
        'Burst.*restart',
        'TypeInitializationException.*Burst'
    ) -CaseSensitive:$false | Select-Object -First 1
    if ($null -eq $nativeRestartEvidence) {
        $targetInvocation = Select-String -LiteralPath $LogPath -Pattern 'System\.Reflection\.TargetInvocationException' -CaseSensitive:$false |
            Select-Object -First 1
        $burstMention = Select-String -LiteralPath $LogPath -Pattern 'Unity\.Burst|com\.unity\.burst' -CaseSensitive:$false |
            Select-Object -First 1
        if ($null -ne $targetInvocation -and $null -ne $burstMention) {
            $nativeRestartEvidence = $targetInvocation
        }
    }
    $compileFailure = Select-String -LiteralPath $LogPath -Pattern @(
        'Aborting batchmode due to failure',
        'Scripts have compiler errors',
        'error CS\d{4}'
    ) -CaseSensitive:$false | Select-Object -First 1

    if ($Pass -gt 1 -and ($process.ExitCode -ne 0 -or $null -ne $nativeRestartEvidence -or $null -ne $compileFailure)) {
        throw "Unity verification pass $Pass was not clean. See $LogPath"
    }
    if ($Pass -eq 1 -and $null -ne $compileFailure -and $null -eq $nativeRestartEvidence) {
        throw "Unity package stabilization pass 1 logged a non-native compiler failure at line $($compileFailure.LineNumber). See $LogPath"
    }
    if ($Pass -eq 1 -and $process.ExitCode -ne 0 -and $null -eq $nativeRestartEvidence) {
        throw "Unity package stabilization pass 1 exited with code $($process.ExitCode) without a recognized native-package restart signature. See $LogPath"
    }
    $reportedRestartEvidence = $null -ne $nativeRestartEvidence
    if ($reportedRestartEvidence -and $Pass -gt 1) {
        throw "Unity package stabilization pass $Pass still reports a native-package restart condition. See $LogPath"
    }

    $unexpectedFatal = Select-String -LiteralPath $LogPath -Pattern @(
        'Fatal Error!',
        'Crash!!!'
    )
    $unexpectedFatal = $unexpectedFatal | Select-Object -First 1
    if ($null -ne $unexpectedFatal) {
        throw "Unity package stabilization pass $Pass logged a fatal process failure at line $($unexpectedFatal.LineNumber). See $LogPath"
    }

    return [pscustomobject][ordered]@{
        pass = $Pass
        exit_code = $process.ExitCode
        native_restart_evidence = $reportedRestartEvidence
        log_path = $LogPath
        log_sha256 = Get-FileSha256OrNull -Path $LogPath
    }
}

$resolvedProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$resolvedEditorPath = [System.IO.Path]::GetFullPath($UnityEditorPath)
if ($resolvedProjectRoot.Contains('"') -or $resolvedEditorPath.Contains('"')) {
    throw 'ProjectRoot and UnityEditorPath must not contain a double quote.'
}
if (-not (Test-Path -LiteralPath $resolvedProjectRoot -PathType Container)) {
    throw "Project root does not exist: $resolvedProjectRoot"
}
if (-not (Test-Path -LiteralPath $resolvedEditorPath -PathType Leaf) -or
    [System.IO.Path]::GetFileName($resolvedEditorPath) -ne 'Unity.exe') {
    throw "UnityEditorPath must name an existing Unity.exe: $resolvedEditorPath"
}

$manifestPath = Join-Path $resolvedProjectRoot 'Packages\manifest.json'
$lockPath = Join-Path $resolvedProjectRoot 'Packages\packages-lock.json'
$projectVersionPath = Join-Path $resolvedProjectRoot 'ProjectSettings\ProjectVersion.txt'
$unityLockPath = Join-Path $resolvedProjectRoot 'Temp\UnityLockfile'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $projectVersionPath -PathType Leaf)) {
    throw 'The target is not a Unity project with manifest.json and ProjectVersion.txt.'
}
if (Test-Path -LiteralPath $unityLockPath) {
    throw "The target project appears open in Unity: $unityLockPath"
}

$projectVersionText = Get-Content -LiteralPath $projectVersionPath -Raw
if ($projectVersionText -notmatch '(?m)^m_EditorVersion:\s*(?<version>\d+\.\d+\.\d+[abfp]\d+)\s*$') {
    throw 'ProjectVersion.txt does not contain one supported m_EditorVersion value.'
}
$projectUnityVersion = $Matches.version
$editorProductVersion = [string](Get-Item -LiteralPath $resolvedEditorPath).VersionInfo.ProductVersion
if (-not $editorProductVersion.StartsWith("$projectUnityVersion`_", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unity executable version '$editorProductVersion' does not match project version '$projectUnityVersion'."
}

try {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
}
catch {
    throw "Packages/manifest.json is invalid JSON: $($_.Exception.Message)"
}
$lockBefore = if (Test-Path -LiteralPath $lockPath -PathType Leaf) {
    try {
        Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    }
    catch {
        throw "Packages/packages-lock.json is invalid JSON before stabilization: $($_.Exception.Message)"
    }
}
else {
    $null
}
$nativeGraphWasStale = Get-NativeGraphNeedsResolution -Manifest $manifest -Lock $lockBefore
$lockHashBefore = Get-FileSha256OrNull -Path $lockPath
$manifestHashBefore = Get-FileSha256OrNull -Path $manifestPath

$checkpointDirectory = Join-Path $resolvedProjectRoot '.agent-temp\setup-checkpoints'
$checkpointPath = Join-Path $checkpointDirectory 'unity-package-stabilization.json'
$scriptAssembliesPath = Join-Path $resolvedProjectRoot 'Library\ScriptAssemblies'
if (Test-Path -LiteralPath $checkpointPath -PathType Leaf) {
    try {
        $checkpoint = Get-Content -LiteralPath $checkpointPath -Raw | ConvertFrom-Json
    }
    catch {
        $checkpoint = $null
    }
    if ($null -ne $checkpoint -and
        [string](Get-PropertyValue -Object $checkpoint -Name 'status') -eq 'stable-editor-closed-package-graph' -and
        [string](Get-PropertyValue -Object $checkpoint -Name 'unity_version') -eq $projectUnityVersion -and
        [string](Get-PropertyValue -Object $checkpoint -Name 'unity_editor_path') -eq $resolvedEditorPath -and
        [string](Get-PropertyValue -Object $checkpoint -Name 'manifest_sha256') -eq $manifestHashBefore -and
        [string](Get-PropertyValue -Object $checkpoint -Name 'package_lock_sha256_after') -eq $lockHashBefore -and
        -not $nativeGraphWasStale -and
        (Test-Path -LiteralPath $scriptAssembliesPath -PathType Container)) {
        [pscustomobject][ordered]@{
            status = 'stable-editor-closed-package-graph'
            reused_checkpoint = $true
            project_root = $resolvedProjectRoot
            unity_version = $projectUnityVersion
            unity_editor_path = $resolvedEditorPath
            manifest_sha256 = $manifestHashBefore
            package_lock_sha256_before = $lockHashBefore
            package_lock_sha256_after = $lockHashBefore
            native_graph_was_stale = $false
            verification_pass_required = $false
            pass_count = 0
            checkpoint_path = $checkpointPath
            passes = @()
        } | ConvertTo-Json -Depth 6
        return
    }
}

$logDirectory = Join-Path $resolvedProjectRoot '.agent-temp\setup-logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$passes = @()
$passes += Invoke-UnityPass -Pass 1 -LogPath (Join-Path $logDirectory "unity-package-stabilize-$runId-pass1.log")

if (Test-Path -LiteralPath $unityLockPath) {
    throw "Unity left its project lock after stabilization pass 1: $unityLockPath"
}
$lockHashAfterFirst = Get-FileSha256OrNull -Path $lockPath
$verificationRequired = $nativeGraphWasStale -or
    ($lockHashBefore -ne $lockHashAfterFirst) -or
    [bool]$passes[0].native_restart_evidence

if ($verificationRequired) {
    $passes += Invoke-UnityPass -Pass 2 -LogPath (Join-Path $logDirectory "unity-package-stabilize-$runId-pass2.log")
    if (Test-Path -LiteralPath $unityLockPath) {
        throw "Unity left its project lock after stabilization pass 2: $unityLockPath"
    }
    $lockHashAfterSecond = Get-FileSha256OrNull -Path $lockPath
    if ($lockHashAfterFirst -ne $lockHashAfterSecond) {
        throw 'The package lock changed again during the verification-only pass. The graph is not stable; do not ask the user to open Unity yet.'
    }
}
else {
    $lockHashAfterSecond = $lockHashAfterFirst
}

try {
    $resolvedLock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
}
catch {
    throw "Packages/packages-lock.json is missing or invalid after stabilization: $($_.Exception.Message)"
}
if (Get-NativeGraphNeedsResolution -Manifest $manifest -Lock $resolvedLock) {
    throw 'Burst/Collections direct dependencies are still unresolved after stabilization.'
}

$result = [pscustomobject][ordered]@{
    status = 'stable-editor-closed-package-graph'
    reused_checkpoint = $false
    project_root = $resolvedProjectRoot
    unity_version = $projectUnityVersion
    unity_editor_path = $resolvedEditorPath
    manifest_sha256 = Get-FileSha256OrNull -Path $manifestPath
    package_lock_sha256_before = $lockHashBefore
    package_lock_sha256_after = $lockHashAfterSecond
    native_graph_was_stale = $nativeGraphWasStale
    verification_pass_required = $verificationRequired
    pass_count = $passes.Count
    checkpoint_path = $checkpointPath
    passes = $passes
}
$resultJson = $result | ConvertTo-Json -Depth 6
New-Item -ItemType Directory -Path $checkpointDirectory -Force | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($checkpointPath, $resultJson + [Environment]::NewLine, $utf8NoBom)
$resultJson
