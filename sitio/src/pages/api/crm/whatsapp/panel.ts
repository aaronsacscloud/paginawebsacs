// WHATSAPP · Contexto del panel derecho en UNA llamada.
// GET ?wa_id=<conv> | ?contact_id= | ?company_id=
// → { salud, desde_ultimo, otros_contactos, sugerencias, cotizaciones, sacs, propiedades }
//
// 13 salud: el semáforo de 3 segundos (plan, MRR, renovación, último pago, soporte).
// 14 desde_ultimo: qué pasó desde NUESTRO último mensaje (pagos, aperturas de
//    correo, reuniones, uso de SACS) — cruza tablas que ya existen.
// 15 otros_contactos: la cuenta tiene más personas que este número.
// 16 sugerencias: número desconocido → pistas (emails/nombres en el texto,
//    teléfono parecido) para ligarlo con un clic.
// 30 sacs: la cuenta SACS del cliente sin meter sacs3 (viene del puente).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const waId = url.searchParams.get('wa_id');
  let contactId = url.searchParams.get('contact_id');
  let companyId = url.searchParams.get('company_id');
  let conv: any = null;
  if (waId) {
    const { data } = await supabase.from('wa_conversaciones').select('id, telefono, contact_id, company_id, ultimo_saliente_at, ultimo_entrante_at, created_at').eq('id', waId).maybeSingle();
    conv = data;
    contactId = contactId || conv?.contact_id || null;
    companyId = companyId || conv?.company_id || null;
  }
  if (contactId && !companyId) {
    const { data: ct } = await supabase.from('contacts').select('company_id').eq('id', contactId).maybeSingle();
    companyId = ct?.company_id || null;
  }

  const [{ data: empresa }, { data: contacto }] = await Promise.all([
    companyId ? supabase.from('companies').select('id, nombre, nombre_comercial, plan, mrr, estado_cuenta, fecha_renovacion, health_score, health_factors, last_payment_at, soporte_abiertos, soporte_estancado, sacs_account, uso_sacs, actividad, ultima_venta_at, dias_sin_venta, propiedades, sucursales, giro, tipo_cuenta, pipeline_stage').eq('id', companyId).maybeSingle() : Promise.resolve({ data: null as any }),
    contactId ? supabase.from('contacts').select('id, nombre, apellido, email, created_at, visitor_id, resumen_ia, resumen_ia_at, propiedades, next_followup, proximo_paso, owner_id, lead_score, intencion, calificacion').eq('id', contactId).maybeSingle() : Promise.resolve({ data: null as any }),
  ]);

  // ── 13) salud ──
  let salud: any = null;
  if (empresa) {
    const dias = empresa.fecha_renovacion ? Math.round((new Date(empresa.fecha_renovacion).getTime() - Date.now()) / 86400e3) : null;
    const { count: ticketsAbiertos } = await supabase.from('crm_soporte_tickets').select('id', { count: 'exact', head: true }).eq('company_id', empresa.id).neq('estado', 'resuelto').neq('estado', 'cerrado');
    const nivel = empresa.estado_cuenta === 'cancelado' || empresa.estado_cuenta === 'churned' ? 'rojo'
      : (dias != null && dias < 0) || (empresa.soporte_estancado) || (empresa.health_score != null && empresa.health_score < 40) ? 'rojo'
      : (dias != null && dias <= 15) || (ticketsAbiertos || 0) > 0 || (empresa.health_score != null && empresa.health_score < 70) ? 'ambar' : 'verde';
    salud = {
      nivel, plan: empresa.plan, mrr: empresa.mrr, estado_cuenta: empresa.estado_cuenta,
      fecha_renovacion: empresa.fecha_renovacion, dias_renovacion: dias,
      last_payment_at: empresa.last_payment_at, health_score: empresa.health_score,
      tickets_abiertos: ticketsAbiertos || 0, soporte_estancado: !!empresa.soporte_estancado,
      factores: Array.isArray(empresa.health_factors) ? empresa.health_factors.slice(0, 3) : (empresa.health_factors ? Object.entries(empresa.health_factors).slice(0, 3).map(([k, v]) => `${k}: ${v}`) : []),
    };
  }

  // ── 14) desde nuestro último mensaje ──
  let desde_ultimo: any = null;
  const desde = conv?.ultimo_saliente_at || null;
  if (desde && (contactId || companyId)) {
    const [{ data: pagos }, { data: aperturas }, { data: reuniones }, { data: msjsEm }] = await Promise.all([
      companyId ? supabase.from('payments').select('monto, fecha, estado').eq('company_id', companyId).gte('created_at', desde).limit(20) : Promise.resolve({ data: [] as any[] }),
      contactId ? supabase.from('email_sends').select('opened_at, clicked_at, open_count').eq('contact_id', contactId).gte('first_opened_at', desde).limit(50) : Promise.resolve({ data: [] as any[] }),
      contactId ? supabase.from('bookings').select('fecha, estado').eq('contact_id', contactId).gte('created_at', desde).limit(10) : Promise.resolve({ data: [] as any[] }),
      contactId ? supabase.from('email_conversations').select('id').eq('contact_id', contactId).gte('ultimo_mensaje_at', desde).limit(10) : Promise.resolve({ data: [] as any[] }),
    ]);
    const modulos: any[] = empresa?.uso_sacs?.modulos || [];
    const usoReciente = modulos.filter(m => m.usa && m.ultimo && m.ultimo >= desde.slice(0, 10)).map(m => m.modulo).slice(0, 4);
    desde_ultimo = {
      desde,
      pagos: { n: (pagos || []).length, monto: (pagos || []).reduce((a: number, p: any) => a + Number(p.monto || 0), 0) },
      correos_abiertos: (aperturas || []).length,
      clics: (aperturas || []).filter((a: any) => a.clicked_at).length,
      reuniones: (reuniones || []).length,
      correos_recibidos: (msjsEm || []).length,
      uso_sacs: usoReciente,
    };
  }

  // ── 15) otros contactos de la empresa ──
  let otros_contactos: any[] = [];
  if (companyId) {
    const { data: cts } = await supabase.from('contacts').select('id, nombre, apellido, email, whatsapp, telefono, puesto, rol, es_principal, lifecycle_stage')
      .eq('company_id', companyId).is('archived_at', null).limit(20);
    const ids = (cts || []).map(c => c.id);
    const { data: convs } = ids.length ? await supabase.from('wa_conversaciones').select('id, contact_id, ultimo_mensaje_at').in('contact_id', ids) : { data: [] as any[] };
    otros_contactos = (cts || []).filter(c => c.id !== contactId).map(c => ({
      ...c, nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim(),
      wa_id: (convs || []).find((v: any) => v.contact_id === c.id)?.id || null,
    }));
  }

  // ── 16) sugerencias para número desconocido ──
  let sugerencias: any[] = [];
  if (conv && !conv.contact_id) {
    const { data: msjs } = await supabase.from('wa_mensajes').select('cuerpo, transcript').eq('conversation_id', conv.id).eq('direccion', 'entrante').order('created_at', { ascending: false }).limit(30);
    const texto = (msjs || []).map((m: any) => `${m.cuerpo || ''} ${m.transcript || ''}`).join('\n');
    const emails = [...new Set((texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).map(e => e.toLowerCase()))].slice(0, 5);
    const vistos = new Set<string>();
    const agregar = (c: any, motivo: string) => { if (c && !vistos.has(c.id)) { vistos.add(c.id); sugerencias.push({ id: c.id, nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim(), email: c.email, empresa: c.companies?.nombre_comercial || c.companies?.nombre || null, company_id: c.company_id, motivo }); } };
    if (emails.length) {
      const { data } = await supabase.from('contacts').select('id, nombre, apellido, email, company_id, companies(nombre, nombre_comercial)').in('email', emails).limit(5);
      for (const c of data || []) agregar(c, `Mencionó el correo ${c.email}`);
    }
    // Teléfono parecido (últimos 10 dígitos) guardado en otro formato.
    const dig = String(conv.telefono || '').replace(/\D/g, '').slice(-10);
    if (dig.length === 10) {
      const { data } = await supabase.from('contacts').select('id, nombre, apellido, email, whatsapp, telefono, company_id, companies(nombre, nombre_comercial)').or(`whatsapp.ilike.%${dig},telefono.ilike.%${dig}`).limit(5);
      for (const c of data || []) agregar(c, `Su teléfono termina en ${dig.slice(-4)}`);
    }
    // Nombres propios mencionados ("soy Laura", "habla Pedro de Zapatería X").
    const nombres = [...new Set((texto.match(/\b(?:soy|habla|me llamo|de parte de)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/g) || []).map(m => m.replace(/^(?:soy|habla|me llamo|de parte de)\s+/i, '')))].slice(0, 3);
    for (const n of nombres) {
      const { data } = await supabase.from('contacts').select('id, nombre, apellido, email, company_id, companies(nombre, nombre_comercial)').ilike('nombre', `${n.split(' ')[0]}%`).limit(3);
      for (const c of data || []) agregar(c, `Dijo llamarse ${n}`);
    }
    // Empresas mencionadas por nombre.
    const { data: emps } = await supabase.from('companies').select('id, nombre, nombre_comercial').is('archived_at', null).limit(800);
    const tl = texto.toLowerCase();
    for (const e of emps || []) {
      const n = (e.nombre_comercial || e.nombre || '').toLowerCase();
      if (n.length >= 5 && tl.includes(n)) {
        const { data: cts } = await supabase.from('contacts').select('id, nombre, apellido, email, company_id, companies(nombre, nombre_comercial)').eq('company_id', e.id).limit(2);
        for (const c of cts || []) agregar(c, `Mencionó a ${e.nombre_comercial || e.nombre}`);
        if (sugerencias.length >= 6) break;
      }
    }
    sugerencias = sugerencias.slice(0, 6);
  }

  // ── 9) cotizaciones enviables ──
  let cotizaciones: any[] = [];
  if (companyId || contactId) {
    const q = supabase.from('quotes').select('id, numero, total, moneda, estado, created_at, vigencia, plan, link_pago').order('created_at', { ascending: false }).limit(8);
    const { data } = companyId ? await q.eq('company_id', companyId) : await q.eq('contact_id', contactId!);
    cotizaciones = data || [];
  }

  // ── 30) cuenta SACS ──
  let sacs: any = null;
  if (empresa?.sacs_account) {
    const modulos: any[] = empresa.uso_sacs?.modulos || [];
    sacs = {
      cuenta: empresa.sacs_account,
      cuentas: empresa.uso_sacs?.cuentas || [empresa.sacs_account],
      ultima_venta_at: empresa.ultima_venta_at, dias_sin_venta: empresa.dias_sin_venta,
      modulos_activos: modulos.filter(m => m.usa).sort((a, b) => (b.docs_30d || 0) - (a.docs_30d || 0)).slice(0, 6).map(m => ({ modulo: m.modulo, docs_30d: m.docs_30d, ultimo: m.ultimo })),
      lealtad: empresa.uso_sacs?.lealtad || null,
      actividad: empresa.actividad || null,
    };
  }

  // Visitas al sitio de ESTE contacto. Hoy el rastreador guarda casi todo sin
  // identificar (visitor_id anónimo), así que solo salen las que traen su
  // correo o su visitor_id ligado; el panel lo dice cuando viene vacío.
  let web: any = null;
  if (contactId) {
    // Por contacto ligado, por su correo o por el navegador que ya reconocimos.
    const filtros = [`contact_id.eq.${contactId}`];
    if (contacto?.email) filtros.push(`email.eq.${contacto.email}`);
    if ((contacto as any)?.visitor_id) filtros.push(`visitor_id.eq.${(contacto as any).visitor_id}`);
    const { data: vis } = await supabase.from('contact_visits')
      .select('ruta, titulo, created_at, origen')
      .or(filtros.join(','))
      .not('ruta', 'like', '/admin%')
      .order('created_at', { ascending: false }).limit(15);
    if (vis?.length) {
      const msUltima = Date.now() - new Date(vis[0].created_at).getTime();
      web = {
        total: vis.length,
        ultima: new Date(vis[0].created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        paginas: vis.map(v => ({ ruta: v.titulo || v.ruta, fecha: v.created_at })),
        // "Lo tienes EN el sitio": visita registrada hace menos de 5 minutos.
        en_vivo: msUltima < 5 * 60e3 ? (vis[0].titulo || vis[0].ruta) : null,
      };
    }
  }

  // Llamadas con minuta: el seguimiento de lo hablado, para el panel derecho.
  let llamadas: any[] = [];
  if (conv?.id) {
    const { data: lls } = await supabase.from('wa_llamadas')
      .select('call_id, canal, direccion, estado, duracion_seg, ended_at, created_at, minuta, siguiente_paso, atendida_por_nombre')
      .eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(8);
    llamadas = lls || [];
  }

  return json({
    llamadas, web,
    salud, desde_ultimo, otros_contactos, sugerencias, cotizaciones, sacs,
    propiedades: { empresa: empresa?.propiedades || null, contacto: contacto?.propiedades || null },
    contacto: contacto ? { owner_id: contacto.owner_id, email: (contacto as any).email, created_at: (contacto as any).created_at, resumen_ia: (contacto as any).resumen_ia, resumen_ia_at: (contacto as any).resumen_ia_at, next_followup: contacto.next_followup, proximo_paso: contacto.proximo_paso, lead_score: contacto.lead_score, intencion: contacto.intencion, calificacion: contacto.calificacion } : null,
  });
};
