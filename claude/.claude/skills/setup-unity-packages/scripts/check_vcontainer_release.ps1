[CmdletBinding()]
param(
    [ValidateRange(5, 120)]
    [int]$TimeoutSec = 20
)

$ErrorActionPreference = 'Stop'
$repository = 'hadashiA/VContainer'
$packageId = 'jp.hadashikick.vcontainer'
$headers = @{
    Accept = 'application/vnd.github+json'
    'User-Agent' = 'Codex-Unity-Package-Setup'
    'X-GitHub-Api-Version' = '2022-11-28'
}

try {
    $release = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$repository/releases/latest" `
        -Headers $headers `
        -TimeoutSec $TimeoutSec

    if ($release.draft -or $release.prerelease) {
        throw 'GitHub releases/latest returned a draft or prerelease.'
    }

    $tag = [string]$release.tag_name
    if ($tag -notmatch '^v?(?<version>\d+\.\d+\.\d+)$') {
        throw "Latest release tag is not a stable numeric semantic version: $tag"
    }

    $version = $Matches.version
    $encodedTag = [uri]::EscapeDataString($tag)
    $tagRef = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$repository/git/ref/tags/$encodedTag" `
        -Headers $headers `
        -TimeoutSec $TimeoutSec

    if ([string]$tagRef.ref -ne "refs/tags/$tag") {
        throw "The release tag could not be confirmed in official Git refs: $tag"
    }

    $manifestUrl = "https://raw.githubusercontent.com/$repository/$encodedTag/VContainer/Assets/VContainer/package.json"
    $manifest = Invoke-RestMethod -Uri $manifestUrl -Headers $headers -TimeoutSec $TimeoutSec
    if ([string]$manifest.name -ne $packageId) {
        throw "Tagged package ID mismatch: $($manifest.name)"
    }
    if ([string]$manifest.version -ne $version) {
        throw "Tagged package version mismatch: release=$version manifest=$($manifest.version)"
    }

    [pscustomobject]@{
        Product = 'VContainer'
        PackageId = $packageId
        Version = $version
        Tag = $tag
        GitUrl = "https://github.com/$repository.git?path=VContainer/Assets/VContainer#$tag"
        ReleaseUrl = [string]$release.html_url
        PublishedAt = ([DateTimeOffset]$release.published_at).ToUniversalTime().ToString('o')
        TagObjectSha = [string]$tagRef.object.sha
        ManifestUrl = $manifestUrl
        Status = 'verified-stable'
    } | ConvertTo-Json -Depth 4
}
catch {
    [pscustomobject]@{
        Product = 'VContainer'
        PackageId = $packageId
        Status = 'unavailable'
        Error = $_.Exception.Message
    } | ConvertTo-Json -Depth 4
    exit 1
}
