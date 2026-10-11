import { T, GR } from './theme.js';
import { areaChart } from './charts.js';
import { fmtBytes, fmtDuration, etimeToSeconds } from './format.js';
import { button, keyValue, modalFrame } from './widgets.js';
import { t, getLanguage, LANGUAGES } from './i18n.js';
import type { ConfirmItem, Ctx, Row } from './types.js';

export const TABS = [
  { id: 'overview', label: 'Resumen', color: T.accent },
  { id: 'cpu', label: 'CPU', color: T.cpu },
  { id: 'memory', label: t('Memoria'), color: T.mem },
  { id: 'gpu', label: 'GPU', color: T.gpu },
  { id: 'network', label: 'Red', color: T.down },
  { id: 'disk', label: 'Disco', color: T.disk },
  { id: 'power', label: 'Energía', color: T.battery },
  { id: 'processes', label: 'Procesos', color: T.accent },
];

export function header({ scr, data, state, actions }: Ctx): void {
  scr.fill(0, 0, scr.width, 1, { bg: T.surface });
  let x = scr.text(0, 0, ' ◆ MAC VITALS ', { fg: T.ink, bg: T.accent, bold: true });
  const info = data.info;
  if (info) {
    const cores = info.pCores ? `${info.pCores}P+${info.eCores}E` : t('{n} núcleos', { n: info.cores });
    x = scr.text(x + 1, 0, `${info.host} · ${info.model} ${cores} · ${fmtBytes(data.mem?.total ?? 0)} · macOS ${info.macos} · ${t('activo {t}', { t: fmtDuration(data.uptime) })}`, { fg: T.muted }, scr.width - x - 30);
  }
  const clock = data.capturedAt.toLocaleTimeString(getLanguage().locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  scr.textRight(scr.width - 1, 0, clock, { fg: T.text, bold: true });
  const label = t(state.paused ? '❚❚ PAUSADO' : '● EN VIVO');
  button(scr, scr.width - clock.length - label.length - 4, 0, label, actions.togglePause, { tone: state.paused ? T.warn : T.ok });
}

export function tabBar({ scr, state, actions }: Ctx): void {
  const gap = scr.width >= 90 ? 1 : 0;
  let x = 1;
  TABS.forEach((tab, i) => {
    const label = ` ${i + 1} ${t(tab.label)} `;
    const w = [...label].length;
    const active = state.tab === i;
    const hovered = scr.hover(x, 1, w, 1);
    const style = active
      ? { fg: T.ink, bg: tab.color, bold: true }
      : { fg: hovered ? tab.color : T.muted, bg: hovered ? T.hover : undefined, bold: hovered };
    scr.text(x, 1, label, style);
    scr.region(x, 1, w, 1, { onClick: () => actions.setTab(i) });
    x += w + gap;
  });
}

export function footer({ scr, state, actions }: Ctx): void {
  const y = scr.height - 1;
  scr.fill(0, y, scr.width, 1, { bg: T.surface });
  if (state.searching) {
    const x = scr.text(1, y, ` ${t('Buscar')} `, { fg: T.ink, bg: T.accent, bold: true });
    const end = scr.text(x + 1, y, state.query, { fg: T.text, bold: true });
    scr.put(end, y, '▌', { fg: T.accent });
    scr.textRight(scr.width - 1, y, 'Enter aplicar · Esc limpiar', { fg: T.muted });
    return;
  }
  if (state.notice) {
    scr.text(1, y, ` ${state.notice} `, { fg: T.ink, bg: T.warn, bold: true });
    return;
  }
  const hints = [['←→', 'vista'], ['↑↓', 'mover'], ['⏎', 'detalle'], ['/', 'buscar'], ['s', 'ordenar'], ['g', 'agrupar']];
  let x = 1;
  for (const [key, label] of hints) {
    x = scr.text(x, y, key, { fg: T.accent, bold: true });
    x = scr.text(x + 1, y, t(label), { fg: T.muted }) + 2;
  }
  if (state.query) x = button(scr, x, y, t('filtro: {q} ✕', { q: state.query }), actions.clearQuery, { tone: T.warn });
  let right = scr.width - 1;
  const lang = `L ${getLanguage().code.toUpperCase()}`;
  const controls: [string, () => void, string][] = [
    [t('q salir'), actions.quit, T.danger],
    [t('? ayuda'), actions.toggleHelp, T.accent],
    [t('r actualizar'), actions.refresh, T.ok],
    [lang, actions.cycleLanguage, T.gpu],
  ];
  for (const [label, fn, tone] of controls) {
    right -= [...label].length + 3;
    if (right > x) button(scr, right, y, label, fn, { tone });
  }
}

export function helpModal({ scr, actions }: Ctx): void {
  const r = modalFrame(scr, 64, 23, t('Atajos'), T.accent, actions.toggleHelp);
  const rows = [
    ['← → · Tab · 1-8', 'cambiar de vista'],
    ['↑ ↓ · j · RePág · AvPág', 'mover la selección'],
    ['Inicio · Fin', 'primera / última fila'],
    ['Enter · clic', 'abrir el detalle'],
    ['Esc', 'cerrar detalle o ventana'],
    ['/', 'buscar por nombre, ruta o PID'],
    ['s · clic en columna', 'cambiar el orden'],
    ['g', 'agrupar por aplicación / individual'],
    ['k', 'terminar la aplicación seleccionada'],
    ['p · Espacio', 'pausar / reanudar el muestreo'],
    ['r', 'actualizar ahora'],
    ['rueda del ratón', 'desplazar listas'],
    ['L', 'cambiar idioma'],
    ['q · Ctrl+C', 'salir'],
  ];
  rows.forEach(([key, desc], i) => {
    scr.text(r.x + 1, r.y + 1 + i, t(key), { fg: T.accent, bold: true });
    scr.text(r.x + 27, r.y + 1 + i, t(desc), { fg: T.text }, r.w - 28);
  });
  scr.text(r.x + 1, r.y + r.h - 2, t('Las tarjetas y paneles con borde resaltado también son clicables.'), { fg: T.muted }, r.w - 2);
}

export function detailModal({ scr, data, actions }: Ctx, item: Row | null): void {
  const r = modalFrame(scr, 92, 26, item ? item.name : t('Proceso finalizado'), T.accent, actions.closeDetail);
  if (!item) {
    scr.text(r.x + 1, r.y + 1, t('El proceso ya no está en ejecución.'), { fg: T.muted });
    return;
  }
  const colW = Math.floor((r.w - 3) / 2);
  const left = r.x + 1;
  const right = left + colW + 2;
  keyValue(scr, left, r.y + 1, colW, 'CPU', `${item.cpu.toFixed(1)}%`, T.cpu);
  keyValue(scr, left, r.y + 2, colW, t('Memoria'), `${fmtBytes(item.rss)} · ${item.mem.toFixed(1)}%`, T.mem);
  keyValue(scr, left, r.y + 3, colW, t(item.grouped ? 'Procesos' : 'PID padre'), item.grouped ? String(item.count) : String(item.ppid), T.text);
  keyValue(scr, right, r.y + 1, colW, t('PID principal'), String(item.pid), T.text);
  keyValue(scr, right, r.y + 2, colW, t('Usuario'), item.user, item.user === 'root' ? T.warn : T.text);
  keyValue(scr, right, r.y + 3, colW, t('En ejecución'), fmtDuration(etimeToSeconds(item.elapsed)), T.text);
  keyValue(scr, left, r.y + 4, r.w - 2, t('Puertos'), [...item.ports].join(', ') || t('ninguno'), item.ports.size ? T.down : T.muted);
  scr.text(left, r.y + 5, item.command, { fg: T.dim }, r.w - 2);

  const history = data.appHistory.get(item.app || item.key) || [];
  const peak = Math.max(100, ...history);
  scr.text(left, r.y + 7, t('CPU del grupo · últimos 2 min'), { fg: T.muted });
  scr.textRight(r.x + r.w - 1, r.y + 7, t('máx {v}', { v: `${Math.max(0, ...history).toFixed(1)}%` }), { fg: T.muted });
  areaChart(scr, left, r.y + 8, r.w - 2, 4, history, { max: peak, color: GR.cpu });

  const listY = r.y + 13;
  scr.text(left, listY, t('PID       CPU     Memoria   Tiempo        Comando'), { fg: T.muted });
  const members = [...item.members].sort((a, b) => b.cpu - a.cpu).slice(0, Math.max(0, r.h - 16));
  members.forEach((m, i) => {
    const line = `${String(m.pid).padEnd(7)} ${`${m.cpu.toFixed(1)}%`.padStart(6)} ${fmtBytes(m.rss).padStart(10)}   ${m.elapsed.padStart(11)}   ${m.name}`;
    scr.text(left, listY + 1 + i, line, { fg: T.text }, r.w - 2);
  });
  if (item.members.length > members.length) scr.text(left, listY + 1 + members.length, t('… y {n} más', { n: item.members.length - members.length }), { fg: T.dim });

  const by = r.y + r.h - 1;
  let bx = button(scr, left, by, t('k Terminar'), () => actions.askTerminate(item), { tone: T.danger });
  button(scr, bx, by, t('Esc Cerrar'), actions.closeDetail, { tone: T.muted });
}

export function confirmModal({ scr, actions }: Ctx, item: ConfirmItem): void {
  const r = modalFrame(scr, 56, 8, t('Confirmar'), T.danger, () => actions.confirm(false));
  scr.text(r.x + 1, r.y + 1, t('¿Enviar SIGTERM a {name}?', { name: item.name }), { fg: T.text, bold: true }, r.w - 2);
  scr.text(r.x + 1, r.y + 2, `PID ${item.pid}${item.grouped && item.count > 1 ? t(' (proceso raíz de {n})', { n: item.count }) : ''}`, { fg: T.muted }, r.w - 2);
  const bx = button(scr, r.x + 1, r.y + 4, t('y Sí, terminar'), () => actions.confirm(true), { tone: T.danger, active: true });
  button(scr, bx, r.y + 4, t('n Cancelar'), () => actions.confirm(false), { tone: T.muted });
}

/** Selector de idioma del primer arranque; los textos van en ambos idiomas a propósito. */
export function languagePicker({ scr, state, actions }: Ctx): void {
  scr.fill(0, 0, scr.width, scr.height, { bg: T.ink });
  const w = Math.min(54, scr.width - 4);
  const h = 11 + LANGUAGES.length * 2;
  const x = Math.floor((scr.width - w) / 2);
  const y = Math.floor((scr.height - h) / 2);
  scr.box(x, y, w, h, { color: T.accent, bg: T.surface });
  scr.text(x + Math.floor((w - 14) / 2), y + 1, ' ◆ MAC VITALS ', { fg: T.ink, bg: T.accent, bold: true });
  scr.text(x + 3, y + 3, 'Elige tu idioma', { fg: T.text, bold: true });
  scr.text(x + 3, y + 4, 'Choose your language', { fg: T.muted });
  LANGUAGES.forEach((lang, i) => {
    const ry = y + 6 + i * 2;
    const selected = state.picker?.index === i;
    const hovered = scr.hover(x + 3, ry, w - 6, 1);
    const bg = selected ? T.accent : hovered ? T.hover : T.track;
    scr.fill(x + 3, ry, w - 6, 1, { bg });
    scr.text(x + 5, ry, `${i + 1}   ${lang.name}`, { fg: selected ? T.ink : T.text, bg, bold: selected });
    if (selected) scr.textRight(x + w - 5, ry, '⏎', { fg: T.ink, bg, bold: true });
    scr.region(x + 3, ry, w - 6, 1, { onClick: () => actions.chooseLanguage(lang.code) });
  });
  scr.text(x + 3, y + h - 3, '↑↓ · Enter · 1-2 · clic / click', { fg: T.muted }, w - 6);
  scr.text(x + 3, y + h - 2, 'L: cambiar después / change it later', { fg: T.dim }, w - 6);
}
