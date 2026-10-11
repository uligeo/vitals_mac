import os from 'node:os';
import { execFile } from 'node:child_process';
import type { Battery, Gpu, Memory, PortEntry, Pressure, Process, StaticInfo, Volume } from './types.js';

const sh = (command: string, args: string[], timeout = 1500): Promise<string> => new Promise((resolve) => {
  execFile(command, args, { encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => resolve(error ? '' : stdout));
});

const num = (raw: string, pattern: RegExp): number => Number(raw.match(pattern)?.[1] ?? NaN);

/** Nombre visible: el primer bundle .app de la ruta o, si no hay, el binario. */
export const appName = (command: string): string => command.match(/^.*?\/([^/]+)\.app(\/|$)/)?.[1] || command.split('/').pop() || command;

export async function staticInfo(): Promise<StaticInfo> {
  const [perf, version, gpu] = await Promise.all([
    sh('sysctl', ['-n', 'hw.perflevel0.logicalcpu', 'hw.perflevel1.logicalcpu']),
    sh('sw_vers', ['-productVersion']),
    sh('ioreg', ['-r', '-d', '1', '-w0', '-c', 'IOAccelerator']),
  ]);
  const [pCores, eCores] = perf.trim().split('\n').map(Number);
  return {
    model: os.cpus()[0]?.model || 'CPU',
    cores: os.cpus().length,
    pCores: pCores || 0,
    eCores: eCores || 0,
    macos: version.trim(),
    host: os.hostname().replace(/\.local$/, ''),
    gpuCores: num(gpu, /"gpu-core-count"\s*=\s*(\d+)/) || 0,
  };
}

/** Desglose de memoria con las mismas categorías que Monitor de Actividad. */
export async function memory(): Promise<Memory> {
  const raw = await sh('vm_stat', []);
  const page = num(raw, /page size of (\d+)/) || 16384;
  const pages = (label: string): number => (num(raw, new RegExp(`${label}:\\s+(\\d+)`)) || 0) * page;
  const total = os.totalmem();
  const purgeable = pages('Pages purgeable');
  const app = Math.max(0, pages('Anonymous pages') - purgeable);
  const wired = pages('Pages wired down');
  const compressed = pages('Pages occupied by compressor');
  const cached = pages('File-backed pages') + purgeable;
  const used = app + wired + compressed;
  return { total, app, wired, compressed, cached, used, free: Math.max(0, total - used - cached), percent: (used / total) * 100 };
}

export async function pressure(): Promise<Pressure> {
  const raw = await sh('sysctl', ['vm.swapusage', 'kern.memorystatus_level']);
  const mb = (label: string): number => (num(raw, new RegExp(`${label} = ([\\d.]+)M`)) || 0) * 1024 * 1024;
  const level = num(raw, /memorystatus_level: (\d+)/);
  return { swapTotal: mb('total'), swapUsed: mb('used'), pressure: Number.isFinite(level) ? 100 - level : NaN };
}

export async function gpu(): Promise<Gpu> {
  const raw = await sh('ioreg', ['-r', '-d', '1', '-w0', '-c', 'IOAccelerator']);
  return {
    device: num(raw, /"Device Utilization %"=(\d+)/),
    renderer: num(raw, /"Renderer Utilization %"=(\d+)/),
    tiler: num(raw, /"Tiler Utilization %"=(\d+)/),
    memory: num(raw, /"In use system memory"=(\d+)/),
  };
}

export async function defaultInterface(): Promise<string> {
  const raw = await sh('route', ['-n', 'get', 'default']);
  return raw.match(/interface:\s*(\S+)/)?.[1] || 'en0';
}

/**
 * Bytes acumulados de una interfaz; se leen desde el final porque la columna
 * Address es opcional. `-n` evita resolver nombres, que puede tardar segundos.
 */
export async function netCounters(iface: string): Promise<{ rx: number; tx: number } | null> {
  const raw = await sh('netstat', ['-I', iface, '-bn']);
  const line = raw.split('\n').find((row) => row.includes('<Link#') && row.split(/\s+/)[0].replace('*', '') === iface);
  if (!line) return null;
  const cols = line.trim().split(/\s+/);
  return { rx: Number(cols[cols.length - 5]), tx: Number(cols[cols.length - 2]) };
}

export async function diskCounters(): Promise<{ read: number; write: number }> {
  const raw = await sh('ioreg', ['-c', 'IOBlockStorageDriver', '-r', '-w0', '-k', 'Statistics']);
  const sum = (label: string): number => [...raw.matchAll(new RegExp(`"Bytes \\(${label}\\)"=(\\d+)`, 'g'))].reduce((acc, m) => acc + Number(m[1]), 0);
  return { read: sum('Read'), write: sum('Write') };
}

/** Uso del contenedor APFS principal más volúmenes externos montados. */
export async function volumes(): Promise<Volume[]> {
  const raw = await sh('df', ['-kl']);
  return raw.split('\n').slice(1).map((line): Volume | null => {
    const match = line.match(/^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+\d+%.*?\s(\/.*)$/);
    if (!match) return null;
    const [, device, blocks, , avail, mount] = match;
    const total = Number(blocks) * 1024;
    const free = Number(avail) * 1024;
    return { device, mount, total, free, used: total - free, percent: ((total - free) / total) * 100 };
  }).filter((v): v is Volume => v !== null && (v.mount === '/' || (v.mount.startsWith('/Volumes/') && v.mount !== '/Volumes/Recovery')));
}

export async function battery(): Promise<Battery> {
  const [batt, smart] = await Promise.all([
    sh('pmset', ['-g', 'batt']),
    sh('ioreg', ['-rn', 'AppleSmartBattery', '-w0']),
  ]);
  const percent = num(batt, /(\d+)%/);
  if (!Number.isFinite(percent)) return { present: false, source: batt.match(/drawing from '([^']+)'/)?.[1] || 'AC Power' };
  const prop = (key: string): string | undefined => smart.match(new RegExp(`"${key}" = (\\S+)`))?.[1];
  const rawAmperage = prop('InstantAmperage');
  const amperage = rawAmperage ? Number(BigInt.asIntN(64, BigInt(rawAmperage))) : NaN;
  const voltage = Number(prop('Voltage'));
  const remaining = batt.match(/(\d+:\d+) remaining/)?.[1];
  return {
    present: true,
    percent,
    state: batt.match(/\d+%;\s*([^;]+);/)?.[1]?.trim() || 'unknown',
    source: batt.match(/drawing from '([^']+)'/)?.[1] || '',
    remaining: remaining && remaining !== '0:00' ? remaining : null,
    cycles: Number(prop('CycleCount')),
    health: Number(prop('MaxCapacity')),
    external: prop('ExternalConnected') === 'Yes',
    watts: (voltage * amperage) / 1e6,
  };
}

/** Procesos del sistema, excluyendo las sondas de esta app y los que están terminando. */
export async function processes(): Promise<Process[]> {
  const raw = await sh('ps', ['-axo', 'pid=,ppid=,%cpu=,%mem=,rss=,etime=,user=,comm=']);
  return raw.split('\n').map((line): Process | null => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (!m) return null;
    const command = m[8].trim();
    return {
      pid: Number(m[1]), ppid: Number(m[2]), cpu: Number(m[3]), mem: Number(m[4]), rss: Number(m[5]) * 1024,
      elapsed: m[6], user: m[7], command, name: command.split('/').pop() || command, app: appName(command),
    };
  }).filter((p): p is Process => p !== null && p.ppid !== process.pid && !p.command.startsWith('('));
}

/** Puertos TCP en escucha por PID. */
export async function listeningPorts(): Promise<Map<number, PortEntry>> {
  const raw = await sh('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'], 3000);
  const ports = new Map<number, PortEntry>();
  let pid = 0;
  let command = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('c')) command = line.slice(1);
    else if (line.startsWith('n')) {
      const port = line.match(/:(\d+)$/)?.[1];
      if (!port) continue;
      const entry = ports.get(pid) || { pid, command, ports: new Set<number>() };
      entry.ports.add(Number(port));
      ports.set(pid, entry);
    }
  }
  return ports;
}
