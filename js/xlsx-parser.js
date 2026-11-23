// Lector de la planilla de rutina (.xlsx) del entrenador.
// Lee el archivo directamente (zip + XML) para conservar los colores de las celdas:
//   - verde en una celda "Kilos" de una serie  => esa serie se debe grabar
//   - gris                                      => la serie no aplica
// Detecta la estructura por encabezados ("Ejercicios", "Series", "Reps", "Kilos"...),
// no por posiciones fijas, para tolerar pequeños cambios entre semanas.

export function norm(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const tags = (el, name) => (el ? Array.from(el.getElementsByTagNameNS('*', name)) : []);
const hijos = (el) => (el ? Array.from(el.childNodes).filter((n) => n.nodeType === 1) : []);

function refToRC(ref) {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return [Number(m[2]), c];
}

export async function parseRutinaXlsx(data, deps = {}) {
  const JSZipLib = deps.JSZip || globalThis.JSZip;
  const DP = deps.DOMParser || globalThis.DOMParser;
  if (!JSZipLib) throw new Error('No se pudo cargar el lector de Excel (JSZip). Revisa tu conexión e inténtalo de nuevo.');

  let zip;
  try { zip = await JSZipLib.loadAsync(data); } catch { throw new Error('El archivo no es un Excel .xlsx válido.'); }
  const parser = new DP();
  const leer = async (p) => {
    const f = zip.file(p);
    return f ? parser.parseFromString(await f.async('string'), 'text/xml') : null;
  };

  const wb = await leer('xl/workbook.xml');
  if (!wb) throw new Error('El archivo no es un Excel .xlsx válido.');
  const rels = await leer('xl/_rels/workbook.xml.rels');
  const relMap = {};
  for (const r of tags(rels, 'Relationship')) relMap[r.getAttribute('Id')] = r.getAttribute('Target');

  // Textos compartidos
  const sst = [];
  const ss = await leer('xl/sharedStrings.xml');
  for (const si of tags(ss, 'si')) {
    sst.push(tags(si, 't').filter((t) => t.parentNode?.localName !== 'rPh').map((t) => t.textContent).join(''));
  }

  // Estilos: índice de estilo -> color de relleno (RRGGBB)
  const xfFill = [];
  const st = await leer('xl/styles.xml');
  if (st) {
    const fills = hijos(tags(st, 'fills')[0]).map((f) => {
      const pf = tags(f, 'patternFill')[0];
      const tipo = pf?.getAttribute('patternType');
      if (!pf || !tipo || tipo === 'none') return null;
      const rgb = tags(pf, 'fgColor')[0]?.getAttribute('rgb');
      return rgb ? rgb.slice(-6).toUpperCase() : null;
    });
    for (const xf of hijos(tags(st, 'cellXfs')[0])) xfFill.push(fills[Number(xf.getAttribute('fillId') || 0)] ?? null);
  }

  const semanas = [];
  for (const sh of tags(wb, 'sheet')) {
    const nombreHoja = sh.getAttribute('name');
    const rid = sh.getAttribute('r:id') ||
      sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const target = relMap[rid];
    if (!target) continue;
    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const doc = await leer(path);
    if (!doc) continue;
    const semana = extraerSemana(nombreHoja, leerGrid(doc, sst, xfFill));
    if (semana) semanas.push(semana);
  }
  if (!semanas.length) {
    throw new Error('No encontré ninguna hoja con la rutina (busqué los encabezados "Ejercicios", "Series" y "Reps").');
  }
  return semanas;
}

function leerGrid(doc, sst, xfFill) {
  const cells = new Map();
  let maxR = 0, maxC = 0;
  for (const c of tags(doc, 'c')) {
    const rc = refToRC(c.getAttribute('r') || '');
    if (!rc) continue;
    const [r, col] = rc;
    const t = c.getAttribute('t');
    const vEl = tags(c, 'v')[0];
    let v = null;
    if (t === 's' && vEl) v = sst[Number(vEl.textContent)];
    else if (t === 'inlineStr') v = tags(c, 't').map((x) => x.textContent).join('');
    else if (vEl) v = t === 'str' || t === 'e' ? vEl.textContent : t === 'b' ? vEl.textContent === '1' : Number(vEl.textContent);
    if (typeof v === 'string' && v.trim() === '') v = null;
    cells.set(r + ',' + col, { v, fill: xfFill[Number(c.getAttribute('s') || 0)] ?? null });
    maxR = Math.max(maxR, r);
    maxC = Math.max(maxC, col);
  }
  const merges = tags(doc, 'mergeCell').map((m) => {
    const [a, b] = m.getAttribute('ref').split(':');
    const [r1, c1] = refToRC(a);
    const [r2, c2] = refToRC(b || a);
    return { r1, c1, r2, c2 };
  });
  const get = (r, c) => cells.get(r + ',' + c) || { v: null, fill: null };
  // Valor considerando celdas combinadas; "origen" es la fila donde realmente está el valor.
  const valor = (r, c) => {
    const x = get(r, c);
    if (x.v != null) return { v: x.v, origen: r };
    const m = merges.find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2);
    if (m) return { v: get(m.r1, m.c1).v, origen: m.r1 };
    return { v: null, origen: r };
  };
  const fila = (r) => {
    const out = [];
    for (let c = 1; c <= maxC; c++) {
      const v = get(r, c).v;
      if (v != null) out.push({ c, v, n: norm(v) });
    }
    return out;
  };
  return { get, valor, fila, maxR, maxC };
}

function clasificarColor(hex) {
  if (!hex || hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  if (g - Math.max(r, b) >= 20 && g > 140) return 'grabar';
  if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r > 0x60 && r < 0xD8) return 'na';
  return null;
}

// Excel convierte "8-12" en la fecha 8-dic. Se recupera como "día-mes".
function formatearReps(v) {
  if (v == null) return '';
  if (typeof v === 'number') {
    if (v >= 100) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
      return `${d.getUTCDate()}-${d.getUTCMonth() + 1}`;
    }
    return String(Math.round(v * 100) / 100);
  }
  return String(v).trim();
}

export function parseDescanso(t) {
  const s = norm(t);
  const m = s.match(/(\d+(?:[.,]\d+)?)(?:\s*(?:-|a)\s*(\d+(?:[.,]\d+)?))?/);
  if (!m) return [120, 180];
  const a = parseFloat(m[1].replace(',', '.'));
  const b = m[2] ? parseFloat(m[2].replace(',', '.')) : a;
  const mult = /min/.test(s) || !/seg|"|''|\bs\b/.test(s) ? 60 : 1;
  return [Math.round(a * mult), Math.round(b * mult)];
}

function objetivosPorSerie(txt, n) {
  const t = String(txt || '').trim();
  const m = /^@\s*([\d.,]+(?:\s*-\s*[\d.,]+)*)$/.exec(t);
  if (m) {
    const p = m[1].split('-').map((x) => x.trim());
    if (p.length === n) return p.map((x) => '@' + x);
    if (p.length === 1) return Array(n).fill('@' + p[0]);
  }
  return Array(n).fill(t);
}

function extraerSemana(nombreHoja, g) {
  // 1) Fila de encabezados del protocolo
  let hr = null, filaH = null;
  for (let r = 1; r <= Math.min(g.maxR, 80); r++) {
    const f = g.fila(r);
    if (f.some((x) => x.n === 'series') && f.some((x) => x.n === 'reps')) { hr = r; filaH = f; break; }
  }
  if (!hr) return null;
  const kilos = filaH.filter((x) => x.n === 'kilos').map((x) => x.c);
  const limite = kilos.length ? Math.min(...kilos) : Infinity;
  const col = (pred) => filaH.find((x) => x.c < limite && pred(x.n))?.c ?? null;
  const cols = {
    series: col((n) => n === 'series'),
    carga: col((n) => n.startsWith('carga')),
    descanso: col((n) => n.startsWith('descanso')),
    reps: col((n) => n === 'reps'),
    rir: col((n) => n.includes('rir') || n.includes('rpe')),
  };

  // 2) Columna de ejercicios, título y calentamiento
  let exCol = null, titulo = null, calentamiento = '';
  for (let r = 1; r <= g.maxR; r++) {
    for (const x of g.fila(r)) {
      if (exCol == null && r <= hr && x.n === 'ejercicios') exCol = x.c;
      if (!titulo && /^semana\s*\d+/.test(x.n)) titulo = String(x.v).trim();
      if (!calentamiento && x.n.includes('calentamiento') && x.n.length > 30) {
        const s = String(x.v);
        calentamiento = (s.includes(':') ? s.slice(s.indexOf(':') + 1) : s).trim();
      }
    }
  }
  if (exCol == null) exCol = Math.max(1, (cols.series ?? 4) - 2);

  // 3) Días y ejercicios
  const dias = [];
  let dia = null;
  for (let r = 1; r <= g.maxR; r++) {
    const v = g.get(r, exCol).v;
    if (v == null || typeof v !== 'string') continue;
    const md = /^d[ií]a\s*(\d+)/i.exec(v.trim());
    if (md) {
      dia = { numero: Number(md[1]), nombre: v.trim().replace(/^d[ií]a/i, 'Día'), ejercicios: [] };
      dias.push(dia);
      continue;
    }
    if (r <= hr || !dia) continue;

    const nombre = v.trim().replace(/\s+/g, ' ');
    const sv = cols.series ? g.valor(r, cols.series) : { v: null, origen: r };
    const seriesTxt = sv.v != null ? String(sv.v).trim() : '';
    const estados = kilos.map((k) => clasificarColor(g.get(r, k).fill));
    const n = parseInt(seriesTxt, 10) || estados.filter((e) => e !== 'na').length || 3;
    const rir = cols.rir ? String(g.get(r, cols.rir).v ?? '').trim() : '';
    const desc = cols.descanso ? String(g.valor(r, cols.descanso).v ?? '').trim() : '';
    const carga = cols.carga ? g.get(r, cols.carga).v : null;

    const ej = {
      nombre,
      series: n,
      seriesTexto: seriesTxt,
      reps: formatearReps(cols.reps ? g.get(r, cols.reps).v : null),
      intensidad: rir,
      descanso: desc,
      descansoSeg: parseDescanso(desc),
      carga: carga == null ? '' : String(carga).trim(),
      grabar: estados.map((e, i) => (e === 'grabar' ? i + 1 : 0)).filter((i) => i && i <= n),
      objetivos: objetivosPorSerie(rir, n),
      color: g.get(r, exCol).fill,
      biserie: null,
      _fila: r,
    };
    // Una celda "Series" combinada que viene de una fila anterior => biserie con ese ejercicio
    if (sv.origen !== r) {
      const prev = dia.ejercicios.find((e) => e._fila === sv.origen);
      if (prev) {
        prev.biserie = prev.biserie || 'b' + prev._fila;
        ej.biserie = prev.biserie;
      }
    }
    dia.ejercicios.push(ej);
  }
  for (const d of dias) for (const e of d.ejercicios) delete e._fila;
  const conEjercicios = dias.filter((d) => d.ejercicios.length);
  if (!conEjercicios.length) return null;

  const nombre = titulo || nombreHoja;
  return {
    nombre,
    numero: Number((/(\d+)/.exec(nombre) || [])[1]) || 0,
    calentamiento,
    dias: conEjercicios,
    importada: new Date().toISOString(),
  };
}
