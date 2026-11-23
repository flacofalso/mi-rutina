import {
  state, semanasOrdenadas, setSemanaActiva, guardarConfig, importarExcel, importarPaquete,
  exportarRespaldo, importarRespaldo, borrarTodo, imagenDe, guardarImagen, tieneRutina,
} from '../data.js';
import { esc, toast, elegirArchivo, descargar, reducirImagen, DIAS_CORTOS } from '../ui.js';

const ORDEN = [1, 2, 3, 4, 5, 6, 0];

export async function accionImportarPaquete(alTerminar) {
  const f = await elegirArchivo('');
  if (!f) return;
  try {
    const res = await importarPaquete(JSON.parse(await f.text()));
    toast('Importado: ' + res.join(', '), 4000);
    alTerminar?.();
  } catch (e) { alert(e.message || String(e)); }
}

export async function accionImportarExcel(alTerminar) {
  const f = await elegirArchivo('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  if (!f) return;
  try {
    const semanas = await importarExcel(await f.arrayBuffer());
    toast(`Importado: ${semanas.map((s) => s.nombre).join(', ')}`, 4000);
    alTerminar?.();
  } catch (e) { alert(e.message || String(e)); }
}

export function vistaBienvenida(el, redibujar) {
  el.innerHTML = `
    <div class="bienvenida">
      <div class="logo-grande" aria-hidden="true">🏋️</div>
      <h2>Tu rutina y tu alimentación, en un solo lugar</h2>
      <p>Tus datos se guardan solo en este dispositivo. Para empezar, importa tu <b>paquete personal</b> (rutina, imágenes y plan de comidas) o directamente el <b>Excel de la rutina</b>.</p>
      <button class="btn btn-primario btn-bloque" id="b-paquete">Importar paquete personal (.json)</button>
      <button class="btn btn-sec btn-bloque" id="b-excel">Importar Excel de rutina (.xlsx)</button>
      <button class="btn btn-texto btn-bloque" id="b-respaldo">Restaurar un respaldo</button>
    </div>`;
  el.querySelector('#b-paquete').onclick = () => accionImportarPaquete(redibujar);
  el.querySelector('#b-excel').onclick = () => accionImportarExcel(redibujar);
  el.querySelector('#b-respaldo').onclick = () => restaurar(redibujar);
}

async function restaurar(alTerminar) {
  const f = await elegirArchivo('');
  if (!f) return;
  try {
    await importarRespaldo(JSON.parse(await f.text()));
    toast('Respaldo restaurado');
    alTerminar?.();
  } catch (e) { alert(e.message || String(e)); }
}

export function vistaAjustes(el) {
  const c = state.config;
  const semanas = semanasOrdenadas();
  const todos = [...new Map(semanas.flatMap((s) => s.dias.flatMap((d) => d.ejercicios)).map((e) => [e.nombre, e])).values()];
  const sinImg = todos.filter((e) => !imagenDe(e.nombre));
  const pintar = () => vistaAjustes(el);

  el.innerHTML = `
    <h2 class="titulo-pag">Ajustes</h2>

    <section class="tarjeta">
      <h3>Horario de entrenamiento</h3>
      <div class="segmentado">
        <button data-hora="19:00" class="${c.horaEntreno === '19:00' ? 'activo' : ''}">🌙 19:00–20:00</button>
        <button data-hora="07:00" class="${c.horaEntreno === '07:00' ? 'activo' : ''}">☀️ 07:00–08:00</button>
      </div>
      <label class="campo fila">Otra hora de inicio <input type="time" id="hora" value="${esc(c.horaEntreno)}"></label>
      <p class="ayuda">Los horarios de comida se ajustan solos: entrenando de noche, la once es tu preentreno y la cena el posentreno. Entrenando de mañana, una colación liviana antes y el desayuno después.${window.APP?.temaPorHorario ? ' El modo tarde usa tonos oscuros y el de mañana, tonos claros.' : ''}</p>
      <h3>Días de entrenamiento</h3>
      <div class="dias-semana">
        ${ORDEN.map((d) => `<label><input type="checkbox" value="${d}" ${c.diasEntreno.includes(d) ? 'checked' : ''}><span>${DIAS_CORTOS[d]}</span></label>`).join('')}
      </div>
    </section>

    <section class="tarjeta">
      <h3>Rutina</h3>
      ${semanas.length ? `<label class="campo">Semana activa
        <select id="semana" class="campo-select">${semanas.map((s) => `<option ${s.nombre === state.semanaActiva ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>
      </label>` : '<p class="vacio">Sin rutina importada.</p>'}
      <button class="btn btn-primario btn-bloque" id="excel">Importar Excel de la semana</button>
      <p class="ayuda">Cuando el entrenador envíe la planilla nueva, impórtala aquí. Se agrega como nueva semana y queda activa; las anteriores y tu historial se conservan.</p>
    </section>

    <section class="tarjeta">
      <h3>Imágenes de ejercicios</h3>
      ${sinImg.length ? `<p class="ayuda">Sin imagen:</p><ul class="lista-img">${sinImg.map((e) => `<li><span>${esc(e.nombre)}</span><button class="btn-chico" data-img="${esc(e.nombre)}">Agregar</button></li>`).join('')}</ul>`
        : `<p class="ayuda">${todos.length ? 'Todos los ejercicios tienen imagen ✓' : '—'}</p>`}
    </section>

    <section class="tarjeta">
      <h3>Paquete personal y respaldo</h3>
      <button class="btn btn-sec btn-bloque" id="paquete">Importar paquete personal</button>
      <button class="btn btn-sec btn-bloque" id="exportar">Descargar respaldo</button>
      <button class="btn btn-sec btn-bloque" id="restaurar">Restaurar respaldo</button>
      <p class="ayuda">Tus datos viven solo en este dispositivo. Descarga un respaldo de vez en cuando (por ejemplo, a Drive) para no perder tu historial si cambias de teléfono o borras los datos del navegador.</p>
      <button class="btn btn-texto btn-peligro btn-bloque" id="borrar">Borrar todos los datos</button>
    </section>`;

  el.querySelectorAll('[data-hora]').forEach((b) => b.onclick = async () => { await guardarConfig({ horaEntreno: b.dataset.hora }); pintar(); toast('Horario actualizado'); });
  el.querySelector('#hora').onchange = async (e) => { if (e.target.value) { await guardarConfig({ horaEntreno: e.target.value }); pintar(); } };
  el.querySelectorAll('.dias-semana input').forEach((i) => i.onchange = async () => {
    const dias = [...el.querySelectorAll('.dias-semana input:checked')].map((x) => Number(x.value));
    await guardarConfig({ diasEntreno: dias });
  });
  el.querySelector('#semana')?.addEventListener('change', async (e) => { await setSemanaActiva(e.target.value); toast('Semana activa: ' + e.target.value); });
  el.querySelector('#excel').onclick = () => accionImportarExcel(pintar);
  el.querySelector('#paquete').onclick = () => accionImportarPaquete(pintar);
  el.querySelectorAll('[data-img]').forEach((b) => b.onclick = async () => {
    const f = await elegirArchivo('image/*');
    if (!f) return;
    await guardarImagen(b.dataset.img, await reducirImagen(f));
    pintar();
  });
  el.querySelector('#exportar').onclick = async () => {
    const d = await exportarRespaldo();
    descargar(`respaldo-rutina-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d));
  };
  el.querySelector('#restaurar').onclick = () => restaurar(pintar);
  el.querySelector('#borrar').onclick = async () => {
    if (!confirm('¿Borrar rutina, imágenes, plan de comidas e historial de este dispositivo? No se puede deshacer.')) return;
    if (!confirm('¿Seguro? Te recomiendo descargar un respaldo antes.')) return;
    await borrarTodo();
    location.hash = '#/hoy';
  };
  return tieneRutina;
}
