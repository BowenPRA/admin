# Full copy of The Current's Supabase database, made with pg_dump.
#
# First time (once per laptop):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\sbowe\admin\scripts\backup-database.ps1" -SetUp
# Every backup after that:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\sbowe\admin\scripts\backup-database.ps1"
#
# -SetUp asks for the Session pooler connection string (Supabase > Connect > Direct) and
# the database password, which it tries against the database (three tries) before saving.
# The password is saved encrypted for this Windows user only
# (%APPDATA%\PRA\the-current-database.json), never in the repository.
#
# Each run writes the-current-YYYY-MM-DD-HHmm.dump (pg_dump custom format) to -Folder,
# checks it with pg_restore --list and adds a line to backup-log.txt. Every copy is kept
# (about 2 MB each in October 2026); -Keep 30 would keep only the newest 30. The handbook chapter "Behind the scenes" says how to read a copy back.
# Needs PostgreSQL 18's command-line tools (C:\Program Files\PostgreSQL\18\bin).
# Plain ASCII on purpose: Windows PowerShell 5.1 reads files without a BOM as ANSI.

param(
  [switch]$SetUp,
  [string]$Folder = 'C:\Users\sbowe\PRA Backups\Database',
  [int]$Keep = 0
)

$ErrorActionPreference = 'Stop'
$configPath = Join-Path $env:APPDATA 'PRA\the-current-database.json'

function Find-PgTool([string]$name) {
  $found = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin' -Filter "$name.exe" -Recurse -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.FullName -replace '^.*\\PostgreSQL\\(\d+)\\.*$', '$1') } -Descending |
    Select-Object -First 1
  if (-not $found) { throw "$name.exe not found. Install PostgreSQL 18's command-line tools first (see the handbook, Behind the scenes > Backups)." }
  $found.FullName
}

# Runs a native program and returns its exit code and output. Windows PowerShell turns
# a program's stderr lines into errors, so 'Stop' must not apply here.
function Invoke-Native([string]$exe, [string[]]$argList) {
  $ErrorActionPreference = 'Continue'
  $output = & $exe @argList 2>&1 | ForEach-Object { "$_" }
  @{ Code = $LASTEXITCODE; Output = $output }
}

function Write-Log([string]$line) {
  Add-Content -Path (Join-Path $Folder 'backup-log.txt') -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $line)
}

function Set-PgPassword([Security.SecureString]$secure) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$env:PGSSLMODE = 'require'
$env:PGCONNECT_TIMEOUT = '20'

if ($SetUp) {
  Write-Host 'In Supabase open the project, click Connect at the top, choose Direct, then'
  Write-Host 'Session pooler, and copy the string. Paste it as it is, with [YOUR-PASSWORD] still in it.'
  $uri = (Read-Host 'Connection string').Trim()
  $m = [regex]::Match($uri, '^postgres(?:ql)?://([^:@/]+)(?::([^@]*))?@([^/]+)/([^?]+)')
  if (-not $m.Success) { throw 'That does not look like a postgresql:// connection string.' }
  $user = $m.Groups[1].Value
  $hostPort = $m.Groups[3].Value
  $database = $m.Groups[4].Value
  if ($hostPort -notmatch ':5432$') { Write-Warning 'The Session pooler uses port 5432. Check you copied the Session pooler string, not Transaction pooler (6543).' }
  $url = "postgresql://$user@$hostPort/$database"
  $psql = Find-PgTool 'psql'

  # Each password is tried against the database before it is saved. Supabase blocks a
  # computer for a while after repeated wrong passwords, so three tries, then reset it.
  $secure = $null
  for ($try = 1; $try -le 3 -and -not $secure; $try++) {
    $candidate = Read-Host "Database password (try $try of 3)" -AsSecureString
    Set-PgPassword $candidate
    $test = Invoke-Native $psql @('--no-password', '--no-psqlrc', '--tuples-only', '--dbname', $url, '--command', 'select 1')
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($test.Code -eq 0) { $secure = $candidate; Write-Host 'Password accepted.' -ForegroundColor Green }
    elseif (($test.Output -join ' ') -match 'password authentication failed|wrong password|invalid password') { Write-Host 'Wrong password.' -ForegroundColor Yellow }
    else {
      throw ("Could not reach the database:`n{0}`nAfter several wrong passwords Supabase blocks the computer for a while; Database > Settings > Network Bans lifts it." -f ($test.Output -join "`n"))
    }
  }
  if (-not $secure) {
    Write-Host 'Nothing saved. Reset the password in Supabase (Database > Settings > Reset database password) and run -SetUp again.' -ForegroundColor Red
    exit 1
  }
  $config = [ordered]@{
    url      = $url
    password = ($secure | ConvertFrom-SecureString)
    saved    = (Get-Date -Format 'yyyy-MM-dd HH:mm')
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $configPath) | Out-Null
  $config | ConvertTo-Json | Set-Content -Path $configPath -Encoding ASCII
  Write-Host "Saved for this Windows user in $configPath. Now run the script without -SetUp to make a backup."
  exit 0
}

if (-not (Test-Path $configPath)) {
  Write-Host 'No saved connection. Run this script once with -SetUp.' -ForegroundColor Red
  exit 1
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json
Set-PgPassword (ConvertTo-SecureString $config.password)

New-Item -ItemType Directory -Force -Path $Folder | Out-Null
$name = 'the-current-{0}.dump' -f (Get-Date -Format 'yyyy-MM-dd-HHmm')
$target = Join-Path $Folder $name
$partial = "$target.partial"

try {
  $pgDump = Find-PgTool 'pg_dump'
  $pgRestore = Find-PgTool 'pg_restore'

  Write-Host "Copying the database to $target ..."
  $dump = Invoke-Native $pgDump @('--format=custom', '--no-password', '--dbname', $config.url, '--file', $partial)
  if ($dump.Code -ne 0 -or -not (Test-Path $partial)) {
    throw ("pg_dump failed (exit {0}):`n{1}" -f $dump.Code, ($dump.Output -join "`n"))
  }

  # A copy only counts once pg_restore can read its table of contents.
  $list = Invoke-Native $pgRestore @('--list', $partial)
  if ($list.Code -ne 0) { throw ("The copy could not be read back:`n{0}" -f ($list.Output -join "`n")) }
  $tables = @($list.Output | Where-Object { $_ -match ' TABLE DATA ' }).Count
  Move-Item -Path $partial -Destination $target

  $mb = [math]::Round((Get-Item $target).Length / 1MB, 1)
  $line = "OK      $name  $mb MB  $tables tables with data"
  if ($dump.Output) { $line += "  (pg_dump said: " + (($dump.Output | Select-Object -First 3) -join ' | ') + ')' }
  Write-Log $line
  Write-Host "Done: $mb MB, $tables tables with data."

  if ($Keep -gt 0) {
    $old = @(Get-ChildItem $Folder -Filter 'the-current-*.dump' | Sort-Object Name -Descending | Select-Object -Skip $Keep)
    foreach ($f in $old) { Remove-Item $f.FullName; Write-Log "Removed $($f.Name) (keeping the newest $Keep)" }
  }
}
catch {
  if (Test-Path $partial) { Remove-Item $partial }
  $reason = (($_.Exception.Message -split "`n") | Select-Object -First 2) -join ' | '
  Write-Log "FAILED  $name  $reason"
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
