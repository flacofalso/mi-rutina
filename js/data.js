// Estado de la app y lógica de dominio (rutina, imágenes, horarios, historial).
import { kv, sesionesDB } from './db.js';
import { parseRutinaXlsx, norm } from './xlsx-parser.js';

export { norm };

export const CONFIG_DEFECTO = {
  horaEntreno: '19:00',
  duracionEntreno: 60,
  diasEntreno: [1, 3, 5], // 0 = domingo … 6 = sábado
};

export const state = {
  semanas: {},
  semanaActiva: null,
  imagenes: {},
  nutricion: null,
  config: { ...CONFIG_DEFECTO },
  sesiones: [],
};

export async function cargarEstado() {
  const [semanas, activa, imagenes, nutricion, config, sesiones] = await Promise.all([
    kv.get('semanas'), kv.get('semanaActiva'), kv.get('imagenes'), kv.get('nutricion'), kv.get('config'),
    sesionesDB.todas(),
  ]);
  state.semanas = semanas || {};
  state.semanaActiva = activa && state.semanas[activa] ? activa : semanasOrdenadas().at(-1)?.nombre ?? null;
  state.imagenes = imagenes || {};
  state.nutricion = nutricion || null;
  state.config = { ...CONFIG_DEFECTO, ...(config || {}) };
  state.sesiones = (sesiones || []).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export const tieneRutina = () => Object.keys(state.semanas).length > 0;
export const semanasOrdenadas = () => Object.values(state.semanas).sort((a, b) => a.numero - b.numero || a.nombre.localeCompare(b.nombre));
export const semanaActual = () => state.semanas[state.semanaActiva] || null;

export async function setSemanaActiva(nombre) {
  state.semanaActiva = nombre;
  await kv.set('semanaActiva', nombre);
}

export async function guardarConfig(parcial) {
  state.config = { ...state.config, ...parcial };
  await kv.set('config', state.config);
}

// ---------- Importación ----------
export async function importarExcel(buffer) {
  const semanas = await parseRutinaXlsx(buffer);
  for (const s of semanas) state.semanas[s.nombre] = s;
  await kv.set('semanas', state.semanas);
  await setSemanaActiva(semanas.sort((a, b) => a.numero - b.numero).at(-1).nombre);
  return semanas;
}

function base64ABuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export async function importarPaquete(obj) {
  if (obj?.tipo !== 'paquete-rutina') throw new Error('Este archivo no es un paquete personal de la app.');
  const resumen = [];
  if (obj.excel?.base64) {
    const semanas = await importarExcel(base64ABuffer(obj.excel.base64));
    resumen.push(`${semanas.length} semana(s) de rutina`);
  }
  if (obj.imagenes) {
    for (const [nombre, url] of Object.entries(obj.imagenes)) state.imagenes[norm(nombre)] = url;
    await kv.set('imagenes', state.imagenes);
    resumen.push(`${Object.keys(obj.imagenes).length} imágenes`);
  }
  if (obj.nutricion) {
    state.nutricion = obj.nutricion;
    await kv.set('nutricion', obj.nutricion);
    resumen.push('plan de alimentación');
  }
  return resumen;
}

export async function guardarImagen(nombreEjercicio, dataUrl) {
  state.imagenes[norm(nombreEjercicio)] = dataUrl;
  await kv.set('imagenes', state.imagenes);
}

// Busca imagen por nombre exacto (normalizado) o por el nombre más parecido,
// para que un "Press de banca pausa 3 seg" de otra semana reutilice la imagen.
const palabras = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['con', 'del', 'las', 'los', 'por'].includes(w)));
export function imagenDe(nombre) {
  const k = norm(nombre);
  if (state.imagenes[k]) return state.imagenes[k];
  const a = palabras(nombre);
  let mejor = null, puntaje = 0;
  for (const [clave, url] of Object.entries(state.imagenes)) {
    const b = palabras(clave);
    const inter = [...a].filter((w) => b.has(w)).length;
    const p = inter / Math.max(a.size, b.size);
    if (p > puntaje) { puntaje = p; mejor = url; }
  }
  return puntaje >= 0.6 ? mejor : null;
}

// ---------- Respaldo ----------
export async function exportarRespaldo() {
  const claves = await kv.keys();
  const datos = {};
  for (const k of claves) datos[k] = await kv.get(k);
  return { tipo: 'respaldo-rutina', version: 1, creado: new Date().toISOString(), kv: datos, sesiones: await sesionesDB.todas() };
}

export async function importarRespaldo(obj) {
  if (obj?.tipo !== 'respaldo-rutina') throw new Error('Este archivo no es un respaldo de la app.');
  for (const [k, v] of Object.entries(obj.kv || {})) await kv.set(k, v);
  for (const s of obj.sesiones || []) await sesionesDB.put(s);
  await cargarEstado();
}

export async function borrarTodo() {
  await kv.clear();
  await sesionesDB.clear();
  await cargarEstado();
}

// ---------- Sesiones ----------
export async function guardarSesion(s) {
  await sesionesDB.put(s);
  state.sesiones = [s, ...state.sesiones.filter((x) => x.id !== s.id)].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function eliminarSesion(id) {
  await sesionesDB.del(id);
  state.sesiones = state.sesiones.filter((x) => x.id !== id);
}

export function proximoDia() {
  const sem = semanaActual();
  if (!sem) return null;
  const nums = sem.dias.map((d) => d.numero);
  const ult = state.sesiones.find((s) => s.semana === sem.nombre);
  if (!ult) return nums[0];
  const i = nums.indexOf(ult.dia);
  return nums[(i + 1) % nums.length];
}

export function diasCompletadosSemana(sem = semanaActual()) {
  if (!sem) return new Set();
  return new Set(state.sesiones.filter((s) => s.semana === sem.nombre).map((s) => s.dia));
}

export function registroAnterior(nombreEjercicio, excluirId) {
  const k = norm(nombreEjercicio);
  for (const s of state.sesiones) {
    if (s.id === excluirId) continue;
    const e = s.ejercicios.find((x) => norm(x.nombre) === k);
    if (e && e.registros.some((r) => r.hecho)) return { fecha: s.fecha, registros: e.registros };
  }
  return null;
}

// ---------- Horarios ----------
export const aMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
export const aHHMM = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export const COMIDAS = {
  desayuno: 'Desayuno',
  colacion: 'Colación',
  almuerzo: 'Almuerzo',
  once: 'Once',
  cena: 'Cena',
};

export const esDiaEntreno = (fecha) => state.config.diasEntreno.includes(fecha.getDay());

// Horario de comidas según la pauta (8:30 · 10:30 · 13:30 · 16:30 · 19:30), ajustado
// al entrenamiento y respetando una ventana de 12 h como máximo.
export function horarioComidas(fecha) {
  const entreno = esDiaEntreno(fecha);
  const ini = aMin(state.config.horaEntreno);
  const fin = ini + (state.config.duracionEntreno || 60);
  let h = { desayuno: 510, colacion: 630, almuerzo: 810, once: 990, cena: 1170 };
  const notas = {};
  if (entreno && ini < 720) {
    // Mañana: colación antes de entrenar y desayuno al terminar.
    const pre = ini - 30;
    h = { colacion: pre, desayuno: fin + 30, almuerzo: pre + 390, once: pre + 570, cena: pre + 720 };
    notas.colacion = 'Preentreno: algo liviano 30 min antes';
    notas.desayuno = 'Posentreno';
  } else if (entreno) {
    // Tarde/noche: once como preentreno y cena al terminar.
    h.once = Math.max(h.almuerzo + 150, Math.min(ini - 90, h.once + 60));
    h.cena = Math.max(h.cena, fin + 30);
    if (h.cena - h.desayuno > 720) h.desayuno = h.cena - 720;
    h.colacion = Math.max(h.colacion, h.desayuno + 120);
    notas.once = 'Preentreno: 1 a 2 h antes de entrenar';
    notas.cena = 'Posentreno: cena liviana con proteína';
  }
  const lista = Object.entries(h).map(([clave, min]) => ({ clave, nombre: COMIDAS[clave], hora: aHHMM(min), min, nota: notas[clave] || '' }));
  if (entreno) lista.push({ clave: 'entreno', nombre: 'Entrenamiento', hora: aHHMM(ini), min: ini, fin: aHHMM(fin) });
  return lista.sort((a, b) => a.min - b.min);
}

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
export function menuDe(fecha) {
  const menu = state.nutricion?.menu;
  if (!menu) return null;
  return menu.find((m) => norm(m.dia) === NOMBRES_DIA[fecha.getDay()]) || null;
}

// ---------- Textos de ayuda ----------
export function explicarIntensidad(txt) {
  const t = String(txt || '').trim();
  if (t.startsWith('@')) {
    return 'RPE (escala de esfuerzo de 0 a 10). @8 significa terminar la serie sintiendo un esfuerzo de 8/10, con unas 2 repeticiones en reserva. @6 deja unas 4 en reserva y @10 es el máximo. Si una serie trae varios números (por ejemplo, @8-6-6-6), cada uno corresponde a una serie, en orden.';
  }
  if (/rir/i.test(t)) {
    const fallo = /fallo|\b0\b/.test(t);
    return `RIR significa "repeticiones en reserva": cuántas repeticiones te quedan antes de no poder hacer otra con buena técnica. ${t.replace(/rir/i, 'RIR')} quiere decir que termines cada serie dejando esa cantidad en reserva${fallo ? ' (0 = llegar al fallo)' : ''}. Elige un peso con el que caigas dentro del rango de repeticiones: si superas el máximo, sube el peso; si no alcanzas el mínimo, bájalo.`;
  }
  return t || 'Sin indicación de intensidad.';
}

export function notasTecnicas(nombre) {
  const n = norm(nombre);
  const out = [];
  const tempo = /tempo\s*(\d)(\d)(\d)/.exec(n);
  if (tempo) out.push(`Tempo ${tempo[1]}${tempo[2]}${tempo[3]}: bajar en ${tempo[1]} s, pausa de ${tempo[2]} s abajo y subir ${tempo[3] === '0' ? 'explosivo' : `en ${tempo[3]} s`}.`);
  const pausa = /pausa\s*(\d+)\s*seg/.exec(n);
  if (pausa) out.push(`Pausa de ${pausa[1]} s con la barra quieta en el pecho antes de empujar.`);
  return out;
}
