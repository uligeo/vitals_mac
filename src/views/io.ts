import { T, GR, heat } from '../theme.js';
import { gauge } from '../charts.js';
import { fmtBytes, fmtRate, fmtPct } from '../format.js';
import { panel, keyValue, legend, table } from '../widgets.js';
import { mirrorChart } from './common.js';
import { t } from '../i18n.js';
import type { Ctx, PortEntry, Process, Rect } from '../types.js';

interface Frame {
  main: Rect;
  side: Rect;
  bottom: Rect;
}

interface RatesSpec {
  title: string;
  right?: string;
  color: string;
  top: number[];
  bottom: number[];
  topColor: string;
  bottomColor: string;
  topGradient: (fraction: number) => string;
  bottomGradient: (fraction: number) => string;
  topLabel: string;
  bottomLabel: string;
  totals: [string, string, string][];
}

type PortRow = PortEntry & { process?: Process; list: number[] };

function frame(rect: Rect, topRatio = 0.58): Frame {
  const topH = Math.max(10, Math.min(rect.h - 6, Math.round(rect.h * topRatio)));
  const wide = Math.round(rect.w * 0.68);
  return {
    main: { x: rect.x, y: rect.y, w: wide, h: topH },
    side: { x: rect.x + wide + 1, y: rect.y, w: rect.w - wide - 1, h: topH },
    bottom: { x: rect.x, y: rect.y + topH, w: rect.w, h: rect.h - topH },
  };
}

const peak = (series: number[], seconds: number): number => Math.max(0, ...series.slice(-seconds));

/** Panel de tasas con gráfica espejo y totales laterales. */
function ratesPanel(ctx: Ctx, l: Frame, spec: RatesSpec): void {
  const { scr } = ctx;
  const c = panel(scr, l.main, t(spec.title), spec.color, { right: spec.right });
  let x = legend(scr, c.x, c.y, spec.topColor, t(spec.topLabel), fmtRate(spec.top.at(-1) || 0));
  legend(scr, x + 4, c.y, spec.bottomColor, t(spec.bottomLabel), fmtRate(spec.bottom.at(-1) || 0));
  mirrorChart(scr, { x: c.x, y: c.y + 2, w: c.w, h: c.h - 2 }, spec.top, spec.bottom, {
    topColor: spec.topGradient, bottomColor: spec.bottomGradient,
  });

  const s = panel(scr, l.side, t('Totales'), spec.color);
  spec.totals.forEach(([label, value, tone], i) => {
    if (i < s.h) keyValue(scr, s.x, s.y + i, s.w, label && t(label), value, tone);
  });
}

export function networkView(ctx: Ctx, rect: Rect): void {
  const { scr, data, actions } = ctx;
  const { net, history } = data;
  const l = frame(rect);
  ratesPanel(ctx, l, {
    title: 'Tráfico de red', right: data.iface, color: T.down,
    top: history.rx, bottom: history.tx,
    topColor: T.down, bottomColor: T.up, topGradient: GR.down, bottomGradient: GR.up, topLabel: '↓ Descarga', bottomLabel: '↑ Subida',
    totals: [
      ['Sesión ↓', fmtBytes(net.rxSession), T.down],
      ['Sesión ↑', fmtBytes(net.txSession), T.up],
      ['', '', T.text],
      ['Pico ↓ 1 min', fmtRate(peak(history.rx, 60)), T.down],
      ['Pico ↑ 1 min', fmtRate(peak(history.tx, 60)), T.up],
      ['', '', T.text],
      ['Desde arranque ↓', fmtBytes(net.rxTotal), T.muted],
      ['Desde arranque ↑', fmtBytes(net.txTotal), T.muted],
    ],
  });

  if (l.bottom.h < 4) return;
  const b = panel(scr, l.bottom, t('Puertos TCP en escucha'), T.down, { right: t('clic para detalles') });
  const byPid = new Map(data.processes.map((p) => [p.pid, p]));
  const rows: PortRow[] = [...data.ports.values()]
    .map((entry) => ({ ...entry, process: byPid.get(entry.pid), list: [...entry.ports].sort((a, c) => a - c) }))
    .sort((a, c) => a.list[0] - c.list[0]);
  if (!rows.length) {
    scr.text(b.x, b.y, t('No hay puertos TCP en escucha visibles para este usuario.'), { fg: T.muted });
    return;
  }
  table(scr, b, rows.slice(0, b.h - 1), {
    columns: [
      { title: t('Puerto'), width: 8, align: 'right', render: (r) => ({ text: String(r.list[0]), fg: T.down }) },
      { title: t('Aplicación'), width: 'flex', render: (r) => ({ text: r.process?.app || r.command }) },
      { title: 'PID', width: 7, align: 'right', render: (r) => ({ text: String(r.pid), fg: T.muted }) },
      { title: t('Otros puertos'), width: 24, render: (r) => ({ text: r.list.slice(1).join(' ') || '—', fg: T.dim }) },
    ],
    selected: -1,
    scroll: 0,
    onRow: (_, r) => {
      const group = data.groups.find((g) => g.pids.includes(r.pid));
      if (group) actions.openDetail(group);
    },
  });
}

export function diskView(ctx: Ctx, rect: Rect): void {
  const { scr, data } = ctx;
  const { disk, history } = data;
  const l = frame(rect, 0.6);
  ratesPanel(ctx, l, {
    title: 'Lectura y escritura', color: T.disk,
    top: history.read, bottom: history.write,
    topColor: T.disk, bottomColor: T.up, topGradient: GR.read, bottomGradient: GR.write, topLabel: 'Lectura', bottomLabel: 'Escritura',
    totals: [
      ['Leído (sesión)', fmtBytes(disk.readSession), T.disk],
      ['Escrito (sesión)', fmtBytes(disk.writeSession), T.up],
      ['', '', T.text],
      ['Pico lectura 1 min', fmtRate(peak(history.read, 60)), T.disk],
      ['Pico escritura 1 min', fmtRate(peak(history.write, 60)), T.up],
    ],
  });

  if (l.bottom.h < 4) return;
  const v = panel(scr, l.bottom, t('Volúmenes'), T.disk);
  data.volumes.forEach((vol, i) => {
    const y = v.y + i * 2;
    if (y + 1 >= v.y + v.h) return;
    const name = vol.mount === '/' ? t('Macintosh HD (contenedor APFS)') : vol.mount.replace('/Volumes/', '');
    scr.text(v.x, y, name, { fg: T.text, bold: true }, Math.floor(v.w / 2));
    scr.textRight(v.x + v.w, y, t('{u} de {t} · {f} libres · {p}', { u: fmtBytes(vol.used), t: fmtBytes(vol.total), f: fmtBytes(vol.free), p: fmtPct(vol.percent) }), { fg: T.muted });
    gauge(scr, v.x, y + 1, v.w, vol.percent, heat);
  });
}
