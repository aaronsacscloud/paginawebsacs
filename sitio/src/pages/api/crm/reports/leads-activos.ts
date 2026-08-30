// GET /api/crm/reports/leads-activos?dias=7 — leads que se movieron, y qué hicieron.
//
// Para qué existe: en el teléfono, «¿a quién le toco hoy?» se contestaba
// entrando al pipeline y leyendo tarjeta por tarjeta. Aquí se responde de un
// vistazo: cuántos leads tuvieron actividad en la ventana, y al abrirlos, qué
// pasó con cada uno, del más reciente al más viejo.
//
// LA DECISIÓN QUE HACE ÚTIL ESTA PANTALLA — no toda "actividad" es actividad.
// Medido sobre 7 días reales: de 600 filas de `activities` de leads, 360 son
// `estatus_cambio` / `stage_change` / `sistema`, o sea la máquina anotándose a
// sí misma, y las MÁS RECIENTES son bienvenidas automáticas. Ordenar por
// created_at a secas dejaba arriba al robot saludando y enterraba al cliente
// que acababa de escribir. Así que se clasifica en tres:
//
//   · DEL LEAD  — te escribió, entró al sitio, abrió el correo, vio la
//                 cotización, agendó o faltó a la demo. Esto es señal: es lo
//                 que justifica levantar el teléfono.
//   · NUESTRA   — le escribimos, le llamamos. Da contexto (¿ya le seguimos?),
//                 no urgencia.
//   · MÁQUINA   — cambios de estatus, etapa, bienvenidas, sistema. NI se
//                 cuenta ni ordena: si contara, todo lead tocado por un cron
//                 aparecería como "activo" y la lista mentiría.
//
// El orden es por la última actividad que cuenta, y cada renglón dice de quién
// fue. `senales` cuenta solo las del lead: dos visitas al sitio y un WhatsApp
// en la misma semana no es lo mismo que un solo correo abierto.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { conMicroCache } from '../../../../lib/crm/micro-cache';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/**
 * PESO DE INTENCIÓN. No todas las señales dicen lo mismo: abrir un correo es
 * casi ruido, abrir la COTIZACIÓN es alguien viendo el precio. Los números no
 * son un modelo, son un orden de importancia deliberado — y por eso el detalle
 * se enseña, para que se pueda discutir en vez de creerle a un número.
 */
const PESO: Record<string, number> = {
  cotizacion_vista: 5, quote_viewed: 5,   // está viendo el precio
  demo_agendada: 5,                       // apartó tiempo suyo
  whatsapp_recibido: 4,                   // se tomó la molestia de escribir
  form_submit: 4,
  demo_realizada: 4,
  email_clicked: 3,
  page_visit: 2, ticket_abierto: 2,
  email_opened: 1, lead_created: 1,
  demo_no_show: 0,                        // hubo intención, pero no llegó
};

/** Lo que hizo el LEAD. Es lo que se puede accionar. */
const DEL_LEAD: Record<string, string> = {
  whatsapp_recibido: 'Te escribió por WhatsApp',
  page_visit: 'Visitó el sitio',
  cotizacion_vista: 'Abrió la cotización',
  quote_viewed: 'Abrió la cotización',
  email_opened: 'Abrió el correo',
  email_clicked: 'Hizo clic en el correo',
  demo_agendada: 'Agendó una demo',
  demo_realizada: 'Tomó la demo',
  demo_no_show: 'No llegó a la demo',
  lead_created: 'Se registró',
  form_submit: 'Llenó un formulario',
  ticket_abierto: 'Abrió un ticket',
};

/** Lo que hicimos NOSOTROS. Contexto, no urgencia. */
const NUESTRA: Record<string, string> = {
  whatsapp_enviado: 'Le escribimos por WhatsApp',
  llamada: 'Le llamamos',
  secuencia_manual: 'Entró a una secuencia',
  nota: 'Nota del equipo',
  email_enviado: 'Le mandamos correo',
};

/* Estas etapas son las que se trabajan. `cliente` ya compró y `churned` /
   `descalificado` están cerradas: meterlas infla el número con gente a la que
   nadie va a llamar. */
const ETAPAS_LEAD = ['lead', 'lead_calificado', 'oportunidad', 'rezagado'];

const _GET: APIRoute = async ({ url }) => {
  const dias = Math.min(90, Math.max(1, Number(url.searchParams.get('dias') || 7)));
  const desde = new Date(Date.now() - dias * 864e5).toISOString();

  const { data: contactos, error: e1 } = await supabase
    .from('contacts')
    .select('id, nombre, email, whatsapp, lifecycle_stage, pipeline_stage, company_id, companies(nombre)')
    .in('lifecycle_stage', ETAPAS_LEAD);
  if (e1) return json({ error: e1.message }, 500);

  const porId = new Map((contactos || []).map((c: any) => [c.id, c]));
  if (!porId.size) return json({ dias, total: 0, leads: [] });

  // Se piden solo los tipos que cuentan: filtrar en el servidor evita traer las
  // ~360 filas de ruido de máquina para tirarlas aquí.
  const tiposUtiles = [...Object.keys(DEL_LEAD), ...Object.keys(NUESTRA)];
  const { data: acts, error: e2 } = await supabase
    .from('activities')
    .select('contact_id, tipo, titulo, descripcion, created_at, metadata')
    .gte('created_at', desde)
    .in('tipo', tiposUtiles)
    .in('contact_id', [...porId.keys()])
    .order('created_at', { ascending: false })
    .limit(4000);
  if (e2) return json({ error: e2.message }, 500);

  const ahora = Date.now();
  const antiguedad = (iso: string) => (ahora - new Date(iso).getTime()) / 864e5;   // en días
  /* Lo de hoy pesa más que lo de hace una semana. La caída es suave a
     propósito: un salto brusco haría que un lead cambie de temperatura por
     cruzar la medianoche. */
  const frescura = (iso: string) => { const d = antiguedad(iso); return d < 1 ? 1 : d < 3 ? 0.75 : d < 6 ? 0.5 : 0.3; };

  const porLead = new Map<string, any>();
  for (const a of acts || []) {
    const c = porId.get(a.contact_id);
    if (!c) continue;
    const delLead = !!DEL_LEAD[a.tipo];
    let f = porLead.get(a.contact_id);
    if (!f) {
      f = {
        id: c.id,
        nombre: c.nombre || 'Sin nombre',
        empresa: (c as any).companies?.nombre || null,
        whatsapp: c.whatsapp || null,
        email: c.email || null,
        ciclo: c.lifecycle_stage || null,
        etapa: c.pipeline_stage || null,
        senales: 0,
        puntos: 0,
        // Para saber si está subiendo o enfriándose sin pedir otra consulta.
        senales_3d: 0, senales_antes: 0,
        tipos: {} as Record<string, number>,
        wa_conversation_id: null as string | null,
        ultima: null as any,
        linea: [] as any[],
      };
      porLead.set(a.contact_id, f);
    }
    const item = {
      tipo: a.tipo,
      de: delLead ? 'lead' : 'nosotros',
      que: (delLead ? DEL_LEAD : NUESTRA)[a.tipo] || a.tipo,
      detalle: a.titulo || a.descripcion || null,
      cuando: a.created_at,
      peso: delLead ? (PESO[a.tipo] ?? 1) : 0,
    };
    if (delLead) {
      f.senales++;
      f.tipos[a.tipo] = (f.tipos[a.tipo] || 0) + 1;
      f.puntos += (PESO[a.tipo] ?? 1) * frescura(a.created_at);
      if (antiguedad(a.created_at) < 3) f.senales_3d++; else f.senales_antes++;
    }
    if (!f.wa_conversation_id && a.metadata?.wa_conversation_id) f.wa_conversation_id = a.metadata.wa_conversation_id;
    // `acts` viene de más nuevo a más viejo: la primera de cada lead es la última.
    if (!f.ultima) f.ultima = item;
    if (f.linea.length < 25) f.linea.push(item);
  }

  const leads = [...porLead.values()].map(f => {
    f.puntos = Math.round(f.puntos * 10) / 10;
    /* Tres cajones, no un número suelto: «7.4» no le dice nada a nadie y
       además finge una precisión que no existe. El corte se eligió mirando la
       distribución real (la mayoría de los leads tiene 1 sola señal). */
    f.temperatura = f.puntos >= 6 ? 'caliente' : f.puntos >= 2.5 ? 'tibio' : 'frio';
    /* DE QUIÉN ES LA PELOTA — el dato más accionable de toda la pantalla.
       Medido hoy: 13 leads esperando respuesta SUYA y 10 esperando la NUESTRA.
       Son dos listas de trabajo distintas y estaban mezcladas. */
    f.pelota = f.ultima?.de === 'lead' ? 'nosotros' : 'ellos';
    f.horas_esperando = f.ultima ? Math.round(antiguedad(f.ultima.cuando) * 24) : null;
    /* Subiendo / enfriándose: comparar los últimos 3 días contra el resto de
       la ventana. Un lead que dio 5 señales el lunes y ninguna desde entonces
       NO es lo mismo que uno que dio 2 ayer, aunque sumen parecido. */
    f.tendencia = f.senales_3d > f.senales_antes ? 'subiendo'
      : (f.senales_3d === 0 && f.senales_antes > 0) ? 'enfriandose' : 'estable';
    return f;
  }).sort((a, b) => (a.ultima?.cuando < b.ultima?.cuando ? 1 : -1));
  return json({
    dias,
    total: leads.length,
    // Los que además hicieron algo ellos: es el subconjunto accionable y se
    // dice aparte para poder destacarlo sin recalcular en el cliente.
    con_senal: leads.filter(l => l.senales > 0).length,
    // Contadores para los filtros: se calculan aquí una vez y no en cada
    // pintada del cliente, que además tendría que rehacerlos por pestaña.
    conteos: {
      pelota_nosotros: leads.filter(l => l.pelota === 'nosotros').length,
      pelota_ellos: leads.filter(l => l.pelota === 'ellos').length,
      caliente: leads.filter(l => l.temperatura === 'caliente').length,
      enfriandose: leads.filter(l => l.tendencia === 'enfriandose').length,
      por_tipo: [...leads.reduce((m, l) => {
        for (const [t, n] of Object.entries(l.tipos as Record<string, number>)) m.set(t, (m.get(t) || 0) + (n as number));
        return m;
      }, new Map<string, number>())].map(([tipo, n]) => ({ tipo, etiqueta: DEL_LEAD[tipo] || tipo, n }))
        .sort((a, b) => b.n - a.n),
    },
    leads: leads.slice(0, 100),
  });
};

/* 20 s de micro-caché: la pantalla de Inicio la abre cada quien varias veces al
   día y esta consulta cruza contactos con actividades. No más, porque el
   sentido de la lista es enterarte de lo que acaba de pasar. */
export const GET = conMicroCache('reports/leads-activos', 20000, _GET as any);
