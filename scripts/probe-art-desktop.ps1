# Gate 6 launcher, including ownership and cleanup. Windows PowerShell 5.1.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Out,
    [switch]$SkipBuild,
    [string]$AppExe,
    [ValidateRange(1024, 65535)][int]$Port = 9431
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$gateOut = [IO.Path]::GetFullPath($Out)
$helper = Join-Path $PSScriptRoot 'art-probe-native-cleanup.py'
$utf8 = [Text.UTF8Encoding]::new($false)
New-Item -ItemType Directory -Path $gateOut -Force | Out-Null
$probePath = Join-Path $gateOut 'gate6-desktop.json'
if (Test-Path -LiteralPath $probePath) { throw 'Use a fresh output directory to preserve existing gate-6 evidence' }
function Write-S6Json([string]$Path, $Value) {
    [IO.File]::WriteAllText($Path, (ConvertTo-Json -InputObject $Value -Depth 20), $utf8)
}
Push-Location $repoRoot
try {
    python $helper check
    if ($LASTEXITCODE -ne 0) { throw 'Python with psutil is required before launching the app' }
    if (-not $SkipBuild) {
        npm.cmd run app:build
        if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed' }
        if (-not $AppExe) {
            $cargoJson = cargo metadata --no-deps --locked --format-version 1 --manifest-path src-tauri/Cargo.toml
            if ($LASTEXITCODE -ne 0) { throw 'Cargo metadata failed' }
            $AppExe = Join-Path (($cargoJson | ConvertFrom-Json).target_directory) 'release\app.exe'
        }
    }
    # SkipBuild needs neither Cargo nor a rebuild. Override AppExe for custom target directories.
    if (-not $AppExe) { $AppExe = Join-Path $repoRoot 'src-tauri\target\release\app.exe' }
    $AppExe = (Resolve-Path -LiteralPath $AppExe).Path
    $portCheck = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    try { $portCheck.Start() } finally { $portCheck.Stop() }
    $oldArguments = [Environment]::GetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS')
    $oldProfile = [Environment]::GetEnvironmentVariable('WEBVIEW2_USER_DATA_FOLDER')
    $desktop = $null
    $nativeStartTicks = $null
    $ownedProcesses = @()
    $cleanupErrors = @()
    $probeExit = 1
    $cleanupExit = 1
    $cleanupPath = Join-Path $gateOut 'native-cleanup.json'
    $snapshotPath = Join-Path $gateOut ('native-snapshot-' + [guid]::NewGuid() + '.json')
    $ownedPath = Join-Path $gateOut ('native-owned-' + [guid]::NewGuid() + '.json')
    Write-S6Json $cleanupPath @{ tracked = @(); remaining = @(); errors = @('Cleanup has not run yet') }
    function Get-S6OwnedTree([int]$AppPid) {
        python $helper snapshot --pid $AppPid --output $snapshotPath
        if ($LASTEXITCODE -ne 0) { throw "Could not record native descendants; inspect $snapshotPath" }
        @((Get-Content -LiteralPath $snapshotPath -Raw | ConvertFrom-Json).tracked)
    }
    try {
        $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$Port"
        $env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $gateOut ('webview-profile-' + [guid]::NewGuid())
        Write-S6Json (Join-Path $gateOut 'native-launch.json') @{
            appExe = $AppExe; sha256 = (Get-FileHash -LiteralPath $AppExe -Algorithm SHA256).Hash
            skipBuild = [bool]$SkipBuild; port = $Port; profile = $env:WEBVIEW2_USER_DATA_FOLDER
        }
        $desktop = Start-Process -FilePath $AppExe -WindowStyle Hidden -PassThru
        $nativeStartTicks = $desktop.StartTime.ToUniversalTime().Ticks
        $ownedProcesses += Get-S6OwnedTree $desktop.Id
        node scripts/probe-art.mjs --attach $Port --app-pid $desktop.Id --tier full --stream default --repeat 1 --out $gateOut --label gate6-desktop
        $probeExit = $LASTEXITCODE
    } finally {
        # Include identities the probe observed, even if the native app exited
        # before this finally and left orphaned WebViews. Never trust another run.
        if ($null -ne $desktop -and (Test-Path -LiteralPath $probePath)) {
            try {
                $evidence = Get-Content -LiteralPath $probePath -Raw | ConvertFrom-Json
                $launchedAt = ($nativeStartTicks - ([datetime]'1970-01-01').Ticks) / 10000000.0
                $app = $evidence.gate6.app
                if ($app.pid -ne $desktop.Id -or [math]::Abs($app.startedAt - $launchedAt) -gt 0.001) {
                    throw 'Probe process evidence does not match this native launch'
                }
                $ownedProcesses += @($app.processes | Select-Object pid, startedAt)
                foreach ($stop in $evidence.stops) {
                    foreach ($sample in @($stop) + @($stop.memorySampling.observations)) {
                        $observed = $sample.processEvidence
                        if ($observed.app.pid -eq $desktop.Id -and [math]::Abs($observed.app.startedAt - $launchedAt) -le 0.001) {
                            $ownedProcesses += @($observed.processes | Select-Object pid, startedAt)
                        }
                    }
                }
            } catch { $cleanupErrors += $_.Exception.Message }
        }
        try {
            if ($null -ne $desktop) {
                $current = Get-Process -Id $desktop.Id -ErrorAction SilentlyContinue
                if ($current -and $current.StartTime.ToUniversalTime().Ticks -eq $nativeStartTicks) {
                    try { $ownedProcesses += Get-S6OwnedTree $desktop.Id }
                    catch { $cleanupErrors += $_.Exception.Message }
                    taskkill.exe /PID $desktop.Id /T /F | Out-Null
                }
            }
        } catch { $cleanupErrors += $_.Exception.Message }
        try {
            # Explicit array and a file prevent PS5.1 empty/singleton pipeline loss.
            Write-S6Json $ownedPath @($ownedProcesses)
            python $helper cleanup --input $ownedPath --output $cleanupPath
            $cleanupExit = $LASTEXITCODE
            $record = Get-Content -LiteralPath $cleanupPath -Raw | ConvertFrom-Json
            $record.errors = @($record.errors) + @($cleanupErrors)
            if ($cleanupExit -ne 0 -and $record.errors.Count -eq 0) {
                $record.errors += "Cleanup helper failed with exit $cleanupExit"
            }
            Write-S6Json $cleanupPath $record
        } catch {
            $cleanupExit = 1
            Write-S6Json $cleanupPath @{ tracked = @($ownedProcesses); remaining = $null
                errors = @($cleanupErrors) + @($_.Exception.Message) }
        } finally {
            [Environment]::SetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', $oldArguments)
            [Environment]::SetEnvironmentVariable('WEBVIEW2_USER_DATA_FOLDER', $oldProfile)
        }
    }
    if ($cleanupErrors.Count -gt 0 -or $cleanupExit -ne 0) { throw "Native cleanup is incomplete or unverified; inspect $cleanupPath" }
    if ($probeExit -ne 0) { throw 'Desktop probe failed or is unmeasured; inspect gate6-desktop.json' }
} finally { Pop-Location }
