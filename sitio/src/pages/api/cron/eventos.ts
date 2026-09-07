// El cron de ferias y eventos: que la preparación te busque a ti.
//
// La lista de preparación vivía dentro de la pestaña, dentro de la hoja de la
// edición, dentro de Eventos: "apartar el stand" vencía cuatro meses antes de la
// feria y nadie abría esa hoja cuatro meses antes. Con 26 fechas límite en los
// próximos 90 días y cero avisos, el stand se agota y se descubre en enero.
//
// Corre una vez al día y deja avisos en la campana (idempotentes por clave: un
// reintento de Vercel no duplica). Cuatro cosas, y nada más:
//   1. Fecha límite de registro/stand en los próximos 21 días (evento que vamos o que encaja ≥8).
//   2. Tareas de preparación vencidas, UN aviso por edición (no 17).
//   3. Registros de las últimas 72 h con consentimiento y sin ninguna bienvenida.
//   4. Ediciones que ya pasaron hace 7+ días sin retro (el aprendizaje se enfría).
import type { APIRoute } from 'astro';
import { diaMX } from '../../../lib/crm/eventos.lib';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { notificar } from '../../../lib/crm/notificaciones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const dia = (d: Date) => d.toISOString().slice(0, 10);
const mas = (n: number) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + n); return dia(x); };
const MIN_ANTES = 20; // con menos de 20 días para la feria, el plazo vencido ya es historia: no vale un aviso
const fecha = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'no autorizado' }, 401);
  const hoy = diaMX(null);
  const res = { limites: 0, vencidos: 0, tareas: 0, sin_bienvenida: 0, sin_retro: 0 };

  // 1. Se acaba el plazo para apartar.
  const { data: lims } = await supabase.from('ev_ediciones')
    .select('id, nombre, inicio, limite_registro, participacion, ev_eventos(nombre, decision, fit_puntaje)')
    .gte('limite_registro', hoy).lte('limite_registro', mas(21)).neq('participacion', 'no_vamos');
  for (const ed of (lims || []) as any[]) {
    const ev = ed.ev_eventos || {};
    if (ev.decision !== 'ir' && Number(ev.fit_puntaje || 0) < 8 && ed.participacion !== 'vamos') continue;
    const dias = Math.round((Date.parse(ed.limite_registro) - Date.parse(hoy)) / 864e5);
    const nuevo = await notificar({
      clave: `ev_limite:${ed.id}`, tipo: 'evento_limite', nivel: dias <= 7 ? 'urgente' : 'alerta',
      titulo: `${ev.nombre} · ${ed.nombre}: el plazo para apartar vence en ${dias} día${dias === 1 ? '' : 's'}`,
      detalle: ed.participacion === 'vamos' ? `Vamos y aún no está apartado en la lista. Límite ${fecha(ed.limite_registro)}; la feria es el ${fecha(ed.inicio)}.` : `Todavía está "sin decidir". Límite ${fecha(ed.limite_registro)}; la feria es el ${fecha(ed.inicio)}.`,
      destino: `eventos?edicion=${ed.id}`, metadata: { edicion_id: ed.id },
    });
    if (nuevo) res.limites++;
  }

  // 1b. El plazo ya pasó y seguimos «sin decidir» en una feria que encaja. Avisa una
  // sola vez: muchas ferias aceptan expositores después de la fecha oficial, pero eso
  // hay que preguntarlo, no descubrirlo cuando ya no hay stand.
  const { data: venc } = await supabase.from('ev_ediciones')
    .select('id, nombre, inicio, limite_registro, participacion, ev_eventos(nombre, decision, fit_puntaje)')
    .lt('limite_registro', hoy).gte('inicio', mas(MIN_ANTES)).eq('participacion', 'sin_decidir');
  for (const ed of (venc || []) as any[]) {
    const ev = ed.ev_eventos || {};
    if (ev.decision !== 'ir' && Number(ev.fit_puntaje || 0) < 8) continue;
    const nuevo = await notificar({
      clave: `ev_limite_vencido:${ed.id}`, tipo: 'evento_limite', nivel: 'alerta',
      titulo: `${ev.nombre} · ${ed.nombre}: el plazo para apartar pasó el ${fecha(ed.limite_registro)} y sigue sin decidir`,
      detalle: `La feria es el ${fecha(ed.inicio)}. Si todavía interesa, hay que preguntar al organizador si queda lugar; si no, márcala «no vamos» para que deje de aparecer.`,
      destino: `eventos?edicion=${ed.id}`, metadata: { edicion_id: ed.id },
    });
    if (nuevo) res.vencidos++;
  }

  // 2. Tareas vencidas, agrupadas por edición.
  const { data: tv } = await supabase.from('ev_tareas').select('edicion_id, titulo, vence').eq('hecha', false).lt('vence', hoy);
  const porEd = new Map<string, any[]>();
  for (const t of tv || []) (porEd.get(t.edicion_id) || porEd.set(t.edicion_id, []).get(t.edicion_id)!).push(t);
  if (porEd.size) {
    const { data: eds } = await supabase.from('ev_ediciones').select('id, nombre, inicio, participacion, ev_eventos(nombre)').in('id', Array.from(porEd.keys()));
    for (const ed of (eds || []) as any[]) {
      if (ed.participacion !== 'vamos' || ed.inicio < hoy) continue;
      const lista = porEd.get(ed.id)!.sort((a, b) => a.vence.localeCompare(b.vence));
      // La clave lleva la semana: si siguen vencidas, vuelve a avisar el lunes siguiente, no cada día.
      const semana = Math.floor(Date.parse(hoy) / (7 * 864e5));
      const nuevo = await notificar({
        clave: `ev_tareas:${ed.id}:${semana}`, tipo: 'evento_tareas', nivel: 'alerta',
        titulo: `${ed.ev_eventos?.nombre} · ${ed.nombre}: ${lista.length} pendiente${lista.length === 1 ? '' : 's'} de preparación vencido${lista.length === 1 ? '' : 's'}`,
        detalle: lista.slice(0, 3).map(t => `· ${t.titulo}`).join('\n') + (lista.length > 3 ? `\n· y ${lista.length - 3} más` : ''),
        destino: `eventos?edicion=${ed.id}`, metadata: { edicion_id: ed.id },
      });
      if (nuevo) res.tareas++;
    }
  }

  // 3. Dijeron que sí y no les llegó nada.
  const desde = new Date(Date.now() - 72 * 3600e3).toISOString();
  const { data: regs } = await supabase.from('ev_registros').select('id, edicion_id, bienvenida_wa_error, bienvenida_email_error')
    .eq('consentimiento', true).is('bienvenida_wa_at', null).is('bienvenida_email_at', null).gte('capturado_at', desde);
  const porEdR = new Map<string, any[]>();
  for (const r of regs || []) (porEdR.get(r.edicion_id) || porEdR.set(r.edicion_id, []).get(r.edicion_id)!).push(r);
  if (porEdR.size) {
    const { data: eds } = await supabase.from('ev_ediciones').select('id, nombre, plantilla_wa, ev_eventos(nombre)').in('id', Array.from(porEdR.keys()));
    for (const ed of (eds || []) as any[]) {
      const l = porEdR.get(ed.id)!;
      const sinPlantilla = !ed.plantilla_wa;
      const motivos = Array.from(new Set(l.map(r => r.bienvenida_wa_error || r.bienvenida_email_error).filter(Boolean)))
        .filter(m => !(sinPlantilla && /plantilla/i.test(String(m)))).slice(0, 2);
      const uno = l.length === 1;
      const nuevo = await notificar({
        clave: `ev_bienvenida:${ed.id}:${hoy}`, tipo: 'evento_bienvenida', nivel: 'urgente',
        titulo: `${ed.ev_eventos?.nombre} · ${ed.nombre}: ${uno ? '1 persona dijo' : l.length + ' personas dijeron'} que sí y no ${uno ? 'ha' : 'han'} recibido nada`,
        detalle: [sinPlantilla ? 'La edición no tiene plantilla de WhatsApp: elígela en la hoja de la edición y las bienvenidas salen solas.' : '', motivos.length ? 'Motivos: ' + motivos.join(' · ') : ''].filter(Boolean).join(' '),
        destino: `eventos?edicion=${ed.id}`, metadata: { edicion_id: ed.id },
      });
      if (nuevo) res.sin_bienvenida++;
    }
  }

  // 4. Pasó y nadie cerró.
  const { data: pasadas } = await supabase.from('ev_ediciones').select('id, nombre, fin, inicio, retro, ev_eventos(nombre)')
    .eq('participacion', 'vamos').lt('inicio', mas(-7));
  for (const ed of (pasadas || []) as any[]) {
    if ((ed.fin || ed.inicio) >= mas(-7) || (ed.retro as any)?.cerrada_at) continue;
    const nuevo = await notificar({
      clave: `ev_retro:${ed.id}`, tipo: 'evento_retro', nivel: 'alerta',
      titulo: `${ed.ev_eventos?.nombre} · ${ed.nombre} ya pasó y no tiene cierre`,
      detalle: 'Qué funcionó, qué no, cuánto costó y si se repite: se escribe ahora que se acuerda, no en seis meses.',
      destino: `eventos?edicion=${ed.id}`, metadata: { edicion_id: ed.id },
    });
    if (nuevo) res.sin_retro++;
  }

  return json({ ok: true, hoy, ...res });
};
