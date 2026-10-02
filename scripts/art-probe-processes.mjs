/* global process */
import { execFileSync } from 'node:child_process';

// These helpers only inspect processes. The desktop launcher, which owns the
// native application and its disposable profile, also owns their shutdown.
const MIB = 1024 * 1024;
const EXEC_OPTIONS = { encoding: 'utf8', windowsHide: true, timeout: 20_000, maxBuffer: 8 * MIB };

const DISCOVER_APP = String.raw`
import json, os, sys
import psutil

request = json.loads(sys.argv[1])
cdp_ids = set(request['cdpIds'])
app_names = {'app.exe', 'darling blades.exe'}

def fail(kind, message):
    print(json.dumps({'error': {'kind': kind, 'message': message}}))
    sys.exit(0)

def is_app(proc):
    return proc.name().lower() in app_names

def describe(proc):
    with proc.oneshot():
        return {'pid': proc.pid, 'ppid': proc.ppid(), 'name': proc.name(),
                'cmdline': proc.cmdline(), 'startedAt': proc.create_time()}

try:
    requested = request.get('appPid')
    if requested is None:
        candidates = set()
        unowned = []
        for pid in cdp_ids:
            candidate = None
            for ancestor in psutil.Process(pid).parents():
                if is_app(ancestor):
                    candidate = ancestor.pid
                    break
            if candidate is None:
                unowned.append(pid)
            else:
                candidates.add(candidate)
        if len(candidates) > 1:
            fail('ambiguousApp', 'CDP processes belong to multiple app processes: ' + str(sorted(candidates)))
        if not candidates:
            fail('noApp', 'No app.exe or Darling Blades.exe ancestor was found for the CDP processes')
        if unowned:
            fail('foreignCdpProcesses', 'CDP processes have no matching app ancestor: ' + str(sorted(unowned)))
        requested = next(iter(candidates))

    app = psutil.Process(requested)
    if not is_app(app):
        fail('wrongApp', 'Requested PID is not app.exe or Darling Blades.exe: ' + str(requested))
    app_started = app.create_time()
    if request.get('expectedStartedAt') is not None and app_started != request['expectedStartedAt']:
        fail('reusedAppPid', 'App PID creation time changed: ' + str(requested))
    exe = app.exe()
    if os.path.basename(exe).lower() not in app_names:
        fail('wrongApp', 'Requested app executable does not have an expected binary name')
    if request.get('expectedExe') is not None and os.path.normcase(exe) != os.path.normcase(request['expectedExe']):
        fail('changedAppExecutable', 'App executable changed for PID ' + str(requested))

    descendants = []
    for child in app.children(recursive=True):
        try:
            entry = describe(child)
            if entry['startedAt'] < app_started:
                fail('invalidAncestry', 'A descendant predates the app: ' + str(child.pid))
            descendants.append(entry)
        except psutil.NoSuchProcess:
            # A disappearing CDP process is still rejected by the membership
            # check below; an exited, unrelated helper needs no measurement.
            continue
    descendant_ids = {entry['pid'] for entry in descendants}
    foreign = cdp_ids - descendant_ids
    if foreign:
        fail('foreignCdpProcesses', 'CDP PIDs are not live descendants of the app: ' + str(sorted(foreign)))
    if not app.is_running() or app.create_time() != app_started:
        fail('appExited', 'The native app exited while its process tree was inspected')
    print(json.dumps({'pid': app.pid, 'exe': exe, 'startedAt': app_started, 'nativeProcess': describe(app),
                      'processes': sorted(descendants, key=lambda entry: entry['pid'])}))
except psutil.AccessDenied as error:
    fail('providerDenied', 'Process inspection denied for PID ' + str(error.pid))
except psutil.NoSuchProcess as error:
    fail('processExited', 'Process exited before inspection: ' + str(error.pid))
except Exception as error:
    fail('providerFailure', type(error).__name__ + ': ' + str(error))
`;

const READ_MEMORY = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$rows = @()
foreach ($entry in $request.processes) {
  $row = [ordered]@{
    pid = [int]$entry.pid
    name = $null
    startedAt = $null
    privateBytes = $null
    gpuDedicatedBytes = $null
    gpuSharedBytes = $null
    unavailable = @()
  }
  try {
    $observed = Get-Process -Id $entry.pid -ErrorAction Stop
    if ($observed.HasExited) { throw 'Process exited before memory measurement' }
    $row.name = $observed.ProcessName
    $row.startedAt = ($observed.StartTime.ToUniversalTime() - [datetime]::SpecifyKind([datetime]'1970-01-01', [DateTimeKind]::Utc)).TotalSeconds
    # The providers express Unix time through different .NET/Python floating
    # point conversions. One millisecond covers that conversion, not PID reuse.
    if ($null -ne $entry.startedAt -and [math]::Abs($row.startedAt - [double]$entry.startedAt) -gt 0.001) {
      throw 'Process creation time changed before memory measurement'
    }
    $row.privateBytes = [long]$observed.PrivateMemorySize64
    if ($row.privateBytes -lt 0) { throw 'Process private memory was negative' }
  } catch {
    $row.privateBytes = $null
    $row.unavailable += @{ measurement = 'privateBytes'; reason = $_.Exception.Message }
  }

  if ($entry.role -eq 'gpu') {
    foreach ($metric in @(
      @{ field = 'gpuDedicatedBytes'; counter = 'Dedicated Usage' },
      @{ field = 'gpuSharedBytes'; counter = 'Shared Usage' }
    )) {
      try {
        # Counter data alone cannot prove that a reused PID is the process we
        # inspected. Do not publish it when process identity was unavailable.
        if ($null -eq $row.privateBytes) { throw 'Process identity or private memory was unavailable' }
        $counterPath = '\GPU Process Memory(pid_' + $entry.pid + '_*)\' + $metric.counter
        $samples = @((Get-Counter -Counter $counterPath -ErrorAction Stop).CounterSamples)
        if ($samples.Count -eq 0) { throw 'No GPU process counter instance was returned' }
        $total = 0.0
        foreach ($sample in $samples) {
          if ($sample.Status -ne 0 -and $sample.Status -ne 1) {
            throw ('GPU process counter status ' + $sample.Status)
          }
          $value = [double]$sample.CookedValue
          if ([double]::IsNaN($value) -or [double]::IsInfinity($value) -or $value -lt 0) {
            throw 'GPU process counter value was invalid'
          }
          $total += $value
        }
        $row[$metric.field] = $total
      } catch {
        $row[$metric.field] = $null
        $row.unavailable += @{ measurement = $metric.field; reason = $_.Exception.Message }
      }
    }
  }
  $rows += [pscustomobject]$row
}
ConvertTo-Json -InputObject @{ processes = $rows } -Depth 7 -Compress
`;

function cdpEntries(cdpProcesses) {
  if (!Array.isArray(cdpProcesses) || cdpProcesses.length === 0) throw new Error('CDP returned no process identities');
  const entries = new Map();
  for (const entry of cdpProcesses) {
    const pid = Number(entry.id);
    if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('CDP returned an invalid process ID');
    if (!entries.has(pid)) entries.set(pid, { pid, types: [] });
    const type = String(entry.type ?? '').toLowerCase();
    if (!entries.get(pid).types.includes(type)) entries.get(pid).types.push(type);
  }
  return entries;
}

function providerError(error) {
  return String(error?.stderr?.toString().trim() || error?.message || error).slice(0, 1600);
}

function parseProviderJson(output) {
  return JSON.parse(output.replace(/^\uFEFF/, '').trim());
}

function inspectApp(entries, requestedAppPid, previous = null) {
  if (requestedAppPid !== null && (!Number.isSafeInteger(Number(requestedAppPid)) || Number(requestedAppPid) < 1)) {
    throw new Error('The requested app PID must be a positive integer');
  }
  const request = {
    cdpIds: [...entries.keys()],
    appPid: requestedAppPid === null ? null : Number(requestedAppPid),
    expectedStartedAt: previous?.startedAt ?? null,
    expectedExe: previous?.exe ?? null,
  };
  const output = execFileSync('python', ['-c', DISCOVER_APP, JSON.stringify(request)], EXEC_OPTIONS);
  const result = parseProviderJson(output);
  if (result.error) throw new Error(`${result.error.kind}: ${result.error.message}`);
  return result;
}

/** Discover one native application and prove every CDP PID belongs to it. */
export function discoverAttachedApp(cdpProcesses, requestedAppPid = null) {
  const { pid, exe, startedAt, processes } = inspectApp(cdpEntries(cdpProcesses), requestedAppPid);
  return { pid, exe, startedAt, processes };
}

function processRole(entry, types) {
  const args = Array.isArray(entry.cmdline) ? entry.cmdline.map((arg) => String(arg).toLowerCase()) : [];
  const argumentTypes = args.flatMap((arg, index) => arg.startsWith('--type=')
    ? [arg.slice('--type='.length)] : arg === '--type' ? [args[index + 1]] : []);
  const gpu = [...types, ...argumentTypes].some((type) => type === 'gpu' || type === 'gpu-process');
  const renderer = [...types, ...argumentTypes].includes('renderer');
  if (gpu && renderer) throw new Error(`Conflicting GPU/renderer identity for PID ${entry.pid}`);
  return gpu ? 'gpu' : renderer ? 'renderer' : 'other';
}

/**
 * Return exact MiB totals, plus raw bytes and identity evidence for every PID.
 * A missing provider, process or counter produces null, never a fabricated 0.
 * Attach refreshes the same native app's descendants; standalone measurements
 * use only CDP's exact PIDs. Neither path discovers unrelated browser processes.
 */
export function readProcessMemory(cdpProcesses, attachedApp = null) {
  const unavailable = [];
  const processEvidence = {
    app: attachedApp === null ? null : { pid: attachedApp.pid, exe: attachedApp.exe, startedAt: attachedApp.startedAt },
    processes: [],
  };
  const result = {
    gpuPrivateMiB: null, gpuDedicatedMiB: null, gpuSharedMiB: null, rendererPrivateMiB: null,
    processEvidence, unavailable,
  };
  let entries;
  try {
    const identities = cdpEntries(cdpProcesses);
    if (attachedApp !== null) {
      if (!Number.isSafeInteger(attachedApp.pid) || attachedApp.pid < 1 || !Number.isFinite(attachedApp.startedAt) || typeof attachedApp.exe !== 'string') {
        throw new Error('Attached app lacks executable and creation-time evidence');
      }
      const refreshed = inspectApp(identities, attachedApp.pid, attachedApp);
      processEvidence.app = { ...refreshed.nativeProcess, exe: refreshed.exe };
      entries = refreshed.processes;
    } else {
      entries = [...identities.values()].map(({ pid }) => ({ pid, ppid: null, name: null, cmdline: null, startedAt: null }));
    }
    entries = entries.map((entry) => {
      const cdpTypes = identities.get(entry.pid)?.types ?? [];
      return { ...entry, cdpTypes, role: processRole(entry, cdpTypes) };
    });
    processEvidence.processes = entries.map((entry) => ({
      ...entry, privateBytes: null, gpuDedicatedBytes: null, gpuSharedBytes: null, unavailable: [],
    }));
  } catch (error) {
    unavailable.push({ measurement: 'processIdentity', reason: providerError(error) });
    return result;
  }

  if (process.platform !== 'win32') {
    unavailable.push({ measurement: 'processMemory', reason: 'Windows Get-Process and GPU process counters are required' });
    return result;
  }

  const measured = entries.filter((entry) => entry.role === 'gpu' || entry.role === 'renderer');
  let providerRows;
  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', READ_MEMORY], {
      ...EXEC_OPTIONS,
      input: JSON.stringify({ processes: measured.map(({ pid, role, startedAt }) => ({ pid, role, startedAt })) }),
    });
    providerRows = parseProviderJson(output).processes;
    if (!Array.isArray(providerRows)) throw new Error('Memory provider returned no process rows');
  } catch (error) {
    unavailable.push({ measurement: 'processMemory', reason: providerError(error) });
    return result;
  }

  const byPid = new Map(providerRows.map((row) => [Number(row.pid), row]));
  for (const evidence of processEvidence.processes) {
    if (evidence.role === 'other') continue;
    const row = byPid.get(evidence.pid);
    if (row === undefined) {
      evidence.unavailable.push({ measurement: 'processMemory', reason: 'Memory provider omitted this PID' });
    } else {
      evidence.observedName = row.name;
      evidence.observedStartedAt = row.startedAt;
      const fields = evidence.role === 'gpu'
        ? ['privateBytes', 'gpuDedicatedBytes', 'gpuSharedBytes'] : ['privateBytes'];
      for (const field of fields) {
        if (typeof row[field] === 'number' && Number.isFinite(row[field]) && row[field] >= 0) evidence[field] = row[field];
        else evidence.unavailable.push({ measurement: field, reason: row.unavailable?.find((item) => item.measurement === field)?.reason ?? 'No valid measurement was returned' });
      }
    }
    for (const detail of evidence.unavailable) unavailable.push({ pid: evidence.pid, ...detail });
  }

  const total = (role, field) => {
    const rows = processEvidence.processes.filter((entry) => entry.role === role);
    if (rows.length === 0) {
      unavailable.push({ measurement: field, reason: `No ${role} process was identified` });
      return null;
    }
    if (rows.some((entry) => entry[field] === null)) return null;
    return rows.reduce((sum, entry) => sum + entry[field], 0) / MIB;
  };
  result.gpuPrivateMiB = total('gpu', 'privateBytes');
  result.gpuDedicatedMiB = total('gpu', 'gpuDedicatedBytes');
  result.gpuSharedMiB = total('gpu', 'gpuSharedBytes');
  result.rendererPrivateMiB = total('renderer', 'privateBytes');
  return result;
}
