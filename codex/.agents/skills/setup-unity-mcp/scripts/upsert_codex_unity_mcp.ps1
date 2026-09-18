#Requires -Version 5.1

[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $env:USERPROFILE '.codex\config.toml'),
    [string]$RelayPath = (Join-Path $env:USERPROFILE '.unity\relay\relay_win.exe')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$config=[IO.Path]::GetFullPath($ConfigPath)
$relay=[IO.Path]::GetFullPath($RelayPath)
if (-not (Test-Path $relay -PathType Leaf)) { throw "Official Unity relay is missing: $relay" }

$text=if (Test-Path $config -PathType Leaf) { [IO.File]::ReadAllText($config) } else { '' }
$newline=if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
$lines=if ($text.Length -eq 0) { @() } else { @($text -split '\r?\n', 0) }
$kept=New-Object 'System.Collections.Generic.List[string]'
$removed=New-Object 'System.Collections.Generic.List[string]'
$skip=$false
foreach ($line in $lines) {
    if ($line -match '^\s*\[(?<table>[^\]]+)\]\s*(?:#.*)?$') {
        $table=[string]$Matches.table
        $skip=$table -match '^mcp_servers\.(?:unity_mcp|unityMCP)(?:\.|$)'
        if ($skip) { $removed.Add($table); continue }
    }
    if (-not $skip) { $kept.Add($line) }
}
while ($kept.Count -gt 0 -and [string]::IsNullOrWhiteSpace($kept[$kept.Count-1])) { $kept.RemoveAt($kept.Count-1) }
$escaped=$relay.Replace('\','\\').Replace('"','\"')
$block=@(
    '[mcp_servers.unity_mcp]',
    "command = `"$escaped`"",
    'args = ["--mcp"]',
    'enabled = true',
    '',
    '# Per-tool approval gate. Mirrored for Claude Code by',
    '# upsert_claude_unity_mcp.ps1 as a permissions.ask rule.',
    '[mcp_servers.unity_mcp.tools.Unity_ManageEditor]',
    'approval_mode = "approve"'
)
$newText=((@($kept) + $(if ($kept.Count -gt 0) { @('') } else { @() }) + $block) -join $newline) + $newline
if ($newText -eq $text) {
    [pscustomobject]@{status='current';changed=$false;config=$config;relay=$relay;removed_tables=@($removed)} | ConvertTo-Json -Depth 4
    return
}
$parent=Split-Path -Parent $config
New-Item -ItemType Directory -Force $parent | Out-Null
if (Test-Path $config -PathType Leaf) { Copy-Item $config "$config.setup-unity-mcp.bak" -Force }
$partial="$config.partial"
[IO.File]::WriteAllText($partial,$newText,(New-Object Text.UTF8Encoding($false)))
Move-Item $partial $config -Force
[pscustomobject]@{status='restart-ready';changed=$true;config=$config;relay=$relay;removed_tables=@($removed)} | ConvertTo-Json -Depth 4
