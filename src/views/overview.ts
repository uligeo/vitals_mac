import { T, GR, RAMP, heat } from '../theme.js';
import { areaChart, gauge } from '../charts.js';
import { split } from '../term.js';
import { fmtBytes, fmtRate, fmtPct, fmtDuration } from '../format.js';
import { panel, bigValue, keyValue } from '../widgets.js';
import { topGroups } from '../rows.js';
import { selectableTable } from './common.js';
import { batteryStateLabel } from './power.js';
import { t } from '../i18n.js';
import type { Ctx, Rect } from '../types.js';

interface CardSpec {
  tab: number;
  title: string;
  color: string;
  value: string;
  unit?: string;
  sub: string;
  right?: string;
  series: number[];
  chartColor?: (fraction: number) => string;
  mirror?: number[];
}

function card(ctx: Ctx, rect: Rect, spec: CardSpec): void {
  const { scr, actions } = ctx;
  const inner = panel(scr, rect, spec.title, spec.color, { onClick: () => actions.setTab(spec.tab), right: spec.right });
  bigValue(scr, inner.x, inner.y, spec.value, spec.unit, spec.color);
  scr.textRight(inner.x + inner.w, inner.y, spec.sub, { fg: T.muted });
  const chartH = inner.h - 1;
  if (chartH <= 0) return;
  if (spec.mirror) {
    const max = Math.max(1024, ...spec.series.slice(-inner.w * 2), ...spec.mirror.slice(-inner.w * 2)) * 1.15;
    const half = Math.ceil(chartH / 2);
    areaChart(scr, inner.x, inner.y + 1, inner.w, half, spec.series, { max, color: GR.down, grid: false });
    areaChart(scr, inner.x, inner.y + 1 + half, inner.w, chartH - half, spec.mirror, { max, color: GR.up, invert: true, grid: false });
  } else {
    areaChart(scr, inner.x, inner.y + 1, inner.w, chartH, spec.series, { max: 100, color: spec.chartColor ?? GR.cpu, grid: false });
  }
}

function cards(ctx: Ctx, { x, y, w }: Pick<Rect, 'x' | 'y' | 'w'>): number {
  const { data } = ctx;
  const { cpu, mem, gpu, net, history } = data;
  if (!mem) return 0;
  const specs: CardSpec[] = [
    { tab: 1, title: 'CPU', color: T.cpu, value: fmtPct(cpu.total), sub: `usr ${fmtPct(cpu.user)} · sys ${fmtPct(cpu.sys)}`, series: history.cpu, chartColor: GR.cpu },
    { tab: 2, title: t('Memoria'), color: T.mem, value: fmtBytes(mem.used), unit: `/ ${fmtBytes(mem.total)}`, sub: fmtPct(mem.percent), series: history.mem, chartColor: GR.mem },
    { tab: 3, title: 'GPU', color: T.gpu, value: fmtPct(gpu.device), sub: t('{v} en uso', { v: fmtBytes(gpu.memory) }), series: history.gpu, chartColor: GR.gpu },
    { tab: 4, title: t('Red'), color: T.down, right: data.iface, value: `↓ ${fmtRate(net.rx)}`, sub: `↑ ${fmtRate(net.tx)}`, series: history.rx, mirror: history.tx },
  ];
  const perRow = w >= 100 ? 4 : 2;
  const cardH = 7;
  specs.forEach((spec, i) => {
    const col = split(x, w, perRow, 1)[i % perRow];
    card(ctx, { x: col.x, y: y + Math.floor(i / perRow) * cardH, w: col.w, h: cardH }, spec);
  });
  return Math.ceil(specs.length / perRow) * cardH;
}

function vitals(ctx: Ctx, { x, y, w, h }: Rect): void {
  const { scr, data, actions } = ctx;
  const [diskCol, powerCol, sysCol] = split(x, w, 3, 1);
  const root = data.volumes.find((v) => v.mount === '/');

  const d = panel(scr, { ...diskCol, y, h }, t('Disco'), T.disk, { onClick: () => actions.setTab(5) });
  if (root) {
    bigValue(scr, d.x, d.y, fmtBytes(root.free), t('libres'), T.disk);
    scr.textRight(d.x + d.w, d.y, fmtPct(root.percent), { fg: heat(root.percent), bold: true });
    gauge(scr, d.x, d.y + 1, d.w, root.percent, heat);
  }
  scr.text(d.x, d.y + 2, `L ${fmtRate(data.disk.read)}`, { fg: T.disk });
  scr.textRight(d.x + d.w, d.y + 2, `E ${fmtRate(data.disk.write)}`, { fg: T.up });

  const p = panel(scr, { ...powerCol, y, h }, t('Energía'), T.battery, { onClick: () => actions.setTab(6) });
  const b = data.battery;
  if (b.present) {
    const tone = b.percent <= 20 ? T.danger : b.percent <= 40 ? T.warn : T.battery;
    bigValue(scr, p.x, p.y, `${b.percent}%`, t(b.external ? 'conectado' : 'batería'), tone);
    scr.textRight(p.x + p.w, p.y, Number.isFinite(b.watts) ? `${Math.abs(b.watts).toFixed(1)} W` : '', { fg: T.muted });
    gauge(scr, p.x, p.y + 1, p.w, b.percent, RAMP.battery);
    scr.text(p.x, p.y + 2, b.remaining ? t('{t} restantes', { t: b.remaining }) : batteryStateLabel(b.state), { fg: T.muted }, p.w);
  } else {
    bigValue(scr, p.x, p.y, t('Corriente'), t('sin batería'), T.battery);
  }

  const s = panel(scr, { ...sysCol, y, h }, t('Sistema'), T.accent, { onClick: () => actions.setTab(7) });
  keyValue(scr, s.x, s.y, s.w, t('Carga 1/5/15'), data.load.map((v) => v.toFixed(2)).join(' '), T.text);
  keyValue(scr, s.x, s.y + 1, s.w, t('Procesos'), t('{p} · {g} grupos', { p: data.processes.length, g: data.groups.length }), T.text);
  keyValue(scr, s.x, s.y + 2, s.w, t('Presión · swap'), `${fmtPct(data.pressure.pressure)} · ${fmtBytes(data.pressure.swapUsed)}`, heat(data.pressure.pressure || 0));
  if (s.h > 3) keyValue(scr, s.x, s.y + 3, s.w, t('Encendido'), fmtDuration(data.uptime), T.text);
}

export function overview(ctx: Ctx, rect: Rect): void {
  const { scr } = ctx;
  if (!ctx.data.mem) return;
  let y = rect.y;
  y += cards(ctx, rect);
  const remaining = rect.y + rect.h - y;
  if (remaining >= 11) {
    vitals(ctx, { x: rect.x, y, w: rect.w, h: 5 });
    y += 5;
  }
  const h = rect.y + rect.h - y;
  if (h < 4) return;
  const inner = panel(scr, { x: rect.x, y, w: rect.w, h }, t('Aplicaciones activas'), T.accent, { right: t('clic para detalles') });
  selectableTable(ctx, { x: inner.x, y: inner.y, w: inner.w - 1, h: inner.h }, topGroups(ctx.data, 'cpu'), { compact: rect.w < 110 });
}
