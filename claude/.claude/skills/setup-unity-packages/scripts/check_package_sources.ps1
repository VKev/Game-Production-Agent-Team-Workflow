[CmdletBinding()]
param(
    [Parameter()]
    [string] $RegistryPath = (Join-Path $PSScriptRoot '..\references\package-registry.md'),

    [Parameter()]
    [ValidateRange(5, 120)]
    [int] $TimeoutSeconds = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-VersionParts {
    param([string] $Name)

    $match = [regex]::Match($Name, '(?i)\bv(?<version>\d+(?:\.\d+)+)')
    if (-not $match.Success) {
        return $null
    }

    return @($match.Groups['version'].Value.Split('.') | ForEach-Object { [int64] $_ })
}

function Get-ProductKey {
    param([string] $Name)

    $match = [regex]::Match($Name, '^(?<product>.+?)\s+v\d', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $match.Success) {
        return ''
    }

    $key = $match.Groups['product'].Value.ToLowerInvariant()
    $key = $key.Replace('spinal', 'spine')
    return [regex]::Replace($key, '[^a-z0-9]+', '')
}

function Get-VersionKey {
    param([int64[]] $Parts)

    if ($null -eq $Parts) {
        return ''
    }

    $padded = for ($index = 0; $index -lt 8; $index++) {
        $value = if ($index -lt $Parts.Count) { $Parts[$index] } else { 0 }
        $value.ToString('D12', [Globalization.CultureInfo]::InvariantCulture)
    }
    return $padded -join '.'
}

function Compare-VersionParts {
    param([int64[]] $Left, [int64[]] $Right)

    if ($null -eq $Left -or $null -eq $Right) {
        return 'unknown'
    }

    $count = [Math]::Max($Left.Count, $Right.Count)
    for ($index = 0; $index -lt $count; $index++) {
        $leftValue = if ($index -lt $Left.Count) { $Left[$index] } else { 0 }
        $rightValue = if ($index -lt $Right.Count) { $Right[$index] } else { 0 }
        if ($leftValue -gt $rightValue) { return 'higher' }
        if ($leftValue -lt $rightValue) { return 'lower' }
    }
    return 'same'
}

function Get-ReleaseDate {
    param([string] $Name)

    $match = [regex]::Match($Name, '\((?<date>\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\)')
    if (-not $match.Success) {
        return [datetime]::MinValue
    }

    $parsed = [datetime]::MinValue
    $ok = [datetime]::TryParseExact(
        $match.Groups['date'].Value,
        'd MMM yyyy',
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::None,
        [ref] $parsed
    )
    if ($ok) { return $parsed }
    return [datetime]::MinValue
}

$resolvedRegistry = (Resolve-Path -LiteralPath $RegistryPath).Path
$rows = foreach ($line in Get-Content -LiteralPath $resolvedRegistry) {
    $pattern = '^\| (?<product>[^|]+?) \| `(?<link>https://disk\.yandex\.ru/d/[^`]+)` \| `(?<name>[^`]+\.unitypackage)`, SHA-256 `(?<sha>[0-9A-F]{64})` \|$'
    if ($line -match $pattern) {
        [pscustomobject]@{
            Product = $Matches['product'].Trim()
            PublicLink = $Matches['link']
            KnownName = $Matches['name']
            KnownSha256 = $Matches['sha']
        }
    }
}

if (-not $rows) {
    throw "No registered public candidate sources found in $resolvedRegistry"
}

$results = foreach ($row in $rows) {
    try {
        $encoded = [Uri]::EscapeDataString($row.PublicLink)
        $uri = "https://cloud-api.yandex.net/v1/disk/public/resources?public_key=$encoded&limit=100"
        $resource = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec $TimeoutSeconds
        $items = if ($resource.type -eq 'dir') { @($resource._embedded.items) } else { @($resource) }
        $knownProductKey = Get-ProductKey -Name $row.KnownName
        $candidates = foreach ($item in $items) {
            if ($item.type -ne 'file' -or $item.name -notmatch '(?i)\.unitypackage$') { continue }
            if ((Get-ProductKey -Name $item.name) -ne $knownProductKey) { continue }
            $parts = Get-VersionParts -Name $item.name
            [pscustomobject]@{
                Item = $item
                VersionParts = $parts
                VersionKey = Get-VersionKey -Parts $parts
                ReleaseDate = Get-ReleaseDate -Name $item.name
            }
        }

        $selected = $candidates |
            Where-Object { $_.VersionParts -ne $null } |
            Sort-Object -Property @{ Expression = 'VersionKey'; Descending = $true }, @{ Expression = 'ReleaseDate'; Descending = $true } |
            Select-Object -First 1

        if ($null -eq $selected) {
            [pscustomobject]@{
                Product = $row.Product
                PublicLink = $row.PublicLink
                Status = 'no-versioned-package'
                ComparisonToKnown = 'unknown'
                CandidateName = $null
                CandidateVersion = $null
                CandidateReleaseDate = $null
                CandidateSize = $null
                CandidateSha256 = $null
                KnownName = $row.KnownName
                KnownSha256 = $row.KnownSha256
                MatchesKnownSnapshot = $false
            }
            continue
        }

        $knownParts = Get-VersionParts -Name $row.KnownName
        $candidateVersion = ($selected.VersionParts | ForEach-Object { $_.ToString([Globalization.CultureInfo]::InvariantCulture) }) -join '.'
        $candidateSha = [string] $selected.Item.sha256
        $matchesKnown = $selected.Item.name -eq $row.KnownName -and $candidateSha.ToUpperInvariant() -eq $row.KnownSha256

        [pscustomobject]@{
            Product = $row.Product
            PublicLink = $row.PublicLink
            Status = if ($matchesKnown) { 'same-known' } else { 'changed' }
            ComparisonToKnown = Compare-VersionParts -Left $selected.VersionParts -Right $knownParts
            CandidateName = [string] $selected.Item.name
            CandidateVersion = $candidateVersion
            CandidateReleaseDate = if ($selected.ReleaseDate -eq [datetime]::MinValue) { $null } else { $selected.ReleaseDate.ToString('yyyy-MM-dd') }
            CandidateSize = [int64] $selected.Item.size
            CandidateSha256 = $candidateSha.ToUpperInvariant()
            KnownName = $row.KnownName
            KnownSha256 = $row.KnownSha256
            MatchesKnownSnapshot = $matchesKnown
        }
    }
    catch {
        [pscustomobject]@{
            Product = $row.Product
            PublicLink = $row.PublicLink
            Status = 'unavailable'
            ComparisonToKnown = 'unknown'
            CandidateName = $null
            CandidateVersion = $null
            CandidateReleaseDate = $null
            CandidateSize = $null
            CandidateSha256 = $null
            KnownName = $row.KnownName
            KnownSha256 = $row.KnownSha256
            MatchesKnownSnapshot = $false
            Error = $_.Exception.Message
        }
    }
}

$results | ConvertTo-Json -Depth 4
