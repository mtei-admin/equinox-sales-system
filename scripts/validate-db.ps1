# Phase 1 database validation (local PostgreSQL).
# Applies supabase/migrations in order, seed.sql, then tests/sql/validate_foundation.sql.
# Does not touch the system postgres cluster; uses a throwaway data directory.

$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$psql = Join-Path $pgBin "psql.exe"
$initdb = Join-Path $pgBin "initdb.exe"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"

if (-not (Test-Path $psql)) {
  throw "psql not found at $psql"
}

$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "supabase\migrations"))) {
  $root = (Get-Location).Path
}

$port = 55432
$dataDir = Join-Path $env:TEMP ("equinox-pg-phase1-" + [guid]::NewGuid().ToString("N"))
$logFile = Join-Path $dataDir "pg.log"
$started = $false

function Invoke-PsqlFile {
  param(
    [string]$Database,
    [string]$FilePath
  )
  Write-Host "APPLY $FilePath"
  & $psql -h 127.0.0.1 -p $port -U postgres -d $Database -v ON_ERROR_STOP=1 -f $FilePath
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed ($LASTEXITCODE) on $FilePath"
  }
}

try {
  New-Item -ItemType Directory -Path $dataDir | Out-Null
  Write-Host "initdb $dataDir"
  & $initdb -D $dataDir -U postgres --auth=trust --encoding=UTF8 --locale=C --no-sync
  if ($LASTEXITCODE -ne 0) {
    Write-Host "initdb locale=C failed; retrying English_United States"
    if (Test-Path $dataDir) { Remove-Item -Recurse -Force $dataDir }
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    & $initdb -D $dataDir -U postgres --auth=trust --encoding=UTF8 --locale="English_United States.1252" --no-sync
    if ($LASTEXITCODE -ne 0) {
      throw "initdb failed"
    }
  }

  Add-Content -Path (Join-Path $dataDir "postgresql.conf") -Value "`nlisten_addresses = '127.0.0.1'`nport = $port`n"

  Write-Host "starting postgres on port $port"
  & $pgCtl -D $dataDir -l $logFile -o "-p $port" start
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path $logFile) { Get-Content $logFile }
    throw "pg_ctl start failed"
  }
  $started = $true

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    & $psql -h 127.0.0.1 -p $port -U postgres -d postgres -c "select 1" | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "postgres did not become ready" }

  & $psql -h 127.0.0.1 -p $port -U postgres -d postgres -v ON_ERROR_STOP=1 -c "create database equinox_phase1;"
  if ($LASTEXITCODE -ne 0) { throw "create database failed" }

  Invoke-PsqlFile -Database "equinox_phase1" -FilePath (Join-Path $root "tests\sql\auth_stub.sql")

  $migrations = Get-ChildItem (Join-Path $root "supabase\migrations") -Filter "*.sql" | Sort-Object Name
  foreach ($m in $migrations) {
    Invoke-PsqlFile -Database "equinox_phase1" -FilePath $m.FullName
  }

  Invoke-PsqlFile -Database "equinox_phase1" -FilePath (Join-Path $root "supabase\seed.sql")
  Invoke-PsqlFile -Database "equinox_phase1" -FilePath (Join-Path $root "tests\sql\validate_foundation.sql")
  Invoke-PsqlFile -Database "equinox_phase1" -FilePath (Join-Path $root "tests\sql\validate_auth.sql")
  Invoke-PsqlFile -Database "equinox_phase1" -FilePath (Join-Path $root "tests\sql\validate_sales_order.sql")
  Invoke-PsqlFile -Database "equinox_phase1" -FilePath (Join-Path $root "tests\sql\validate_invoice.sql")
  Invoke-PsqlFile -Database "equinox_phase1" -FilePath (Join-Path $root "tests\sql\validate_atw.sql")
  Invoke-PsqlFile -Database "equinox_phase1" -FilePath (Join-Path $root "tests\sql\validate_ws.sql")

  Write-Host "PHASE 1-7 DATABASE VALIDATION PASSED"
  exit 0
}
finally {
  if ($started) {
    & $pgCtl -D $dataDir stop -m fast | Out-Null
  }
  if (Test-Path $dataDir) {
    Start-Sleep -Seconds 1
    Remove-Item -Recurse -Force $dataDir -ErrorAction SilentlyContinue
  }
}
