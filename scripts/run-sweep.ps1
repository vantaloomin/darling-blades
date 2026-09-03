# Launch the persona metagame sweep as a Windows Scheduled Task.
#
# WHY A SCHEDULED TASK. The 2026-08-25 sweep was launched with Start-Process
# from a tool shell and died 4h36 in, silently, with a zero-byte log. A child
# process started that way belongs to the launching session's job object, so it
# goes down when that session does. A scheduled task is owned by the OS and
# survives the shell, the terminal, and the agent that started it.
#
# The task runs once, immediately, under the current user. It does not persist
# a schedule: -Once with a start time in the past fires straight away, and the
# task is removed when the run completes.
#
#   .\scripts\run-sweep.ps1                     # start a fresh sweep
#   .\scripts\run-sweep.ps1 -Resume             # continue from the journal
#   .\scripts\run-sweep.ps1 -Workers 4          # gentler on the machine
#   .\scripts\run-sweep.ps1 -Status             # is it alive, and how far in
#   .\scripts\run-sweep.ps1 -Stop               # end it (journal is kept)

param(
  [int]$Workers = 8,
  [int]$Rounds = 4,
  [int]$Seeds = 150,
  [int]$Iterations = 80,
  [string]$Field = 'prefabs',
  [string]$Worktree = 'Z:\Coding Projects\DarlingBlades-sweep',
  [string]$Root = 'Z:\Coding Projects\DarlingBlades',
  [switch]$Resume,
  [switch]$Status,
  [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$TaskName = 'DarlingBladesSweep'
$OutDir = Join-Path $Root 'balance\sweep-current'
$StatusFile = Join-Path $Root 'balance\metagame-sweep-status.json'
$Journal = Join-Path $OutDir 'craft-journal.jsonl'

function Get-SweepProcess {
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*craft.ts*' -and $_.CommandLine -like '*--metagame*' })
}

function Get-DurableCraftCount {
  param([string]$Path)
  $count = 0
  foreach ($line in @(Get-Content -LiteralPath $Path -ErrorAction Stop)) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try { $entry = $line | ConvertFrom-Json -ErrorAction Stop } catch { continue }
    if ($null -ne $entry.crafted -and $null -ne $entry.personaId -and $null -ne $entry.round) {
      $count++
    }
  }
  return $count
}

if ($Status) {
  try { $procs = @(Get-SweepProcess) } catch { $procs = @() }
  $liveCount = 0
  foreach ($p in $procs) {
    try {
      $pr = Get-Process -Id $p.ProcessId -ErrorAction Stop
      $liveCount++
      Write-Host "sweep: running (pid $($p.ProcessId), $([math]::Round($pr.CPU,0)) cpu-seconds)"
    } catch {
      Write-Host "sweep: process $($p.ProcessId) exited during status check"
    }
  }
  if ($liveCount -eq 0) { Write-Host 'sweep: NOT RUNNING' }
  if (Test-Path $Journal) {
    try {
      $done = Get-DurableCraftCount -Path $Journal
      Write-Host "journal: $done complete craft(s) durable at $Journal"
    } catch {
      Write-Host 'journal: unavailable because it could not be read safely'
    }
  } else { Write-Host 'journal: none yet' }
  $s = $null
  if (Test-Path $StatusFile) {
    try {
      $s = Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
      Write-Host "status: $($s.state) | round $($s.round)/$($s.maxRounds) | crafting $($s.personaName)"
      try { Write-Host "last written: $((Get-Item -LiteralPath $StatusFile -ErrorAction Stop).LastWriteTime)" } catch {}
    } catch {
      Write-Host 'status: unavailable because the status file is absent or incomplete'
    }
  } else { Write-Host 'status: unavailable because the status file is absent or incomplete' }
  if ($s -and $s.state -eq 'running' -and $liveCount -eq 0) {
    Write-Host 'reconciliation: the status file says running, but no sweep process exists. The status is stale.'
  }
  $crash = Join-Path $OutDir 'craft-crash.log'
  if (Test-Path $crash) { Write-Host "CRASH LOG PRESENT: $crash"; Get-Content $crash -Tail 5 }
  return
}

if ($Stop) {
  try { $procs = @(Get-SweepProcess) } catch { $procs = @() }
  foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
  $stoppedAt = [DateTime]::UtcNow.ToString('o')
  $statusPayload = [ordered]@{}
  if (Test-Path $StatusFile) {
    try {
      $existingStatus = Get-Content -LiteralPath $StatusFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
      foreach ($property in $existingStatus.PSObject.Properties) {
        $statusPayload[$property.Name] = $property.Value
      }
    } catch {}
  }
  $statusPayload['state'] = 'stopped'
  $statusPayload['updatedAt'] = $stoppedAt
  $statusPayload['stoppedAt'] = $stoppedAt
  $statusPayload['stoppedProcesses'] = $procs.Count
  $statusPayload['stopReason'] = 'Stopped by operator'
  $statusDir = Split-Path -Parent $StatusFile
  New-Item -ItemType Directory -Force -Path $statusDir | Out-Null
  $statusTemp = "$StatusFile.stop-$PID.tmp"
  try {
    $json = $statusPayload | ConvertTo-Json -Depth 8
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($statusTemp, $json, $utf8NoBom)
    Move-Item -LiteralPath $statusTemp -Destination $StatusFile -Force
  } catch {
    Remove-Item -LiteralPath $statusTemp -Force -ErrorAction SilentlyContinue
    Write-Host "WARNING: could not stamp stopped status: $($_.Exception.Message)"
  }
  try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop } catch {}
  Write-Host "stopped $($procs.Count) process(es). The journal is kept; restart with -Resume."
  return
}

if ((Get-SweepProcess).Count -gt 0) {
  Write-Host 'A sweep is already running. Use -Status, or -Stop first.'
  return
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Kept out of the argument string so a path with spaces cannot split it.
$scriptArgs = @(
  'tsx', 'scripts/personas/craft.ts', '--metagame', '--all',
  '--pool', 'all', '--field', $Field,
  '--seeds', "$Seeds", '--iterations', "$Iterations", '--rounds', "$Rounds",
  '--workers', "$Workers",
  '--out', "`"$OutDir`"",
  '--status-file', "`"$StatusFile`""
)
if ($Resume) { $scriptArgs += '--resume' }

# Resolve npx.cmd ABSOLUTELY and run it through cmd.exe with output redirected.
# Task Scheduler does not reliably give the task the interactive PATH, so
# -Execute 'npx.cmd' registers fine and then exits 0x1 the moment it runs, with
# nothing written anywhere. Found 2026-08-26. The redirect is the other half:
# without it a task failure leaves no evidence at all.
$npx = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
if (-not $npx) { Write-Host 'npx.cmd not found on PATH; cannot register the task.'; exit 1 }
$TaskLog = Join-Path $OutDir 'sweep-task.log'
$inner = '"{0}" {1} > "{2}" 2>&1' -f $npx, ($scriptArgs -join ' '), $TaskLog
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c "' + $inner + '"') -WorkingDirectory $Worktree
# A start time already in the past fires immediately.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(-60)
# NOTE: -DeleteExpiredTaskAfter is deliberately absent. It requires the trigger
# to carry an EndBoundary, and a -Once trigger has none, so including it makes
# Register-ScheduledTask fail with "The task XML is missing a required element
# or attribute (EndBoundary)". Found the hard way 2026-08-26.
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::FromDays(7)) `
  -RestartCount 0 -MultipleInstances IgnoreNew

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop } catch {}
try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -RunLevel Limited -Force -ErrorAction Stop | Out-Null
} catch {
  Write-Host "FAILED to register the scheduled task: $($_.Exception.Message)"
  Write-Host 'Nothing was launched.'
  exit 1
}
try { Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop } catch {
  Write-Host "FAILED to start the scheduled task: $($_.Exception.Message)"
  Write-Host 'Nothing was launched.'
  exit 1
}

# VERIFY, do not assume. The first version of this script printed "sweep
# launched" unconditionally and did so on a run where registration had failed
# and nothing was running at all. A launcher that lies about its own state is
# the same failure as a status file that says `running` for a dead process.
$deadline = (Get-Date).AddSeconds(90)
$seen = $false
while ((Get-Date) -lt $deadline) {
  if ((Get-SweepProcess).Count -gt 0) { $seen = $true; break }
  Start-Sleep -Seconds 3
}
if (-not $seen) {
  Write-Host 'Task started but NO sweep process appeared within 90 seconds.'
  $res = (Get-ScheduledTaskInfo -TaskName $TaskName).LastTaskResult
  Write-Host ("LastTaskResult: 0x{0:X}" -f $res)
  if (Test-Path $TaskLog) { Write-Host '--- task log ---'; Get-Content $TaskLog -Tail 20 }
  else { Write-Host "No task log at $TaskLog; the action never produced output." }
  exit 1
}

Write-Host "sweep launched as scheduled task '$TaskName' and VERIFIED running"
Write-Host "  worktree : $Worktree"
Write-Host "  out      : $OutDir"
Write-Host "  journal  : $Journal"
Write-Host "  status   : $StatusFile"
Write-Host "  task log : $TaskLog"
Write-Host "  resume   : .\scripts\run-sweep.ps1 -Resume"
Write-Host ''
Write-Host 'It now outlives this shell. Check on it with -Status.'
