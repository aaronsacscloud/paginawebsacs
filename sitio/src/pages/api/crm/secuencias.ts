// CRM · SECUENCIAS multi-canal: la config completa de cada secuencia
// (reglas, pasos WhatsApp+correo, ventana) y sus métricas de rendimiento.
//   GET  → { secuencias: [{...sec, pasos, metricas}] }
//   POST → crea o actualiza {id?, nombre, descripcion, activa, corte_dias,
//          hora_inicio, hora_fin, pasos: [{dia, canal, email_template_id|wa_plantilla, activo}]}
//   DELETE ?id= → borra (cascade lleva pasos y miembros)
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => {
  const [{ data: secs }, { data: pasos }, { data: mets }, { data: pstats }, { data: rslt }] = await Promise.all([
    supabase.from('crm_secuencias').select('*').order('created_at'),
    supabase.from('crm_secuencia_pasos').select('*').order('orden'),
    supabase.rpc('crm_secuencias_metricas'),
    supabase.rpc('crm_secuencia_pasos_stats'),
    // Lo que RESULTÓ, por canal. Las métricas de arriba cuentan envíos;
    // "mandé 40 correos y 12 WhatsApps" no dice si la cadencia sirvió.
    supabase.rpc('crm_secuencias_resultados'),
  ]);
  const porSec = new Map<string, any[]>();
  for (const p of pasos || []) { const a = porSec.get(p.secuencia_id) || []; a.push(p); porSec.set(p.secuencia_id, a); }
  const metPor = new Map<string, any>((mets || []).map((m: any) => [m.secuencia_id, m]));
  const resPor = new Map<string, any>((rslt || []).map((r: any) => [r.secuencia_id, r]));
  return json({
    secuencias: (secs || []).map(s => ({
      ...s, pasos: porSec.get(s.id) || [],
      metricas: metPor.get(s.id) || { en_secuencia: 0, entraron: 0, salidas: {}, correos: 0, whatsapps: 0 },
      resultados: resPor.get(s.id) || null,
      stats_correo: (pstats || []).filter((x: any) => x.secuencia_id === s.id),
    })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b?.nombre?.trim()) return json({ error: 'Falta el nombre' }, 400);
  const fila: any = {
    nombre: String(b.nombre).trim().slice(0, 120),
    descripcion: String(b.descripcion || '').slice(0, 500) || null,
    activa: !!b.activa,
    corte_dias: Math.max(1, Math.min(60, Number(b.corte_dias) || 14)),
    hora_inicio: Math.max(0, Math.min(23, Number(b.hora_inicio) ?? 10)),
    hora_fin: Math.max(1, Math.min(24, Number(b.hora_fin) ?? 18)),
  };
  if (['respondio', 'agendo', 'demo_hecha', 'convertido'].includes(b.objetivo)) fila.objetivo = b.objetivo;
  if (['arco', 'permanente'].includes(b.modo)) fila.modo = b.modo;
  if (b.acciones && typeof b.acciones === 'object') fila.acciones = b.acciones;
  if (Array.isArray(b.blackout)) {
    fila.blackout = b.blackout
      .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r?.desde) && /^\d{4}-\d{2}-\d{2}$/.test(r?.hasta))
      .slice(0, 12);
  }
  // Días de la semana en que SÍ envía (1=lun … 7=dom) y reglas de entrada.
  if (Array.isArray(b.dias_envio)) {
    const ds = b.dias_envio.map(Number).filter((d: number) => d >= 1 && d <= 7);
    if (ds.length) fila.dias_envio = [...new Set(ds)].sort();
  }
  // ── Secuencia por EVENTO ──
  // Con disparador 'wa_entrante' no hay estatus, ni etapa, ni días: la entrada
  // guarda las reglas de qué pasa cuando el lead nos escribe. Se valida aparte
  // porque nada del bloque de abajo aplica.
  if (b.disparador === 'wa_entrante') {
    const e = b.entrada && typeof b.entrada === 'object' ? b.entrada : {};
    const s0 = (x: any, max = 900) => String(x ?? '').slice(0, max);
    const dias = Array.isArray(e.horario?.dias)
      ? [...new Set(e.horario.dias.map(Number).filter((d: number) => d >= 1 && d <= 7))].sort()
      : [1, 2, 3, 4, 5, 6];
    const hora = (x: any, d: string) => (/^\d{2}:\d{2}$/.test(String(x)) ? String(x) : d);
    fila.disparador = 'wa_entrante';
    fila.entrada = {
      acuse: {
        activo: e.acuse?.activo !== false,
        en_horario: s0(e.acuse?.en_horario),
        fuera: s0(e.acuse?.fuera),
        // Nunca menos de 1 h: con 0 le contestaríamos lo mismo a cada mensaje.
        rearme_horas: Math.max(1, Math.min(168, Number(e.acuse?.rearme_horas) || 20)),
        // 0 = apagar el silencio (vuelve al comportamiento viejo); nunca negativo.
        silencio_humano_horas: Math.max(0, Math.min(168, Number(e.acuse?.silencio_humano_horas ?? 6))),
      },
      horario: { dias, desde: hora(e.horario?.desde, '09:00'), hasta: hora(e.horario?.hasta, '19:00') },
      presion: {
        // Tope duro de 1 h aunque la pantalla mande 0: nadie debe poder
        // configurar "un WhatsApp por minuto" desde una caja de texto.
        horas_entre_whatsapps: Math.max(1, Math.min(168, Number(e.presion?.horas_entre_whatsapps) || 24)),
        dias_pausa_por_manual: Math.max(0, Math.min(30, Number(e.presion?.dias_pausa_por_manual) ?? 5)),
        permitir_forzar_manual: e.presion?.permitir_forzar_manual !== false,
      },
      intencion: {
        etiquetar: e.intencion?.etiquetar !== false,
        notificar: e.intencion?.notificar !== false,
        solo_desde_cta: e.intencion?.solo_desde_cta !== false,
      },
      cierre: { bloquear_con_no_leidos: e.cierre?.bloquear_con_no_leidos !== false },
    };
  } else if (b.entrada && typeof b.entrada === 'object') {
    const ESTATUS_OK = ['nuevo', 'contactado', 'sin_respuesta', 'respondio', 'descubrimiento', 'agendado'];
    const LIFECYCLE_OK = ['lead', 'lead_calificado', 'oportunidad', 'cliente', 'rezagado'];
    const est = Array.isArray(b.entrada.estatus) ? b.entrada.estatus.filter((x: string) => ESTATUS_OK.includes(x)) : [];
    const estFinal = est.length ? est : ['contactado', 'sin_respuesta'];
    // Quien agendó ya es Oportunidad: la entrada debe alcanzarlo en esa etapa.
    const lifecycle = Array.isArray(b.entrada.lifecycle) && b.entrada.lifecycle.length
      ? b.entrada.lifecycle.filter((x: string) => LIFECYCLE_OK.includes(x))
      : (estFinal.includes('agendado') ? ['lead', 'lead_calificado', 'oportunidad'] : ['lead', 'lead_calificado']);

    // Tercera dimensión de la entrada: el MISMO filtro que se usa en la pestaña
    // de Leads. Estatus y etapa son la red gruesa; esto es la fina — «marcas de
    // moda con 2+ sucursales que ya usan un sistema», por ejemplo. Se guardan
    // las condiciones tal cual y el cron las evalúa con cumpleCondsLead, así
    // que filtrar en la lista y filtrar para inscribir son literalmente lo
    // mismo: lo que ves es lo que entra.
    const filtros = Array.isArray(b.entrada.filtros)
      ? b.entrada.filtros.filter((f: any) => f && typeof f.campo === 'string' && typeof f.op === 'string').slice(0, 12)
      : [];
    const logica = b.entrada.logica === 'OR' ? 'OR' : 'AND';
    // ── El ancla: desde qué fecha cuenta esta cadencia ──
    // 'estatus_lead_at' sirve para las de lead. Las de onboarding necesitan
    // 'prueba_inicio', porque mover a alguien a la etapa de prueba no toca el
    // estatus y el corte lo descartaría con una fecha de hace meses.
    const ANCLAS = ['estatus_lead_at', 'prueba_inicio', 'created_at'];
    const ancla = ANCLAS.includes(b.entrada.ancla) ? b.entrada.ancla : 'estatus_lead_at';
    fila.entrada = { estatus: estFinal, lifecycle, filtros, logica, ancla };
  }
  // ── No se prende una cadencia vacía ──
  // Hoy "Rezagados" se podía activar con cero pasos y no hacer absolutamente
  // nada, en silencio — el peor modo de falla que hay, porque parece que
  // funciona. Una permanente además necesita fondo: con 30 pasos cada 14 días
  // son catorce meses de contenido, que es lo que dura estar en top of mind sin
  // repetirse. Un arco solo necesita tener algo.
  if (b.activa) {
    const nPasos = Array.isArray(b.pasos)
      ? b.pasos.filter((p: any) => p?.activo !== false && (p.email_template_id || p.wa_plantilla || p.inapp_campana_id)).length
      : 0;
    const minimo = b.modo === 'permanente' ? 30 : 1;
    if (nPasos < minimo) {
      return json({
        error: b.modo === 'permanente'
          ? `Una cadencia permanente necesita al menos ${minimo} pasos entre correos y WhatsApp — lleva ${nPasos}. Con menos se repite y deja de servir para estar en top of mind.`
          : 'No se puede prender una secuencia sin pasos: no haría nada y parecería que sí.',
        faltan: minimo - nPasos,
      }, 400);
    }
  }

  let id = b.id || null;
  if (id) {
    const { error } = await supabase.from('crm_secuencias').update(fila).eq('id', id);
    if (error) return json({ error: error.message }, 500);
  } else {
    const { data, error } = await supabase.from('crm_secuencias').insert(fila).select('id').single();
    if (error) return json({ error: error.message }, 500);
    id = data.id;
  }
  if (Array.isArray(b.pasos)) {
    /* ⚠️ ESTE BLOQUE BORRA Y REINSERTA. Todo campo que no se copie aquí se
       PIERDE al guardar desde la pantalla — sin error y sin aviso.
       Ya casi cuesta caro: `dia_semana` (los carriles lunes/miércoles/viernes
       de la cadencia permanente) no estaba en el mapeo ni en el editor, así que
       el primer «Guardar» habría aplanado 34 pasos en una sola fila y nadie se
       habría enterado hasta ver que todos los leads reciben insights tres veces
       por semana. Si agregas una columna al paso, agrégala TAMBIÉN aquí. */
    const filas = b.pasos
      .filter((p: any) => p.dia && ['correo', 'wa', 'inapp'].includes(p.canal))
      .map((p: any, i: number) => ({
        secuencia_id: id, orden: Number(p.orden) || (i + 1) * 10, dia: Math.max(1, Number(p.dia) || 1), canal: p.canal,
        email_template_id: p.canal === 'correo' ? (p.email_template_id || null) : null,
        email_template_id_b: p.canal === 'correo' ? (p.email_template_id_b || null) : null,
        wa_plantilla: p.canal === 'wa' ? (String(p.wa_plantilla || '').trim() || null) : null,
        inapp_campana_id: p.canal === 'inapp' ? (p.inapp_campana_id || null) : null,
        dia_semana: p.dia_semana ? Math.max(1, Math.min(7, Number(p.dia_semana))) : null,
        vigente_hasta: p.vigente_hasta || null,
        activo: p.activo !== false,
      }));

    /* Candado contra el aplanado: si la secuencia HOY tiene carriles y lo que
       llega no trae ninguno, es que el editor no los conoce — no que alguien
       quisiera quitarlos. Se rechaza en vez de destruirlos. */
    const { data: previos } = await supabase.from('crm_secuencia_pasos')
      .select('dia_semana').eq('secuencia_id', id);
    const teniaCarriles = (previos || []).some((p: any) => p.dia_semana);
    const traeCarriles = filas.some((f: any) => f.dia_semana);
    if (teniaCarriles && !traeCarriles) {
      return json({ error: 'Esta secuencia tiene carriles por día de la semana y lo que llegó no los trae. No se guardó nada para no aplanarla.' }, 409);
    }
    /* Un paso in-app sin campaña se saltaría en silencio. La base también lo
       impide, pero un error de restricción no le dice nada a quien edita. */
    const sinCampana = filas.filter((f: any) => f.canal === 'inapp' && !f.inapp_campana_id).length;
    if (sinCampana) return json({ error: `Hay ${sinCampana} paso(s) dentro de Sacs sin campaña elegida.` }, 400);

    const { error: e1 } = await supabase.from('crm_secuencia_pasos').delete().eq('secuencia_id', id);
    if (e1) return json({ error: e1.message }, 500);
    if (filas.length) {
      const { error: e2 } = await supabase.from('crm_secuencia_pasos').insert(filas);
      if (e2) return json({ error: e2.message }, 500);
    }
  }
  return json({ ok: true, id });
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  const { error } = await supabase.from('crm_secuencias').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
