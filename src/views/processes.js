import { T } from '../theme.js';
import { panel, button } from '../widgets.js';
import { processRows } from '../rows.js';
import { selectableTable } from './common.js';
import { t } from '../i18n.js';

const SORTS = [['cpu', 'CPU'], ['rss', 'Memoria'], ['name', 'Nombre'], ['count', 'Procesos']];

export function processesView(ctx, rect) {
  const { scr, data, state, actions } = ctx;
  const rows = processRows(data, state);

  const y = rect.y;
  const searchW = Math.min(36, Math.floor(rect.w / 3));
  const hovered = scr.hover(rect.x, y, searchW, 1);
  const active = state.searching;
  scr.fill(rect.x, y, searchW, 1, { bg: active ? T.select : hovered ? T.hover : T.surface });
  const placeholder = state.query || (active ? '' : t('Buscar nombre, ruta o PID   /'));
  const end = scr.text(rect.x + 1, y, `⌕ ${placeholder}`, { fg: state.query || active ? T.text : T.dim }, searchW - 2);
  if (active) scr.put(end, y, '▌', { fg: T.accent });
  scr.region(rect.x, y, searchW, 1, { onClick: actions.startSearch });

  let x = rect.x + searchW + 2;
  x = button(scr, x, y, t('Por aplicación'), () => actions.setGrouped(true), { active: state.grouped });
  x = button(scr, x, y, t('Individual'), () => actions.setGrouped(false), { active: !state.grouped }) + 2;
  x = scr.text(x, y, t('Orden'), { fg: T.muted }) + 1;
  for (const [key, label] of SORTS) {
    if (key === 'count' && !state.grouped) continue;
    const isActive = state.sort.key === key;
    x = button(scr, x, y, `${t(label)}${isActive ? (state.sort.desc ? ' ▼' : ' ▲') : ''}`, () => actions.setSort(key), { active: isActive, tone: T.muted });
  }

  const title = t(state.grouped ? 'Aplicaciones' : 'Procesos');
  const summary = t('{n} de {m}', { n: rows.length, m: state.grouped ? data.groups.length : data.processes.length });
  const inner = panel(scr, { x: rect.x, y: y + 2, w: rect.w, h: rect.h - 2 }, title, T.accent, { right: summary });
  if (!rows.length) {
    scr.text(inner.x, inner.y + 1, state.query ? t('Sin resultados para «{q}».', { q: state.query }) : t('Cargando procesos…'), { fg: T.muted });
    return;
  }
  selectableTable(ctx, { ...inner, w: inner.w - 1 }, rows, { grouped: state.grouped, sortable: true, compact: rect.w < 100 });
}
