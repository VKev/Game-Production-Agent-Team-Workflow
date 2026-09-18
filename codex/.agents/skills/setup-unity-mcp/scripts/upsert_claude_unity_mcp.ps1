#Requires -Version 7.0

<#
.SYNOPSIS
    Register the official Unity relay for Claude Code with the same policy Codex gets.

.DESCRIPTION
    Writes exactly one project-scope `unity_mcp` server into .mcp.json, enables it in
    .claude/settings.json, and mirrors Codex's per-tool approval gate for
    Unity_ManageEditor through Claude's permission rules (`ask` outranks `allow`).
    Unrelated servers, hooks, permissions, and settings are preserved. User-level
    Claude configuration is inspected only; duplicates there are reported and removed
    only with -PruneUserLevelDuplicates.
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$RelayPath = (Join-Path $env:USERPROFILE '.unity\relay\relay_win.exe'),
    [string]$McpPath,
    [string]$SettingsPath,
    [string]$UserConfigPath = (Join-Path $env:USERPROFILE '.claude.json'),
    [switch]$PruneUserLevelDuplicates,
    [switch]$NoAllowList
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = [IO.Path]::GetFullPath($ProjectRoot)
if (-not (Test-Path $root -PathType Container)) { throw "Project root is missing: $root" }
$relay = [IO.Path]::GetFullPath($RelayPath)
if (-not (Test-Path $relay -PathType Leaf)) { throw "Official Unity relay is missing: $relay" }

if ([string]::IsNullOrWhiteSpace($McpPath)) { $McpPath = Join-Path $root '.mcp.json' }
if ([string]::IsNullOrWhiteSpace($SettingsPath)) { $SettingsPath = Join-Path $root '.claude\settings.json' }
$mcpFile = [IO.Path]::GetFullPath($McpPath)
$settingsFile = [IO.Path]::GetFullPath($SettingsPath)

$managedNames = @('unity_mcp', 'unity-mcp', 'unityMCP')
$serverName = 'unity_mcp'
$askRule = 'mcp__unity_mcp__Unity_ManageEditor'
$allowRule = 'mcp__unity_mcp__*'
$utf8 = New-Object Text.UTF8Encoding($false)

function Read-JsonObject {
    param([string]$Path)
    if (-not (Test-Path $Path -PathType Leaf)) { return [ordered]@{} }
    $text = [IO.File]::ReadAllText($Path)
    if ([string]::IsNullOrWhiteSpace($text)) { return [ordered]@{} }
    try { $parsed = $text | ConvertFrom-Json -AsHashtable -Depth 64 }
    catch { throw "Cannot parse JSON: $Path ($($_.Exception.Message))" }
    if ($null -eq $parsed) { return [ordered]@{} }
    if ($parsed -isnot [System.Collections.IDictionary]) { throw "Expected a JSON object: $Path" }
    return $parsed
}

function Write-JsonObject {
    param([string]$Path, $Value)
    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent)) { New-Item -ItemType Directory -Force $parent | Out-Null }
    if (Test-Path $Path -PathType Leaf) { Copy-Item $Path "$Path.setup-unity-mcp.bak" -Force }
    $json = ($Value | ConvertTo-Json -Depth 64)
    $partial = "$Path.partial"
    [IO.File]::WriteAllText($partial, $json + "`n", $utf8)
    Move-Item $partial $Path -Force
}

function Get-Fingerprint {
    param($Value)
    return ($Value | ConvertTo-Json -Depth 64 -Compress)
}

function Add-StringOnce {
    param($Bag, [string]$Value)
    $existing = @()
    if ($null -ne $Bag) { $existing = @($Bag) }
    foreach ($item in $existing) {
        if (($item -is [string]) -and $item -ceq $Value) { return , $existing }
    }
    return , (@($existing) + @($Value))
}

# --- .mcp.json -------------------------------------------------------------
$mcp = Read-JsonObject -Path $mcpFile
$mcpBefore = Get-Fingerprint $mcp
if (-not $mcp.Contains('mcpServers') -or $mcp['mcpServers'] -isnot [System.Collections.IDictionary]) {
    $mcp['mcpServers'] = [ordered]@{}
}
$servers = $mcp['mcpServers']
$removedServers = New-Object 'System.Collections.Generic.List[string]'
foreach ($key in @($servers.Keys)) {
    if ($managedNames -contains $key) {
        if ($key -cne $serverName) { $removedServers.Add($key) }
        $servers.Remove($key)
    }
}
$servers[$serverName] = [ordered]@{ command = $relay; args = @('--mcp') }
$mcpChanged = (Get-Fingerprint $mcp) -ne $mcpBefore

# --- .claude/settings.json -------------------------------------------------
$settings = Read-JsonObject -Path $settingsFile
$settingsBefore = Get-Fingerprint $settings
$settings['enabledMcpjsonServers'] = (Add-StringOnce -Bag $(if ($settings.Contains('enabledMcpjsonServers')) { $settings['enabledMcpjsonServers'] } else { @() }) -Value $serverName)
if (-not $settings.Contains('permissions') -or $settings['permissions'] -isnot [System.Collections.IDictionary]) {
    $settings['permissions'] = [ordered]@{}
}
$permissions = $settings['permissions']
$permissions['ask'] = (Add-StringOnce -Bag $(if ($permissions.Contains('ask')) { $permissions['ask'] } else { @() }) -Value $askRule)
if (-not $NoAllowList) {
    $permissions['allow'] = (Add-StringOnce -Bag $(if ($permissions.Contains('allow')) { $permissions['allow'] } else { @() }) -Value $allowRule)
}
$settingsChanged = (Get-Fingerprint $settings) -ne $settingsBefore

# --- user-level duplicates (inspect; prune only on request) ----------------
$userConfig = [IO.Path]::GetFullPath($UserConfigPath)
$duplicates = New-Object 'System.Collections.Generic.List[string]'
$pruned = New-Object 'System.Collections.Generic.List[string]'
$relayLeaf = [IO.Path]::GetFileName($relay)
if (Test-Path $userConfig -PathType Leaf) {
    $user = Read-JsonObject -Path $userConfig
    if ($user.Contains('mcpServers') -and $user['mcpServers'] -is [System.Collections.IDictionary]) {
        $userServers = $user['mcpServers']
        foreach ($key in @($userServers.Keys)) {
            $entry = $userServers[$key]
            $command = ''
            if ($entry -is [System.Collections.IDictionary] -and $entry.Contains('command')) { $command = [string]$entry['command'] }
            $isRelay = ($managedNames -contains $key) -or ($command -and ([IO.Path]::GetFileName($command.Replace('/', '\')) -ieq $relayLeaf))
            if (-not $isRelay) { continue }
            $duplicates.Add($key)
            if ($PruneUserLevelDuplicates) {
                $userServers.Remove($key)
                $pruned.Add($key)
            }
        }
        if ($pruned.Count -gt 0) { Write-JsonObject -Path $userConfig -Value $user }
    }
}

if (-not $mcpChanged -and -not $settingsChanged) {
    [pscustomobject]@{
        status                = if ($duplicates.Count -gt $pruned.Count) { 'ambiguous' } else { 'current' }
        changed               = $false
        mcp_config            = $mcpFile
        settings              = $settingsFile
        relay                 = $relay
        removed_servers       = @($removedServers)
        user_level_duplicates = @($duplicates)
        pruned_user_level     = @($pruned)
        approval_gate         = $askRule
    } | ConvertTo-Json -Depth 6
    return
}

if ($mcpChanged) { Write-JsonObject -Path $mcpFile -Value $mcp }
if ($settingsChanged) { Write-JsonObject -Path $settingsFile -Value $settings }

[pscustomobject]@{
    status                = if ($duplicates.Count -gt $pruned.Count) { 'ambiguous' } else { 'restart-ready' }
    changed               = $true
    mcp_config            = $mcpFile
    settings              = $settingsFile
    relay                 = $relay
    removed_servers       = @($removedServers)
    user_level_duplicates = @($duplicates)
    pruned_user_level     = @($pruned)
    approval_gate         = $askRule
} | ConvertTo-Json -Depth 6
