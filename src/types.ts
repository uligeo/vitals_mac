/** Tipos compartidos entre el muestreo, las vistas y el ciclo de entrada. */

import type { Screen } from './term.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Style {
  fg?: string | null;
  bg?: string | null;
  bold?: boolean;
}

export interface Mouse {
  x: number;
  y: number;
}

/** Función de color: recibe una fracción (0-1) o un porcentaje según el contexto. */
export type ColorFn = (value: number, fraction?: number) => string;
export type Color = string | ColorFn;

export interface Region extends Rect {
  onClick?: () => void;
  onWheel?: (delta: number) => void;
}

export interface Process {
  pid: number;
  ppid: number;
  cpu: number;
  mem: number;
  rss: number;
  elapsed: string;
  user: string;
  command: string;
  name: string;
  app: string;
}

/** Fila de las tablas: un grupo de procesos de la misma aplicación o un proceso individual. */
export interface Row {
  key: string;
  name: string;
  cpu: number;
  mem: number;
  rss: number;
  count: number;
  pid: number;
  ppid?: number;
  pids: number[];
  members: Process[];
  user: string;
  elapsed: string;
  command: string;
  ports: Set<number>;
  grouped: boolean;
  app?: string;
}

export interface PortEntry {
  pid: number;
  command: string;
  ports: Set<number>;
}

export interface StaticInfo {
  model: string;
  cores: number;
  pCores: number;
  eCores: number;
  macos: string;
  host: string;
  gpuCores: number;
}

export interface Memory {
  total: number;
  app: number;
  wired: number;
  compressed: number;
  cached: number;
  used: number;
  free: number;
  percent: number;
}

export interface Pressure {
  swapTotal: number;
  swapUsed: number;
  pressure: number;
}

export interface Gpu {
  device: number;
  renderer: number;
  tiler: number;
  memory: number;
}

export interface Volume {
  device: string;
  mount: string;
  total: number;
  free: number;
  used: number;
  percent: number;
}

export type Battery =
  | { present: false; source: string }
  | {
    present: true;
    source: string;
    percent: number;
    state: string;
    remaining: string | null;
    cycles: number;
    health: number;
    external: boolean;
    watts: number;
  };

export interface CpuUsage {
  cores: number[];
  user: number;
  sys: number;
  total: number;
}

export type Series = 'cpu' | 'user' | 'sys' | 'mem' | 'gpu' | 'rx' | 'tx' | 'read' | 'write' | 'battery' | 'watts';

export interface Data {
  info: StaticInfo | null;
  cpu: CpuUsage;
  load: number[];
  mem: Memory | null;
  pressure: Pressure;
  gpu: Partial<Gpu>;
  iface: string;
  net: { rx: number; tx: number; rxTotal: number; txTotal: number; rxSession: number; txSession: number };
  disk: { read: number; write: number; readSession: number; writeSession: number };
  volumes: Volume[];
  battery: Battery;
  processes: Process[];
  groups: Row[];
  ports: Map<number, PortEntry>;
  history: Record<Series, number[]>;
  appHistory: Map<string, number[]>;
  capturedAt: Date;
  uptime: number;
}

export type SortKey = 'cpu' | 'rss' | 'name' | 'count' | 'pid';

export interface Sort {
  key: SortKey;
  desc: boolean;
}

export type DetailRef = { grouped: true; key: string } | { grouped: false; pid: number };

export interface ConfirmItem {
  name: string;
  pid: number;
  count: number;
  grouped: boolean;
}

export interface State {
  tab: number;
  selected: number;
  scroll: number;
  listHeight: number;
  sort: Sort;
  grouped: boolean;
  query: string;
  searching: boolean;
  detail: DetailRef | null;
  confirm: ConfirmItem | null;
  help: boolean;
  notice: string;
  paused: boolean;
  mouse: Mouse;
  picker: { index: number } | null;
}

export interface Actions {
  quit: () => void;
  chooseLanguage: (code: string) => void;
  cycleLanguage: () => void;
  setTab: (index: number) => void;
  move: (delta: number) => void;
  openRow: (index: number, item: Row) => void;
  openDetail: (item: Row) => void;
  closeDetail: () => void;
  askTerminate: (item: Row | null) => void;
  confirm: (yes: boolean) => void;
  setSort: (key: SortKey) => void;
  cycleSort: () => void;
  setGrouped: (grouped: boolean) => void;
  togglePause: () => void;
  refresh: () => void;
  startSearch: () => void;
  clearQuery: () => void;
  toggleHelp: () => void;
}

/** Contexto que reciben todas las vistas. */
export interface Ctx {
  scr: Screen;
  data: Data;
  state: State;
  actions: Actions;
}

export type View = (ctx: Ctx, rect: Rect) => void;
