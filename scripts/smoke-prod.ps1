# Two-tier production smoke test (Render preflight + Vercel full path).
# Usage (from repo root or CSC584_GroupProject):
#   .\scripts\smoke-prod.ps1
#   .\scripts\smoke-prod.ps1 -Tier tier1
#   .\scripts\smoke-prod.ps1 -Tier tier2
#
# Env (or .env in CSC584_GroupProject): SMOKE_RENDER_URL, SMOKE_VERCEL_URL,
#   SMOKE_STUDENT_USER/PASSWORD, SMOKE_ADMIN_USER/PASSWORD

param(
    [ValidateSet('all', 'tier1', 'tier2')]
    [string] $Tier = 'all'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $ProjectRoot '.env'

function Import-EnvFile {
    param([string] $Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { return }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        if ($key) { Set-Item -Path "Env:$key" -Value $val }
    }
}

function Get-SmokeConfig {
    Import-EnvFile -Path $EnvFile
    @{
        RenderUrl   = $(if ($env:SMOKE_RENDER_URL) { $env:SMOKE_RENDER_URL.TrimEnd('/') } else { $null })
        VercelUrl   = $(if ($env:SMOKE_VERCEL_URL) { $env:SMOKE_VERCEL_URL.TrimEnd('/') } else { $null })
        StudentUser = $(if ($env:SMOKE_STUDENT_USER) { $env:SMOKE_STUDENT_USER } else { 'smoke_student' })
        StudentPass = $(if ($env:SMOKE_STUDENT_PASSWORD) { $env:SMOKE_STUDENT_PASSWORD } else { 'smoke123' })
        AdminUser   = $(if ($env:SMOKE_ADMIN_USER) { $env:SMOKE_ADMIN_USER } else { 'smoke_admin' })
        AdminPass   = $(if ($env:SMOKE_ADMIN_PASSWORD) { $env:SMOKE_ADMIN_PASSWORD } else { 'smoke123' })
    }
}

function Write-Step { param([string] $Message) Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Pass { param([string] $Message) Write-Host " OK  $Message" -ForegroundColor Green }
function Write-Fail { param([string] $Message) Write-Host "FAIL $Message" -ForegroundColor Red; exit 1 }

function Invoke-SmokeRequest {
    param(
        [string] $Method,
        [string] $Url,
        [hashtable] $Headers = @{},
        [string] $Body = $null
    )
    $params = @{
        Method      = $Method
        Uri         = $Url
        Headers     = $Headers
        ErrorAction = 'Stop'
    }
    if ($Body) {
        $params['Body'] = $Body
        $params['ContentType'] = 'application/json'
    }
    try {
        Invoke-WebRequest @params
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $detail = $reader.ReadToEnd()
            throw "HTTP $([int]$resp.StatusCode) $Url - $detail"
        }
        throw
    }
}

function Get-AuthToken {
    param([string] $BaseUrl, [string] $Username, [string] $Password)
    $loginUrl = "$BaseUrl/api/auth/login"
    $body = (@{ username = $Username; password = $Password } | ConvertTo-Json -Compress)
    $r = Invoke-SmokeRequest -Method POST -Url $loginUrl -Body $body
    $json = $r.Content | ConvertFrom-Json
    if (-not $json.token) { throw "Login succeeded but no token for $Username" }
    @{ Token = $json.token; Headers = @{ Authorization = "Bearer $($json.token)" } }
}

function Test-Tier1Render {
    param($Cfg)
    if (-not $Cfg.RenderUrl) {
        Write-Fail 'SMOKE_RENDER_URL is not set (e.g. https://esukan-api.onrender.com)'
    }
    Write-Step "Tier 1 (Render): $($Cfg.RenderUrl)"

    Write-Step 'GET /login.html'
    $r = Invoke-SmokeRequest -Method GET -Url "$($Cfg.RenderUrl)/login.html"
    if ($r.StatusCode -ne 200) { Write-Fail "login.html returned $($r.StatusCode)" }
    Write-Pass 'login.html'

    Write-Step 'POST /api/auth/login (smoke_student)'
    $auth = Get-AuthToken -BaseUrl $Cfg.RenderUrl -Username $Cfg.StudentUser -Password $Cfg.StudentPass
    Write-Pass 'login'

    Write-Step 'GET /api/facilities (read-only)'
    $r = Invoke-SmokeRequest -Method GET -Url "$($Cfg.RenderUrl)/api/facilities" -Headers $auth.Headers
    $facilities = $r.Content | ConvertFrom-Json
    if (-not $facilities -or @($facilities).Count -lt 1) { Write-Fail 'No facilities returned' }
    Write-Pass "facilities ($(@($facilities).Count))"

    Write-Step 'GET /api/equipment/health-report (read-only)'
    $r = Invoke-SmokeRequest -Method GET -Url "$($Cfg.RenderUrl)/api/equipment/health-report" -Headers $auth.Headers
    $health = $r.Content | ConvertFrom-Json
    if ($null -eq $health.available) { Write-Fail 'health-report missing fields' }
    Write-Pass 'equipment health-report'
}

function Get-FirstId {
    param($Items, [string] $Property = 'id')
    $list = @($Items)
    if ($list.Count -eq 0) { return $null }
    $first = $list[0]
    if ($first.PSObject.Properties[$Property]) { return [long]$first.$Property }
    return [long]$first
}

function Test-Tier2Vercel {
    param($Cfg)
    if (-not $Cfg.VercelUrl) {
        Write-Fail 'SMOKE_VERCEL_URL is not set (e.g. https://your-project.vercel.app)'
    }
    Write-Step "Tier 2 (Vercel): $($Cfg.VercelUrl)"

    Write-Step 'POST /api/auth/login (smoke_student)'
    $student = Get-AuthToken -BaseUrl $Cfg.VercelUrl -Username $Cfg.StudentUser -Password $Cfg.StudentPass
    Write-Pass 'student login'

    Write-Step 'GET /api/facilities'
    $r = Invoke-SmokeRequest -Method GET -Url "$($Cfg.VercelUrl)/api/facilities" -Headers $student.Headers
    $facilityId = Get-FirstId ($r.Content | ConvertFrom-Json)
    if (-not $facilityId) { Write-Fail 'No facility id' }
    Write-Pass "facility id $facilityId"

    Write-Step 'GET /api/equipment'
    $r = Invoke-SmokeRequest -Method GET -Url "$($Cfg.VercelUrl)/api/equipment" -Headers $student.Headers
    $equipment = @($r.Content | ConvertFrom-Json) | Where-Object { $_.status -eq 'AVAILABLE' }
    $equipmentId = Get-FirstId $equipment
    if (-not $equipmentId) { Write-Fail 'No AVAILABLE equipment' }
    Write-Pass "equipment id $equipmentId"

    $bookingDate = (Get-Date).AddDays(14).ToString('yyyy-MM-dd')
    $minuteSlot = (Get-Date).ToString('mm')
    $startHour = 8 + ([int]$minuteSlot % 10)
    $startTime = '{0:D2}:00:00' -f $startHour
    $endTime = '{0:D2}:00:00' -f ($startHour + 1)

    Write-Step 'POST /api/bookings'
    $bookingBody = @{
        facilityId  = $facilityId
        bookingDate = $bookingDate
        startTime   = $startTime
        endTime     = $endTime
        notes       = "smoke-$(Get-Date -Format 'yyyyMMddHHmmss')"
    } | ConvertTo-Json -Compress
    $bookingId = $null
    try {
        $r = Invoke-SmokeRequest -Method POST -Url "$($Cfg.VercelUrl)/api/bookings" -Headers $student.Headers -Body $bookingBody
        $created = $r.Content | ConvertFrom-Json
        $bookingId = [long]$created.id
        Write-Pass "booking id $bookingId"
    } catch {
        Write-Host " WARN booking create: $_" -ForegroundColor Yellow
        Write-Step 'Will approve an existing PENDING booking if present'
    }

    Write-Step 'POST /api/rentals'
    $rentalBody = @{
        equipmentId = $equipmentId
        quantity    = 1
        rentalDate  = $bookingDate
    } | ConvertTo-Json -Compress
    $r = Invoke-SmokeRequest -Method POST -Url "$($Cfg.VercelUrl)/api/rentals" -Headers $student.Headers -Body $rentalBody
    $rental = $r.Content | ConvertFrom-Json
    Write-Pass "rental id $($rental.id)"

    Write-Step 'POST /api/auth/login (smoke_admin)'
    $admin = Get-AuthToken -BaseUrl $Cfg.VercelUrl -Username $Cfg.AdminUser -Password $Cfg.AdminPass
    Write-Pass 'admin login'

    if (-not $bookingId) {
        Write-Step 'GET /api/bookings/status/PENDING'
        $r = Invoke-SmokeRequest -Method GET -Url "$($Cfg.VercelUrl)/api/bookings/status/PENDING" -Headers $admin.Headers
        $pending = @($r.Content | ConvertFrom-Json)
        if ($pending.Count -gt 0) {
            $bookingId = [long]$pending[0].id
            Write-Pass "using pending booking $bookingId"
        } else {
            Write-Fail 'No booking to approve (create failed and no PENDING bookings)'
        }
    }

    Write-Step "PATCH /api/bookings/$bookingId/status?status=CONFIRMED"
    $r = Invoke-SmokeRequest -Method PATCH -Url "$($Cfg.VercelUrl)/api/bookings/$bookingId/status?status=CONFIRMED" -Headers $admin.Headers
    $approved = $r.Content | ConvertFrom-Json
    if ($approved.status -ne 'CONFIRMED') { Write-Fail "Expected CONFIRMED, got $($approved.status)" }
    Write-Pass 'booking confirmed'

    Write-Step 'GET /api/bookings/dashboard'
    $r = Invoke-SmokeRequest -Method GET -Url "$($Cfg.VercelUrl)/api/bookings/dashboard" -Headers $admin.Headers
    $dash = $r.Content | ConvertFrom-Json
    if ($null -eq $dash) { Write-Fail 'dashboard empty' }
    Write-Pass 'dashboard stats'
}

$cfg = Get-SmokeConfig
Write-Host ''
Write-Host 'E-Sukan production smoke' -ForegroundColor White
Write-Host "Tier: $Tier" -ForegroundColor DarkGray
Write-Host ''

switch ($Tier) {
    'tier1' { Test-Tier1Render -Cfg $cfg }
    'tier2' { Test-Tier2Vercel -Cfg $cfg }
    default {
        Test-Tier1Render -Cfg $cfg
        Write-Host ''
        Test-Tier2Vercel -Cfg $cfg
    }
}

Write-Host ''
Write-Host 'All smoke checks passed.' -ForegroundColor Green
