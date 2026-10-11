const toRow = (process, ports) => ({
  ...process,
  key: `pid:${process.pid}`,
  count: 1,
  pids: [process.pid],
  members: [process],
  ports: ports.get(process.pid)?.ports || new Set(),
  grouped: false,
});

const compare = {
  name: (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  cpu: (a, b) => a.cpu - b.cpu || a.rss - b.rss,
  rss: (a, b) => a.rss - b.rss,
  count: (a, b) => a.count - b.count,
  pid: (a, b) => a.pid - b.pid,
};

/** Filas de la tabla de procesos según agrupación, filtro y orden actuales. */
export function processRows(data, { grouped, query, sort }) {
  const q = query.toLowerCase();
  const base = grouped ? data.groups : data.processes.map((p) => toRow(p, data.ports));
  const rows = base.filter((r) => !q || r.name.toLowerCase().includes(q) || r.command.toLowerCase().includes(q) || String(r.pid) === q);
  const fn = compare[sort.key] || compare.cpu;
  return rows.sort((a, b) => (sort.desc ? fn(b, a) : fn(a, b)));
}

/** Aplicaciones agrupadas ordenadas por un campo, para listas de resumen. */
export const topGroups = (data, key = 'cpu', n = Infinity) => [...data.groups].sort((a, b) => compare[key](b, a)).slice(0, n);

export function resolveItem(data, ref) {
  if (!ref) return null;
  if (ref.grouped) return data.groups.find((g) => g.key === ref.key) || null;
  const process = data.processes.find((p) => p.pid === ref.pid);
  return process ? toRow(process, data.ports) : null;
}
