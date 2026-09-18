#Requires -Version 5.1

[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$ProjectRoot)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($ProjectRoot)
$lock=Join-Path $root 'Temp\UnityLockfile'
if (Test-Path $lock) { throw 'Close the target Unity project before removing legacy Coplay-managed files.' }
$checkpoint=Join-Path $root '.agent-temp\setup-checkpoints\unity-mcp-roslyn.json'
$removed=New-Object 'System.Collections.Generic.List[string]'
$ambiguous=New-Object 'System.Collections.Generic.List[string]'
if (Test-Path $checkpoint -PathType Leaf) {
    $state=Get-Content -Raw $checkpoint | ConvertFrom-Json
    foreach ($file in @($state.files)) {
        $name=[string]$file.dll_name
        if ([IO.Path]::GetFileName($name) -ne $name -or $name -notmatch '\.dll$') { throw "Unsafe legacy DLL name in checkpoint: $name" }
        $path=Join-Path $root "Assets\Plugins\Roslyn\$name"
        if (-not (Test-Path $path -PathType Leaf)) { continue }
        $actual=(Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne ([string]$file.sha256).ToLowerInvariant()) { $ambiguous.Add($path); continue }
        Remove-Item -LiteralPath $path -Force
        if (Test-Path "$path.meta" -PathType Leaf) { Remove-Item -LiteralPath "$path.meta" -Force }
        $removed.Add($path)
    }
    if ($ambiguous.Count -eq 0) { Remove-Item -LiteralPath $checkpoint -Force }
}
$directory=Join-Path $root 'Assets\Plugins\Roslyn'
if ((Test-Path $directory -PathType Container) -and @(Get-ChildItem -LiteralPath $directory -Force).Count -eq 0) {
    Remove-Item -LiteralPath $directory -Force
    if (Test-Path "$directory.meta" -PathType Leaf) { Remove-Item -LiteralPath "$directory.meta" -Force }
}
[pscustomobject]@{
    status=if ($ambiguous.Count -eq 0) {'legacy-coplay-removed'} else {'ambiguous-legacy-files'}
    removed=@($removed)
    preserved_for_review=@($ambiguous)
    better_context_analyzers_preserved=$true
} | ConvertTo-Json -Depth 5
