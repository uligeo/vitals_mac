export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function fmtBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = Math.abs(bytes);
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : n >= 10 ? 1 : 2)} ${units[i]}`;
}

export const fmtRate = (bytes: number): string => `${fmtBytes(bytes)}/s`;

export const fmtPct = (value: number | undefined, digits = 0): string =>
  (value !== undefined && Number.isFinite(value) ? `${value.toFixed(digits)}%` : '—');

export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor(seconds / 60) % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Convierte el formato etime de ps ([[dd-]hh:]mm:ss) a segundos. */
export function etimeToSeconds(etime: string): number {
  const [days, rest] = etime.includes('-') ? etime.split('-') : ['0', etime];
  const parts = rest.split(':').map(Number).reverse();
  return Number(days) * 86400 + (parts[2] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[0] || 0);
}
