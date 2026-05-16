# Jetty on http://localhost:9090/ using TiDB (or any MySQL-compatible DB) from .env
Set-Location $PSScriptRoot\..

if (-not (Test-Path .env)) {
    Write-Error "Missing .env — copy .env.example and set SPRING_DATASOURCE_* (see DEPLOYMENT_VERCEL_TIDB.md)."
    exit 1
}

$required = @("ESUKAN_DB_USE_H2", "SPRING_DATASOURCE_URL", "SPRING_DATASOURCE_USERNAME", "SPRING_DATASOURCE_PASSWORD")
foreach ($key in $required) {
    $found = $false
    Get-Content .env | ForEach-Object {
        if ($_ -match "^\s*$key\s*=\s*(.+)\s*$" -and $matches[1].Trim() -ne "") { $found = $true }
    }
    if (-not $found) {
        Write-Error ".env must define $key (non-empty). TiDB: use Connect → General in TiDB Cloud console."
        exit 1
    }
}

Write-Host "Starting Jetty with TiDB/MySQL from .env (ESUKAN_DB_USE_H2 should be false)..."
mvn jetty:run
