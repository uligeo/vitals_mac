import { T, GR, RAMP, heat } from '../theme.js';
import { gauge, vbars, stackedBar } from '../charts.js';
import { split } from '../term.js';
import { clamp, fmtBytes, fmtPct } from '../format.js';
import { panel, bigValue, keyValue, legend } from '../widgets.js';
import { topGroups } from '../rows.js';
import { axisChart, miniTable } from './common.js';
import { t } from '../i18n.js';
import type { Screen } from '../term.js';
import type { Color, Ctx, Rect } from '../types.js';

interface Layout {
  main: Rect;
  side: Rect;
  left: Rect;
  right: Rect;
  bottom: Rect;
}

/** Divide el área en una franja superior (gráficas) y una inferior (detalles). */
function layout(rect: Rect, topRatio = 0.55, minTop = 10): Layout {
  const topH = clamp(Math.round(rect.h * topRatio), minTop, rect.h - 6);
  const cols = split(rect.x, rect.w, 2, 1);
  const wide = Math.round(rect.w * 0.64);
  return {
    main: { x: rect.x, y: rect.y, w: wide, h: topH },
    side: { x: rect.x + wide + 1, y: rect.y, w: rect.w - wide - 1, h: topH },
    left: { ...cols[0], y: rect.y + topH, h: rect.h - topH },
    right: { ...cols[1], y: rect.y + topH, h: rect.h - topH },
    bottom: { x: rect.x, y: rect.y + topH, w: rect.w, h: rect.h - topH },
  };
}

function labeledGauge(scr: Screen, x: number, y: number, w: number, label: string, pct: number, color: Color, value?: string): void {
  scr.text(x, y, label, { fg: T.muted });
  scr.textRight(x + w, y, value ?? fmtPct(pct), { fg: typeof color === 'function' ? color(pct) : color, bold: true });
  gauge(scr, x, y + 1, w, pct, color);
}

export function cpuView(ctx: Ctx, rect: Rect): void {
  const { scr, data } = ctx;
  const { cpu, info, history } = data;
  const l = layout(rect);

  const c = panel(scr, l.main, t('Uso de CPU'), T.cpu, { right: t('últimos minutos') });
  let x = bigValue(scr, c.x, c.y, fmtPct(cpu.total, 1), 'total', heat(cpu.total));
  x = legend(scr, x + 3, c.y, T.cpu, t('usuario'), fmtPct(cpu.user, 1));
  legend(scr, x + 3, c.y, T.danger, t('sistema'), fmtPct(cpu.sys, 1));
  axisChart(scr, { x: c.x, y: c.y + 2, w: c.w, h: c.h - 2 }, history.cpu, { color: GR.cpu });

  const cores = cpu.cores;
  const n = panel(scr, l.side, t('Núcleos'), T.cpu, { right: info?.pCores ? `${info.pCores}P + ${info.eCores}E` : `${cores.length}` });
  if (cores.length) {
    const barW = Math.max(1, Math.floor((n.w + 1) / cores.length) - 1);
    const gap = barW >= 3 ? 1 : n.w >= cores.length * 2 ? 1 : 0;
    const barsH = n.h - 1;
    const bx = n.x + Math.max(0, Math.floor((n.w - (cores.length * (barW + gap) - gap)) / 2));
    vbars(scr, bx, n.y, barsH, cores, (_, row) => GR.cpu(row), { barWidth: barW, gap });
    if (barW >= 2) {
      cores.forEach((value, i) => {
        const label = String(Math.round(value));
        scr.text(bx + i * (barW + gap) + Math.max(0, Math.floor((barW - label.length) / 2)), n.y + barsH, label, { fg: T.muted }, barW);
      });
    }
  }

  const d = panel(scr, l.left, t('Distribución y carga'), T.cpu);
  const idle = Math.max(0, 100 - cpu.user - cpu.sys);
  stackedBar(scr, d.x, d.y, d.w, 1, [{ value: cpu.user, color: T.cpu }, { value: cpu.sys, color: T.danger }], 100);
  let lx = legend(scr, d.x, d.y + 1, T.cpu, t('usuario'), fmtPct(cpu.user));
  lx = legend(scr, lx + 2, d.y + 1, T.danger, t('sistema'), fmtPct(cpu.sys));
  legend(scr, lx + 2, d.y + 1, T.track, t('inactivo'), fmtPct(idle));
  ['1 min', '5 min', '15 min'].forEach((label, i) => {
    const y = d.y + 3 + i * 2;
    if (y + 1 >= d.y + d.h) return;
    const load = data.load[i];
    const pct = (load / Math.max(1, cores.length)) * 100;
    labeledGauge(scr, d.x, y, d.w, t('Carga {label}', { label }), pct, heat, `${load.toFixed(2)} · ${fmtPct(pct)}`);
  });

  const list = panel(scr, l.right, t('Mayor uso de CPU'), T.cpu, { right: t('clic para detalles') });
  miniTable(ctx, list, topGroups(data, 'cpu'));
}

export function memoryView(ctx: Ctx, rect: Rect): void {
  const { scr, data } = ctx;
  const { mem, pressure, history } = data;
  if (!mem) return;
  const l = layout(rect, 0.45, 9);

  const c = panel(scr, l.main, t('Memoria en uso'), T.mem);
  let x = bigValue(scr, c.x, c.y, fmtBytes(mem.used), t('de {v}', { v: fmtBytes(mem.total) }), T.mem);
  scr.text(x + 2, c.y, fmtPct(mem.percent, 1), { fg: heat(mem.percent), bold: true });
  axisChart(scr, { x: c.x, y: c.y + 2, w: c.w, h: c.h - 2 }, history.mem, { color: GR.mem });

  const p = panel(scr, l.side, t('Presión'), heat(pressure.pressure || 0));
  labeledGauge(scr, p.x, p.y, p.w, t('Presión de memoria'), pressure.pressure || 0, heat);
  const swapPct = pressure.swapTotal ? (pressure.swapUsed / pressure.swapTotal) * 100 : 0;
  labeledGauge(scr, p.x, p.y + 3, p.w, 'Swap', swapPct, RAMP.write, `${fmtBytes(pressure.swapUsed)} / ${fmtBytes(pressure.swapTotal)}`);
  if (p.h > 7) keyValue(scr, p.x, p.y + 6, p.w, t('Comprimida'), fmtBytes(mem.compressed), T.gpu);
  if (p.h > 8) keyValue(scr, p.x, p.y + 7, p.w, t('Disponible'), fmtBytes(mem.free + mem.cached), T.ok);

  const segments = [
    { label: 'Apps', value: mem.app, color: T.mem },
    { label: 'Wired', value: mem.wired, color: T.warn },
    { label: t('Comprimida'), value: mem.compressed, color: T.gpu },
    { label: 'Caché', value: mem.cached, color: T.disk },
  ];
  const bottom = l.bottom;
  const distH = 6;
  const d = panel(scr, { ...bottom, h: distH }, t('Distribución'), T.mem);
  stackedBar(scr, d.x, d.y, d.w, 2, segments, mem.total);
  let lx = d.x;
  for (const seg of segments) lx = legend(scr, lx, d.y + 3, seg.color, t(seg.label), fmtBytes(seg.value)) + 3;
  legend(scr, lx, d.y + 3, T.track, t('Libre'), fmtBytes(mem.free));

  if (bottom.h - distH >= 4) {
    const list = panel(scr, { ...bottom, y: bottom.y + distH, h: bottom.h - distH }, t('Mayor uso de memoria'), T.mem, { right: t('clic para detalles') });
    miniTable(ctx, list, topGroups(data, 'rss'));
  }
}

export function gpuView(ctx: Ctx, rect: Rect): void {
  const { scr, data } = ctx;
  const { gpu, info, history } = data;
  const l = layout(rect, 0.6);

  const c = panel(scr, l.main, t('Uso de GPU'), T.gpu, { right: info?.gpuCores ? t('{n} núcleos', { n: info.gpuCores }) : '' });
  bigValue(scr, c.x, c.y, fmtPct(gpu.device), t('dispositivo'), T.gpu);
  axisChart(scr, { x: c.x, y: c.y + 2, w: c.w, h: c.h - 2 }, history.gpu, { color: GR.gpu });

  const s = panel(scr, l.side, t('Motores'), T.gpu);
  labeledGauge(scr, s.x, s.y, s.w, t('Dispositivo'), gpu.device || 0, RAMP.gpu);
  labeledGauge(scr, s.x, s.y + 3, s.w, t('Renderizado'), gpu.renderer || 0, RAMP.mem);
  labeledGauge(scr, s.x, s.y + 6, s.w, t('Teselado'), gpu.tiler || 0, RAMP.read);

  const m = panel(scr, l.left, t('Memoria de GPU'), T.gpu);
  const share = data.mem ? ((gpu.memory || 0) / data.mem.total) * 100 : 0;
  labeledGauge(scr, m.x, m.y, m.w, t('Memoria unificada en uso'), share, RAMP.gpu, fmtBytes(gpu.memory));
  scr.text(m.x, m.y + 3, t('Apple Silicon comparte la memoria entre CPU y GPU.'), { fg: T.dim }, m.w);

  const a = panel(scr, l.right, t('Actividad reciente'), T.gpu);
  const stats = (seconds: number): { avg: number; max: number } => {
    const window = history.gpu.slice(-seconds);
    return { avg: window.reduce((acc, v) => acc + v, 0) / Math.max(1, window.length), max: Math.max(0, ...window) };
  };
  const windows: [string, number][] = [['último minuto', 60], ['últimos 5 min', 300], ['últimos 10 min', 600]];
  windows.forEach(([label, seconds], i) => {
    if (i * 2 + 1 >= a.h) return;
    const { avg, max } = stats(seconds);
    keyValue(scr, a.x, a.y + i * 2, a.w, t('Promedio {label}', { label: t(label) }), fmtPct(avg, 1), T.gpu);
    keyValue(scr, a.x, a.y + i * 2 + 1, a.w, t('Máximo {label}', { label: t(label) }), fmtPct(max), T.muted);
  });
}
