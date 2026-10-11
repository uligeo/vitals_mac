import type { Data, DetailRef, PortEntry, Process, Row, Sort, SortKey } from './types.js';

const toRow = (process: Process, ports: Map<number, PortEntry>): Row => ({
  ...process,
  key: `pid:${process.pid}`,
  count: 1,
  pids: [process.pid],
  members: [process],
  ports: ports.get(process.pid)?.ports || new Set<number>(),
  grouped: false,
});

const compare: Record<SortKey, (a: Row, b: Row) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  cpu: (a, b) => a.cpu - b.cpu || a.rss - b.rss,
  rss: (a, b) => a.rss - b.rss,
  count: (a, b) => a.count - b.count,
  pid: (a, b) => a.pid - b.pid,
};

/** Filas de la tabla de procesos según agrupación, filtro y orden actuales. */
export function processRows(data: Data, { grouped, query, sort }: { grouped: boolean; query: string; sort: Sort }): Row[] {
  const q = query.toLowerCase();
  const base = grouped ? data.groups : data.processes.map((p) => toRow(p, data.ports));
  const rows = base.filter((r) => !q || r.name.toLowerCase().includes(q) || r.command.toLowerCase().includes(q) || String(r.pid) === q);
  const fn = compare[sort.key];
  return rows.sort((a, b) => (sort.desc ? fn(b, a) : fn(a, b)));
}

/** Aplicaciones agrupadas ordenadas por un campo, para listas de resumen. */
export const topGroups = (data: Data, key: SortKey = 'cpu', n = Infinity): Row[] => [...data.groups].sort((a, b) => compare[key](b, a)).slice(0, n);

export function resolveItem(data: Data, ref: DetailRef | null): Row | null {
  if (!ref) return null;
  if (ref.grouped) return data.groups.find((g) => g.key === ref.key) || null;
  const process = data.processes.find((p) => p.pid === ref.pid);
  return process ? toRow(process, data.ports) : null;
}
