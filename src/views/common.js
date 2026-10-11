import { T } from '../theme.js';
import { areaChart } from '../charts.js';
import { clamp, fmtRate } from '../format.js';
import { table, processColumns } from '../widgets.js';

const visibleMax = (series, width) => Math.max(...series.slice(-width * 2), 0);

/** Gráfica de área con etiquetas del eje Y en un margen izquierdo. */
export function axisChart(scr, { x, y, w, h }, series, { max = 100, color, label = (v) => `${Math.round(v)}%` }) {
  const labels = [label(max), label(max / 2), label(0)];
  const gutter = Math.max(...labels.map((l) => l.length)) + 1;
  scr.text(x, y, labels[0].padStart(gutter - 1), { fg: T.dim });
  if (h >= 5) scr.text(x, y + Math.round((h - 1) / 2), labels[1].padStart(gutter - 1), { fg: T.dim });
  scr.text(x, y + h - 1, labels[2].padStart(gutter - 1), { fg: T.dim });
  areaChart(scr, x + gutter, y, w - gutter, h, series, { max, color });
}

/**
 * Gráfica espejo para tasas de entrada/salida: la serie superior crece hacia
 * arriba y la inferior hacia abajo, ambas con la misma escala automática.
 */
export function mirrorChart(scr, { x, y, w, h }, top, bottom, { topColor, bottomColor }) {
  const gutter = 11;
  const width = w - gutter;
  const max = Math.max(1024, visibleMax(top, width), visibleMax(bottom, width)) * 1.15;
  const half = Math.floor(h / 2);
  scr.text(x, y, fmtRate(max).padStart(gutter - 1), { fg: T.dim });
  scr.text(x, y + half - 1, '0'.padStart(gutter - 1), { fg: T.dim });
  scr.text(x, y + h - 1, fmtRate(max).padStart(gutter - 1), { fg: T.dim });
  areaChart(scr, x + gutter, y, width, half, top, { max, color: topColor, grid: false });
  areaChart(scr, x + gutter, y + half, width, h - half, bottom, { max, color: bottomColor, invert: true, grid: false });
}

/** Tabla de procesos vinculada a la selección global (teclado, rueda y clic). */
export function selectableTable(ctx, rect, rows, { grouped = true, compact = false, sortable = false } = {}) {
  const { scr, state, actions } = ctx;
  const bodyH = Math.max(1, rect.h - 1);
  state.listHeight = bodyH;
  state.selected = clamp(state.selected, 0, Math.max(0, rows.length - 1));
  if (state.selected < state.scroll) state.scroll = state.selected;
  if (state.selected >= state.scroll + bodyH) state.scroll = state.selected - bodyH + 1;
  state.scroll = clamp(state.scroll, 0, Math.max(0, rows.length - bodyH));
  table(scr, rect, rows, {
    columns: processColumns({ grouped, compact, history: ctx.data.appHistory }),
    selected: state.selected,
    scroll: state.scroll,
    sort: sortable ? state.sort : { key: 'cpu', desc: true },
    onSort: sortable ? actions.setSort : null,
    onRow: (index, item) => actions.openRow(index, item),
    onWheel: (delta) => actions.move(delta),
  });
}

/** Lista compacta de solo lectura (clic abre el detalle). */
export function miniTable(ctx, rect, rows) {
  const { scr, actions } = ctx;
  table(scr, rect, rows.slice(0, Math.max(0, rect.h - 1)), {
    columns: processColumns({ grouped: true, compact: true, history: ctx.data.appHistory }),
    selected: -1,
    scroll: 0,
    onRow: (_, item) => actions.openDetail(item),
  });
}
