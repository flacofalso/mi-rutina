import { state, eliminarSesion, norm } from '../data.js';
import { esc, fmtFecha, fmtHora, fmtNum, toast, compartirTexto, copiarTexto } from '../ui.js';
import { textoResumen } from '../resumen.js';

export function vistaHistorial(el, params) {
  if (params.id) return detalle(el, params.id);
  const ses = state.sesiones;

  // Progreso: mejor serie (más kilos) por ejercicio y sesión
  const ejercicios = [...new Set(ses.flatMap((s) => s.ejercicios.map((e) => e.nombre)))].sort((a, b) => a.localeCompare(b));
  const sel = params.ej && ejercicios.find((n) => norm(n) === norm(decodeURIComponent(params.ej)));

  el.innerHTML = `
    <h2 class="titulo-pag">Historial</h2>
    ${ses.length ? `
    <ul class="lista-sesiones">
      ${ses.map((s) => {
        const series = s.ejercicios.reduce((a, e) => a + e.registros.filter((r) => r.hecho).length, 0);
        return `<li><a href="#/historial/${s.id}" class="tarjeta fila-sesion">
          <div><b>${esc(s.diaNombre)}</b> · ${esc(s.semana)}<small>${esc(fmtFecha(s.fecha))} · ${series} series${s.pesoCorporal ? ` · ${fmtNum(s.pesoCorporal)} kg` : ''}</small></div>
          <span class="flecha">›</span></a></li>`;
      }).join('')}
    </ul>

    <section class="seccion">
      <h2 class="titulo-sec">Progreso por ejercicio</h2>
      <select id="sel-ej" class="campo-select">
        <option value="">Elige un ejercicio…</option>
        ${ejercicios.map((n) => `<option value="${esc(n)}" ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      ${sel ? tablaProgreso(sel) : ''}
    </section>` : '<p class="vacio">Aún no registras sesiones. Cuando termines un entrenamiento aparecerá aquí.</p>'}`;

  const s = el.querySelector('#sel-ej');
  if (s) s.onchange = () => { location.hash = s.value ? `#/historial/ej/${encodeURIComponent(s.value)}` : '#/historial'; };
}

function tablaProgreso(nombre) {
  const filas = [];
  for (const s of state.sesiones) {
    const e = s.ejercicios.find((x) => norm(x.nombre) === norm(nombre));
    const hechas = e?.registros.filter((r) => r.hecho && r.kg !== '' && r.kg != null);
    if (!hechas?.length) continue;
    const mejor = hechas.reduce((a, r) => (Number(r.kg) > Number(a.kg) || (Number(r.kg) === Number(a.kg) && Number(r.reps) > Number(a.reps)) ? r : a));
    const vol = hechas.reduce((a, r) => a + Number(r.kg) * (Number(r.reps) || 0), 0);
    filas.push({ fecha: s.fecha, mejor, vol, series: hechas.map((r) => `${fmtNum(r.kg)}×${r.reps || '–'}`).join(' · ') });
  }
  if (!filas.length) return '<p class="vacio">Sin registros con kilos para este ejercicio.</p>';
  return `<table class="tabla">
    <thead><tr><th>Fecha</th><th>Mejor serie</th><th>Volumen</th></tr></thead>
    <tbody>${filas.map((f) => `<tr><td>${esc(fmtFecha(f.fecha, { day: 'numeric', month: 'short' }))}</td><td><b>${fmtNum(f.mejor.kg)} kg × ${esc(f.mejor.reps || '–')}</b><small>${esc(f.series)}</small></td><td>${Math.round(f.vol).toLocaleString('es-CL')} kg</td></tr>`).join('')}</tbody>
  </table>`;
}

function detalle(el, id) {
  const s = state.sesiones.find((x) => x.id === id);
  if (!s) { el.innerHTML = '<p class="vacio">No se encontró la sesión.</p>'; return; }
  const texto = textoResumen(s);
  const videos = s.ejercicios.flatMap((e) => e.grabar.filter((n) => e.registros[n - 1]?.hecho).map((n) => `${e.nombre} · S${n}`));
  el.innerHTML = `
    <a href="#/historial" class="btn btn-texto">‹ Historial</a>
    <header class="cab-sesion"><div><p class="sobre">${esc(s.semana)} · ${esc(fmtFecha(s.fecha))} · ${fmtHora(s.fecha)}</p><h2>${esc(s.diaNombre)}</h2></div></header>
    ${videos.length ? `<div class="tarjeta aviso-videos"><b>🎥 Videos para adjuntar</b><ul>${videos.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div>` : ''}
    <div class="acciones">
      <button class="btn btn-wsp" id="compartir">Enviar por WhatsApp</button>
      <button class="btn btn-sec" id="copiar">Copiar texto</button>
    </div>
    <p class="ayuda">Envía primero el resumen y luego adjunta los videos en el mismo chat.</p>
    <pre class="resumen">${esc(texto)}</pre>
    <button class="btn btn-texto btn-peligro" id="eliminar">Eliminar sesión</button>`;

  el.querySelector('#compartir').onclick = () => compartirTexto(texto);
  el.querySelector('#copiar').onclick = async () => toast((await copiarTexto(texto)) ? 'Resumen copiado' : 'No se pudo copiar');
  el.querySelector('#eliminar').onclick = async () => {
    if (!confirm('¿Eliminar esta sesión del historial?')) return;
    await eliminarSesion(id);
    location.hash = '#/historial';
  };
}
