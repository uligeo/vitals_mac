import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'mac-vitals');
const FILE = path.join(DIR, 'config.json');

/** Preferencias del usuario; un archivo ausente o dañado equivale a configuración vacía. */
export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveConfig(config) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, `${JSON.stringify(config, null, 2)}\n`);
  } catch {
    // Sin permisos de escritura la preferencia solo dura la sesión actual.
  }
}

/** Lee `--lang es` o `--lang=en` de los argumentos de la línea de comandos. */
export function argLanguage(argv = process.argv.slice(2)) {
  const index = argv.findIndex((arg) => arg === '--lang' || arg.startsWith('--lang='));
  if (index === -1) return null;
  return argv[index].includes('=') ? argv[index].split('=')[1] : argv[index + 1] || null;
}
