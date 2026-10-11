import { T, GR, heat } from './theme.js';
import { gauge, sparkline } from './charts.js';
import { clamp, fmtBytes } from './format.js';
import { t } from './i18n.js';

const trendColor = (_, fraction) => GR.cpu(fraction);

/** Panel con borde redondeado; se resalta al pasar el ratón si es clicable. */
export function panel(scr, { x, y, w, h }, title, color, { onClick, right } = {}) {
  const hovered = onClick && scr.hover(x, y, w, h);
  scr.box(x, y, w, h, { color: hovered ? color : T.border, title, titleColor: color });
  if (right) scr.textRight(x + w - 2, y, ` ${right} `, { fg: T.muted });
  if (onClick) scr.region(x, y, w, h, { onClick });
  return { x: x + 2, y: y + 1, w: w - 4, h: h - 2 };
}

/** Botón tipo píldora. Devuelve la x siguiente. */
export function button(scr, x, y, label, onClick, { tone = T.accent, active = false } = {}) {
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

export function keyValue(scr, x, y, w, label, value, tone = T.text) {
  scr.text(x, y, label, { fg: T.muted }, w);
  scr.textRight(x + w, y, value, { fg: tone, bold: true });
}

export function legend(scr, x, y, color, label, value) {
  scr.put(x, y, '■', { fg: color });
  const end = scr.text(x + 2, y, label, { fg: T.muted });
  return value ? scr.text(end + 1, y, value, { fg: T.text, bold: true }) : end;
}

/** Valor grande con etiqueta, para las tarjetas. */
export function bigValue(scr, x, y, value, unit, color) {
  const end = scr.text(x, y, value, { fg: color, bold: true });
  return unit ? scr.text(end + 1, y, unit, { fg: T.muted }) : end;
}

/**
 * Tabla de procesos con columnas configurables, selección, hover y scroll.
 * columns: [{ title, width, align, sortKey, render(item) -> { text, fg } | gauge }]
 */
export function table(scr, rect, rows, { columns, selected, scroll, sort, onSort, onRow, onWheel }) {
  const { x, y, w, h } = rect;
  const flexible = columns.find((c) => c.width === 'flex');
  const fixed = columns.reduce((acc, c) => acc + (c.width === 'flex' ? 0 : c.width + 1), 0);
  if (flexible) flexible.actual = Math.max(8, w - fixed - 1);
  let cx = x;
  columns.forEach((col) => {
    const cw = col.width === 'flex' ? col.actual : col.width;
    const active = sort && col.sortKey === sort.key;
    const arrow = active ? (sort.desc ? ' ▼' : ' ▲') : '';
    const label = `${col.title}${arrow}`;
    const hovered = col.sortKey && onSort && scr.hover(cx, y, cw, 1);
    const style = { fg: active ? T.accent : hovered ? T.text : T.muted, bold: active };
    if (col.align === 'right') scr.textRight(cx + cw, y, label, style);
    else scr.text(cx, y, label, style, cw);
    if (col.sortKey && onSort) scr.region(cx, y, cw, 1, { onClick: () => onSort(col.sortKey) });
    col.x = cx; col.w = cw;
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
    columns.forEach((col) => {
      const cell = col.render(item);
      if (cell.spark) {
        sparkline(scr, col.x, ry, col.w, cell.spark, trendColor, Math.max(5, ...cell.spark));
      } else if (cell.gauge !== undefined) {
        const gw = Math.max(0, col.w - 7);
        if (gw >= 3) gauge(scr, col.x, ry, gw, cell.gauge, heat(cell.gauge));
        scr.textRight(col.x + col.w, ry, cell.text, { fg: cell.fg || T.text, bold: isSel });
      } else if (col.align === 'right') {
        scr.textRight(col.x + col.w, ry, cell.text, { fg: cell.fg || T.text, bold: isSel });
      } else {
        scr.text(col.x, ry, cell.text, { fg: cell.fg || T.text, bold: isSel && col === columns[0] }, col.w);
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
export function processColumns({ grouped, compact = false, history }) {
  const columns = [
    { title: t(grouped ? 'Aplicación' : 'Proceso'), width: 'flex', sortKey: 'name', render: (i) => ({ text: i.name }) },
    { title: t('Tendencia'), width: compact ? 10 : 12, render: (i) => ({ spark: history?.get(i.grouped ? i.key : i.app) || [] }) },
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
export function modalFrame(scr, w, h, title, color, onClose) {
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
