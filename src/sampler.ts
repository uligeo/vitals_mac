import os from 'node:os';
import * as probe from './probes.js';
import type { CpuUsage, Data, PortEntry, Process, Row, Series } from './types.js';

const HISTORY = 600;
const APP_HISTORY = 60;
const SERIES: Series[] = ['cpu', 'user', 'sys', 'mem', 'gpu', 'rx', 'tx', 'read', 'write', 'battery', 'watts'];

/** Cada cuántos ticks (1 s) se ejecuta cada sonda; las costosas van más espaciadas. */
const EVERY = { processes: 2, pressure: 2, battery: 10, ports: 15, volumes: 30, iface: 30 };

type Probe = keyof typeof EVERY;
type CpuTimes = os.CpuInfo['times'];

function cpuUsage(prev: os.CpuInfo[], now: os.CpuInfo[]): CpuUsage {
  let user = 0;
  let sys = 0;
  let all = 0;
  const cores = now.map((core, i) => {
    const before = prev[i]?.times || core.times;
    const d = (key: keyof CpuTimes): number => core.times[key] - before[key];
    const u = d('user') + d('nice');
    const s = d('sys') + d('irq');
    const total = u + s + d('idle') || 1;
    user += u; sys += s; all += total;
    return ((u + s) / total) * 100;
  });
  return { cores, user: (user / all) * 100, sys: (sys / all) * 100, total: ((user + sys) / all) * 100 };
}

function groupProcesses(list: Process[], ports: Map<number, PortEntry>): Row[] {
  const groups = new Map<string, Row>();
  for (const item of list) {
    const group: Row = groups.get(item.app) || {
      key: item.app, name: item.app, cpu: 0, mem: 0, rss: 0, count: 0, pid: item.pid, pids: [], members: [],
      user: item.user, elapsed: item.elapsed, command: item.command, ports: new Set(), grouped: true,
    };
    group.cpu += item.cpu; group.mem += item.mem; group.rss += item.rss; group.count++;
    group.pids.push(item.pid); group.members.push(item);
    ports.get(item.pid)?.ports.forEach((port) => group.ports.add(port));
    groups.set(item.app, group);
  }
  for (const group of groups.values()) {
    const pidSet = new Set(group.pids);
    const root = group.members.find((m) => !pidSet.has(m.ppid)) || group.members[0];
    group.pid = root.pid; group.command = root.command; group.elapsed = root.elapsed; group.user = root.user;
  }
  return [...groups.values()];
}

export interface Sampler {
  data: Data;
  sample: (force?: boolean) => Promise<void>;
}

export function createSampler(onUpdate: () => void): Sampler {
  const data: Data = {
    info: null, cpu: { cores: [], user: 0, sys: 0, total: 0 }, load: os.loadavg(),
    mem: null, pressure: { swapTotal: 0, swapUsed: 0, pressure: NaN }, gpu: {},
    iface: 'en0', net: { rx: 0, tx: 0, rxTotal: 0, txTotal: 0, rxSession: 0, txSession: 0 },
    disk: { read: 0, write: 0, readSession: 0, writeSession: 0 }, volumes: [],
    battery: { present: false, source: '' }, processes: [], groups: [], ports: new Map(),
    history: Object.fromEntries(SERIES.map((key) => [key, [] as number[]])) as Record<Series, number[]>, appHistory: new Map(),
    capturedAt: new Date(), uptime: os.uptime(),
  };
  let tick = 0;
  let prevCpu = os.cpus();
  let prevNet: { rx: number; tx: number } | null = null;
  let prevDisk: { read: number; write: number } | null = null;
  let prevAt = Date.now();
  let busy = false;

  const due = (name: Probe, force: boolean): boolean => force || tick % EVERY[name] === 0;
  const push = (key: Series, value: number | undefined): void => {
    const series = data.history[key];
    series.push(value !== undefined && Number.isFinite(value) ? value : 0);
    if (series.length > HISTORY) series.shift();
  };

  async function sample(force = false) {
    if (busy) return;
    busy = true;
    try {
      if (!data.info) data.info = await probe.staticInfo();
      if (due('iface', force)) data.iface = await probe.defaultInterface();
      const [mem, gpu, net, disk, procs, press, battery, ports, volumes] = await Promise.all([
        probe.memory(), probe.gpu(), probe.netCounters(data.iface), probe.diskCounters(),
        due('processes', force) ? probe.processes() : null,
        due('pressure', force) ? probe.pressure() : null,
        due('battery', force) ? probe.battery() : null,
        due('ports', force) ? probe.listeningPorts() : null,
        due('volumes', force) ? probe.volumes() : null,
      ]);
      const now = Date.now();
      const seconds = Math.max(0.25, (now - prevAt) / 1000);
      prevAt = now;

      const cpuNow = os.cpus();
      data.cpu = cpuUsage(prevCpu, cpuNow);
      prevCpu = cpuNow;
      data.load = os.loadavg();
      data.uptime = os.uptime();
      data.mem = mem;
      data.gpu = gpu;
      if (press) data.pressure = press;
      if (battery) data.battery = battery;
      if (ports) data.ports = ports;
      if (volumes) data.volumes = volumes;

      if (net) {
        if (prevNet) {
          data.net.rx = Math.max(0, net.rx - prevNet.rx) / seconds;
          data.net.tx = Math.max(0, net.tx - prevNet.tx) / seconds;
          data.net.rxSession += Math.max(0, net.rx - prevNet.rx);
          data.net.txSession += Math.max(0, net.tx - prevNet.tx);
        }
        data.net.rxTotal = net.rx; data.net.txTotal = net.tx;
        prevNet = net;
      }
      if (prevDisk) {
        data.disk.read = Math.max(0, disk.read - prevDisk.read) / seconds;
        data.disk.write = Math.max(0, disk.write - prevDisk.write) / seconds;
        data.disk.readSession += Math.max(0, disk.read - prevDisk.read);
        data.disk.writeSession += Math.max(0, disk.write - prevDisk.write);
      }
      prevDisk = disk;

      if (procs) {
        data.processes = procs;
        data.groups = groupProcesses(procs, data.ports);
        const alive = new Set();
        for (const group of data.groups) {
          alive.add(group.key);
          const series = data.appHistory.get(group.key) || [];
          series.push(group.cpu);
          if (series.length > APP_HISTORY) series.shift();
          data.appHistory.set(group.key, series);
        }
        for (const key of data.appHistory.keys()) if (!alive.has(key)) data.appHistory.delete(key);
      }

      push('cpu', data.cpu.total); push('user', data.cpu.user); push('sys', data.cpu.sys);
      push('mem', mem.percent); push('gpu', gpu.device);
      push('rx', data.net.rx); push('tx', data.net.tx);
      push('read', data.disk.read); push('write', data.disk.write);
      const power = data.battery;
      push('battery', power.present ? power.percent : 0);
      push('watts', power.present ? Math.abs(power.watts) : 0);
      data.capturedAt = new Date();
      tick++;
    } finally {
      busy = false;
    }
    onUpdate();
  }

  return { data, sample };
}
