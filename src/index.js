#!/usr/bin/env -S node --max-semi-space-size=1 --max-old-space-size=64
import { Screen } from './term.js';
import { T } from './theme.js';
import { clamp } from './format.js';
import { createSampler } from './sampler.js';
import { processRows, topGroups, resolveItem } from './rows.js';
import { TABS, header, tabBar, footer, helpModal, detailModal, confirmModal, languagePicker } from './chrome.js';
import { t, setLanguage, getLanguage, isLanguage, systemLanguage, LANGUAGES } from './i18n.js';
import { loadConfig, saveConfig, argLanguage } from './config.js';
import { overview } from './views/overview.js';
import { cpuView, memoryView, gpuView } from './views/resources.js';
import { networkView, diskView } from './views/io.js';
import { powerView } from './views/power.js';
import { processesView } from './views/processes.js';

const VIEWS = { overview, cpu: cpuView, memory: memoryView, gpu: gpuView, network: networkView, disk: diskView, power: powerView, processes: processesView };
const SORT_CYCLE = ['cpu', 'rss', 'name', 'count'];
const out = process.stdout;

const config = loadConfig();
const requested = [argLanguage(), config.lang].find(isLanguage);
setLanguage(requested || systemLanguage());

if (!process.stdin.isTTY || !out.isTTY) {
  console.error(getLanguage().code === 'es' ? 'mac vitals necesita una terminal interactiva.' : 'mac vitals needs an interactive terminal.');
  process.exit(1);
}

const state = {
  tab: 0, selected: 0, scroll: 0, listHeight: 10,
  sort: { key: 'cpu', desc: true }, grouped: true, query: '', searching: false,
  detail: null, confirm: null, help: false, notice: '', paused: false,
  mouse: { x: -1, y: -1 },
  // Sin idioma guardado se muestra el selector, preseleccionando el del sistema.
  picker: requested ? null : { index: LANGUAGES.findIndex((lang) => lang.code === getLanguage().code) },
};

const sampler = createSampler(() => scheduleRender());
const { data } = sampler;

function currentRows() {
  const id = TABS[state.tab].id;
  if (id === 'overview') return topGroups(data, 'cpu');
  if (id === 'processes') return processRows(data, state);
  return null;
}

let noticeTimer = null;
function notify(message) {
  state.notice = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { state.notice = ''; scheduleRender(); }, 3000);
}

function quit() {
  process.exit(0);
}

const actions = {
  quit,
  chooseLanguage(code) {
    setLanguage(code);
    config.lang = code;
    saveConfig(config);
    state.picker = null;
  },
  cycleLanguage() {
    const index = LANGUAGES.findIndex((lang) => lang.code === getLanguage().code);
    const next = LANGUAGES[(index + 1) % LANGUAGES.length];
    actions.chooseLanguage(next.code);
    notify(t('Idioma: {name}', { name: next.name }));
  },
  setTab(index) {
    state.tab = (index + TABS.length) % TABS.length;
    state.selected = 0;
    state.scroll = 0;
    state.searching = false;
  },
  move(delta) {
    const rows = currentRows();
    if (rows) state.selected = clamp(state.selected + delta, 0, Math.max(0, rows.length - 1));
  },
  openRow(index, item) {
    state.selected = index;
    actions.openDetail(item);
  },
  openDetail(item) {
    state.detail = item.grouped ? { grouped: true, key: item.key } : { grouped: false, pid: item.pid };
  },
  closeDetail() { state.detail = null; },
  askTerminate(item) {
    if (item) state.confirm = { name: item.name, pid: item.pid, count: item.count, grouped: item.grouped };
  },
  confirm(yes) {
    const item = state.confirm;
    state.confirm = null;
    if (!yes || !item) return;
    if (item.pid <= 1 || item.pid === process.pid) {
      notify(t('No se permite terminar {name}', { name: item.name }));
      return;
    }
    try {
      process.kill(item.pid, 'SIGTERM');
      notify(t('{name} (PID {pid}) recibió SIGTERM', { name: item.name, pid: item.pid }));
      state.detail = null;
      setTimeout(() => sampler.sample(true), 600);
    } catch (error) {
      notify(t(error.code === 'EPERM' ? 'Sin permiso para terminar {name}' : 'No se pudo terminar {name}', { name: item.name }));
    }
  },
  setSort(key) {
    state.sort = state.sort.key === key ? { key, desc: !state.sort.desc } : { key, desc: key !== 'name' };
    state.selected = 0;
  },
  cycleSort() {
    const keys = SORT_CYCLE.filter((key) => state.grouped || key !== 'count');
    actions.setSort(keys[(keys.indexOf(state.sort.key) + 1) % keys.length]);
  },
  setGrouped(grouped) {
    state.grouped = grouped;
    if (!grouped && state.sort.key === 'count') state.sort = { key: 'cpu', desc: true };
    state.selected = 0;
    state.scroll = 0;
  },
  togglePause() {
    state.paused = !state.paused;
    notify(t(state.paused ? 'Muestreo en pausa · p para reanudar' : 'Muestreo reanudado'));
  },
  refresh() {
    sampler.sample(true);
    notify(t('Actualizando…'));
  },
  startSearch() {
    if (TABS[state.tab].id !== 'processes') actions.setTab(TABS.findIndex((t) => t.id === 'processes'));
    state.searching = true;
  },
  clearQuery() {
    state.query = '';
    state.selected = 0;
  },
  toggleHelp() { state.help = !state.help; },
};

/* ---------- Render ---------- */

const screen = new Screen(state.mouse);
let lastScreen = null;
let prevRows = [];
let pending = false;

function flush(scr) {
  const rows = scr.rows();
  let output = '\x1b[?2026h';
  rows.forEach((row, i) => { if (row !== prevRows[i]) output += `\x1b[${i + 1};1H${row}`; });
  output += '\x1b[?2026l';
  prevRows = rows;
  out.write(output);
}

function render() {
  const width = out.columns || 100;
  const height = out.rows || 30;
  const scr = screen;
  scr.mouse = state.mouse;
  scr.reset(width, height);
  lastScreen = scr;
  if (width < 80 || height < 24) {
    scr.text(2, 1, t('Ventana demasiado pequeña: {w}x{h}', { w: width, h: height }), { fg: T.warn, bold: true });
    scr.text(2, 2, t('Se necesita al menos 80x24.'), { fg: T.muted });
    flush(scr);
    return;
  }
  const ctx = { scr, data, state, actions };
  if (state.picker) {
    languagePicker(ctx);
    flush(scr);
    return;
  }
  header(ctx);
  tabBar(ctx);
  const rect = { x: 1, y: 2, w: width - 2, h: height - 3 };
  if (data.mem) VIEWS[TABS[state.tab].id](ctx, rect);
  else scr.text(rect.x + 1, rect.y + 1, t('Recolectando métricas…'), { fg: T.muted });
  footer(ctx);
  if (state.detail) detailModal(ctx, resolveItem(data, state.detail));
  if (state.confirm) confirmModal(ctx, state.confirm);
  if (state.help) helpModal(ctx);
  flush(scr);
}

function scheduleRender() {
  if (pending) return;
  pending = true;
  setImmediate(() => { pending = false; render(); });
}

/* ---------- Entrada ---------- */

const CSI = { A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end', Z: 'backtab' };
const TILDE = { 1: 'home', 3: 'delete', 4: 'end', 5: 'pageup', 6: 'pagedown', 7: 'home', 8: 'end' };
const SIMPLE = { '\r': 'return', '\n': 'return', '\t': 'tab', '\x7f': 'backspace', '\b': 'backspace', '\x03': 'ctrl-c', ' ': 'space' };

function* tokenize(input) {
  let i = 0;
  while (i < input.length) {
    const rest = input.slice(i);
    let m = rest.match(/^\x1b\[<(\d+);(\d+);(\d+)([mM])/);
    if (m) {
      yield { mouse: true, button: Number(m[1]), x: Number(m[2]) - 1, y: Number(m[3]) - 1, release: m[4] === 'm' };
      i += m[0].length;
      continue;
    }
    m = rest.match(/^\x1b(?:\[(\d*)(?:;\d+)?([A-DHFZ~])|O([A-DHF]))/);
    if (m) {
      yield { name: m[2] === '~' ? TILDE[m[1]] : CSI[m[2] || m[3]] };
      i += m[0].length;
      continue;
    }
    if (rest[0] === '\x1b') { yield { name: 'escape' }; i++; continue; }
    const ch = String.fromCodePoint(rest.codePointAt(0));
    i += ch.length;
    yield SIMPLE[ch] ? { name: SIMPLE[ch] } : { name: ch, ch };
  }
}

let hovered = null;

function handleMouse({ button, x, y, release }) {
  const motion = button & 32;
  state.mouse.x = x;
  state.mouse.y = y;
  if (!lastScreen) return;
  // Solo se redibuja al cambiar el elemento bajo el cursor, no en cada movimiento.
  const target = lastScreen.hit(x, y, 'onClick');
  const key = target ? `${target.x},${target.y},${target.w},${target.h}` : null;
  if (key !== hovered) {
    hovered = key;
    scheduleRender();
  }
  if (release || motion) return;
  if (button & 64) {
    const delta = button & 1 ? 3 : -3;
    const target = lastScreen.hit(x, y, 'onWheel');
    if (target) target.onWheel(delta);
    else if (!state.detail && !state.help && !state.confirm) actions.move(delta);
  } else if ((button & 3) === 0) {
    lastScreen.hit(x, y, 'onClick')?.onClick();
  }
  scheduleRender();
}

function handleSearchKey(key) {
  if (key.name === 'return') state.searching = false;
  else if (key.name === 'escape') { state.searching = false; actions.clearQuery(); }
  else if (key.name === 'backspace') state.query = state.query.slice(0, -1);
  else if (key.ch || key.name === 'space') state.query += key.ch || ' ';
  state.selected = 0;
  state.scroll = 0;
}

function handlePickerKey(name) {
  const count = LANGUAGES.length;
  if (name === 'up' || name === 'left' || name === 'backtab') state.picker.index = (state.picker.index - 1 + count) % count;
  else if (name === 'down' || name === 'right' || name === 'tab') state.picker.index = (state.picker.index + 1) % count;
  else if (name === 'return') actions.chooseLanguage(LANGUAGES[state.picker.index].code);
  else if (/^[1-9]$/.test(name) && Number(name) <= count) actions.chooseLanguage(LANGUAGES[Number(name) - 1].code);
}

function handleKey(key) {
  const { name } = key;
  if (name === 'ctrl-c') quit();
  if (state.searching) return handleSearchKey(key);
  if (state.confirm) {
    if (name === 'y' || name === 'return') actions.confirm(true);
    else if (name === 'n' || name === 'escape') actions.confirm(false);
    return;
  }
  if (name === 'q') quit();
  if (state.picker) return handlePickerKey(name);
  if (name === 'L') return actions.cycleLanguage();
  if (state.help) { state.help = false; return; }
  if (state.detail) {
    if (name === 'escape' || name === 'backspace') actions.closeDetail();
    else if (name === 'k') actions.askTerminate(resolveItem(data, state.detail));
    return;
  }
  const rows = currentRows();
  if (/^[1-8]$/.test(name)) actions.setTab(Number(name) - 1);
  else if (name === 'right' || name === 'l' || name === 'tab') actions.setTab(state.tab + 1);
  else if (name === 'left' || name === 'h' || name === 'backtab') actions.setTab(state.tab - 1);
  else if (name === 'up') actions.move(-1);
  else if (name === 'down' || name === 'j') actions.move(1);
  else if (name === 'pageup') actions.move(-state.listHeight);
  else if (name === 'pagedown') actions.move(state.listHeight);
  else if (name === 'home') actions.move(-Infinity);
  else if (name === 'end') actions.move(Infinity);
  else if (name === 'return' && rows?.[state.selected]) actions.openDetail(rows[state.selected]);
  else if (name === 'k' && rows?.[state.selected]) actions.askTerminate(rows[state.selected]);
  else if (name === '/') actions.startSearch();
  else if (name === 's') actions.cycleSort();
  else if (name === 'g') actions.setGrouped(!state.grouped);
  else if (name === 'p' || name === 'space') actions.togglePause();
  else if (name === 'r') actions.refresh();
  else if (name === '?') actions.toggleHelp();
  else if (name === 'escape' && state.query) actions.clearQuery();
}

/* ---------- Ciclo de vida ---------- */

function restore() {
  out.write('\x1b[?1003l\x1b[?1006l\x1b[0m\x1b[?25h\x1b[?1049l');
}

process.on('exit', restore);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(0));
process.on('uncaughtException', (error) => {
  restore();
  console.error(error);
  process.exit(1);
});

out.write('\x1b[?1049h\x1b[?25l\x1b[?1003h\x1b[?1006h\x1b[2J');
out.on('resize', () => { prevRows = []; out.write('\x1b[2J'); render(); });
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (chunk) => {
  for (const token of tokenize(chunk.toString('utf8'))) {
    if (token.mouse) handleMouse(token);
    else { handleKey(token); scheduleRender(); }
  }
});

render();
sampler.sample(true);
setInterval(() => { if (!state.paused) sampler.sample(); }, 1000);
