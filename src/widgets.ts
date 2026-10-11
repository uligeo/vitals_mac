import { T, GR, heat } from './theme.js';
import { gauge, sparkline } from './charts.js';
import { clamp, fmtBytes } from './format.js';
import { t } from './i18n.js';
import type { Screen } from './term.js';
import type { Rect, Row, Sort, SortKey } from './types.js';

export interface Cell {
  text?: string;
  fg?: string;
  gauge?: number;
  spark?: number[];
}

export interface Column<R> {
  title: string;
  width: number | 'flex';
  align?: 'right';
  sortKey?: SortKey;
  render: (item: R) => Cell;
}

interface TableOptions<R> {
  columns: Column<R>[];
  selected: number;
  scroll: number;
  sort?: Sort;
  onSort?: ((key: SortKey) => void) | null;
  onRow?: (index: number, item: R) => void;
  onWheel?: (delta: number) => void;
}

const trendColor = (_: number, fraction = 0): string => GR.cpu(fraction);

/** Panel con borde redondeado; se resalta al pasar el ratón si es clicable. */
export function panel(scr: Screen, { x, y, w, h }: Rect, title: string, color: string, { onClick, right }: { onClick?: () => void; right?: string } = {}): Rect {
  const hovered = onClick && scr.hover(x, y, w, h);
  scr.box(x, y, w, h, { color: hovered ? color : T.border, title, titleColor: color });
  if (right) scr.textRight(x + w - 2, y, ` ${right} `, { fg: T.muted });
  if (onClick) scr.region(x, y, w, h, { onClick });
  return { x: x + 2, y: y + 1, w: w - 4, h: h - 2 };
}

/** Botón tipo píldora. Devuelve la x siguiente. */
export function button(scr: Screen, x: number, y: number, label: string, onClick: (() => void) | null, { tone = T.accent, active = false } = {}): number {
  const text = ` ${label} `;
  const w = [...text].length;
  const hovered = scr.hover(x, y, w, 1);
  const style = active
    ? { fg: T.ink, bg: tone, bold: true }
    : { fg: hovered ? T.text : tone, bg: hovered ? T.hover : T.surface, bold: hovered };
  scr.text(x, y, text, style);
  if (onClick) scr.region(x, y, w, 1, { onClick });
  return x + w + 1;
}

export function keyValue(scr: Screen, x: number, y: number, w: number, label: string, value: string, tone = T.text): void {
  scr.text(x, y, label, { fg: T.muted }, w);
  scr.textRight(x + w, y, value, { fg: tone, bold: true });
}

export function legend(scr: Screen, x: number, y: number, color: string, label: string, value?: string): number {
  scr.put(x, y, '■', { fg: color });
  const end = scr.text(x + 2, y, label, { fg: T.muted });
  return value ? scr.text(end + 1, y, value, { fg: T.text, bold: true }) : end;
}

/** Valor grande con etiqueta, para las tarjetas. */
export function bigValue(scr: Screen, x: number, y: number, value: string, unit: string | undefined, color: string): number {
  const end = scr.text(x, y, value, { fg: color, bold: true });
  return unit ? scr.text(end + 1, y, unit, { fg: T.muted }) : end;
}

/** Tabla con columnas configurables, selección, hover, orden por clic y scroll. */
export function table<R>(scr: Screen, rect: Rect, rows: R[], { columns, selected, scroll, sort, onSort, onRow, onWheel }: TableOptions<R>): void {
  const { x, y, w, h } = rect;
  const fixed = columns.reduce((acc, c) => acc + (c.width === 'flex' ? 0 : c.width + 1), 0);
  const flexWidth = Math.max(8, w - fixed - 1);
  const layout: { x: number; w: number }[] = [];
  let cx = x;
  columns.forEach((col) => {
    const cw = col.width === 'flex' ? flexWidth : col.width;
    const active = sort !== undefined && col.sortKey === sort.key;
    const arrow = active ? (sort.desc ? ' ▼' : ' ▲') : '';
    const label = `${col.title}${arrow}`;
    const sortKey = col.sortKey;
    const hovered = Boolean(sortKey && onSort && scr.hover(cx, y, cw, 1));
    const style = { fg: active ? T.accent : hovered ? T.text : T.muted, bold: active };
    if (col.align === 'right') scr.textRight(cx + cw, y, label, style);
    else scr.text(cx, y, label, style, cw);
    if (sortKey && onSort) scr.region(cx, y, cw, 1, { onClick: () => onSort(sortKey) });
    layout.push({ x: cx, w: cw });
    cx += cw + 1;
  });
  const bodyH = h - 1;
  const visible = rows.slice(scroll, scroll + bodyH);
  visible.forEach((item, i) => {
    const index = scroll + i;
    const ry = y + 1 + i;
    const isSel = index === selected;
    const hovered = scr.hover(x, ry, w, 1);
    const bg = isSel ? T.select : hovered ? T.hover : undefined;
    if (bg) scr.fill(x - 1, ry, w + 2, 1, { bg });
    if (isSel) scr.put(x - 1, ry, '▌', { fg: T.accent, bg });
    columns.forEach((col, c) => {
      const { x: colX, w: colW } = layout[c];
      const cell = col.render(item);
      const text = cell.text ?? '';
      if (cell.spark) {
        sparkline(scr, colX, ry, colW, cell.spark, trendColor, Math.max(5, ...cell.spark));
      } else if (cell.gauge !== undefined) {
        const gw = Math.max(0, colW - 7);
        if (gw >= 3) gauge(scr, colX, ry, gw, cell.gauge, heat(cell.gauge));
        scr.textRight(colX + colW, ry, text, { fg: cell.fg || T.text, bold: isSel });
      } else if (col.align === 'right') {
        scr.textRight(colX + colW, ry, text, { fg: cell.fg || T.text, bold: isSel });
      } else {
        scr.text(colX, ry, text, { fg: cell.fg || T.text, bold: isSel && c === 0 }, colW);
      }
    });
    if (onRow) scr.region(x, ry, w, 1, { onClick: () => onRow(index, item) });
  });
  if (rows.length > bodyH) {
    const thumbH = Math.max(1, Math.round((bodyH / rows.length) * bodyH));
    const thumbY = Math.round((scroll / Math.max(1, rows.length - bodyH)) * (bodyH - thumbH));
    for (let i = 0; i < bodyH; i++) {
      const thumb = i >= thumbY && i < thumbY + thumbH;
      scr.put(x + w, y + 1 + i, thumb ? '┃' : '│', { fg: thumb ? T.accent : T.border });
    }
  }
  if (onWheel) scr.region(x, y, w + 1, h, { onWheel });
}

/** Columnas estándar para listas de aplicaciones/procesos. */
export function processColumns({ grouped, compact = false, history }: { grouped: boolean; compact?: boolean; history?: Map<string, number[]> }): Column<Row>[] {
  const columns: Column<Row>[] = [
    { title: t(grouped ? 'Aplicación' : 'Proceso'), width: 'flex', sortKey: 'name', render: (i) => ({ text: i.name }) },
    { title: t('Tendencia'), width: compact ? 10 : 12, render: (i) => ({ spark: history?.get(i.grouped ? i.key : i.app ?? i.key) || [] }) },
    { title: 'CPU', width: 16, align: 'right', sortKey: 'cpu', render: (i) => ({ text: `${i.cpu.toFixed(1)}%`, gauge: clamp(i.cpu, 0, 100), fg: heat(i.cpu) }) },
    { title: t('Memoria'), width: 10, align: 'right', sortKey: 'rss', render: (i) => ({ text: fmtBytes(i.rss), fg: T.mem }) },
    grouped
      ? { title: 'Procs', width: 6, align: 'right', sortKey: 'count', render: (i) => ({ text: String(i.count), fg: T.muted }) }
      : { title: 'PID', width: 7, align: 'right', sortKey: 'pid', render: (i) => ({ text: String(i.pid), fg: T.muted }) },
  ];
  if (!compact) {
    columns.push(
      { title: t('Usuario'), width: 12, render: (i) => ({ text: i.user, fg: i.user === 'root' ? T.warn : T.muted }) },
      { title: t('Tiempo'), width: 11, align: 'right', render: (i) => ({ text: i.elapsed, fg: T.muted }) },
      { title: t('Puertos'), width: 14, render: (i) => ({ text: [...i.ports].slice(0, 3).join(' ') || '—', fg: i.ports.size ? T.down : T.dim }) },
    );
  }
  return columns;
}

/** Fondo para modales: atenúa visualmente y cierra al hacer clic fuera. */
export function modalFrame(scr: Screen, w: number, h: number, title: string, color: string, onClose: () => void): Rect {
  scr.dim(T.border, T.ink);
  scr.region(0, 0, scr.width, scr.height, { onClick: onClose, onWheel: () => {} });
  const mw = Math.min(w, scr.width - 4);
  const mh = Math.min(h, scr.height - 2);
  const mx = Math.floor((scr.width - mw) / 2);
  const my = Math.floor((scr.height - mh) / 2);
  scr.box(mx, my, mw, mh, { color, title, titleColor: color, bg: T.surface });
  scr.region(mx, my, mw, mh, { onClick: () => {} });
  const closeX = mx + mw - 5;
  const hovered = scr.hover(closeX, my, 3, 1);
  scr.text(closeX, my, ' ✕ ', { fg: hovered ? T.danger : T.muted, bg: T.surface, bold: hovered });
  scr.region(closeX, my, 3, 1, { onClick: onClose });
  return { x: mx + 2, y: my + 1, w: mw - 4, h: mh - 2 };
}
