// WHATSAPP · Masivos (broadcasts de Kapso) con estado POR DESTINATARIO.
//
// GET                → lista; los no-terminales se re-sincronizan con Kapso
//                      (throttle 60 s vía last_synced_at: dos refrescos
//                      seguidos = una sola llamada).
// GET ?id=…[&status=] → detalle con la tabla por destinatario; el filtro por
//                      status es NUESTRO (Kapso no filtra recipients).
// GET ?audiencia=1   → contactos con WhatsApp utilizable, para el wizard.
// GET ?audiencia=clientes_sacs[&estados=activo,vencido,prospecto]
//                    → preset «Audiencia: clientes de SACS» (ver audienciaClientesSacs).
// POST {nombre, plantilla_id, destinatarios[], header?{tipo,url,filename?}} → crea en Kapso + espejo.
//                      header: solo si la plantilla es de imagen/PDF/video (default: su archivo de muestra).
// POST {accion:'enviar'|'programar', id, scheduled_at?}
//
// El "a quién le llegó" que pide el reporte viene del polling on-demand: el
// webhook de delivered/read no trae el id del broadcast, así que la fuente de
// verdad por destinatario es GET /broadcasts/{id}/recipients.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import {
  agregarDestinatarios, enviarBroadcast, programarBroadcast,
  obtenerBroadcast, listarDestinatarios, KapsoError, limpiarDestinatarios } from '../../../../lib/whatsapp/kapso-api';
import { telefonoWhatsApp } from '../../../../lib/telefono';
import { crearMasivo, componentesDestinatario, resolverHeader } from '../../../../lib/whatsapp/masivos.lib';
import { traerTodo } from '../../../../lib/demanda/paginar';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const TERMINALES = new Set(['enviado', 'fallido', 'detenido']);
const ESTADO_KAPSO: Record<string, string> = {
  draft: 'borrador', scheduled: 'programado', sending: 'enviando',
  completed: 'enviado', failed: 'fallido', stopped: 'detenido',
};

/** Re-sincroniza counts (y opcionalmente destinatarios) de UN masivo. */
async function sincronizar(b: any, conDestinatarios: boolean) {
  if (!b.kapso_broadcast_id || TERMINALES.has(b.status)) return b;
  if (b.last_synced_at && Date.now() - new Date(b.last_synced_at).getTime() < 60_000) return b;

  try {
    const k = await obtenerBroadcast(b.kapso_broadcast_id);
    const cambios: any = {
      status: ESTADO_KAPSO[k?.status] || b.status,
      total: k?.total_recipients ?? b.total,
      enviados: k?.sent_count ?? b.enviados,
      entregados: k?.delivered_count ?? b.entregados,
      leidos: k?.read_count ?? b.leidos,
      respondidos: k?.responded_count ?? b.respondidos,
      fallidos: k?.failed_count ?? b.fallidos,
      last_synced_at: new Date().toISOString(),
    };
    await supabase.from('wa_broadcasts').update(cambios).eq('id', b.id);
    Object.assign(b, cambios);

    if (conDestinatarios) {
      // Todas las páginas: Kapso no filtra por status, así que se trae todo
      // y el filtro vive en nuestra tabla.
      for (let page = 1; page < 100; page++) {
        const r = await listarDestinatarios(b.kapso_broadcast_id, page, 100);
        const items = Array.isArray(r) ? r : (r?.recipients ?? []);
        if (!items.length) break;
        for (const d of items) {
          const tel = telefonoWhatsApp(d.phone_number) || String(d.phone_number || '');
          if (!tel) continue;
          await supabase.from('wa_broadcast_destinatarios').update({
            status: d.status || 'pending',
            delivered_at: d.delivered_at || null,
            read_at: d.read_at || null,
            responded_at: d.responded_at || null,
            error_message: d.error_message || (d.error_details ? JSON.stringify(d.error_details).slice(0, 300) : null),
          }).eq('broadcast_id', b.id).eq('telefono', tel);
        }
        if (items.length < 100) break;
      }
    }
  } catch (e) {
    console.warn('[wa-broadcasts] sync:', e instanceof KapsoError ? e.message : e);
  }
  return b;
}

/* ══ Preset «Audiencia: clientes de SACS» (3-oct-2026) ══════════════════════
   A quién: los contactos de las empresas que TIENEN cuenta de SACS
   (companies.sacs_account o una fila en company_sacs_accounts) y cuyo
   estado_cuenta es de cliente vivo:
     · activo    → paga.
     · vencido   → cliente con pago atrasado: sigue usando SACS.
     · prospecto → con cuenta de SACS = cuenta de prueba (trial).
   Fuera: cancelado, empresas archivadas y las cuentas internas
   (tipo_cuenta = 'interna': demos y pruebas del equipo).
   Por empresa se prefiere al principal (es_principal o rol Dueño); si la
   empresa no tiene ninguno marcado, entran todos sus contactos. Nunca entra
   quien pidió no recibir WhatsApp (wa_optout), ni un lead que esté llevando el
   agente, y un teléfono repetido cuenta una vez (dos envíos = dos cobros). */
const ESTADOS_CLIENTE = ['activo', 'vencido', 'prospecto'];
async function audienciaClientesSacs(estadosPedidos?: string | null) {
  const estados = (estadosPedidos ? estadosPedidos.split(',').map(e => e.trim()).filter(Boolean) : ESTADOS_CLIENTE)
    .filter(e => e !== 'cancelado');
  const [empresas, cuentas] = await Promise.all([
    traerTodo<any>('companies', 'id, nombre, sacs_account, estado_cuenta, tipo_cuenta', q => q.is('archived_at', null)),
    traerTodo<any>('company_sacs_accounts', 'id, company_id'),
  ]);
  const conCuentaMulti = new Set(cuentas.map(c => c.company_id));
  const conCuenta = empresas.filter(e => (e.sacs_account && String(e.sacs_account).trim()) || conCuentaMulti.has(e.id));
  const elegibles = new Map<string, any>(conCuenta
    .filter(e => estados.includes(e.estado_cuenta) && e.tipo_cuenta !== 'interna').map(e => [e.id, e]));
  const ids = [...elegibles.keys()];
  const contactos: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    contactos.push(...await traerTodo<any>('contacts', 'id, nombre, apellido, whatsapp, telefono, tipo, rol, es_principal, company_id, wa_optout',
      q => q.in('company_id', ids.slice(i, i + 200)).is('archived_at', null)));
  }
  const conTel = contactos.map(c => ({ ...c, tel: telefonoWhatsApp(c.whatsapp) || telefonoWhatsApp(c.telefono) })).filter(c => c.tel);
  const sinOptout = conTel.filter(c => !c.wa_optout);
  const { enCicloAgente } = await import('../../../../lib/crm/ti/semaforo');
  const enCiclo = await enCicloAgente(sinOptout.map(c => c.id));
  const disponibles = sinOptout.filter(c => !enCiclo.has(c.id));
  const esPrincipal = (c: any) => !!c.es_principal || /due[ñn]o|owner|propietari/i.test(c.rol || '');
  const porEmpresa = new Map<string, any[]>();
  for (const c of disponibles) porEmpresa.set(c.company_id, [...(porEmpresa.get(c.company_id) || []), c]);
  const preferidos: any[] = [];
  for (const lista of porEmpresa.values()) {
    const ppal = lista.filter(esPrincipal);
    preferidos.push(...(ppal.length ? ppal : lista));
  }
  const vistos = new Set<string>();
  const audiencia = preferidos.filter(c => !vistos.has(c.tel) && !!vistos.add(c.tel)).map(c => {
    const e = elegibles.get(c.company_id);
    return {
      contact_id: c.id,
      nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim() || '(sin nombre)',
      empresa: e?.nombre || null, company_id: c.company_id, tipo: c.tipo,
      telefono: c.tel as string, estado_cuenta: e?.estado_cuenta || null, principal: esPrincipal(c),
    };
  });
  const porEstado = (xs: any[], f: (x: any) => string | null) => xs.reduce((m: Record<string, number>, x) => { const k = f(x) || 'sin_estado'; m[k] = (m[k] || 0) + 1; return m; }, {});
  return {
    audiencia, total: audiencia.length,
    resumen: {
      estados,
      empresas_con_cuenta_sacs: conCuenta.length,
      empresas_elegibles: elegibles.size,
      empresas_elegibles_por_estado: porEstado([...elegibles.values()], e => e.estado_cuenta),
      empresas_sin_whatsapp: elegibles.size - new Set(conTel.map(c => c.company_id)).size,
      contactos: contactos.length, con_whatsapp: conTel.length,
      optout: conTel.length - sinOptout.length, en_ciclo_agente: enCiclo.size,
      tras_preferir_principal: preferidos.length, final: audiencia.length,
      final_por_estado: porEstado(audiencia, a => a.estado_cuenta),
    },
  };
}

export const GET: APIRoute = async ({ url }) => {
  // ── Preset: clientes de SACS ──
  if (url.searchParams.get('audiencia') === 'clientes_sacs') {
    try { return json(await audienciaClientesSacs(url.searchParams.get('estados'))); }
    catch (e: any) { return json({ error: String(e?.message || e) }, 500); }
  }
  // ── Audiencia para el wizard ──
  if (url.searchParams.get('audiencia') === '1') {
    const { data: contactos } = await supabase.from('contacts')
      .select('id, nombre, apellido, whatsapp, telefono, tipo, company_id, wa_optout, companies(nombre)')
      .is('archived_at', null).eq('wa_optout', false).limit(3000);
    // Los leads que lleva el agente no entran a difusiones: se cruzarían con su ciclo (decisión 2026-09-04).
    const { enCicloAgente } = await import('../../../../lib/crm/ti/semaforo');
    const enCiclo = await enCicloAgente((contactos || []).map((c: any) => c.id));
    const audiencia = (contactos || []).filter((c: any) => !enCiclo.has(c.id))
      .map((c: any) => ({
        contact_id: c.id,
        nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim() || '(sin nombre)',
        empresa: c.companies?.nombre || null,
        company_id: c.company_id,
        tipo: c.tipo,
        telefono: telefonoWhatsApp(c.whatsapp) || telefonoWhatsApp(c.telefono),
      }))
      .filter(c => c.telefono);
    // Sin duplicar teléfono: dos contactos con el mismo número serían dos
    // cobros de Meta por el mismo WhatsApp.
    const vistos = new Set<string>();
    return json({ audiencia: audiencia.filter(c => !vistos.has(c.telefono!) && vistos.add(c.telefono!)) });
  }

  // ── Detalle ──
  const id = url.searchParams.get('id');
  if (id) {
    const { data: b } = await supabase.from('wa_broadcasts').select('*').eq('id', id).maybeSingle();
    if (!b) return json({ error: 'Masivo no encontrado' }, 404);
    await sincronizar(b, true);

    let q = supabase.from('wa_broadcast_destinatarios')
      .select('*, contacts(nombre, apellido), companies(nombre)')
      .eq('broadcast_id', id).order('status').order('telefono');
    const filtro = url.searchParams.get('status');
    if (filtro) q = q.eq('status', filtro);
    const { data: destinatarios } = await q;
    return json({ broadcast: b, destinatarios: destinatarios || [] });
  }

  // ── Lista ──
  const { data: lista } = await supabase.from('wa_broadcasts')
    .select('*').order('created_at', { ascending: false }).limit(100);
  for (const b of lista || []) await sincronizar(b, false);
  return json({ broadcasts: lista || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));

  // ── Enviar / programar ──
  if (b.accion === 'enviar' || b.accion === 'programar') {
    const { data: masivo } = await supabase.from('wa_broadcasts').select('*').eq('id', b.id).maybeSingle();
    if (!masivo?.kapso_broadcast_id) return json({ error: 'Masivo no encontrado' }, 404);
    if (!['borrador', 'programado'].includes(masivo.status)) return json({ error: `Ya está ${masivo.status}` }, 409);
    // Disyuntor por línea: si la línea del masivo entró en pausa después de crearlo (calidad baja), no sale.
    if (masivo.phone_number_id) {
      const { infoLinea } = await import('../../../../lib/whatsapp/linea');
      const l = await infoLinea(masivo.phone_number_id);
      if (l?.pausada) return json({ error: `La línea ${l.numero} está en pausa${l.pausada_motivo ? ` (${l.pausada_motivo})` : ''}: el masivo no sale hasta quitar la pausa.`, linea_pausada: true }, 409);
    }
    try {
      if (b.accion === 'programar') {
        if (!b.scheduled_at) return json({ error: 'Falta scheduled_at' }, 400);
        await programarBroadcast(masivo.kapso_broadcast_id, b.scheduled_at);
        await supabase.from('wa_broadcasts').update({ status: 'programado', scheduled_at: b.scheduled_at }).eq('id', masivo.id);
        return json({ ok: true, status: 'programado' });
      }
      await enviarBroadcast(masivo.kapso_broadcast_id);
      await supabase.from('wa_broadcasts').update({
        status: 'enviando', sent_at: new Date().toISOString(), last_synced_at: null,
      }).eq('id', masivo.id);
      return json({ ok: true, status: 'enviando' });
    } catch (e: any) {
      return json({ error: e instanceof KapsoError ? e.message : String(e) }, 502);
    }
  }

  // ── Quitar UN destinatario de un masivo aún no enviado ──
  // Kapso solo puede borrar TODOS los destinatarios, así que: limpiar → volver a
  // agregar a todos menos este → reprogramar si estaba programado.
  if (b.accion === 'quitar_destinatario') {
    const { data: masivo } = await supabase.from('wa_broadcasts').select('*').eq('id', b.id).maybeSingle();
    if (!masivo?.kapso_broadcast_id) return json({ error: 'Masivo no encontrado' }, 404);
    if (!['borrador', 'programado'].includes(masivo.status)) return json({ error: `El masivo ya está ${masivo.status}: no se puede quitar a nadie` }, 409);
    const tel = String(b.telefono || '');
    if (!tel) return json({ error: 'Falta telefono' }, 400);
    const { data: dests } = await supabase.from('wa_broadcast_destinatarios').select('*').eq('broadcast_id', masivo.id);
    const quedan = (dests || []).filter(d => d.telefono !== tel);
    if (quedan.length === (dests || []).length) return json({ error: 'Ese teléfono no está en el masivo' }, 404);
    // El encabezado de media va en CADA destinatario: al re-armar se usa el que se guardó al
    // crear el masivo o, si no hay columna/valor, el archivo de muestra de la plantilla.
    let header = masivo.header || null;
    if (!header && masivo.plantilla_nombre) {
      const { data: pl } = await supabase.from('wa_plantillas').select('nombre, header_tipo, header_media_url').eq('nombre', masivo.plantilla_nombre).limit(1).maybeSingle();
      const r = resolverHeader(pl);
      if (r.error) return json({ error: `No puedo re-armar el masivo: ${r.error}` }, 409);
      header = r.header;
    }
    try {
      await limpiarDestinatarios(masivo.kapso_broadcast_id);
      if (quedan.length) await agregarDestinatarios(masivo.kapso_broadcast_id, quedan.map(d => {
        const components = componentesDestinatario((d.params || []) as string[], header);
        return { phone_number: d.telefono, ...(components ? { components } : {}) };
      }));
      // El clear regresó el broadcast a draft: si estaba programado, se reprograma igual.
      if (masivo.status === 'programado' && masivo.scheduled_at && quedan.length) {
        await programarBroadcast(masivo.kapso_broadcast_id, masivo.scheduled_at);
      }
      await supabase.from('wa_broadcast_destinatarios').delete().eq('broadcast_id', masivo.id).eq('telefono', tel);
      const sinNadie = !quedan.length;
      await supabase.from('wa_broadcasts').update({
        total: quedan.length,
        ...(sinNadie ? { status: 'borrador', scheduled_at: null } : {}),
      }).eq('id', masivo.id);
      return json({ ok: true, quedan: quedan.length, ...(sinNadie ? { aviso: 'El masivo quedó sin destinatarios y volvió a borrador' } : {}) });
    } catch (e: any) {
      return json({ error: e instanceof KapsoError ? e.message : String(e) }, 502);
    }
  }

  // ── Crear ──
  const r = await crearMasivo(b);
  return json(r.cuerpo, r.status);
};
