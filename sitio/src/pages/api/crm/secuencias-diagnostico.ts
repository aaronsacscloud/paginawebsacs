/**
 * GET /api/crm/secuencias-diagnostico?secuencia_id=…&contact_id=…
 *
 * «¿Por qué este lead no entró a esta cadencia?»
 *
 * Existe porque el simulacro dice «enrolados: 0» y ahí se acaba la
 * información. No sabes si fue el estatus, la etapa, el filtro fino, el ancla,
 * el corte, la baja o que ya está adentro — y averiguarlo son cinco consultas
 * a mano. Pasó varias veces armando estas cadencias, y cada vez costó tiempo
 * que no cuesta nada ahorrar.
 *
 * Devuelve TODAS las razones, no la primera: si un lead falla por tres motivos
 * y solo enseñamos uno, se arregla ese y vuelve a no entrar.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { cumpleCondsLead } from '../../../lib/crm/leads-filtros';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user || !['founder', 'cs'].includes(String((user as any).role || ''))) {
    return json({ error: 'Solo el equipo interno.' }, 403);
  }

  const secId = url.searchParams.get('secuencia_id') || '';
  const contactId = url.searchParams.get('contact_id') || '';
  if (!secId || !contactId) return json({ error: 'Faltan secuencia_id y contact_id' }, 400);

  const [{ data: sec }, { data: c }] = await Promise.all([
    supabase.from('crm_secuencias').select('*').eq('id', secId).maybeSingle(),
    supabase.from('contacts').select('*').eq('id', contactId).maybeSingle(),
  ]);
  if (!sec) return json({ error: 'Esa secuencia no existe' }, 404);
  if (!c) return json({ error: 'Ese contacto no existe' }, 404);

  const entrada: any = sec.entrada || {};
  const motivos: { regla: string; explicacion: string }[] = [];

  // ── Lo de la secuencia ──
  if (!sec.activa) motivos.push({ regla: 'secuencia apagada', explicacion: 'La secuencia no está prendida, así que no procesa a nadie.' });

  const hoy = new Date().toISOString().slice(0, 10);
  const enBlackout = (Array.isArray(sec.blackout) ? sec.blackout : [])
    .find((b: any) => b?.desde && b?.hasta && hoy >= b.desde && hoy <= b.hasta);
  if (enBlackout) motivos.push({ regla: 'blackout', explicacion: `Hoy cae dentro del rango congelado ${enBlackout.desde} → ${enBlackout.hasta}.` });

  // ── Lo del contacto: la red gruesa ──
  const estatusIn: string[] = entrada.estatus?.length ? entrada.estatus : ['contactado', 'sin_respuesta'];
  const lifecycleIn: string[] = entrada.lifecycle?.length ? entrada.lifecycle : ['lead', 'lead_calificado'];
  if (!estatusIn.includes(c.estatus_lead)) {
    motivos.push({ regla: 'estatus', explicacion: `Su estatus es «${c.estatus_lead}» y la entrada pide ${estatusIn.join(', ')}.` });
  }
  if (!lifecycleIn.includes(c.lifecycle_stage)) {
    motivos.push({ regla: 'etapa', explicacion: `Su etapa es «${c.lifecycle_stage}» y la entrada pide ${lifecycleIn.join(', ')}.` });
  }
  if (c.archived_at) motivos.push({ regla: 'archivado', explicacion: 'Está archivado.' });
  if (c.wa_optout) motivos.push({ regla: 'optout de WhatsApp', explicacion: 'Pidió no recibir WhatsApp, y la consulta de candidatos exige wa_optout = false.' });

  // ── El ancla y el corte: el que más cuesta ver ──
  const ancla = String(entrada.ancla || 'estatus_lead_at');
  const fecha = ancla === 'prueba_inicio' ? c.prueba_inicio
              : ancla === 'created_at' ? c.created_at
              : ((c.propiedades as any)?.tiktok?.creado || c.estatus_lead_at);
  if (ancla !== 'estatus_lead_at' && !fecha) {
    motivos.push({ regla: 'sin fecha de ancla', explicacion: `Esta secuencia cuenta desde «${ancla}» y este contacto no la tiene. Entrar sin ella sería mandarle el día 1 en su día 9.` });
  } else if (fecha) {
    const d = Math.floor((Date.now() - Date.parse(fecha)) / 86400000);
    if (d > sec.corte_dias) {
      motivos.push({ regla: 'corte', explicacion: `Su ancla (${ancla}) es de hace ${d} días y el corte de la secuencia es de ${sec.corte_dias}.` });
    }
  }

  // ── El filtro fino, con la MISMA función que usa el cron ──
  const filtros = Array.isArray(entrada.filtros) ? entrada.filtros : [];
  if (filtros.length) {
    // Las condiciones de web necesitan datos que no viven en contacts.
    if (filtros.some((f: any) => f.campo === 'visitas_n' || f.campo === 'visito_ruta')) {
      const { data: vis } = await supabase.from('contact_visits')
        .select('ruta').eq('contact_id', contactId)
        .gte('created_at', new Date(Date.now() - 90 * 864e5).toISOString()).limit(500);
      (c as any).rutas_recientes = (vis || []).map(v => v.ruta);
      (c as any).visitas_recientes = (vis || []).length;
    }
    const pasa = cumpleCondsLead(c, filtros, entrada.logica === 'OR' ? 'OR' : 'AND');
    if (!pasa) {
      // Cuál de las condiciones falla, una por una: decir «el filtro» no ayuda.
      const fallan = filtros.filter((f: any) => !cumpleCondsLead(c, [f], 'AND'))
        .map((f: any) => `${f.campo} ${f.op} ${f.valor}`);
      motivos.push({ regla: 'filtro', explicacion: `No cumple: ${fallan.join(' · ')}.` });
    }
  }

  // ── ¿Ya está adentro? ──
  const { data: miembro } = await supabase.from('crm_secuencia_miembros')
    .select('inicio, detenida_at, motivo, enviados').eq('secuencia_id', secId).eq('contact_id', contactId).maybeSingle();
  if (miembro && !miembro.detenida_at) {
    motivos.push({ regla: 'ya está dentro', explicacion: `Entró el ${String(miembro.inicio).slice(0, 10)} y lleva ${Object.keys(miembro.enviados || {}).length} pasos enviados. No es que no entre: ya entró.` });
  } else if (miembro?.detenida_at) {
    motivos.push({ regla: 'ya salió', explicacion: `Salió el ${String(miembro.detenida_at).slice(0, 10)} por «${miembro.motivo}». Solo vuelve a entrar si levanta la mano otra vez o si su salida tiene más de 90 días.` });
  }

  return json({
    entra: motivos.length === 0,
    contacto: { nombre: [c.nombre, c.apellido].filter(Boolean).join(' ').trim(), estatus: c.estatus_lead, etapa: c.lifecycle_stage },
    secuencia: { nombre: sec.nombre, modo: sec.modo, activa: sec.activa },
    motivos,
    resumen: motivos.length === 0
      ? 'Cumple todo: entraría en la próxima corrida.'
      : `No entra por ${motivos.length} ${motivos.length > 1 ? 'razones' : 'razón'}.`,
  });
};
