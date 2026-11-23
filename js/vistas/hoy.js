import { kv } from '../db.js';
import { state, semanaActual, proximoDia, diasCompletadosSemana, esDiaEntreno, horarioComidas, menuDe, aMin, imagenDe } from '../data.js';
import { esc, DIAS_SEMANA } from '../ui.js';

export async function vistaHoy(el) {
  const hoy = new Date();
  const sem = semanaActual();
  const borrador = await kv.get('borrador');
  const entrenaHoy = esDiaEntreno(hoy);
  const sig = proximoDia();
  const diaSig = sem?.dias.find((d) => d.numero === sig);
  const hechos = diasCompletadosSemana(sem);
  const yaEntrenoHoy = state.sesiones.some((s) => new Date(s.fecha).toDateString() === hoy.toDateString());
  const ahoraMin = hoy.getHours() * 60 + hoy.getMinutes();

  // Próximo día de entrenamiento según la configuración
  let proxFecha = null;
  for (let k = 1; k <= 7; k++) {
    const f = new Date(hoy); f.setDate(hoy.getDate() + k);
    if (esDiaEntreno(f)) { proxFecha = f; break; }
  }

  let bloqueEntreno;
  if (borrador?.inicio) {
    const total = borrador.ejercicios.reduce((a, e) => a + e.registros.length, 0);
    const listas = borrador.ejercicios.reduce((a, e) => a + e.registros.filter((r) => r.hecho).length, 0);
    bloqueEntreno = `
      <div class="tarjeta destacada">
        <p class="sobre">Sesión en curso</p>
        <h3>${esc(borrador.diaNombre)} · ${listas}/${total} series</h3>
        <a class="btn btn-primario btn-bloque" href="#/entrenar">Continuar</a>
      </div>`;
  } else if (entrenaHoy && !yaEntrenoHoy && diaSig) {
    bloqueEntreno = `
      <div class="tarjeta destacada">
        <p class="sobre">Hoy entrenas · ${esc(state.config.horaEntreno)}</p>
        <h3>${esc(diaSig.nombre)} · ${esc(sem.nombre)}</h3>
        <ul class="lista-mini">
          ${diaSig.ejercicios.map((e) => `<li>${imagenDe(e.nombre) ? `<img src="${imagenDe(e.nombre)}" alt="">` : '<span class="punto"></span>'}<span>${esc(e.nombre)}</span>${e.grabar.length ? '<span title="Hay series para grabar">🎥</span>' : ''}</li>`).join('')}
        </ul>
        <a class="btn btn-primario btn-bloque" href="#/entrenar/${diaSig.numero}">Comenzar ${esc(diaSig.nombre)}</a>
      </div>`;
  } else {
    bloqueEntreno = `
      <div class="tarjeta">
        <p class="sobre">${yaEntrenoHoy ? 'Entrenamiento de hoy completado ✓' : 'Hoy descansas'}</p>
        <h3>Próximo: ${diaSig ? esc(diaSig.nombre) : '—'}${proxFecha ? ` · ${DIAS_SEMANA[proxFecha.getDay()].toLowerCase()} ${esc(state.config.horaEntreno)}` : ''}</h3>
        ${diaSig ? `<a class="btn btn-sec btn-bloque" href="#/entrenar/${diaSig.numero}">Entrenar ahora de todas formas</a>` : ''}
      </div>`;
  }

  const horario = horarioComidas(hoy);
  const menu = menuDe(hoy);
  const idxProx = horario.findIndex((c) => (c.clave === 'entreno' ? aMin(c.fin) : c.min + 30) >= ahoraMin);

  el.innerHTML = `
    <p class="fecha-hoy">${esc(hoy.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
    ${bloqueEntreno}

    ${sem ? `
    <section class="seccion">
      <h2 class="titulo-sec">${esc(sem.nombre)}</h2>
      <div class="semana-dias">
        ${sem.dias.map((d) => `<a href="#/entrenar/${d.numero}" class="dia-pill ${hechos.has(d.numero) ? 'hecho' : ''} ${d.numero === sig && !hechos.has(d.numero) ? 'sig' : ''}">
          <b>${esc(d.nombre)}</b><small>${hechos.has(d.numero) ? 'Completado ✓' : d.numero === sig ? 'Siguiente' : 'Pendiente'}</small></a>`).join('')}
      </div>
    </section>` : ''}

    <section class="seccion">
      <h2 class="titulo-sec">Comidas de hoy</h2>
      ${menu ? `<ol class="linea-tiempo">
        ${horario.map((c, k) => {
          const clase = [k < idxProx || idxProx === -1 ? 'pasada' : '', k === idxProx ? 'actual' : '', c.clave === 'entreno' ? 'es-entreno' : ''].join(' ');
          if (c.clave === 'entreno') return `<li class="${clase}"><time>${c.hora}</time><div><b>🏋️ Entrenamiento</b><small>${c.hora}–${c.fin}</small></div></li>`;
          const items = menu.comidas[c.clave] || [];
          return `<li class="${clase}"><time>${c.hora}</time><div><b>${esc(c.nombre)}</b>${c.nota ? `<small class="nota-comida">${esc(c.nota)}</small>` : ''}<span>${items.map((i) => esc(i.t)).join(' · ')}</span></div></li>`;
        }).join('')}
      </ol>
      <a href="#/comidas" class="btn btn-texto">Ver menú semanal y equivalencias →</a>`
      : '<p class="vacio">Importa tu paquete personal para ver el plan de alimentación.</p>'}
    </section>

    <section class="seccion recordatorios">
      <div class="tarjeta mini">👣 Meta de 5.000–7.000 pasos</div>
      <div class="tarjeta mini">😴 Dormir 7–9 horas</div>
      <div class="tarjeta mini">🍽️ Comer sin pantallas, 30–40 min</div>
    </section>`;
}
