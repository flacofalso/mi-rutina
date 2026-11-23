import { pedirAlmacenamientoPersistente } from './db.js';
import { cargarEstado, tieneRutina, importarPaquete } from './data.js';
import { $, $$, cerrarHoja } from './ui.js';
import { vistaHoy } from './vistas/hoy.js';
import { vistaEntrenar, salirEntrenar } from './vistas/entrenar.js';
import { vistaComidas } from './vistas/comidas.js';
import { vistaHistorial } from './vistas/historial.js';
import { vistaAjustes, vistaBienvenida } from './vistas/ajustes.js';

const RUTAS = [
  [/^#\/hoy$/, 'hoy', vistaHoy],
  [/^#\/entrenar(?:\/(?<dia>\d+))?$/, 'entrenar', vistaEntrenar],
  [/^#\/comidas(?:\/(?<d>\d))?$/, 'comidas', vistaComidas],
  [/^#\/historial\/ej\/(?<ej>.+)$/, 'historial', vistaHistorial],
  [/^#\/historial(?:\/(?<id>[\w-]+))?$/, 'historial', vistaHistorial],
  [/^#\/ajustes$/, 'ajustes', vistaAjustes],
];

async function render() {
  const hash = location.hash || '#/hoy';
  const main = $('#app');
  cerrarHoja();
  if (!hash.startsWith('#/entrenar')) salirEntrenar();
  main.onclick = null;
  main.oninput = null;

  const ruta = RUTAS.find(([re]) => re.test(hash));
  if (!ruta) { location.replace('#/hoy'); return; }
  const [re, tab, vista] = ruta;
  $$('.tabbar a').forEach((a) => a.classList.toggle('activo', a.dataset.tab === tab));

  if (!tieneRutina() && tab !== 'ajustes') {
    vistaBienvenida(main, () => render());
    return;
  }
  try {
    await vista(main, re.exec(hash).groups || {});
  } catch (e) {
    console.error(e);
    main.innerHTML = `<p class="vacio">Ocurrió un error: ${String(e.message || e)}</p>`;
  }
  if (!hash.startsWith('#/entrenar')) window.scrollTo(0, 0);
}

// En desarrollo (localhost) carga automáticamente privado/paquete.json si existe.
async function autocargarPaqueteLocal() {
  if (tieneRutina() || !['localhost', '127.0.0.1'].includes(location.hostname)) return;
  try {
    const r = await fetch('privado/paquete.json', { cache: 'no-store' });
    if (r.ok) await importarPaquete(await r.json());
  } catch { /* no existe */ }
}

async function iniciar() {
  await cargarEstado();
  await autocargarPaqueteLocal();
  pedirAlmacenamientoPersistente();
  window.addEventListener('hashchange', render);
  await render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

iniciar();
