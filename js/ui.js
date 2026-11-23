// Utilidades de interfaz.
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function fmtFecha(iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Date(iso).toLocaleDateString('es-CL', opts);
}
export const fmtHora = (iso) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const fmtNum = (n) => (n === '' || n == null ? '' : String(n).replace('.', ','));
export const aNum = (s) => {
  const n = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
}

// Hoja inferior (modal)
export function abrirHoja(html, { titulo = '', alAbrir } = {}) {
  const hoja = $('#hoja');
  hoja.innerHTML = `
    <div class="hoja-fondo" data-cerrar></div>
    <div class="hoja-panel" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="hoja-cab"><h2>${esc(titulo)}</h2><button class="btn-icono" data-cerrar aria-label="Cerrar">✕</button></div>
      <div class="hoja-cuerpo">${html}</div>
    </div>`;
  hoja.hidden = false;
  document.body.classList.add('con-hoja');
  hoja.onclick = (e) => { if (e.target.closest('[data-cerrar]')) cerrarHoja(); };
  alAbrir?.($('.hoja-cuerpo', hoja));
}
export function cerrarHoja() {
  const hoja = $('#hoja');
  hoja.hidden = true;
  hoja.innerHTML = '';
  document.body.classList.remove('con-hoja');
}

export function descargar(nombre, contenido, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function elegirArchivo(accept) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

export const leerComoBuffer = (f) => f.arrayBuffer();
export const leerComoTexto = (f) => f.text();
export const leerComoDataURL = (f) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});

// Reduce una foto a WebP de máx. 640 px para no llenar el almacenamiento.
export async function reducirImagen(file, lado = 640) {
  const url = await leerComoDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const k = Math.min(1, lado / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', 0.75);
}

export async function compartirTexto(texto) {
  if (navigator.share) {
    try { await navigator.share({ text: texto }); return 'compartido'; } catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  return 'whatsapp';
}

export async function copiarTexto(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}
