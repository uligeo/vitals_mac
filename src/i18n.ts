/**
 * Traducciones estilo gettext: el texto en español es la clave. `t()` devuelve
 * la traducción del idioma activo e interpola parámetros `{nombre}`.
 * Para agregar un idioma basta con añadir su diccionario a DICTIONARIES.
 */

const EN: Record<string, string> = {
  // Pestañas y encabezado
  Resumen: 'Overview', Memoria: 'Memory', Red: 'Network', Disco: 'Disk', Energía: 'Power', Procesos: 'Processes',
  '{n} núcleos': '{n} cores', 'activo {t}': 'up {t}', '❚❚ PAUSADO': '❚❚ PAUSED', '● EN VIVO': '● LIVE',

  // Pie y búsqueda
  Buscar: 'Search', 'Enter aplicar · Esc limpiar': 'Enter apply · Esc clear',
  vista: 'view', mover: 'move', detalle: 'details', buscar: 'search', ordenar: 'sort', agrupar: 'group',
  'filtro: {q} ✕': 'filter: {q} ✕', 'q salir': 'q quit', '? ayuda': '? help', 'r actualizar': 'r refresh',
  'Idioma: {name}': 'Language: {name}',

  // Ayuda
  Atajos: 'Shortcuts', '↑ ↓ · j · RePág · AvPág': '↑ ↓ · j · PgUp · PgDn', 'Inicio · Fin': 'Home · End',
  'Enter · clic': 'Enter · click', 's · clic en columna': 's · click a column', 'p · Espacio': 'p · Space',
  'rueda del ratón': 'mouse wheel', 'cambiar de vista': 'switch view', 'mover la selección': 'move the selection',
  'primera / última fila': 'first / last row', 'abrir el detalle': 'open details', 'cerrar detalle o ventana': 'close details or dialog',
  'buscar por nombre, ruta o PID': 'search by name, path or PID', 'cambiar el orden': 'change sort order',
  'agrupar por aplicación / individual': 'group by app / individual', 'terminar la aplicación seleccionada': 'terminate the selected app',
  'pausar / reanudar el muestreo': 'pause / resume sampling', 'actualizar ahora': 'refresh now', 'desplazar listas': 'scroll lists',
  'cambiar idioma': 'change language', salir: 'quit',
  'Las tarjetas y paneles con borde resaltado también son clicables.': 'Cards and panels with a highlighted border are clickable too.',

  // Detalle y confirmación
  'Proceso finalizado': 'Process ended', 'El proceso ya no está en ejecución.': 'The process is no longer running.',
  'PID padre': 'Parent PID', 'PID principal': 'Main PID', Usuario: 'User', 'En ejecución': 'Running for', Puertos: 'Ports',
  ninguno: 'none', 'CPU del grupo · últimos 2 min': 'Group CPU · last 2 min', 'máx {v}': 'max {v}',
  'PID       CPU     Memoria   Tiempo        Comando': 'PID       CPU     Memory    Time          Command',
  '… y {n} más': '… and {n} more', 'k Terminar': 'k Terminate', 'Esc Cerrar': 'Esc Close',
  Confirmar: 'Confirm', '¿Enviar SIGTERM a {name}?': 'Send SIGTERM to {name}?', ' (proceso raíz de {n})': ' (root process of {n})',
  'y Sí, terminar': 'y Yes, terminate', 'n Cancelar': 'n Cancel',

  // Resumen
  '{v} en uso': '{v} in use', libres: 'free', conectado: 'plugged in', batería: 'battery', '{t} restantes': '{t} remaining',
  Corriente: 'AC power', 'sin batería': 'no battery', Sistema: 'System', 'Carga 1/5/15': 'Load 1/5/15',
  '{p} · {g} grupos': '{p} · {g} groups', 'Presión · swap': 'Pressure · swap', Encendido: 'Uptime',
  'Aplicaciones activas': 'Active apps', 'clic para detalles': 'click for details',

  // Tablas y procesos
  Aplicación: 'App', Proceso: 'Process', Tendencia: 'Trend', Tiempo: 'Time', Nombre: 'Name',
  'Buscar nombre, ruta o PID   /': 'Search name, path or PID   /', 'Por aplicación': 'By app', Individual: 'Individual',
  Orden: 'Sort', Aplicaciones: 'Apps', '{n} de {m}': '{n} of {m}', 'Sin resultados para «{q}».': 'No results for “{q}”.',
  'Cargando procesos…': 'Loading processes…',

  // CPU, memoria y GPU
  'Uso de CPU': 'CPU usage', 'últimos minutos': 'recent minutes', usuario: 'user', sistema: 'system', Núcleos: 'Cores',
  'Distribución y carga': 'Breakdown and load', inactivo: 'idle', 'Carga {label}': 'Load {label}', 'Mayor uso de CPU': 'Top CPU',
  'Memoria en uso': 'Memory in use', 'de {v}': 'of {v}', Presión: 'Pressure', 'Presión de memoria': 'Memory pressure',
  Comprimida: 'Compressed', Disponible: 'Available', Caché: 'Cached', Distribución: 'Breakdown', Libre: 'Free',
  'Mayor uso de memoria': 'Top memory', 'Uso de GPU': 'GPU usage', dispositivo: 'device', Motores: 'Engines',
  Dispositivo: 'Device', Renderizado: 'Renderer', Teselado: 'Tiler', 'Memoria de GPU': 'GPU memory',
  'Memoria unificada en uso': 'Unified memory in use',
  'Apple Silicon comparte la memoria entre CPU y GPU.': 'Apple Silicon shares memory between CPU and GPU.',
  'Actividad reciente': 'Recent activity', 'Promedio {label}': 'Average {label}', 'Máximo {label}': 'Peak {label}',
  'último minuto': 'last minute', 'últimos 5 min': 'last 5 min', 'últimos 10 min': 'last 10 min',

  // Red y disco
  Totales: 'Totals', 'Tráfico de red': 'Network traffic', '↓ Descarga': '↓ Download', '↑ Subida': '↑ Upload',
  'Sesión ↓': 'Session ↓', 'Sesión ↑': 'Session ↑', 'Pico ↓ 1 min': 'Peak ↓ 1 min', 'Pico ↑ 1 min': 'Peak ↑ 1 min',
  'Desde arranque ↓': 'Since boot ↓', 'Desde arranque ↑': 'Since boot ↑', 'Puertos TCP en escucha': 'Listening TCP ports',
  'No hay puertos TCP en escucha visibles para este usuario.': 'No listening TCP ports visible to this user.',
  Puerto: 'Port', 'Otros puertos': 'Other ports', 'Lectura y escritura': 'Reads and writes', Lectura: 'Read', Escritura: 'Write',
  'Leído (sesión)': 'Read (session)', 'Escrito (sesión)': 'Written (session)', 'Pico lectura 1 min': 'Peak read 1 min',
  'Pico escritura 1 min': 'Peak write 1 min', Volúmenes: 'Volumes', 'Macintosh HD (contenedor APFS)': 'Macintosh HD (APFS container)',
  '{u} de {t} · {f} libres · {p}': '{u} of {t} · {f} free · {p}',

  // Energía
  Cargando: 'Charging', Descargando: 'Discharging', 'Carga completa': 'Fully charged', 'Terminando carga': 'Finishing charge',
  'Conectada, sin cargar': 'Plugged in, not charging', 'Corriente alterna': 'AC power', Batería: 'Battery',
  'Sin batería': 'No battery', 'equipo conectado a corriente': 'running on AC power', Estado: 'Status',
  '{w} W consumo': '{w} W draw', '{w} W entrada': '{w} W input', 'Fuente de energía': 'Power source',
  'Tiempo restante': 'Time remaining', 'calculando…': 'calculating…', 'Flujo de energía': 'Power flow',
  'Ciclos de carga': 'Charge cycles', 'Capacidad máxima': 'Maximum capacity', 'Nivel de carga': 'Charge level',
  'historial de sesión': 'session history', Potencia: 'Power draw',

  // Mensajes
  'Muestreo en pausa · p para reanudar': 'Sampling paused · p to resume', 'Muestreo reanudado': 'Sampling resumed',
  'Actualizando…': 'Refreshing…', 'Ventana demasiado pequeña: {w}x{h}': 'Window too small: {w}x{h}',
  'Se necesita al menos 80x24.': 'At least 80x24 is required.', 'Recolectando métricas…': 'Collecting metrics…',
  '{name} (PID {pid}) recibió SIGTERM': '{name} (PID {pid}) received SIGTERM',
  'No se permite terminar {name}': 'Not allowed to terminate {name}',
  'Sin permiso para terminar {name}': 'No permission to terminate {name}', 'No se pudo terminar {name}': 'Could not terminate {name}',
};

export interface Language {
  code: string;
  name: string;
  locale: string;
}

export const LANGUAGES: Language[] = [
  { code: 'es', name: 'Español', locale: 'es-MX' },
  { code: 'en', name: 'English', locale: 'en-US' },
];

const DICTIONARIES: Record<string, Record<string, string>> = { es: {}, en: EN };
let current: Language = LANGUAGES[0];

export const isLanguage = (code: unknown): code is string => LANGUAGES.some((lang) => lang.code === code);
export const getLanguage = (): Language => current;

export function setLanguage(code: string): void {
  current = LANGUAGES.find((lang) => lang.code === code) || LANGUAGES[0];
}

/** Idioma sugerido según la configuración regional del sistema. */
export function systemLanguage(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || '';
  return LANGUAGES.find((lang) => locale.toLowerCase().startsWith(lang.code))?.code || 'en';
}

export function t(text: string, params?: Record<string, string | number>): string {
  const value = DICTIONARIES[current.code]?.[text] ?? text;
  return params ? value.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key])) : value;
}
