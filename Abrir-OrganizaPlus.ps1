$ErrorActionPreference = "SilentlyContinue"

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:3000"

function Test-OrganizaPlus {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

if (-not (Test-OrganizaPlus)) {
  $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
  if (-not $npm) {
    $npm = "npm.cmd"
  }

  Start-Process -FilePath $npm -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1") -WorkingDirectory $project -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline -and -not (Test-OrganizaPlus)) {
    Start-Sleep -Milliseconds 700
  }
}

Start-Process $url
