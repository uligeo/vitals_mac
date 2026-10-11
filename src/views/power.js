import { T, GR } from '../theme.js';
import { split } from '../term.js';
import { fmtPct } from '../format.js';
import { panel, keyValue, bigValue } from '../widgets.js';
import { axisChart } from './common.js';
import { t } from '../i18n.js';

const STATES = {
  charging: 'Cargando',
  discharging: 'Descargando',
  charged: 'Carga completa',
  'finishing charge': 'Terminando carga',
  'AC attached': 'Conectada, sin cargar',
};

const SOURCES = { 'AC Power': 'Corriente alterna', 'Battery Power': 'Batería', 'UPS Power': 'UPS' };

export const batteryStateLabel = (state) => t(STATES[state] || state);

/** Dibuja una batería con relleno proporcional y el porcentaje centrado. */
function batteryIcon(scr, x, y, w, h, pct, tone) {
  scr.box(x, y, w - 1, h, { color: T.muted });
  const nubY = y + Math.floor(h / 2) - (h > 4 ? 1 : 0);
  for (let row = nubY; row < nubY + (h > 4 ? 2 : 1); row++) scr.put(x + w - 1, row, '▐', { fg: T.muted });
  const innerW = w - 3;
  const filled = Math.round((pct / 100) * innerW);
  for (let row = y + 1; row < y + h - 1; row++) {
    for (let col = 0; col < innerW; col++) {
      scr.put(x + 1 + col, row, ' ', { bg: col < filled ? tone : T.track });
    }
  }
  const label = `${pct}%`;
  const lx = x + 1 + Math.floor((innerW - label.length) / 2);
  const ly = y + Math.floor(h / 2);
  [...label].forEach((ch, i) => {
    const onFill = lx + i - x - 1 < filled;
    scr.put(lx + i, ly, ch, { fg: onFill ? T.ink : T.text, bold: true });
  });
}

export function powerView(ctx, rect) {
  const { scr, data } = ctx;
  const b = data.battery;
  const topH = Math.min(12, Math.max(9, Math.round(rect.h * 0.45)));
  const [left, right] = split(rect.x, rect.w, 2, 1);

  const p = panel(scr, { ...left, y: rect.y, h: topH }, t('Batería'), T.battery);
  if (!b.present) {
    bigValue(scr, p.x, p.y, t('Sin batería'), t('equipo conectado a corriente'), T.battery);
    return;
  }
  const tone = b.percent <= 20 ? T.danger : b.percent <= 40 ? T.warn : T.battery;
  const iconW = Math.min(p.w, 48);
  batteryIcon(scr, p.x + Math.floor((p.w - iconW) / 2), p.y + 1, iconW, Math.min(7, p.h - 2), b.percent, tone);
  const status = `${b.external ? '↯ ' : ''}${batteryStateLabel(b.state)}${b.remaining ? ` · ${t('{t} restantes', { t: b.remaining })}` : ''}`;
  scr.text(p.x + Math.floor((p.w - status.length) / 2), p.y + p.h - 1, status, { fg: tone, bold: true }, p.w);

  const i = panel(scr, { ...right, y: rect.y, h: topH }, t('Estado'), T.battery);
  const watts = Number.isFinite(b.watts) ? t(b.watts < 0 ? '{w} W consumo' : '{w} W entrada', { w: Math.abs(b.watts).toFixed(1) }) : '—';
  const healthTone = b.health >= 80 ? T.ok : b.health >= 60 ? T.warn : T.danger;
  const rows = [
    ['Fuente de energía', t(SOURCES[b.source] || b.source), T.text],
    ['Estado', batteryStateLabel(b.state), tone],
    ['Tiempo restante', b.remaining || t('calculando…'), T.text],
    ['Flujo de energía', watts, b.watts < 0 ? T.warn : T.ok],
    ['Ciclos de carga', Number.isFinite(b.cycles) ? String(b.cycles) : '—', T.text],
    ['Capacidad máxima', fmtPct(b.health), healthTone],
  ];
  rows.forEach(([label, value, color], idx) => {
    if (idx < i.h) keyValue(scr, i.x, i.y + idx + (i.h > rows.length + 1 ? 1 : 0), i.w, t(label), value, color);
  });

  const chartsH = rect.h - topH;
  if (chartsH < 5) return;
  const c = panel(scr, { ...left, y: rect.y + topH, h: chartsH }, t('Nivel de carga'), T.battery, { right: t('historial de sesión') });
  axisChart(scr, c, data.history.battery, { color: GR.battery });
  const watt = panel(scr, { ...right, y: rect.y + topH, h: chartsH }, t('Potencia'), T.warn, { right: 'W' });
  const maxW = Math.max(10, ...data.history.watts) * 1.2;
  axisChart(scr, watt, data.history.watts, { max: maxW, color: GR.power, label: (v) => `${v.toFixed(0)} W` });
}
