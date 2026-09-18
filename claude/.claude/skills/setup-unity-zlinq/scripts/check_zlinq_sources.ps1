[CmdletBinding()]
param(
    [ValidateRange(5, 120)]
    [int]$TimeoutSec = 20
)

$ErrorActionPreference = 'Stop'
$headers = @{
    Accept = 'application/vnd.github+json'
    'User-Agent' = 'Codex-Unity-ZLinq-Setup'
    'X-GitHub-Api-Version' = '2022-11-28'
}

function Get-VerifiedRelease {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$ManifestPath,
        [Parameter(Mandatory = $true)][string]$ExpectedPackageId,
        [Parameter(Mandatory = $true)][int]$RequestTimeoutSec
    )

    $release = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$Repository/releases/latest" `
        -Headers $headers `
        -TimeoutSec $RequestTimeoutSec

    if ($release.draft -or $release.prerelease) {
        throw "$Repository releases/latest returned a draft or prerelease."
    }

    $tag = [string]$release.tag_name
    if ($tag -notmatch '^v?(?<version>\d+\.\d+\.\d+(?:\.\d+)?)$') {
        throw "$Repository latest tag is not a stable numeric semantic version: $tag"
    }

    $version = $Matches.version
    $encodedTag = [uri]::EscapeDataString($tag)
    $tagRef = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$Repository/git/ref/tags/$encodedTag" `
        -Headers $headers `
        -TimeoutSec $RequestTimeoutSec

    if ([string]$tagRef.ref -ne "refs/tags/$tag") {
        throw "$Repository release tag was not confirmed in official Git refs: $tag"
    }

    $manifestUrl = "https://raw.githubusercontent.com/$Repository/$encodedTag/$ManifestPath"
    $manifest = Invoke-RestMethod -Uri $manifestUrl -Headers $headers -TimeoutSec $RequestTimeoutSec
    if ([string]$manifest.name -ne $ExpectedPackageId) {
        throw "$Repository tagged package ID mismatch: $($manifest.name)"
    }
    if ([string]$manifest.version -ne $version) {
        throw "$Repository release/manifest version mismatch: release=$version manifest=$($manifest.version)"
    }

    return [pscustomobject]@{
        Repository = $Repository
        Version = $version
        Tag = $tag
        TagObjectSha = [string]$tagRef.object.sha
        ReleaseUrl = [string]$release.html_url
        PublishedAt = ([DateTimeOffset]$release.published_at).ToUniversalTime().ToString('o')
        ManifestUrl = $manifestUrl
        UnityFloor = [string]$manifest.unity
    }
}

try {
    $nugetForUnity = Get-VerifiedRelease `
        -Repository 'GlitchEnzo/NuGetForUnity' `
        -ManifestPath 'src/NuGetForUnity/package.json' `
        -ExpectedPackageId 'com.github-glitchenzo.nugetforunity' `
        -RequestTimeoutSec $TimeoutSec

    $zlinq = Get-VerifiedRelease `
        -Repository 'Cysharp/ZLinq' `
        -ManifestPath 'src/ZLinq.Unity/Assets/ZLinq.Unity/package.json' `
        -ExpectedPackageId 'com.cysharp.zlinq' `
        -RequestTimeoutSec $TimeoutSec

    $nugetIndex = Invoke-RestMethod `
        -Uri 'https://api.nuget.org/v3-flatcontainer/zlinq/index.json' `
        -TimeoutSec $TimeoutSec

    $stableVersions = @(
        $nugetIndex.versions |
            Where-Object { $_ -match '^\d+\.\d+\.\d+(?:\.\d+)?$' } |
            ForEach-Object { [version]$_ } |
            Sort-Object
    )
    if ($stableVersions.Count -eq 0) {
        throw 'NuGet.org returned no stable numeric ZLinq versions.'
    }

    $latestNugetVersion = $stableVersions[-1].ToString()
    if ($latestNugetVersion -ne $zlinq.Version) {
        throw "ZLinq Git release, Unity manifest, and NuGet.org latest stable disagree: git=$($zlinq.Version) nuget=$latestNugetVersion"
    }

    [pscustomobject]@{
        Status = 'verified-stable'
        NuGetForUnityPackageId = 'com.github-glitchenzo.nugetforunity'
        NuGetForUnityVersion = $nugetForUnity.Version
        NuGetForUnityTag = $nugetForUnity.Tag
        NuGetForUnityTagObjectSha = $nugetForUnity.TagObjectSha
        NuGetForUnityGitUrl = "https://github.com/GlitchEnzo/NuGetForUnity.git?path=/src/NuGetForUnity#$($nugetForUnity.Tag)"
        NuGetForUnityReleaseUrl = $nugetForUnity.ReleaseUrl
        ZLinqNuGetPackageId = 'ZLinq'
        ZLinqVersion = $zlinq.Version
        ZLinqNuGetUrl = "https://api.nuget.org/v3-flatcontainer/zlinq/$($zlinq.Version)/zlinq.$($zlinq.Version).nupkg"
        ZLinqUnityPackageId = 'com.cysharp.zlinq'
        ZLinqUnityVersion = $zlinq.Version
        ZLinqUnityTag = $zlinq.Tag
        ZLinqUnityTagObjectSha = $zlinq.TagObjectSha
        ZLinqUnityGitUrl = "https://github.com/Cysharp/ZLinq.git?path=src/ZLinq.Unity/Assets/ZLinq.Unity#$($zlinq.Tag)"
        ZLinqUnityReleaseUrl = $zlinq.ReleaseUrl
        ZLinqUnityFloor = $zlinq.UnityFloor
    } | ConvertTo-Json -Depth 4
}
catch {
    [pscustomobject]@{
        Status = 'unavailable'
        Error = $_.Exception.Message
    } | ConvertTo-Json -Depth 4
    exit 1
}
