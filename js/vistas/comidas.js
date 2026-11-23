import { state, horarioComidas, menuDe, esDiaEntreno } from '../data.js';
import { esc, abrirHoja, DIAS_CORTOS, DIAS_SEMANA } from '../ui.js';

const ORDEN = [1, 2, 3, 4, 5, 6, 0];

function fechaDeDiaSemana(d) {
  const hoy = new Date();
  const f = new Date(hoy);
  const lunesOffset = (hoy.getDay() + 6) % 7;
  f.setDate(hoy.getDate() - lunesOffset + ((d + 6) % 7));
  return f;
}

export function vistaComidas(el, params) {
  const n = state.nutricion;
  if (!n) { el.innerHTML = '<p class="vacio">Importa tu paquete personal en Ajustes para ver el plan de alimentación.</p>'; return; }
  const d = params.d != null ? Number(params.d) : new Date().getDay();
  const fecha = fechaDeDiaSemana(d);
  const menu = menuDe(fecha);
  const horario = horarioComidas(fecha);
  const entreno = esDiaEntreno(fecha);

  const totales = {};
  for (const items of Object.values(menu?.comidas || {})) for (const i of items) totales[i.g] = (totales[i.g] || 0) + i.p;

  el.innerHTML = `
    <div class="selector-dia">
      ${ORDEN.map((k) => `<a href="#/comidas/${k}" class="chip ${k === d ? 'activo' : ''}">${DIAS_CORTOS[k]}${state.config.diasEntreno.includes(k) ? ' 🏋️' : ''}</a>`).join('')}
    </div>
    <header class="cab-sesion">
      <div>
        <p class="sobre">${entreno ? `Día de entrenamiento · ${esc(state.config.horaEntreno)}` : 'Día de descanso'}</p>
        <h2>${DIAS_SEMANA[d]}</h2>
      </div>
    </header>
    ${menu?.nota ? `<p class="tarjeta aviso">${esc(menu.nota)}</p>` : ''}
    ${horario.map((c) => {
      if (c.clave === 'entreno') return `<div class="bloque-entreno"><time>${c.hora}–${c.fin}</time> 🏋️ Entrenamiento</div>`;
      const items = menu?.comidas[c.clave] || [];
      return `
      <article class="tarjeta comida">
        <header><time>${c.hora}</time><h3>${esc(c.nombre)}</h3>${c.nota ? `<span class="nota-comida">${esc(c.nota)}</span>` : ''}</header>
        <ul>
          ${items.map((i) => {
            const g = n.grupos[i.g] || { nombre: i.g, color: '#888' };
            return `<li><button class="item-comida" data-g="${esc(i.g)}">
              <span class="pastilla" style="--g:${esc(g.color)}">${i.p}</span>
              <span>${esc(i.t)}<small>${esc(g.nombre)}</small></span>
              <span class="flecha">⇄</span></button></li>`;
          }).join('')}
        </ul>
      </article>`;
    }).join('')}

    <section class="seccion">
      <h2 class="titulo-sec">Porciones del día</h2>
      <div class="porciones">
        ${Object.entries(n.grupos).map(([k, g]) => {
          const meta = String(g.porciones);
          const [a, b] = meta.split('-').map(Number);
          const ok = totales[k] >= a && totales[k] <= (b || a);
          return `<button class="porcion ${ok ? 'ok' : ''}" data-g="${esc(k)}" style="--g:${esc(g.color)}"><b>${totales[k] || 0}<small>/${esc(meta)}</small></b><span>${esc(g.nombre)}</span></button>`;
        }).join('')}
      </div>
      <p class="ayuda">Toca un alimento o un grupo para ver sus equivalencias. Puedes cambiar cualquier alimento por otro del mismo grupo.</p>
    </section>

    <section class="seccion">
      <h2 class="titulo-sec">Pauta</h2>
      <details class="tarjeta"><summary>📋 Reglas</summary><ul class="lista">${n.reglas.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>
      <details class="tarjeta"><summary>🚫 Alimentos a evitar</summary><ul class="lista">${n.evitar.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>${n.desarreglo ? `<p class="aviso">${esc(n.desarreglo)}</p>` : ''}</details>
      <details class="tarjeta"><summary>🌱 Hábitos</summary>${n.habitos.map((h) => `<p><b>${esc(h.titulo)}:</b> ${esc(h.texto)}</p>`).join('')}</details>
      ${n.calorias ? `<p class="ayuda">Meta aproximada: ${esc(n.calorias)} kcal al día.</p>` : ''}
    </section>`;

  el.onclick = (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    const g = n.grupos[b.dataset.g];
    if (!g) return;
    abrirHoja(`<p class="ayuda">Cada línea equivale a <b>1 porción</b>.</p>
      <ul class="lista equivalencias">${g.equivalencias.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, { titulo: g.nombre });
  };
}
