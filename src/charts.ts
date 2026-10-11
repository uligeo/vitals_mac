import { clamp } from './format.js';
import { T } from './theme.js';
import type { Screen } from './term.js';
import type { Color } from './types.js';

const DOTS = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
const PARTIAL_H = ' ▏▎▍▌▋▊▉█';
const PARTIAL_V = ' ▁▂▃▄▅▆▇█';
const SPARK = '▁▂▃▄▅▆▇█';

/**
 * Gráfica de área en braille (2x4 puntos por celda). `color(f)` recibe la
 * altura relativa de la fila (0 abajo, 1 arriba) para pintar degradados.
 * Con `invert` crece hacia abajo, útil para gráficas espejo.
 */
interface AreaOptions {
  max?: number;
  color: (fraction: number) => string;
  invert?: boolean;
  grid?: boolean;
}

export function areaChart(scr: Screen, x: number, y: number, w: number, h: number, values: number[], { max = 100, color, invert = false, grid = true }: AreaOptions): void {
  if (w <= 0 || h <= 0) return;
  const cols = w * 2;
  const rows = h * 4;
  const data = values.slice(-cols);
  const offset = cols - data.length;
  const mask = new Uint8Array(w * h);
  const top = Math.max(max, Number.EPSILON);
  data.forEach((value, i) => {
    let level = Math.round(clamp(value / top, 0, 1) * rows);
    if (value > 0 && level === 0) level = 1;
    const dx = offset + i;
    for (let k = 0; k < level; k++) {
      const dy = invert ? k : rows - 1 - k;
      mask[(dy >> 2) * w + (dx >> 1)] |= DOTS[dy & 3][dx & 1];
    }
  });
  for (let cy = 0; cy < h; cy++) {
    const fraction = invert ? (cy + 1) / h : (h - cy) / h;
    const gridRow = grid && h >= 4 && [1, 2, 3].some((k) => cy === Math.round((k * (h - 1)) / 4));
    for (let cx = 0; cx < w; cx++) {
      const bits = mask[cy * w + cx];
      if (bits) scr.put(x + cx, y + cy, String.fromCodePoint(0x2800 + bits), { fg: color(fraction) });
      else if (gridRow && cx % 2 === 0) scr.put(x + cx, y + cy, '·', { fg: T.border });
    }
  }
}

/** Barra horizontal con resolución de 1/8 de celda sobre un riel de fondo. */
export function gauge(scr: Screen, x: number, y: number, w: number, pct: number, color: Color, { track = T.track } = {}): void {
  const units = (clamp(pct, 0, 100) / 100) * w;
  const full = Math.floor(units);
  const rem = Math.round((units - full) * 8);
  for (let i = 0; i < w; i++) {
    const fg = typeof color === 'function' ? color((i / Math.max(1, w - 1)) * 100) : color;
    if (i < full) scr.put(x + i, y, '█', { fg, bg: track });
    else if (i === full && rem > 0) scr.put(x + i, y, PARTIAL_H[rem], { fg, bg: track });
    else scr.put(x + i, y, ' ', { bg: track });
  }
}

/** Barras verticales (una por valor) con resolución de 1/8 de celda. */
export function vbars(scr: Screen, x: number, y: number, h: number, values: number[], colorOf: (value: number, fraction: number) => string, { barWidth = 1, gap = 1 } = {}): void {
  values.forEach((value, i) => {
    const units = (clamp(value, 0, 100) / 100) * h * 8;
    const bx = x + i * (barWidth + gap);
    for (let row = 0; row < h; row++) {
      const filled = clamp(units - row * 8, 0, 8);
      const ch = PARTIAL_V[Math.round(filled)];
      for (let b = 0; b < barWidth; b++) {
        scr.put(bx + b, y + h - 1 - row, ch, { fg: colorOf(value, (row + 1) / h), bg: T.track });
      }
    }
  });
}

export function sparkline(scr: Screen, x: number, y: number, w: number, values: number[], color: Color, max?: number): void {
  const data = values.slice(-w);
  const top = Math.max(max ?? Math.max(...data, 1), Number.EPSILON);
  data.forEach((value, i) => {
    const idx = Math.round(clamp(value / top, 0, 1) * (SPARK.length - 1));
    const fg = typeof color === 'function' ? color(value, value / top) : color;
    scr.put(x + w - data.length + i, y, SPARK[idx], { fg });
  });
}

/** Barra apilada: segmentos [{ value, color }] proporcionales a `total`. */
export function stackedBar(scr: Screen, x: number, y: number, w: number, h: number, segments: { value: number; color: string }[], total: number): void {
  let acc = 0;
  let prevEnd = 0;
  segments.forEach(({ value, color }) => {
    acc += value;
    const end = Math.round((clamp(acc / total, 0, 1)) * w);
    for (let col = prevEnd; col < end; col++) {
      for (let row = 0; row < h; row++) scr.put(x + col, y + row, '█', { fg: color });
    }
    prevEnd = end;
  });
  for (let col = prevEnd; col < w; col++) {
    for (let row = 0; row < h; row++) scr.put(x + col, y + row, ' ', { bg: T.track });
  }
}
