// El WhatsApp de la cadencia (Cuentas objetivo), mandado por el cron.
//
// Hasta el 13-sep-2026 el WhatsApp del ABM se mandaba a mano (abrir wa.me con
// el texto cargado, api/crm/abm/whatsapp.ts). El dueño pidió que el goteo lo
// mande solo, y para eso hacen falta tres cosas que este archivo cuida:
//
//  1. Solo a quien publicó su wa.me. El trigger `abm_whatsapp_solo_declarado`
//     ya rechaza cualquier toque a un número no declarado; aquí no se salta.
//  2. Plantilla APROBADA por Meta. Iniciar una conversación fuera de la ventana
//     de 24 h solo se puede con plantilla; se registra desde la pantalla
//     (`registrarPlantillas`) y hasta que Meta la apruebe no sale nada.
//  3. La línea manda. Se va por la línea que el CRM tenga para «prospección»
//     (reglas de wa_reglas_linea, si no la default), con el disyuntor de
//     calidad (`wa-salud` la pausa) por encima de todo, un tope propio al día
//     (abm_config.wa_tope_dia) y la presión de 24 h entre WhatsApps al mismo
//     número que ya respetan las demás automatizaciones.
//
// Una respuesta frena TODA la cadencia (correo y WhatsApp), igual que una
// contestación por correo: se detecta leyendo el espejo `wa_mensajes`.
import { supabase } from '../supabase';
import { apuntar, variablesDe, rellenar, limpiar } from './abm.lib';
import { telefonoWhatsApp } from '../telefono';
import { enviarPlantilla, conLinea, crearPlantillaMeta, sanearParam, KapsoError, type BotonPlantilla } from '../whatsapp/kapso-api';
import { registrarMensaje } from '../whatsapp/espejo';
import { lineaPara, infoLinea } from '../whatsapp/linea';
import { puedeMandarWa } from '../whatsapp/presion';
import { enHorarioDe } from './abm-paises';

export type ResultadoWa = {
  enviados: number; saltados: number; fallidos: number;
  linea: string | null; tope: number; motivo: string | null; errores: string[];
};

/** `{{nombre}}` → `{{1}}`, en orden de aparición. Es el cuerpo que se registra en Meta. */
export function cuerpoMeta(cuerpo: string): { texto: string; variables: string[] } {
  const variables: string[] = [];
  const texto = String(cuerpo || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, v) => {
    const k = String(v).toLowerCase();
    if (!variables.includes(k)) variables.push(k);
    return `{{${variables.indexOf(k) + 1}}}`;
  });
  return { texto, variables };
}

/**
 * Los botones de la plantilla, desde las mismas columnas que usa el correo.
 * No son adorno: un toque en una respuesta rápida abre la ventana de 24 h, y
 * ahí ya se conversa sin plantilla (manual §8.5). Con `boton_url` es un botón
 * de enlace; sin ella, `boton_texto` son respuestas rápidas separadas por « | »
 * («Sí, muéstrenme | Ahora no»). Un «no» también es respuesta: frena la
 * cadencia antes de que alguien la reporte.
 */
export function botonesDe(pl: { boton_texto?: string | null; boton_url?: string | null } | null | undefined): BotonPlantilla[] {
  const texto = String(pl?.boton_texto || '').trim();
  if (!texto) return [];
  const url = String(pl?.boton_url || '').trim();
  if (url) return [{ tipo: 'URL', texto: texto.slice(0, 20), url }];
  return texto.split('|').map(t => t.trim()).filter(Boolean).slice(0, 3).map(t => ({ tipo: 'QUICK_REPLY' as const, texto: t.slice(0, 20) }));
}

/** Estado en Meta de las plantillas de WhatsApp de un giro (para la pantalla y para el cron).
 *  Con `region` se mira solo la de esa región: las de España y Latinoamérica
 *  son otro trámite y no se registran junto con las de México. */
export async function estadoPlantillas(giro: string, region?: string) {
  let q = supabase.from('abm_plantillas')
    .select('id, nombre, cuerpo, meta_nombre, meta_idioma, orden, region')
    .eq('giro', giro).eq('canal', 'whatsapp').eq('activa', true).order('orden');
  if (region) q = q.eq('region', region);
  const { data: pls } = await q;
  const nombres = (pls || []).map((p: any) => p.meta_nombre).filter(Boolean);
  const { data: enMeta } = nombres.length
    ? await supabase.from('wa_plantillas').select('nombre, idioma, status, rechazo_motivo, calidad').in('nombre', nombres)
    : { data: [] as any[] };
  return (pls || []).map((p: any) => {
    const m = (enMeta || []).find((x: any) => x.nombre === p.meta_nombre && x.idioma === (p.meta_idioma || 'es_MX'));
    return { id: p.id, nombre: p.nombre, region: p.region || 'mexico', meta_nombre: p.meta_nombre, idioma: p.meta_idioma || 'es_MX',
      status: m?.status || (p.meta_nombre ? 'SIN_REGISTRAR' : 'SIN_NOMBRE'), rechazo: m?.rechazo_motivo || null, calidad: m?.calidad || null };
  });
}

/** Registra en Meta las plantillas del giro que aún no existen (o que Meta rechazó).
 *  La REGIÓN es obligatoria a propósito (16-sep-2026): el botón registraba de
 *  un golpe las de todas las regiones, y meter en Meta las de España —que el
 *  dueño todavía no aprueba— es un trámite hacia afuera que nadie pidió. */
export async function registrarPlantillas(giro: string, region = 'mexico'): Promise<{ nombre: string; resultado: string }[]> {
  const estado = await estadoPlantillas(giro, region);
  const { data: pls } = await supabase.from('abm_plantillas').select('id, cuerpo, boton_texto, boton_url').in('id', estado.map(e => e.id));
  // La muestra que Meta exige por hueco sale de una cuenta real del giro: a
  // una plantilla de novias no se le manda de ejemplo un mayorista de Villa
  // Hidalgo, que es lo que el revisor ve para decidir si el texto tiene sentido.
  const REGION_PAIS: Record<string, string> = { mexico: 'México', latam: 'Colombia', espana: 'España' };
  const { data: muestra } = await supabase.from('abm_cuentas').select('nombre, ciudad, pais').eq('giro', giro)
    .not('ciudad', 'is', null).eq('pais', REGION_PAIS[region] || 'México')
    .order('puntaje', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const ejemploDe = (v: string) => v === 'nombre' ? (muestra?.nombre || 'Creaciones Lupita') : v === 'ciudad' ? (muestra?.ciudad || 'Villa Hidalgo') : v === 'pais' ? (muestra?.pais || REGION_PAIS[region] || 'México') : 'ejemplo';
  const out: { nombre: string; resultado: string }[] = [];
  for (const e of estado) {
    if (!e.meta_nombre) { out.push({ nombre: e.nombre, resultado: 'sin meta_nombre en abm_plantillas' }); continue; }
    if (['APPROVED', 'PENDING', 'IN_APPEAL'].includes(e.status)) { out.push({ nombre: e.nombre, resultado: `ya está: ${e.status}` }); continue; }
    const pl = (pls || []).find((p: any) => p.id === e.id);
    const { texto, variables } = cuerpoMeta(pl?.cuerpo || '');
    try {
      await crearPlantillaMeta({
        nombre: e.meta_nombre, idioma: e.idioma, categoria: 'MARKETING', cuerpo: texto,
        ejemplos: variables.map(ejemploDe),
        botones: botonesDe(pl),
      });
      out.push({ nombre: e.nombre, resultado: 'enviada a revisión de Meta' });
    } catch (err: any) {
      out.push({ nombre: e.nombre, resultado: `error: ${err instanceof KapsoError ? err.message : String(err?.message || err)}`.slice(0, 300) });
    }
  }
  // El espejo wa_plantillas lo actualiza sincronizarPlantillas (api/crm/whatsapp/plantillas.ts).
  try { const { sincronizarPlantillas } = await import('../../pages/api/crm/whatsapp/plantillas'); await sincronizarPlantillas(); } catch (e) { console.warn('[abm-wa] sync plantillas:', e); }
  return out;
}

/**
 * Manda los WhatsApp aprobados cuya fecha ya llegó. Lo llama el cron de
 * cadencias después del goteo. Nunca lanza: devuelve el motivo de lo que no salió.
 */
export async function enviarWhatsApps(o: { hoy: string; tope: number }): Promise<ResultadoWa> {
  const res: ResultadoWa = { enviados: 0, saltados: 0, fallidos: 0, linea: null, tope: o.tope, motivo: null, errores: [] };
  if (!(o.tope > 0)) { res.motivo = 'wa_tope_dia = 0'; return res; }

  const pn = await lineaPara({ contexto: 'prospeccion' }).catch(() => null);
  if (!pn) { res.motivo = 'no hay línea de WhatsApp disponible para prospección (¿pausada por calidad?)'; return res; }
  const linea = await infoLinea(pn);
  if (linea?.pausada) { res.motivo = `la línea ${linea.numero} está pausada${linea.pausada_motivo ? `: ${linea.pausada_motivo}` : ''}`; return res; }
  res.linea = linea?.numero || pn;

  const { count: yaHoy } = await supabase.from('abm_toques').select('id', { count: 'exact', head: true })
    .eq('estado', 'enviado').eq('canal', 'whatsapp').gte('enviado_at', o.hoy + 'T00:00:00Z');
  const restante = Math.max(0, o.tope - (yaHoy || 0));
  if (!restante) { res.motivo = 'tope de WhatsApp del día agotado'; return res; }

  const { data: pendientes } = await supabase.from('abm_toques')
    .select('id, cuenta_id, destino, cuerpo, programado_at, paso_id')
    .eq('estado', 'aprobado').eq('canal', 'whatsapp')
    .lte('programado_at', new Date().toISOString())
    .order('programado_at').limit(500);
  if (!pendientes?.length) return res;

  // Qué plantilla de Meta lleva cada toque: el toque nace con su paso
  // (paso_id) → plantilla del ABM → nombre en Meta → estado en el espejo wa_plantillas.
  const pasoIds = Array.from(new Set(pendientes.map((t: any) => t.paso_id).filter(Boolean)));
  const { data: pasos } = pasoIds.length
    ? await supabase.from('abm_pasos').select('id, plantilla_id').in('id', pasoIds)
    : { data: [] as any[] };
  const plIds = Array.from(new Set((pasos || []).map((p: any) => p.plantilla_id).filter(Boolean)));
  const { data: pls } = plIds.length
    ? await supabase.from('abm_plantillas').select('id, cuerpo, meta_nombre, meta_idioma').in('id', plIds)
    : { data: [] as any[] };
  const nombresMeta = Array.from(new Set((pls || []).map((p: any) => p.meta_nombre).filter(Boolean)));
  const { data: aprobadas } = nombresMeta.length
    ? await supabase.from('wa_plantillas').select('nombre, idioma, status').in('nombre', nombresMeta)
    : { data: [] as any[] };

  const { data: cuentasHoy } = await supabase.from('abm_toques').select('cuenta_id')
    .eq('estado', 'enviado').gte('enviado_at', o.hoy + 'T00:00:00Z').limit(5000);
  const tocadasHoy = new Set((cuentasHoy || []).map((r: any) => r.cuenta_id));

  const ids = Array.from(new Set(pendientes.map((t: any) => t.cuenta_id)));
  // `pais` viaja para que {{pais}} de una plantilla de Latam diga «Colombia» y
    // no «México» (variablesDe cae a México cuando la cuenta no trae país).
    const { data: cuentas } = await supabase.from('abm_cuentas').select('id, nombre, ciudad, pais, etapa, ya_es_cliente, giro').in('id', ids);

  for (const t of pendientes as any[]) {
    if (res.enviados >= restante) break;
    const c = (cuentas || []).find((x: any) => x.id === t.cuenta_id);
    if (!c || c.ya_es_cliente || ['no_contactar', 'respondio', 'reunion', 'ganada', 'perdida'].includes(c.etapa)) {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'la cuenta ya no está en cadencia' }).eq('id', t.id);
      continue;
    }
    // Fuera de la ventana local (9:00–17:59) el WhatsApp espera a la
    // siguiente corrida: a nadie le llega un WhatsApp comercial de noche.
    if (!enHorarioDe(c.pais)) { res.saltados++; res.motivo = res.motivo || 'fuera de horario en su país'; continue; }
    // Un solo toque por negocio al día, sea correo o WhatsApp: si hoy ya le
    // salió algo, el WhatsApp se recorre a mañana.
    if (tocadasHoy.has(t.cuenta_id)) {
      await supabase.from('abm_toques').update({ programado_at: new Date(Date.now() + 864e5).toISOString() }).eq('id', t.id);
      res.saltados++; continue;
    }
    const tel = telefonoWhatsApp(t.destino);
    if (!tel) { await supabase.from('abm_toques').update({ estado: 'fallido', resultado: 'el número no tiene forma de WhatsApp' }).eq('id', t.id); res.fallidos++; continue; }

    const paso = (pasos || []).find((p: any) => p.id === t.paso_id);
    const pl = paso ? (pls || []).find((p: any) => p.id === paso.plantilla_id) : null;
    if (!pl?.meta_nombre) { res.saltados++; res.motivo = res.motivo || 'el toque no tiene paso con plantilla registrada en Meta'; continue; }
    const idioma = pl.meta_idioma || 'es_MX';
    const ap = (aprobadas || []).find((x: any) => x.nombre === pl.meta_nombre && x.idioma === idioma);
    if (ap?.status !== 'APPROVED') {
      res.saltados++; res.motivo = res.motivo || `la plantilla «${pl.meta_nombre}» ${ap?.status ? `está ${ap.status} en Meta` : 'no está registrada en Meta'}: se queda en la fila`;
      continue;
    }

    const presion = await puedeMandarWa(tel).catch(() => ({ ok: true } as any));
    if (!presion.ok) { res.saltados++; continue; }

    const { data: reclamado } = await supabase.from('abm_toques')
      .update({ estado: 'enviando', enviado_at: new Date().toISOString() })
      .eq('id', t.id).eq('estado', 'aprobado').select('id').maybeSingle();
    if (!reclamado) continue;

    const vars = variablesDe(c);
    const params = cuerpoMeta(pl.cuerpo).variables.map(v => sanearParam(vars[v] || '') || '—');
    try {
      const r: any = await conLinea({ pn, contexto: 'prospeccion' }, () => enviarPlantilla(tel, pl.meta_nombre, idioma, params));
      const wamid = r?.messages?.[0]?.id ? String(r.messages[0].id) : null;
      if (wamid) {
        await registrarMensaje({
          kapsoMessageId: wamid, telefono: tel, direccion: 'saliente', tipo: 'template',
          cuerpo: t.cuerpo || `[plantilla ${pl.meta_nombre}]`, status: 'sent', autor: 'Sistema',
          metadata: { plantilla: pl.meta_nombre, abm_cuenta_id: c.id, abm_toque_id: t.id, contexto: 'prospeccion' },
        } as any).catch(() => {});
      }
      await supabase.from('abm_toques').update({ estado: 'enviado', enviado_at: new Date().toISOString(), mensaje_id: wamid, resultado: null }).eq('id', t.id);
      await supabase.from('abm_cuentas').update({ etapa: 'en_cadencia', ultimo_toque_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', c.id).in('etapa', ['sin_tocar', 'en_cadencia']);
      await apuntar(c.id, 'whatsapp', 'envio', { toque_id: t.id, texto: `WhatsApp «${pl.meta_nombre.replace(/^abm_[a-z]+_/, '')}» a ${tel} por ${res.linea}`, detalle: { plantilla: pl.meta_nombre, wamid } });
      tocadasHoy.add(c.id);
      res.enviados++;
    } catch (e: any) {
      const msg = e instanceof KapsoError ? e.message : String(e?.message || e);
      await supabase.from('abm_toques').update({ estado: 'fallido', resultado: msg.slice(0, 300) }).eq('id', t.id);
      res.fallidos++; res.errores.push(`${c.nombre}: ${msg.slice(0, 160)}`);
      if (res.errores.length >= 5) { res.motivo = 'cinco fallos seguidos: algo está mal con la plantilla o la línea, no se sigue'; break; }
    }
  }
  return res;
}

/**
 * Quien contesta por WhatsApp deja de recibir la cadencia entera. El webhook
 * de Kapso espeja cada entrante en wa_mensajes; aquí se cruza con las cuentas
 * que tienen un WhatsApp enviado y todavía algo en la fila.
 */
/** Mensaje de ausencia o de bienvenida automática, no una persona contestando.
 *  Las frases salieron de leer los entrantes reales; se prefiere dejar pasar
 *  un automático a descartar a alguien que sí escribió, así que la lista es
 *  corta y literal en vez de lista y adivinadora. */
const AUTO_WA = [
  /gracias por (tu|su) mensaje/i,
  /en (este momento|estos momentos) no (podemos|puedo) (responder|atender)/i,
  /(le|te) (responderemos|contestaremos|atenderemos) (a la brevedad|lo antes posible|en breve)/i,
  /(horario de atenci[oó]n|nuestro horario es)/i,
  /mensaje autom[aá]tico/i,
  /fuera de (horario|la oficina)/i,
  /[uú]nete a (nuestro|nuestros) grupo/i,
  /chat\.whatsapp\.com\/[A-Za-z0-9]/,
];
export function esAutoWa(cuerpo?: string | null): boolean {
  const t = String(cuerpo || '').trim();
  if (!t) return true;
  return AUTO_WA.some(r => r.test(t));
}

export async function respuestasWhatsApp(): Promise<{ respondieron: number }> {
  const desde = new Date(Date.now() - 45 * 864e5).toISOString();
  const { data: enviados } = await supabase.from('abm_toques')
    .select('cuenta_id, destino, enviado_at').eq('canal', 'whatsapp').eq('estado', 'enviado').gte('enviado_at', desde)
    .order('enviado_at').limit(2000);
  if (!enviados?.length) return { respondieron: 0 };
  const primero = new Map<string, { destino: string; desde: string }>();
  for (const t of enviados as any[]) if (!primero.has(t.cuenta_id)) primero.set(t.cuenta_id, { destino: t.destino, desde: t.enviado_at });

  const ids = Array.from(primero.keys());
  const { data: cuentas } = await supabase.from('abm_cuentas').select('id, nombre, etapa').in('id', ids).in('etapa', ['sin_tocar', 'en_cadencia', 'en_pausa']);
  let respondieron = 0;
  for (const c of cuentas || []) {
    const p = primero.get(c.id)!;
    const tel = telefonoWhatsApp(p.destino);
    if (!tel) continue;
    const { data: conv } = await supabase.from('wa_conversaciones').select('id').eq('telefono', tel).maybeSingle();
    if (!conv) continue;
    /* Un AUTORESPONDEDOR no es una respuesta. El camino de correo lo filtra
       desde el día uno (`esAutomatico` en inbound.ts); este no lo hacía, y en
       WhatsApp Business el mensaje de ausencia es lo normal, no la excepción.
       Ya pasó: «Fashion queens» contestó dos mensajes en el mismo segundo —una
       invitación a su grupo y «Gracias por tu mensaje, en este momento no
       podemos responder»— y eso canceló 15 toques de correo y 4 de WhatsApp,
       y movió la cuenta a «respondió». Si esto se deja, la tasa de respuesta
       que se reporte va a ser casi toda mensajes de ausencia, y cada negocio
       con auto-respuesta matará su propia cadencia en el primer toque.
       Se piden varios y se toma el primero que parezca escrito por una
       persona; si todos son automáticos, no hubo respuesta. */
    const { data: entrantes } = await supabase.from('wa_mensajes').select('id, cuerpo, created_at')
      .eq('conversation_id', conv.id).eq('direccion', 'entrante').gt('created_at', p.desde)
      .order('created_at').limit(5);
    const m = (entrantes || []).find((x: any) => !esAutoWa(x.cuerpo));
    if (!m) continue;
    const { count: ya } = await supabase.from('abm_actividad').select('id', { count: 'exact', head: true })
      .eq('cuenta_id', c.id).eq('canal', 'whatsapp').eq('tipo', 'respuesta');
    if (!ya) await apuntar(c.id, 'whatsapp', 'respuesta', { texto: String(m.cuerpo || '').slice(0, 2000) });
    await supabase.from('abm_cuentas').update({ etapa: 'respondio', updated_at: new Date().toISOString() }).eq('id', c.id).in('etapa', ['sin_tocar', 'en_cadencia', 'en_pausa']);
    await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'contestó por WhatsApp' })
      .eq('cuenta_id', c.id).in('estado', ['borrador', 'aprobado', 'programado']);
    respondieron++;
  }
  return { respondieron };
}

/**
 * Las cuentas que un goteo enroló ANTES de que existiera el WhatsApp en la
 * cadencia se quedaron solo con correos. Esto les escribe sus WhatsApp con la
 * misma fecha de arranque que su primer correo, ya aprobados con la firma de
 * quien encendió el goteo (es la misma aprobación, regla 8.3 del manual).
 */
export async function completarWhatsApps(goteo_id: string): Promise<{ cuentas: number; whatsapps: number; sin_wa: number }> {
  const { data: g } = await supabase.from('abm_goteo').select('id, cadencia_id, creado_por').eq('id', goteo_id).maybeSingle();
  if (!g) return { cuentas: 0, whatsapps: 0, sin_wa: 0 };
  const { data: pasosWa } = await supabase.from('abm_pasos').select('id, dia, plantilla_id').eq('cadencia_id', g.cadencia_id).eq('canal', 'whatsapp').order('dia');
  if (!pasosWa?.length) return { cuentas: 0, whatsapps: 0, sin_wa: 0 };
  const { data: pls } = await supabase.from('abm_plantillas').select('id, cuerpo, meta_nombre').in('id', pasosWa.map((p: any) => p.plantilla_id)).eq('activa', true);

  const { data: toques } = await supabase.from('abm_toques').select('cuenta_id, canal, persona_id, programado_at')
    .eq('goteo_id', goteo_id).order('programado_at').limit(20000);
  const conWa = new Set((toques || []).filter((t: any) => t.canal === 'whatsapp').map((t: any) => t.cuenta_id));
  const primero = new Map<string, { programado_at: string; persona_id: string | null }>();
  for (const t of (toques || []) as any[]) if (t.canal === 'email' && !primero.has(t.cuenta_id)) primero.set(t.cuenta_id, { programado_at: t.programado_at, persona_id: t.persona_id });
  const faltan = Array.from(primero.keys()).filter(id => !conWa.has(id));
  if (!faltan.length) return { cuentas: 0, whatsapps: 0, sin_wa: 0 };

  const [{ data: cuentas }, { data: canales }] = await Promise.all([
    supabase.from('abm_cuentas').select('*').in('id', faltan).in('etapa', ['sin_tocar', 'en_cadencia']),
    supabase.from('abm_canales').select('cuenta_id, tipo, valor, estado').in('cuenta_id', faltan).like('tipo', 'whatsapp%').in('estado', ['declarado', 'valido']),
  ]);
  let whatsapps = 0, sin_wa = 0, n = 0;
  const filas: any[] = [];
  for (const c of cuentas || []) {
    const wa = (canales || []).find((x: any) => x.cuenta_id === c.id && x.tipo === 'whatsapp_dueno') || (canales || []).find((x: any) => x.cuenta_id === c.id);
    if (!wa) { sin_wa++; continue; }
    const p0 = primero.get(c.id)!;
    const arranque = new Date(p0.programado_at).getTime();
    const vars = variablesDe(c);
    for (const paso of pasosWa as any[]) {
      const pl = (pls || []).find((x: any) => x.id === paso.plantilla_id);
      if (!pl?.meta_nombre) continue;
      filas.push({
        cuenta_id: c.id, cadencia_id: g.cadencia_id, paso_id: paso.id, persona_id: p0.persona_id, goteo_id,
        canal: 'whatsapp', destino: wa.valor, asunto: null, cuerpo: limpiar(rellenar(pl.cuerpo, vars), 1024),
        estado: 'aprobado', aprobado_por: g.creado_por, aprobado_at: new Date().toISOString(),
        programado_at: new Date(arranque + ((Number(paso.dia) || 2) - 1) * 864e5).toISOString(),
      });
    }
    n++;
  }
  if (filas.length) {
    const { error } = await supabase.from('abm_toques').insert(filas);
    if (error) throw new Error(error.message);
    whatsapps = filas.length;
    for (const id of new Set(filas.map(f => f.cuenta_id))) {
      await apuntar(id, 'sistema', 'nota', { texto: `El goteo completó la cadencia con ${filas.filter(f => f.cuenta_id === id).length} WhatsApp (plantilla de Meta, solo al wa.me publicado)` });
    }
  }
  return { cuentas: n, whatsapps, sin_wa };
}
