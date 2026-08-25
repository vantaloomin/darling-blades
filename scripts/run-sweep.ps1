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

if ($Status) {
  $procs = Get-SweepProcess
  if ($procs.Count -eq 0) { Write-Host 'sweep: NOT RUNNING' } else {
    foreach ($p in $procs) {
      $pr = Get-Process -Id $p.ProcessId
      Write-Host "sweep: running (pid $($p.ProcessId), $([math]::Round($pr.CPU,0)) cpu-seconds)"
    }
  }
  if (Test-Path $Journal) {
    $done = @(Get-Content $Journal | Where-Object { $_.Trim() }).Count
    Write-Host "journal: $done craft(s) durable at $Journal"
  } else { Write-Host 'journal: none yet' }
  if (Test-Path $StatusFile) {
    $s = Get-Content $StatusFile -Raw | ConvertFrom-Json
    Write-Host "status: $($s.state) | round $($s.round)/$($s.maxRounds) | crafting $($s.personaName)"
    Write-Host "last written: $((Get-Item $StatusFile).LastWriteTime)"
  }
  $crash = Join-Path $OutDir 'craft-crash.log'
  if (Test-Path $crash) { Write-Host "CRASH LOG PRESENT: $crash"; Get-Content $crash -Tail 5 }
  return
}

if ($Stop) {
  $procs = Get-SweepProcess
  foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
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

$action = New-ScheduledTaskAction -Execute 'npx.cmd' -Argument ($scriptArgs -join ' ') -WorkingDirectory $Worktree
# A start time already in the past fires immediately.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(-60)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::FromDays(7)) `
  -RestartCount 0 -MultipleInstances IgnoreNew `
  -DeleteExpiredTaskAfter ([TimeSpan]::FromMinutes(5))

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop } catch {}
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -RunLevel Limited -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "sweep launched as scheduled task '$TaskName'"
Write-Host "  worktree : $Worktree"
Write-Host "  out      : $OutDir"
Write-Host "  journal  : $Journal"
Write-Host "  status   : $StatusFile"
Write-Host "  resume   : .\scripts\run-sweep.ps1 -Resume"
Write-Host ''
Write-Host 'It now outlives this shell. Check on it with -Status.'
