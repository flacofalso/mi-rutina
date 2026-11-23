// Temporizador de descanso (barra fija inferior). Usa la hora real, así que sigue
// siendo correcto aunque la pantalla se bloquee o el navegador pause la pestaña.
import { $, esc } from './ui.js';

let fin = 0, minS = 0, maxS = 0, inicio = 0, intervalo = null, avisado = false, audio = null, siguiente = '';

const mmss = (s) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s) % 60)).padStart(2, '0')}`;

function pitido() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    [0, 0.25, 0.5].forEach((d) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
      o.connect(g).connect(audio.destination);
      o.start(t + d);
      o.stop(t + d + 0.2);
    });
  } catch { /* sin audio */ }
  navigator.vibrate?.([300, 120, 300, 120, 300]);
}

function pintar() {
  const el = $('#timer');
  const ahora = Date.now();
  const restante = (fin - ahora) / 1000;
  const transcurrido = (ahora - inicio) / 1000;
  if (restante <= 0 && !avisado) { avisado = true; pitido(); }
  const listo = restante <= 0;
  const pasado = transcurrido > maxS;
  el.className = 'timer' + (listo ? ' listo' : '') + (pasado ? ' pasado' : '');
  const pct = Math.min(100, (transcurrido / minS) * 100);
  el.innerHTML = `
    <div class="timer-barra" style="width:${pct}%"></div>
    <div class="timer-info">
      <span class="timer-tiempo">${listo ? '+' + mmss(-restante) : mmss(restante)}</span>
      <span class="timer-texto">${listo ? (pasado ? 'Superaste el descanso máximo' : '¡Listo! Siguiente serie') : `Descanso · ${esc(rango())}`}${siguiente ? `<br><small>${esc(siguiente)}</small>` : ''}</span>
    </div>
    <div class="timer-acciones">
      <button class="btn-chico" data-t="+30">+30 s</button>
      <button class="btn-chico" data-t="fin">${listo ? 'Cerrar' : 'Saltar'}</button>
    </div>`;
}

const tiempoCorto = (s) => (s % 60 === 0 ? String(s / 60) : mmss(s));
const rango = () => (minS === maxS ? tiempoCorto(minS) + ' min' : `${tiempoCorto(minS)}–${tiempoCorto(maxS)} min`);

export function iniciarDescanso([a, b], textoSiguiente = '') {
  // Crear el contexto de audio durante el toque del usuario (requisito de iOS)
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* */ }
  minS = a; maxS = Math.max(a, b);
  inicio = Date.now();
  fin = inicio + a * 1000;
  avisado = false;
  siguiente = textoSiguiente;
  const el = $('#timer');
  el.hidden = false;
  document.body.classList.add('con-timer');
  el.onclick = (e) => {
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (t === '+30') { fin += 30000; avisado = fin <= Date.now(); pintar(); }
    if (t === 'fin') detenerDescanso();
  };
  clearInterval(intervalo);
  intervalo = setInterval(pintar, 500);
  pintar();
}

export function detenerDescanso() {
  clearInterval(intervalo);
  intervalo = null;
  const el = $('#timer');
  el.hidden = true;
  el.innerHTML = '';
  document.body.classList.remove('con-timer');
}
