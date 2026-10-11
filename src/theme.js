import { clamp } from './format.js';

export const T = {
  text: '#e6e9f2',
  muted: '#8b93a7',
  dim: '#5a6178',
  border: '#343b52',
  ink: '#10131c',
  surface: '#1a1f2e',
  hover: '#242b40',
  select: '#2e3a5c',
  track: '#262d40',
  accent: '#7aa2f7',
  cpu: '#ff9e64',
  mem: '#7aa2f7',
  gpu: '#bb9af7',
  disk: '#7dcfff',
  down: '#9ece6a',
  up: '#f7768e',
  battery: '#9ece6a',
  ok: '#9ece6a',
  warn: '#e0af68',
  danger: '#f7768e',
};

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Pasos de cuantización: limitan la paleta a un conjunto finito y memorizable. */
const STEPS = 24;
const mixCache = new Map();

export function mix(a, b, t) {
  const step = Math.round(clamp(t, 0, 1) * STEPS);
  const key = `${a}${b}${step}`;
  let color = mixCache.get(key);
  if (!color) {
    const [ra, rb] = [toRgb(a), toRgb(b)];
    color = toHex(ra.map((v, i) => v + ((rb[i] - v) * step) / STEPS));
    mixCache.set(key, color);
  }
  return color;
}

const HEAT = [[0, T.ok], [55, T.warn], [85, T.danger], [100, T.danger]];

/** Color semáforo para un porcentaje: verde, ámbar, rojo. */
export function heat(pct) {
  const p = clamp(pct, 0, 100);
  for (let i = 1; i < HEAT.length; i++) {
    const [stop, color] = HEAT[i];
    const [prevStop, prevColor] = HEAT[i - 1];
    if (p <= stop) return mix(prevColor, color, (p - prevStop) / (stop - prevStop || 1));
  }
  return T.danger;
}

/** Degradados multicolor por métrica, del valor bajo al alto. */
export const G = {
  cpu: ['#2ac3de', '#9ece6a', '#e0af68', '#ff9e64', '#f7768e'],
  mem: ['#2ac3de', '#7aa2f7', '#9d7cd8', '#ff79c6'],
  gpu: ['#7aa2f7', '#bb9af7', '#ff79c6', '#ff9e64'],
  down: ['#0db9a5', '#1abc9c', '#9ece6a', '#d4f08c'],
  up: ['#ff9e64', '#ff7a93', '#f7768e', '#ff5c8a'],
  read: ['#3d59a1', '#2ac3de', '#7dcfff', '#b4f9f8'],
  write: ['#e0af68', '#ff9e64', '#f7768e', '#ff007c'],
  battery: ['#f7768e', '#e0af68', '#9ece6a', '#73daca'],
  power: ['#9ece6a', '#e0af68', '#ff9e64', '#f7768e'],
};

/** Función de color a partir de paradas; recibe una fracción entre 0 y 1. */
export function gradient(stops) {
  return (fraction) => {
    const pos = clamp(fraction, 0, 1) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(pos));
    return mix(stops[i], stops[i + 1], pos - i);
  };
}

/** Degradados listos para gráficas (fracción 0-1) y medidores (porcentaje). */
export const GR = Object.fromEntries(Object.entries(G).map(([key, stops]) => [key, gradient(stops)]));
export const RAMP = Object.fromEntries(Object.entries(GR).map(([key, fn]) => [key, (pct) => fn(pct / 100)]));
