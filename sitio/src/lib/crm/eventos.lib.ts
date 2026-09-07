// Ferias y eventos físicos · lo que comparten el CRM, el modo stand y la liga pública del QR.
//
// Tres reglas que no se negocian:
//   1. Un registro del evento ES un contacto del CRM. No hay lista paralela: la persona que
//      conocimos en Intermoda entra a `contacts` con fuente «evento:intermoda», y desde ahí la
//      trabajan los mismos motores que a cualquier lead (agente, cadencias, reuniones, deals).
//      Si más tarde llena el formulario de la web, el anti-duplicado la reconoce y la fuente
//      original se conserva: la feria se lleva el crédito que le toca.
//   2. Nadie recibe un mensaje sin haber dicho que sí. `consentimiento` se guarda con hora.
//   3. El teléfono en el stand no tiene red. El registro se acepta con `cliente_local_id` y
//      se puede reintentar: dos veces el mismo id = un solo registro.
import { supabase } from '../supabase';
import { limpiar } from './abm.lib';

export const TIPOS: Record<string, string> = {
  feria_comercial: 'Feria comercial (B2B)', expo_consumidor: 'Expo al público', zona_mayoreo: 'Zona de mayoreo',
  semana_moda: 'Semana de la moda', congreso: 'Congreso', feria_retail_tech: 'Retail y tecnología',
};
export const ROLES: Record<string, string> = { stand: 'Poner stand', recorrido: 'Recorrer pasillos', visitante: 'Ir como visitante', patrocinio: 'Patrocinar', no_ir: 'No ir' };
export const DECISION: Record<string, string> = { ir: 'Vamos', evaluar: 'Por evaluar', no_ir: 'No vamos' };
export const PARTICIPACION: Record<string, string> = { sin_decidir: 'Sin decidir', vamos: 'Vamos', no_vamos: 'No vamos', fuimos: 'Fuimos' };
export const CATEGORIAS_GASTO: Record<string, string> = { stand: 'Stand', viaje: 'Viajes y hospedaje', material: 'Material e impresos', personal: 'Personal', muestras: 'Regalos y muestras', otro: 'Otro' };

export const tel10 = (t?: string | null) => String(t || '').replace(/\D/g, '').slice(-10);
export const telE164 = (t?: string | null) => { const d = tel10(t); return d.length === 10 ? '+52' + d : null; };

/* ── La lista de preparación. Días relativos al inicio (negativo = antes). ── */
export const TAREAS_PLANTILLA: Record<string, { clave: string; dias: number; fase: 'antes' | 'durante' | 'despues'; titulo: string }[]> = {
  stand: [
    { clave: 'apartar', dias: -120, fase: 'antes', titulo: 'Apartar el stand y pagar el anticipo (los buenos lugares se acaban meses antes)' },
    { clave: 'ubicacion', dias: -90, fase: 'antes', titulo: 'Confirmar ubicación y medidas del stand; pedir el plano del pabellón' },
    { clave: 'diseno', dias: -60, fase: 'antes', titulo: 'Diseñar el stand y mandar a imprimir lona, banner y tarjetas' },
    { clave: 'demo', dias: -45, fase: 'antes', titulo: 'Preparar la cuenta demo con productos del giro que va a este evento' },
    { clave: 'oferta', dias: -30, fase: 'antes', titulo: 'Definir la oferta del evento (regalo por registrarse) y la plantilla de WhatsApp de bienvenida aprobada por Meta' },
    { clave: 'equipo', dias: -21, fase: 'antes', titulo: 'Confirmar equipo, viajes y hospedaje' },
    { clave: 'qr', dias: -14, fase: 'antes', titulo: 'Imprimir el QR de registro y probar el modo stand SIN internet' },
    { clave: 'internet', dias: -7, fase: 'antes', titulo: 'Módem propio, extensiones, pantalla, cargadores, hojas de respaldo' },
    { clave: 'expositores', dias: -3, fase: 'antes', titulo: 'Cargar la lista de expositores que son prospecto (a quién buscar en pasillos)' },
    { clave: 'montaje', dias: -1, fase: 'antes', titulo: 'Montaje y prueba de la demo en el stand' },
    { clave: 'meta_dia', dias: 0, fase: 'durante', titulo: 'Cada tarde: registros del día contra la meta, y demos agendadas' },
    { clave: 'bienvenida', dias: 0, fase: 'durante', titulo: 'Revisar que los WhatsApp de bienvenida están llegando (no al final)' },
    { clave: 'sin_seguimiento', dias: 1, fase: 'despues', titulo: 'Nadie sin bienvenida: revisar los registros que no recibieron mensaje' },
    { clave: 'calientes', dias: 2, fase: 'despues', titulo: 'Llamar a los calientes (antes de que los llame la competencia)' },
    { clave: 'tibios', dias: 7, fase: 'despues', titulo: 'Correo de seguimiento a tibios con el diagnóstico de su negocio' },
    { clave: 'retro', dias: 14, fase: 'despues', titulo: 'Cerrar la retrospectiva: qué funcionó, qué no, repetir sí o no' },
    { clave: 'conversion', dias: 30, fase: 'despues', titulo: 'Medir conversión y costo por cliente; decidir la siguiente edición' },
  ],
  recorrido: [
    { clave: 'registro', dias: -45, fase: 'antes', titulo: 'Registrarse como comprador/visitante (muchas ferias piden acreditación)' },
    { clave: 'expositores', dias: -30, fase: 'antes', titulo: 'Cargar la lista de expositores que son prospecto y ordenarla por puntaje' },
    { clave: 'ruta', dias: -7, fase: 'antes', titulo: 'Armar la ruta por pabellón y stand; repartir pasillos entre el equipo' },
    { clave: 'material', dias: -3, fase: 'antes', titulo: 'Tarjetas, QR del registro y la demo en el teléfono sin internet' },
    { clave: 'visitas', dias: 0, fase: 'durante', titulo: 'Visitar los stands por orden de puntaje y registrar cada visita en el momento' },
    { clave: 'sin_seguimiento', dias: 1, fase: 'despues', titulo: 'Nadie sin bienvenida: revisar los registros que no recibieron mensaje' },
    { clave: 'calientes', dias: 2, fase: 'despues', titulo: 'Llamar a los calientes' },
    { clave: 'retro', dias: 14, fase: 'despues', titulo: 'Cerrar la retrospectiva: qué funcionó, qué no, repetir sí o no' },
    { clave: 'conversion', dias: 30, fase: 'despues', titulo: 'Medir conversión y costo por cliente; decidir la siguiente edición' },
  ],
};
TAREAS_PLANTILLA.visitante = TAREAS_PLANTILLA.recorrido;
TAREAS_PLANTILLA.patrocinio = TAREAS_PLANTILLA.stand;

const sumar = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Genera (o completa) la lista de preparación de una edición según su rol. No duplica: va por clave. */
export async function generarTareas(edicionId: string) {
  const { data: ed } = await supabase.from('ev_ediciones').select('id, inicio, fin, rol').eq('id', edicionId).maybeSingle();
  if (!ed) return { ok: false, motivo: 'edición no existe' };
  // Lo de antes cuenta desde el inicio; lo de después, desde que TERMINA (una
  // feria de 4 días tenía "llamar a los calientes" antes del último día).
  const base = (t: { fase: string }) => t.fase === 'despues' ? (ed.fin || ed.inicio) : ed.inicio;
  const lista = TAREAS_PLANTILLA[ed.rol || 'stand'] || TAREAS_PLANTILLA.stand;
  const { data: ya } = await supabase.from('ev_tareas').select('clave').eq('edicion_id', edicionId);
  const tengo = new Set((ya || []).map((t: any) => t.clave));
  const nuevas = lista.filter(t => !tengo.has(t.clave)).map((t, i) => ({
    edicion_id: edicionId, titulo: t.titulo, fase: t.fase, vence: sumar(base(t), t.dias), orden: i, clave: t.clave,
  }));
  if (nuevas.length) { const { error } = await supabase.from('ev_tareas').insert(nuevas); if (error) return { ok: false, motivo: error.message }; }
  return { ok: true, creadas: nuevas.length };
}

/* ── Registrar a una persona conocida en el evento ────────────────────────── */
export interface Registro {
  edicion_id: string;
  modo?: 'stand' | 'recorrido' | 'qr';
  nombre?: string; empresa?: string; puesto?: string; giro?: string; sucursales?: number | string | null;
  sistema_actual?: string; whatsapp?: string; email?: string; ciudad?: string; instagram?: string;
  temperatura?: 'caliente' | 'tibio' | 'frio'; quiere_demo?: boolean; interes?: string; nota?: string; foto_url?: string;
  stand_visitado?: string; consentimiento?: boolean;
  cliente_local_id?: string; capturado_por?: string | null; capturado_por_nombre?: string | null;
  abm_cuenta_id?: string | null;
}

export async function registrar(r: Registro): Promise<{ ok: boolean; id?: string; contact_id?: string; duplicado?: boolean; ya_era?: string | null; motivo?: string }> {
  const { data: ed } = await supabase.from('ev_ediciones').select('id, nombre, evento_id, plantilla_wa, email_bienvenida, ev_eventos(slug, nombre)').eq('id', r.edicion_id).maybeSingle();
  if (!ed) return { ok: false, motivo: 'edición no existe' };
  const ev: any = (ed as any).ev_eventos;

  const nombre = limpiar(r.nombre, 120) || null;
  const email = limpiar(r.email, 160).toLowerCase() || null;
  const wa = telE164(r.whatsapp);
  if (!nombre && !email && !wa) return { ok: false, motivo: 'se necesita al menos nombre, WhatsApp o correo' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, motivo: 'correo con forma inválida' };

  // Mismo teléfono sin red que ya sincronizó: no se registra dos veces.
  if (r.cliente_local_id) {
    const { data: prev } = await supabase.from('ev_registros').select('id, contact_id').eq('edicion_id', r.edicion_id).eq('cliente_local_id', r.cliente_local_id).maybeSingle();
    if (prev) return { ok: true, id: prev.id, contact_id: prev.contact_id || undefined, duplicado: true };
  }

  // ¿Ya lo conocíamos? Por teléfono o correo, en contactos reales.
  let contacto: any = null;
  if (email) ({ data: contacto } = await supabase.from('contacts').select('id, nombre, lifecycle_stage, fuente, company_id').eq('email', email).is('archived_at', null).limit(1).maybeSingle());
  if (!contacto && wa) {
    const { data } = await supabase.from('contacts').select('id, nombre, lifecycle_stage, fuente, company_id').is('archived_at', null)
      .or(`whatsapp.ilike.%${tel10(wa)},telefono.ilike.%${tel10(wa)}`).limit(1).maybeSingle();
    contacto = data;
  }
  let ya_era: string | null = null;
  if (contacto) ya_era = contacto.lifecycle_stage === 'cliente' ? 'cliente' : 'contacto';

  // ¿Es una cuenta objetivo? Por id (recorrido) o por teléfono/correo en sus canales.
  let abmId: string | null = r.abm_cuenta_id || null;
  if (!abmId && (wa || email)) {
    const ors = [wa ? `valor.ilike.%${tel10(wa)}` : null, email ? `valor.eq.${email}` : null].filter(Boolean).join(',');
    const { data: can } = await supabase.from('abm_canales').select('cuenta_id').or(ors).limit(1).maybeSingle();
    if (can?.cuenta_id) abmId = can.cuenta_id;
  }
  if (abmId && !ya_era) ya_era = 'cuenta_objetivo';

  const fuente = `evento:${ev?.slug || 'evento'}`;
  const campana = ed.nombre;
  let contactId: string | null = contacto?.id || null;
  if (!contactId) {
    const { data: nuevo, error } = await supabase.from('contacts').insert({
      nombre, email, whatsapp: wa, tipo: 'lead', lifecycle_stage: 'lead',
      fuente, fuente_detalle: ev?.nombre || null, utm_source: 'evento', utm_campaign: ev?.slug || null,
      origen_alta: 'evento', campana,
      giro: limpiar(r.giro, 60) || null, sucursales_interes: Number(r.sucursales) || null,
      puesto: limpiar(r.puesto, 80) || null,
      estatus_lead: 'nuevo', estatus_lead_at: new Date().toISOString(),
      propiedades: {
        evento: { slug: ev?.slug, nombre: ev?.nombre, edicion: ed.nombre, edicion_id: ed.id, modo: r.modo || 'stand', temperatura: r.temperatura || 'tibio', quiere_demo: !!r.quiere_demo, empresa: limpiar(r.empresa, 120) || null, sistema_actual: limpiar(r.sistema_actual, 80) || null, stand: limpiar(r.stand_visitado, 40) || null },
      },
    }).select('id').single();
    if (error) return { ok: false, motivo: error.message };
    contactId = nuevo.id;
  } else {
    // Ya existía: la fuente original se respeta, pero queda escrito que lo vimos en persona.
    await supabase.from('activities').insert({ contact_id: contactId, tipo: 'evento', titulo: `Lo conocimos en ${ev?.nombre || 'un evento'} · ${ed.nombre}`, automatico: true, metadata: { edicion_id: ed.id, temperatura: r.temperatura, quiere_demo: !!r.quiere_demo, nota: limpiar(r.nota, 500) } }).then(() => {}, () => {});
    await supabase.from('contacts').update({ propiedades: { ...(await propiedadesDe(contactId)), evento: { slug: ev?.slug, nombre: ev?.nombre, edicion: ed.nombre, edicion_id: ed.id, modo: r.modo || 'stand', temperatura: r.temperatura || 'tibio', quiere_demo: !!r.quiere_demo } } }).eq('id', contactId);
  }

  const { data: reg, error: eReg } = await supabase.from('ev_registros').insert({
    edicion_id: r.edicion_id, contact_id: contactId, company_id: contacto?.company_id || null, abm_cuenta_id: abmId,
    capturado_por: r.capturado_por || null, capturado_por_nombre: r.capturado_por_nombre || null,
    modo: r.modo || 'stand',
    nombre, empresa: limpiar(r.empresa, 120) || null, puesto: limpiar(r.puesto, 80) || null, giro: limpiar(r.giro, 60) || null,
    sucursales: Number(r.sucursales) || null, sistema_actual: limpiar(r.sistema_actual, 80) || null,
    whatsapp: wa, email, ciudad: limpiar(r.ciudad, 80) || null, instagram: limpiar(r.instagram, 80) || null,
    temperatura: r.temperatura || 'tibio', quiere_demo: !!r.quiere_demo,
    interes: limpiar(r.interes, 300) || null, nota: limpiar(r.nota, 2000) || null, foto_url: limpiar(r.foto_url, 500) || null,
    stand_visitado: limpiar(r.stand_visitado, 40) || null,
    consentimiento: !!r.consentimiento, consentimiento_at: r.consentimiento ? new Date().toISOString() : null,
    ya_era, cliente_local_id: r.cliente_local_id || null,
  }).select('id').single();
  if (eReg) return { ok: false, motivo: eReg.message };

  // La cuenta objetivo se entera: conocerla en persona es la señal más fuerte que existe, y la
  // cadencia en frío se detiene — no se le manda un correo frío a quien ya te dio la mano.
  if (abmId) {
    await supabase.from('abm_actividad').insert({ cuenta_id: abmId, canal: 'presencial', tipo: 'reunion', texto: `Conocidos en ${ev?.nombre || 'evento'} · ${ed.nombre}${nombre ? ' · ' + nombre : ''}`, detalle: { edicion_id: ed.id, registro_id: reg.id, temperatura: r.temperatura } }).then(() => {}, () => {});
    await supabase.from('abm_toques').update({ estado: 'cancelado' }).eq('cuenta_id', abmId).in('estado', ['borrador', 'aprobado', 'programado']).then(() => {}, () => {});
    await supabase.from('abm_cuentas').update({ etapa: 'respondio', ultimo_toque_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', abmId).in('etapa', ['sin_tocar', 'en_cadencia', 'en_pausa']).then(() => {}, () => {});
    await supabase.from('abm_senales').insert({ cuenta_id: abmId, tipo: 'contexto', detalle: `Conocido en persona en ${ev?.nombre || 'evento'}`, peso: 10, vigente: true, origen: 'evento', fecha: new Date().toISOString().slice(0, 10) }).then(() => {}, () => {});
  }

  // Bienvenida: solo con consentimiento, y cada canal se anota con su hora (o su error).
  if (r.consentimiento) bienvenida(reg.id, contactId!, { nombre, wa, email, evento: ev?.nombre || 'el evento', edicion: ed as any }).catch(() => {});

  return { ok: true, id: reg.id, contact_id: contactId!, ya_era };
}

async function propiedadesDe(contactId: string) {
  const { data } = await supabase.from('contacts').select('propiedades').eq('id', contactId).maybeSingle();
  return (data?.propiedades as any) || {};
}

async function bienvenida(registroId: string, contactId: string, o: { nombre: string | null; wa: string | null; email: string | null; evento: string; edicion: { plantilla_wa?: string | null; email_bienvenida?: boolean | null; nombre: string } }) {
  const primer = String(o.nombre || '').trim().split(/\s+/)[0] || '';
  // Sin plantilla configurada no hay bienvenida por WhatsApp, y eso tiene que
  // quedar escrito en el registro: si no, en la lista parece que "no llegó" sin motivo.
  if (o.wa && !o.edicion.plantilla_wa) await supabase.from('ev_registros').update({ bienvenida_wa_error: 'la edición no tiene plantilla de WhatsApp configurada' }).eq('id', registroId);
  if (o.wa && o.edicion.plantilla_wa) {
    try {
      const { permitido } = await import('../whatsapp/permisos');
      if (!(await permitido('primer_mensaje'))) throw new Error('automatización primer_mensaje apagada');
      const { enviarPlantilla } = await import('../whatsapp/kapso-api');
      await enviarPlantilla(o.wa, o.edicion.plantilla_wa, 'es_MX', [primer || 'Hola', o.evento]);
      await supabase.from('ev_registros').update({ bienvenida_wa_at: new Date().toISOString() }).eq('id', registroId);
      await supabase.from('activities').insert({ contact_id: contactId, tipo: 'bienvenida_wa', automatico: true, titulo: `Bienvenida del evento por WhatsApp (${o.edicion.plantilla_wa})`, metadata: { registro_id: registroId } }).then(() => {}, () => {});
    } catch (e: any) {
      await supabase.from('ev_registros').update({ bienvenida_wa_error: String(e?.message || e).slice(0, 200) }).eq('id', registroId);
    }
  }
  if (o.email && o.edicion.email_bienvenida !== false) {
    try {
      const { enviarCorreo } = await import('../email/pipeline');
      const res: any = await enviarCorreo({ para: o.email, asunto: `${primer ? primer + ', ' : ''}qué gusto conocerte en ${o.evento}`, html: htmlBienvenida(primer, o.evento), categoria: 'transaccional' as any, contactId });
      if (res?.ok !== false) await supabase.from('ev_registros').update({ bienvenida_email_at: new Date().toISOString() }).eq('id', registroId);
    } catch { /* el correo es el canal secundario; el WhatsApp ya quedó anotado */ }
  }
}

function htmlBienvenida(nombre: string, evento: string): string {
  const f = "-apple-system,'Segoe UI',Roboto,sans-serif";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f3f8">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f8"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ececf1">
      <tr><td height="6" style="height:6px;background:#9B8CFA;background:linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,rgba(244,168,205,.9));font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:26px 34px 0"><img src="https://www.sacscloud.com/images/sacs-wordmark.png" alt="Sacs" width="88" style="display:block;border:0;height:auto;max-width:88px"></td></tr>
      <tr><td style="padding:22px 34px 0">
        <p style="margin:0 0 16px;font:16px/1.65 ${f};color:#2a2733">${nombre ? 'Hola ' + nombre + ',' : 'Hola,'} qué gusto haber platicado contigo en <b>${evento}</b>.</p>
        <p style="margin:0 0 16px;font:16px/1.65 ${f};color:#2a2733">Como te comentamos, Sacscloud es el sistema con el que las marcas de moda en México controlan inventario, tienda física y venta en línea desde un solo lugar. Lo que sigue es sencillo: una demo de 20 minutos con tu propio negocio, sin costo.</p>
      </td></tr>
      <tr><td align="center" style="padding:6px 34px 8px">
        <a href="https://www.sacscloud.com/contacto" style="display:inline-block;background:#9B8CFA;color:#ffffff;text-decoration:none;font:800 16px/1 ${f};padding:15px 34px;border-radius:12px">Agendar mi demo</a>
      </td></tr>
      <tr><td style="padding:16px 34px 26px"><p style="margin:0;font:15px/1.6 ${f};color:#55515f">Si prefieres, responde este correo y te atendemos por aquí. Lo leemos personalmente.</p></td></tr>
    </table>
    <p style="margin:14px 0 0;font:500 11.5px/1.5 ${f};color:#a5a2af">Sacscloud · www.sacscloud.com · Recibes este correo porque te registraste con nosotros en ${evento}.</p>
  </td></tr></table></body></html>`;
}

/* ── El embudo de una edición: de registros a clientes, con su costo ─────── */
export async function embudoDe(edicionId: string) {
  const { data: regs } = await supabase.from('ev_registros').select('id, contact_id, company_id, consentimiento, bienvenida_wa_at, bienvenida_email_at, temperatura, quiere_demo, capturado_por_nombre, capturado_at, modo').eq('edicion_id', edicionId);
  const lista = regs || [];
  const ids = Array.from(new Set(lista.map((r: any) => r.contact_id).filter(Boolean)));
  let contactos: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('contacts').select('id, lifecycle_stage, respondio_at, eng_wa_respondidos, eng_emails_respondidos, reuniones_agendadas, reuniones_completadas, company_id, companies(mrr, estado_cuenta)').in('id', ids.slice(i, i + 150));
    contactos = contactos.concat(data || []);
  }
  const porId = new Map(contactos.map(c => [c.id, c]));
  let deals: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('deals').select('id, contact_id, stage, valor_mensual, mrr, closed_at').in('contact_id', ids.slice(i, i + 150)).is('archived_at', null);
    deals = deals.concat(data || []);
  }
  const { data: gastos } = await supabase.from('ev_gastos').select('monto, categoria').eq('edicion_id', edicionId);
  const costo = (gastos || []).reduce((a: number, g: any) => a + Number(g.monto || 0), 0);

  const registros = lista.length;
  const con_consentimiento = lista.filter((r: any) => r.consentimiento).length;
  const contactados = lista.filter((r: any) => r.bienvenida_wa_at || r.bienvenida_email_at).length;
  const respondieron = lista.filter((r: any) => { const c = porId.get(r.contact_id); return c && (c.respondio_at || Number(c.eng_wa_respondidos) > 0 || Number(c.eng_emails_respondidos) > 0); }).length;
  const demos = lista.filter((r: any) => { const c = porId.get(r.contact_id); return c && (Number(c.reuniones_agendadas) > 0 || Number(c.reuniones_completadas) > 0); }).length;
  const conDeal = new Set(deals.map(d => d.contact_id));
  const oportunidades = lista.filter((r: any) => conDeal.has(r.contact_id)).length;
  const clientesIds = lista.filter((r: any) => { const c = porId.get(r.contact_id); return c && c.lifecycle_stage === 'cliente'; }).map((r: any) => r.contact_id);
  const clientes = new Set(clientesIds).size;
  const arr = Array.from(new Set(clientesIds)).reduce((a, id) => { const c: any = porId.get(id); return a + Number(c?.companies?.mrr || 0) * 12; }, 0);
  const calientes = lista.filter((r: any) => r.temperatura === 'caliente').length;
  const quieren_demo = lista.filter((r: any) => r.quiere_demo).length;
  const porPersona: Record<string, number> = {};
  for (const r of lista as any[]) { const k = r.capturado_por_nombre || (r.modo === 'qr' ? 'QR (se registró solo)' : 'Sin nombre'); porPersona[k] = (porPersona[k] || 0) + 1; }
  const porDia: Record<string, number> = {};
  for (const r of lista as any[]) { const k = String(r.capturado_at).slice(0, 10); porDia[k] = (porDia[k] || 0) + 1; }

  return {
    registros, con_consentimiento, contactados, respondieron, demos, oportunidades, clientes, arr, calientes, quieren_demo,
    costo, costo_por_registro: registros ? Math.round(costo / registros) : null, costo_por_cliente: clientes ? Math.round(costo / clientes) : null,
    roi: costo > 0 ? Math.round(((arr - costo) / costo) * 100) : null,
    por_persona: porPersona, por_dia: porDia,
    gastos_por_categoria: (gastos || []).reduce((m: Record<string, number>, g: any) => { m[g.categoria] = (m[g.categoria] || 0) + Number(g.monto || 0); return m; }, {}),
  };
}

export const tokenPublico = () => Array.from(crypto.getRandomValues(new Uint8Array(9))).map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
