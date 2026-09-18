#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$UnityEditorPath,
    [string]$StatusDirectory,
    [Alias('TimeoutSeconds')][ValidateRange(1, 600)][int]$TimeoutSec = 180,
    [switch]$AfterReload,
    [ValidateRange(100, 2000)][int]$PollMilliseconds = 250
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
    foreach ($name in $Names) {
        $property = $Object.PSObject.Properties[$name]
        if ($null -ne $property) { return $property.Value }
    }
    return $null
}

$root = Normalize-Path $ProjectRoot
$editorPath = Normalize-Path $UnityEditorPath
if (-not (Test-Path -LiteralPath $editorPath -PathType Leaf)) {
    throw "UnityEditorPath does not exist: $editorPath"
}
if ([string]::IsNullOrWhiteSpace($StatusDirectory)) {
    $StatusDirectory = if ([string]::IsNullOrWhiteSpace($env:UNITY_MCP_STATUS_DIR)) {
        Join-Path ([Environment]::GetFolderPath('UserProfile')) '.unity\mcp\connections'
    } else { $env:UNITY_MCP_STATUS_DIR }
}
$statusPath = Normalize-Path $StatusDirectory
$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
$observedNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$rejectedFiles = 0

do {
    $matches = @()
    if (Test-Path -LiteralPath $statusPath -PathType Container) {
        foreach ($file in Get-ChildItem -LiteralPath $statusPath -Filter 'bridge-*.json' -File -ErrorAction SilentlyContinue) {
            [void]$observedNames.Add($file.FullName)
            try {
                $record = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                $recordRoot = [string](Get-PropertyValue $record @('project_path', 'projectPath', 'project_root', 'projectRoot'))
                $recordPid = [int](Get-PropertyValue $record @('editor_pid', 'editorPid', 'process_id', 'processId'))
                $connectionPath = [string](Get-PropertyValue $record @('connection_path', 'connectionPath'))
                if (-not (Same-Path $recordRoot $root) -or $recordPid -le 0 -or [string]::IsNullOrWhiteSpace($connectionPath)) {
                    continue
                }
                $process = Get-Process -Id $recordPid -ErrorAction SilentlyContinue
                if ($null -eq $process) { $rejectedFiles++; continue }
                $livePath = $null
                try { $livePath = [string]$process.Path } catch { }
                if (-not (Same-Path $livePath $editorPath)) { $rejectedFiles++; continue }
                $matches += [pscustomobject]@{
                    file = $file.Name
                    editor_pid = $recordPid
                    connection_type = [string](Get-PropertyValue $record @('connection_type', 'connectionType'))
                    connection_path = $connectionPath
                }
            }
            catch { $rejectedFiles++ }
        }
    }
    if ($matches.Count -eq 1) {
        [pscustomobject][ordered]@{
            status = 'ready'
            project_root = $root
            editor_path = $editorPath
            discovery = $matches[0]
            computer_use = 'prohibited'
        } | ConvertTo-Json -Depth 5
        exit 0
    }
    if ($matches.Count -gt 1) {
        [pscustomobject][ordered]@{
            status = 'ambiguous'
            reason = 'multiple live discovery records match the target project and Editor'
            match_count = $matches.Count
            computer_use = 'prohibited'
        } | ConvertTo-Json -Depth 4
        exit 2
    }
    if ([DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds $PollMilliseconds }
} while ([DateTime]::UtcNow -lt $deadline)

$exactEditorAlive = $false
$instancePath = Join-Path $root 'Library\EditorInstance.json'
if (Test-Path -LiteralPath $instancePath -PathType Leaf) {
    try {
        $instance = Get-Content -LiteralPath $instancePath -Raw -Encoding UTF8 | ConvertFrom-Json
        $instancePid = [int](Get-PropertyValue $instance @('process_id', 'processId', 'editor_pid', 'editorPid'))
        $instanceAppPath = [string](Get-PropertyValue $instance @('app_path', 'appPath', 'editor_path', 'editorPath'))
        $instanceProcess = Get-Process -Id $instancePid -ErrorAction SilentlyContinue
        $livePath = if ($null -ne $instanceProcess) { try { [string]$instanceProcess.Path } catch { $null } } else { $null }
        $exactEditorAlive = $instancePid -gt 0 -and (Same-Path $instanceAppPath $editorPath) -and (Same-Path $livePath $editorPath)
    }
    catch { $exactEditorAlive = $false }
}
$transientReload = $AfterReload -and $exactEditorAlive

[pscustomobject][ordered]@{
    status = if ($transientReload) { 'transient-editor-reload' } else { 'pending-manual-action' }
    reason = if ($transientReload) { 'the exact Editor is alive and may still be compiling or reloading; discovery has not republished yet' } else { 'no exact live Unity MCP discovery record appeared and the exact Editor could not be verified as a transient reload' }
    project_root = $root
    exact_editor_alive = $exactEditorAlive
    observed_files = $observedNames.Count
    rejected_files = $rejectedFiles
    next_action = if ($transientReload) { 'Keep the Editor open, wait for compilation to settle, then rerun this bounded discovery check.' } else { 'Ask the user to verify the exact Editor and Unity MCP Server in Project Settings; do not use UI automation.' }
    computer_use = 'prohibited'
} | ConvertTo-Json -Depth 4
