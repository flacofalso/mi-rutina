// Texto de resumen de la sesión para enviar al entrenador por WhatsApp.
import { fmtNum } from './ui.js';

const CARAS = ['', '😫', '😕', '😐', '🙂', '💪'];
export const SENSACIONES = ['', 'Muy mal', 'Mal', 'Normal', 'Bien', 'Excelente'];

export function textoResumen(s) {
  const fecha = new Date(s.fecha).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = (iso) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const l = [];
  l.push(`🏋️ *${s.semana} · ${s.diaNombre || 'Día ' + s.dia}*`);
  l.push(`📅 ${fecha.charAt(0).toUpperCase() + fecha.slice(1)}${s.fin ? ` · ${hora(s.fecha)}–${hora(s.fin)}` : ''}`);
  if (s.pesoCorporal) l.push(`⚖️ Peso corporal: ${fmtNum(s.pesoCorporal)} kg`);
  if (s.sensacion) l.push(`${CARAS[s.sensacion]} Cómo me sentí: ${s.sensacion}/5 (${SENSACIONES[s.sensacion]})`);
  if (s.notas?.trim()) l.push(`📝 ${s.notas.trim()}`);
  l.push('');

  const videos = [];
  for (const e of s.ejercicios) {
    const hechas = e.registros.map((r, i) => ({ ...r, i })).filter((r) => r.hecho || r.kg || r.reps);
    l.push(`*${e.nombre}* (${e.series}×${e.reps} · ${e.intensidad})`);
    if (!hechas.length) { l.push('   — no realizado'); continue; }
    for (const r of hechas) {
      const grabar = e.grabar?.includes(r.i + 1);
      if (grabar) videos.push(`${e.nombre} S${r.i + 1}`);
      const kg = r.kg !== '' && r.kg != null ? `${fmtNum(r.kg)} kg` : 'sin carga';
      const reps = r.reps !== '' && r.reps != null ? ` × ${r.reps}` : '';
      const rpe = r.rpe ? ` · ${String(r.rpe).startsWith('@') || /rir/i.test(r.rpe) ? r.rpe : '@' + r.rpe}` : '';
      l.push(`   S${r.i + 1}: ${kg}${reps}${rpe}${grabar ? ' 🎥' : ''}`);
    }
    if (e.nota?.trim()) l.push(`   📝 ${e.nota.trim()}`);
  }
  if (videos.length) {
    l.push('');
    l.push(`🎥 Videos adjuntos: ${videos.join(', ')}`);
  }
  return l.join('\n');
}
