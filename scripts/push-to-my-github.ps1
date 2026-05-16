# Push this project to your GitHub account (default: syukri1995/esukan)
param(
    [string]$User = "",
    [string]$Repo = "",
    [string]$Branch = "main",
    [string]$RemoteName = "mygithub"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\repo-target.ps1"
if ($User) { $script:EsukanGitHubUser = $User }
if ($Repo) { $script:EsukanGitHubRepo = $Repo }
$script:EsukanGitHubBranch = $Branch
$script:EsukanGitHubRepoUrl = "https://github.com/$EsukanGitHubUser/$EsukanGitHubRepo.git"

Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "Target: $EsukanGitHubRepoUrl (branch: $EsukanGitHubBranch)"
Write-Host ""

$repoExists = $false
try {
    git ls-remote $EsukanGitHubRepoUrl 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $repoExists = $true }
} catch { }

if (-not $repoExists) {
    $ghOk = $false
    try {
        gh auth status 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ghOk = $true }
    } catch { }

    if ($ghOk) {
        Write-Host "Creating GitHub repo $EsukanGitHubUser/$EsukanGitHubRepo via gh ..."
        gh repo create "$EsukanGitHubUser/$EsukanGitHubRepo" --public --description "E-Sukan campus sports booking" --source . --remote $RemoteName --push
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Created and pushed."
            exit 0
        }
        Write-Host "gh repo create failed; create the repo manually." -ForegroundColor Yellow
    }

    Write-Host "Repository not found yet. Create it first:"
    Write-Host "  https://github.com/new?name=$EsukanGitHubRepo"
    Write-Host "  Owner: $EsukanGitHubUser  |  Name: $EsukanGitHubRepo  |  Empty repo (no README)"
    Write-Host ""
    Write-Host "Or log in: gh auth login   then run this script again."
    $open = Read-Host "Open GitHub 'new repo' page in browser? [Y/n]"
    if ($open -ne "n" -and $open -ne "N") {
        Start-Process "https://github.com/new?name=$EsukanGitHubRepo"
    }
    Read-Host "Press Enter after you have created the empty repository"
}

$remotes = git remote
if ($remotes -match "^$RemoteName$") {
    git remote set-url $RemoteName $EsukanGitHubRepoUrl
} else {
    git remote add $RemoteName $EsukanGitHubRepoUrl
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Pushing branch '$currentBranch' to $RemoteName/$EsukanGitHubBranch ..."
git push -u $RemoteName "${currentBranch}:${EsukanGitHubBranch}"

Write-Host ""
Write-Host "Done. Repo: https://github.com/$EsukanGitHubUser/$EsukanGitHubRepo"
Write-Host "Render deploy: $EsukanRenderDeployUrl"
Write-Host ""
Write-Host "Next: Vercel -> Project Settings -> Git -> connect this repository."
