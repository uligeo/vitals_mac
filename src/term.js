const TRUECOLOR = /truecolor|24bit/i.test(process.env.COLORTERM || '')
  || ['iTerm.app', 'vscode', 'WezTerm', 'ghostty'].includes(process.env.TERM_PROGRAM);

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const cube = (v) => (v < 48 ? 0 : v < 115 ? 1 : Math.floor((v - 35) / 40));
const colorCode = (hex, base) => {
  const [r, g, b] = rgb(hex);
  return TRUECOLOR ? `${base};2;${r};${g};${b}` : `${base};5;${16 + 36 * cube(r) + 6 * cube(g) + cube(b)}`;
};

/** Paleta interna: cada color hex se guarda una vez y las celdas usan su índice (0 = por defecto). */
const palette = [null];
const paletteIndex = new Map();
const intern = (hex) => {
  if (!hex) return 0;
  let index = paletteIndex.get(hex);
  if (index === undefined) {
    index = palette.push(hex) - 1;
    paletteIndex.set(hex, index);
  }
  return index;
};

const sgrCache = new Map();
function sgr(fg, bg, bold) {
  const key = (fg * 65536 + bg) * 2 + bold;
  let code = sgrCache.get(key);
  if (!code) {
    const parts = ['0'];
    if (bold) parts.push('1');
    if (fg) parts.push(colorCode(palette[fg], 38));
    if (bg) parts.push(colorCode(palette[bg], 48));
    code = `\x1b[${parts.join(';')}m`;
    sgrCache.set(key, code);
  }
  return code;
}

/**
 * Búfer de pantalla en arreglos tipados que se reutilizan entre renders.
 * Cada vista dibuja sobre él y registra regiones interactivas; al final se
 * serializa a ANSI fila por fila.
 */
export class Screen {
  constructor(mouse) {
    this.mouse = mouse;
    this.width = 0;
    this.height = 0;
    this.regions = [];
  }

  /** Limpia el búfer para un nuevo render; solo reasigna memoria si cambia el tamaño. */
  reset(width, height) {
    if (width !== this.width || height !== this.height) {
      const size = width * height;
      this.width = width;
      this.height = height;
      this.ch = new Uint32Array(size);
      this.fg = new Uint16Array(size);
      this.bg = new Uint16Array(size);
      this.bold = new Uint8Array(size);
    }
    this.ch.fill(32);
    this.fg.fill(0);
    this.bg.fill(0);
    this.bold.fill(0);
    this.regions = [];
  }

  put(x, y, ch, style = {}) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    this.ch[i] = ch.codePointAt(0);
    if (style.fg !== undefined) this.fg[i] = intern(style.fg);
    if (style.bg !== undefined) this.bg[i] = intern(style.bg);
    this.bold[i] = style.bold ? 1 : 0;
  }

  /** Escribe texto truncándolo con elipsis a `max` columnas; devuelve la x final. */
  text(x, y, value, style = {}, max = Infinity) {
    const chars = [...String(value)];
    const limit = Math.max(0, Math.min(max, this.width - x));
    if (chars.length > limit) {
      chars.length = Math.max(0, limit - 1);
      if (limit > 0) chars.push('…');
    }
    chars.forEach((ch, i) => this.put(x + i, y, ch, style));
    return x + chars.length;
  }

  /** Texto alineado a la derecha terminando en la columna `right` (exclusiva). */
  textRight(right, y, value, style = {}) {
    const len = [...String(value)].length;
    return this.text(right - len, y, value, style);
  }

  fill(x, y, w, h, style = {}, ch = ' ') {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) this.put(col, row, ch, style);
    }
  }

  box(x, y, w, h, { color, title, titleColor, bg } = {}) {
    if (w < 2 || h < 2) return;
    const style = { fg: color, bg };
    if (bg) this.fill(x, y, w, h, { bg });
    for (let col = x + 1; col < x + w - 1; col++) {
      this.put(col, y, '─', style);
      this.put(col, y + h - 1, '─', style);
    }
    for (let row = y + 1; row < y + h - 1; row++) {
      this.put(x, row, '│', style);
      this.put(x + w - 1, row, '│', style);
    }
    this.put(x, y, '╭', style);
    this.put(x + w - 1, y, '╮', style);
    this.put(x, y + h - 1, '╰', style);
    this.put(x + w - 1, y + h - 1, '╯', style);
    if (title) this.text(x + 2, y, ` ${title} `, { fg: titleColor || color, bg, bold: true }, w - 4);
  }

  /** Atenúa todo lo dibujado hasta ahora (fondo de los modales). */
  dim(fg, bg) {
    const [dimFg, dimBg] = [intern(fg), intern(bg)];
    this.fg.fill(dimFg);
    this.bold.fill(0);
    for (let i = 0; i < this.bg.length; i++) if (this.bg[i]) this.bg[i] = dimBg;
  }

  /** Registra una zona interactiva: { onClick, onWheel }. Las últimas tienen prioridad. */
  region(x, y, w, h, handlers) {
    this.regions.push({ x, y, w, h, ...handlers });
  }

  hit(x, y, kind) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (r[kind] && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    }
    return null;
  }

  hover(x, y, w, h) {
    const { x: mx, y: my } = this.mouse;
    return mx >= x && mx < x + w && my >= y && my < y + h;
  }

  rows() {
    const out = [];
    for (let y = 0; y < this.height; y++) {
      let line = '';
      let last = '';
      for (let i = y * this.width, end = i + this.width; i < end; i++) {
        const code = sgr(this.fg[i], this.bg[i], this.bold[i]);
        if (code !== last) { line += code; last = code; }
        line += String.fromCodePoint(this.ch[i]);
      }
      out.push(`${line}\x1b[0m`);
    }
    return out;
  }
}

/** Divide un ancho en `n` columnas con separación `gap`; reparte el sobrante. */
export function split(x, width, n, gap = 1) {
  const usable = width - gap * (n - 1);
  const base = Math.floor(usable / n);
  let extra = usable - base * n;
  const out = [];
  let cursor = x;
  for (let i = 0; i < n; i++) {
    const w = base + (extra-- > 0 ? 1 : 0);
    out.push({ x: cursor, w });
    cursor += w + gap;
  }
  return out;
}
