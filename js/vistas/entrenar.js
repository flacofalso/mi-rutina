import { kv } from '../db.js';
import {
  state, semanaActual, proximoDia, diasCompletadosSemana, registroAnterior, imagenDe, guardarImagen,
  explicarIntensidad, notasTecnicas, guardarSesion,
} from '../data.js';
import { $, esc, toast, abrirHoja, cerrarHoja, fmtFecha, fmtNum, aNum, elegirArchivo, reducirImagen, mostrarFrase } from '../ui.js';
import { iniciarDescanso, detenerDescanso } from '../timer.js';
import { SENSACIONES } from '../resumen.js';

let wakeLock = null;
async function mantenerPantalla() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch { /* */ }
}
function alVolverVisible() { if (document.visibilityState === 'visible' && location.hash.startsWith('#/entrenar')) mantenerPantalla(); }

export function salirEntrenar() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  document.removeEventListener('visibilitychange', alVolverVisible);
}

function nuevoBorrador(sem, d) {
  return {
    semana: sem.nombre,
    dia: d.numero,
    diaNombre: d.nombre,
    inicio: null,
    ejercicios: d.ejercicios.map((e) => ({
      nombre: e.nombre, series: e.series, reps: e.reps, intensidad: e.intensidad, objetivos: e.objetivos,
      descanso: e.descanso, descansoSeg: e.descansoSeg, carga: e.carga, grabar: e.grabar, biserie: e.biserie, color: e.color,
      registros: Array.from({ length: e.series }, () => ({ kg: '', reps: '', rpe: '', hecho: false })),
      nota: '',
    })),
  };
}

const colorDe = (hex) => (hex ? '#' + hex : 'var(--borde)');

export async function vistaEntrenar(el, params) {
  const sem = semanaActual();
  if (!sem) { el.innerHTML = '<p class="vacio">Primero importa tu rutina en Ajustes.</p>'; return; }

  let b = await kv.get('borrador');
  const pedido = params.dia ? Number(params.dia) : null;
  if (b && pedido && (pedido !== b.dia || b.semana !== sem.nombre)) {
    if (b.inicio && !confirm(`Tienes una sesión de ${b.diaNombre} en curso. ¿Descartarla y empezar otra?`)) {
      location.hash = '#/entrenar';
      return;
    }
    b = null;
  }
  if (!b) {
    const num = pedido ?? proximoDia();
    const d = sem.dias.find((x) => x.numero === num) || sem.dias[0];
    b = nuevoBorrador(sem, d);
    await kv.set('borrador', b);
  }

  mantenerPantalla();
  document.addEventListener('visibilitychange', alVolverVisible);

  let guardarT;
  const guardar = () => { clearTimeout(guardarT); guardarT = setTimeout(() => kv.set('borrador', b), 250); };
  const hechos = diasCompletadosSemana(sem);
  const previos = b.ejercicios.map((e) => registroAnterior(e.nombre));

  const pintar = () => {
    const total = b.ejercicios.reduce((a, e) => a + e.registros.length, 0);
    const listas = b.ejercicios.reduce((a, e) => a + e.registros.filter((r) => r.hecho).length, 0);
    el.innerHTML = `
      <div class="selector-dia">
        ${sem.dias.map((d) => `<a href="#/entrenar/${d.numero}" class="chip ${d.numero === b.dia ? 'activo' : ''}">${esc(d.nombre)}${hechos.has(d.numero) ? ' ✓' : ''}</a>`).join('')}
      </div>
      <header class="cab-sesion">
        <div>
          <p class="sobre">${esc(b.semana)}</p>
          <h2>${esc(b.diaNombre)}</h2>
        </div>
        <div class="progreso-circ" style="--p:${total ? (listas / total) * 100 : 0}"><span>${listas}/${total}</span></div>
      </header>
      ${sem.calentamiento ? `<details class="tarjeta calentamiento"><summary>🔥 Calentamiento recomendado</summary><p>${esc(sem.calentamiento)}</p></details>` : ''}
      ${grupos(b.ejercicios).map((g) => g.length > 1 ? tarjetaBiserie(g) : tarjetaEjercicio(g[0])).join('')}
      <button class="btn btn-primario btn-bloque" id="terminar">Terminar entrenamiento</button>
      <button class="btn btn-texto btn-bloque" id="descartar">Descartar sesión</button>`;
  };

  const grupos = (ejs) => {
    const out = [];
    ejs.forEach((e, i) => {
      const ult = out.at(-1);
      if (e.biserie && ult && ult[0].e.biserie === e.biserie) ult.push({ e, i });
      else out.push([{ e, i }]);
    });
    return out;
  };

  const tarjetaBiserie = (g) => `
    <section class="biserie">
      <p class="biserie-cab">🔁 Biserie: alterna ${g.map((x, k) => `<b>A${k + 1}</b>`).join(' → ')} sin pausa y descansa al terminar la ronda.</p>
      ${g.map((x, k) => tarjetaEjercicio(x, `A${k + 1}`)).join('')}
    </section>`;

  const tarjetaEjercicio = ({ e, i }, etiqueta = '') => {
    const img = imagenDe(e.nombre);
    const prev = previos[i];
    const tecnicas = notasTecnicas(e.nombre);
    return `
    <article class="tarjeta ejercicio" style="--c:${colorDe(e.color)}">
      <div class="ej-cab">
        ${img
          ? `<button class="ej-img" data-zoom="${i}" aria-label="Ver imagen"><img src="${img}" alt="" loading="lazy"></button>`
          : `<button class="ej-img sin" data-addimg="${i}" aria-label="Agregar imagen">＋<small>foto</small></button>`}
        <div class="ej-titulo">
          <h3>${etiqueta ? `<span class="etq">${etiqueta}</span> ` : ''}${esc(e.nombre)}</h3>
          <div class="chips">
            <span class="chip">${e.series} series</span>
            <span class="chip">${esc(e.reps)} reps</span>
            <button class="chip chip-info" data-info="${i}">${esc(e.intensidad)} ⓘ</button>
            <span class="chip">⏱ ${esc(e.descanso)}</span>
            ${e.carga ? `<span class="chip chip-carga">🎯 ${esc(e.carga)} kg</span>` : ''}
          </div>
        </div>
      </div>
      ${tecnicas.map((t) => `<p class="nota-tec">${esc(t)}</p>`).join('')}
      ${prev ? `<p class="anterior">Última vez (${fmtFecha(prev.fecha, { day: 'numeric', month: 'short' })}): ${prev.registros.filter((r) => r.hecho).map((r) => `${fmtNum(r.kg) || '–'}×${r.reps || '–'}`).join(' · ')}</p>` : ''}
      <div class="series">
        <div class="serie serie-cab"><span>Serie</span><span>Objetivo</span><span>Kg</span><span>Reps</span><span>RPE</span><span></span></div>
        ${e.registros.map((r, j) => filaSerie(e, i, r, j, prev)).join('')}
      </div>
      <button class="btn-texto nota-btn" data-nota="${i}">📝 ${e.nota ? esc(e.nota) : 'Agregar nota'}</button>
    </article>`;
  };

  const filaSerie = (e, i, r, j, prev) => {
    const grabar = e.grabar.includes(j + 1);
    const obj = e.objetivos[j] || e.intensidad;
    const objCorto = obj.startsWith('@') ? obj : obj.replace(/^RIR\s*/i, 'RIR ');
    const prevKg = prev?.registros[j]?.kg;
    return `
      <div class="serie ${r.hecho ? 'hecha' : ''} ${grabar ? 'grabar' : ''}" data-e="${i}" data-s="${j}">
        <span class="s-num">${grabar ? '<span class="rec" title="Grabar esta serie">🎥</span>' : ''}S${j + 1}</span>
        <span class="s-obj">${esc(e.reps)}<small>${esc(objCorto)}</small></span>
        <input class="s-in" data-f="kg" inputmode="decimal" enterkeyhint="next" aria-label="Kilos serie ${j + 1}" placeholder="${esc(prevKg ? fmtNum(prevKg) : e.carga || 'kg')}" value="${esc(fmtNum(r.kg))}">
        <input class="s-in" data-f="reps" inputmode="numeric" enterkeyhint="next" aria-label="Repeticiones serie ${j + 1}" placeholder="${esc(e.reps)}" value="${esc(r.reps)}">
        <input class="s-in" data-f="rpe" inputmode="decimal" enterkeyhint="done" aria-label="RPE o RIR serie ${j + 1}" placeholder="${esc(obj.startsWith('@') ? obj.slice(1) : 'RIR')}" value="${esc(r.rpe)}">
        <button class="s-check" aria-label="Marcar serie ${j + 1} como hecha" aria-pressed="${r.hecho}">✓</button>
      </div>
      ${grabar && !r.hecho ? `<p class="aviso-rec">🎥 Graba esta serie para tu entrenador</p>` : ''}`;
  };

  // Siguiente serie pendiente, respetando el orden de las biseries
  const siguienteSerie = (desdeI, desdeJ) => {
    const orden = [];
    for (const g of grupos(b.ejercicios)) {
      const maxS = Math.max(...g.map((x) => x.e.registros.length));
      for (let j = 0; j < maxS; j++) for (const x of g) if (j < x.e.registros.length) orden.push([x.i, j]);
    }
    const pos = orden.findIndex(([i, j]) => i === desdeI && j === desdeJ);
    for (let k = 1; k <= orden.length; k++) {
      const [i, j] = orden[(pos + k) % orden.length];
      if (!b.ejercicios[i].registros[j].hecho) return { i, j };
    }
    return null;
  };

  pintar();

  el.oninput = (ev) => {
    const inp = ev.target.closest('.s-in');
    if (!inp) return;
    const fila = inp.closest('.serie');
    const r = b.ejercicios[+fila.dataset.e].registros[+fila.dataset.s];
    r[inp.dataset.f] = inp.dataset.f === 'kg' ? (aNum(inp.value) ?? inp.value) : inp.value.trim();
    guardar();
  };

  el.onclick = async (ev) => {
    const t = ev.target;
    const check = t.closest('.s-check');
    if (check) {
      const fila = check.closest('.serie');
      const i = +fila.dataset.e, j = +fila.dataset.s;
      const e = b.ejercicios[i];
      const r = e.registros[j];
      r.hecho = !r.hecho;
      if (r.hecho) {
        // Completar con lo sugerido si quedó vacío
        if (r.kg === '' || r.kg == null) {
          const ph = aNum(fila.querySelector('[data-f="kg"]').placeholder);
          if (ph != null) r.kg = ph;
        }
        if (!r.reps && /^\d+$/.test(e.reps)) r.reps = e.reps;
        if (!b.inicio) b.inicio = new Date().toISOString();
        if (window.APP?.fraseEjercicio && e.registros.every((x) => x.hecho)) mostrarFrase(window.APP.fraseEjercicio);
        const sig = siguienteSerie(i, j);
        const grupo = e.biserie ? b.ejercicios.filter((x) => x.biserie === e.biserie) : [e];
        const sigeEnBiserie = sig && e.biserie && b.ejercicios[sig.i].biserie === e.biserie;
        const esUltimoDeRonda = grupo.at(-1) === e || !sigeEnBiserie;
        const txtSig = sig ? `Siguiente: ${b.ejercicios[sig.i].nombre} S${sig.j + 1}${b.ejercicios[sig.i].grabar.includes(sig.j + 1) ? ' · 🎥 ¡prepara la cámara!' : ''}` : '';
        if (!sig) { detenerDescanso(); toast('¡Todas las series listas! 🎉 Termina y guarda la sesión.'); }
        else if (e.biserie && !esUltimoDeRonda) { detenerDescanso(); toast(`Sin descanso → ${b.ejercicios[sig.i].nombre}`); }
        else iniciarDescanso(e.descansoSeg, txtSig);
      }
      await kv.set('borrador', b);
      const y = window.scrollY;
      pintar();
      window.scrollTo(0, y);
      return;
    }
    const info = t.closest('[data-info]');
    if (info) {
      const e = b.ejercicios[+info.dataset.info];
      abrirHoja(`<p>${esc(explicarIntensidad(e.intensidad))}</p>
        <p><b>Repeticiones:</b> ${esc(e.reps)} por serie.</p>
        <p><b>Descanso:</b> ${esc(e.descanso)} entre series.</p>
        ${e.grabar.length ? `<p><b>🎥 Grabar:</b> serie${e.grabar.length > 1 ? 's' : ''} ${e.grabar.join(' y ')}.</p>` : ''}`, { titulo: e.intensidad });
      return;
    }
    const zoom = t.closest('[data-zoom]');
    if (zoom) {
      const e = b.ejercicios[+zoom.dataset.zoom];
      abrirHoja(`<img class="img-grande" src="${imagenDe(e.nombre)}" alt="${esc(e.nombre)}">
        <button class="btn btn-sec btn-bloque" data-cambiarimg>Cambiar imagen</button>`, {
        titulo: e.nombre,
        alAbrir: (c) => { $('[data-cambiarimg]', c).onclick = () => cambiarImagen(e.nombre); },
      });
      return;
    }
    const add = t.closest('[data-addimg]');
    if (add) { cambiarImagen(b.ejercicios[+add.dataset.addimg].nombre); return; }
    const nota = t.closest('[data-nota]');
    if (nota) {
      const e = b.ejercicios[+nota.dataset.nota];
      const v = prompt(`Nota para "${e.nombre}"`, e.nota || '');
      if (v !== null) { e.nota = v.trim(); await kv.set('borrador', b); pintar(); }
      return;
    }
    if (t.closest('#descartar')) {
      if (confirm('¿Descartar esta sesión? Se perderá lo registrado.')) {
        await kv.del('borrador');
        detenerDescanso();
        location.hash = '#/hoy';
      }
      return;
    }
    if (t.closest('#terminar')) terminar();
  };

  async function cambiarImagen(nombre) {
    const f = await elegirArchivo('image/*');
    if (!f) return;
    await guardarImagen(nombre, await reducirImagen(f));
    cerrarHoja();
    pintar();
    toast('Imagen guardada');
  }

  function terminar() {
    const hechas = b.ejercicios.reduce((a, e) => a + e.registros.filter((r) => r.hecho).length, 0);
    const ultimoPeso = state.sesiones.find((s) => s.pesoCorporal)?.pesoCorporal;
    abrirHoja(`
      ${hechas ? '' : '<p class="alerta">Aún no marcas ninguna serie como hecha.</p>'}
      <label class="campo">Peso corporal (kg)
        <input id="f-peso" inputmode="decimal" placeholder="${esc(ultimoPeso ? fmtNum(ultimoPeso) : 'Ej: 80,5')}">
      </label>
      <fieldset class="campo sensacion"><legend>¿Cómo te sentiste?</legend>
        ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="sens" value="${n}" ${n === 4 ? 'checked' : ''}><span>${['😫', '😕', '😐', '🙂', '💪'][n - 1]}<small>${SENSACIONES[n]}</small></span></label>`).join('')}
      </fieldset>
      <label class="campo">Comentarios para el entrenador
        <textarea id="f-notas" rows="3" placeholder="Molestias, sensaciones, técnica, sueño…"></textarea>
      </label>
      <button class="btn btn-primario btn-bloque" id="f-guardar">Guardar y ver resumen</button>`, {
      titulo: 'Terminar entrenamiento',
      alAbrir: (c) => {
        $('#f-guardar', c).onclick = async () => {
          const ahora = new Date().toISOString();
          const sesion = {
            id: Date.now().toString(36),
            fecha: b.inicio || ahora,
            fin: ahora,
            semana: b.semana,
            dia: b.dia,
            diaNombre: b.diaNombre,
            pesoCorporal: aNum($('#f-peso', c).value),
            sensacion: Number($('input[name="sens"]:checked', c)?.value) || null,
            notas: $('#f-notas', c).value.trim(),
            ejercicios: b.ejercicios.map(({ nombre, series, reps, intensidad, grabar, registros, nota }) => ({ nombre, series, reps, intensidad, grabar, registros, nota })),
          };
          await guardarSesion(sesion);
          await kv.del('borrador');
          detenerDescanso();
          cerrarHoja();
          location.hash = `#/historial/${sesion.id}`;
          toast('Sesión guardada 💪');
        };
      },
    });
  }
}
