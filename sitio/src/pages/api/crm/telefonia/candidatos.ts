/* A QUIÉN SE LE PUEDE LLAMAR HOY · el motor de filtros del armador.
 *
 * PEDIDO DEL DUEÑO (21-sep-2026): «al crear la llamada inteligente debes darme
 * más opciones de filtros: que pueda seleccionar un giro de las ABM y llamarle
 * a las que ya están verificadas que sí tienen WhatsApp, o las que tienen
 * teléfono sin WhatsApp, o ambas; que pueda seleccionar por sucursales, que de
 * forma general pueda decidir más de X sucursales; que pueda seleccionar uno o
 * varios giros, sea de ABM o de leads normales; que pueda excluir los que he
 * llamado más de X veces y nunca han contestado, y otros 10 filtros que
 * consideres importantes, para que pueda meter varios a la vez y sea muy
 * flexible».
 *
 * POR QUÉ UN ENDPOINT NUEVO Y NO MÁS PARÁMETROS EN EL INBOX
 * El armador construía un query del inbox, y eso funcionaba porque hasta hoy
 * llamar era «marcarle a una conversación». Lo que se pide ahora rompe esa
 * premisa por dos lados:
 *   · El ABM no tiene conversaciones. Son 29,770 cuentas con teléfono y sin un
 *     solo hilo de WhatsApp — para el inbox no existen.
 *   · Los filtros que pide son del NEGOCIO (giro, sucursales, rating, cuántas
 *     veces le marqué sin que conteste), no de la conversación. Meterlos en el
 *     endpoint del inbox los pondría en la ruta más caliente del CRM para que
 *     los use una pantalla al día.
 *
 * Devuelve EXACTAMENTE la forma que ya consumen el armador y la cabina
 * (`conversaciones`, `total_filtrado`, `hay_mas`), así que nada más abajo tiene
 * que enterarse de dónde salió cada fila.
 *
 * LO QUE NUNCA SE PUEDE APAGAR DESDE LA PANTALLA: sin teléfono no entra, los
 * `no_llamar` del CRM no entran, y los de la lista de bloqueo del ABM tampoco
 * (eso lo hace la vista). Un filtro que se pueda desmarcar acaba desmarcado.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const lista = (v: string | null) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
/* ⚠️ `Number(null)` es 0, no NaN. La primera versión de esto devolvía 0 para
   CADA filtro numérico ausente, así que sin tocar nada la consulta llevaba
   `sucursales <= 0`, `rating >= 0`, `puntaje >= 0`… y la lista salía vacía con
   los filtros en blanco. El parámetro ausente tiene que distinguirse del cero
   ANTES de convertir. */
const num = (v: string | null) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const haceDias = (d: number) => new Date(Date.now() - d * 86400e3).toISOString();

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const q = url.searchParams;

  const fuente = (q.get('fuente') || 'crm') as 'crm' | 'abm' | 'ambas';

  /* ── EL CATÁLOGO DE GIROS ─────────────────────────────────────────────────
     `?catalogo=1` devuelve los giros que EXISTEN con cuántos hay en cada uno.
     Se sirve desde aquí y no desde una lista escrita a mano porque los giros
     del ABM los pone el barrido de Maps: una lista fija se queda vieja el día
     que entra un giro nuevo, y entonces la pantalla ofrece filtrar por algo
     que ya no está y esconde lo que sí. Con el número al lado además se sabe
     antes de elegir si vale la pena. */
  if (q.get('catalogo') === '1') {
    /* Los conteos salen de VISTAS AGREGADAS y no de leer las filas: PostgREST
       corta en 1000 sin avisar, y la primera versión de esta pantalla decía
       «marcas (212)» contando sobre ese corte. Un número que miente justo
       donde se decide a quién llamar es peor que no ponerlo. */
    const [abm, estados, crm] = await Promise.all([
      supabase.from('v_abm_giros').select('giro, n, con_wa').limit(200),
      supabase.from('v_abm_estados').select('estado, n').limit(200),
      supabase.from('contacts').select('giro').is('archived_at', null).not('giro', 'is', null).limit(1000),
    ]);
    /* Los del CRM son texto libre («ropa de mujer, accesorios, bolsas»), así
       que se cuentan aquí —son 62 en total, caben— y se filtran por «contiene».
       Normalizarlos sería inventar una taxonomía que el CRM no tiene. */
    const m = new Map<string, number>();
    for (const f of crm.data || []) { const g = String(f.giro || '').trim(); if (g) m.set(g, (m.get(g) || 0) + 1); }
    return json({
      ok: true,
      giros_abm: abm.data || [],
      giros_crm: [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([giro, n]) => ({ giro, n })),
      estados: estados.data || [],
    });
  }

  const limit = Math.min(500, Math.max(1, Number(q.get('limit') || 60)));
  const offset = Math.max(0, Number(q.get('offset') || 0));
  const giros = lista(q.get('giros'));
  const canal = q.get('canal') || '';              // wa_verificado | wa | solo_tel
  const sucMin = num(q.get('suc_min'));
  const sucMax = num(q.get('suc_max'));
  const quemados = num(q.get('quemados'));         // excluir con ≥N intentos y 0 contestadas
  const sinTocarDias = num(q.get('sin_tocar_dias'));
  const soloNuevos = q.get('nunca_llamados') === '1';
  const excluirClientes = q.get('excluir_clientes') === '1';
  const excluirReunion = q.get('excluir_con_reunion') === '1';
  const orden = q.get('orden') || '';

  /* ── EL CANDADO QUE EVITA QUEMAR UNA LISTA ────────────────────────────────
     Los números a los que ya se marcó N veces sin que contestara nadie. Se
     resuelve ANTES y aparte porque es un conjunto chico (hoy 10 con N=2) y
     porque es el único filtro que cruza las dos fuentes: una cuenta del ABM no
     tiene `contact_id`, así que el número es lo único que comparten. */
  let quemadosSet = new Set<string>();
  if (quemados && quemados > 0) {
    const { data } = await supabase.from('v_tel_intentos')
      .select('telefono, intentos, contestadas')
      .eq('contestadas', 0).gte('intentos', quemados).limit(5000);
    quemadosSet = new Set((data || []).map(r => String(r.telefono)));
  }

  /* Quien ya tiene cita próxima no entra: llamarle a alguien con quien vas a
     hablar el martes gasta el contacto y la llamada. */
  let conReunion = new Set<string>();
  if (excluirReunion) {
    const hoy = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('bookings').select('contact_id')
      .gte('fecha', hoy).not('contact_id', 'is', null)
      .not('estado', 'in', '("cancelada","no_asistio","reagendada")').limit(2000);
    conReunion = new Set((data || []).map(b => String(b.contact_id)));
  }

  const filas: any[] = [];
  let total = 0;

  // ══ FUENTE 1 · EL CRM (contactos y leads de siempre) ══════════════════════
  if (fuente === 'crm' || fuente === 'ambas') {
    let sel = supabase.from('contacts')
      .select('id, nombre, apellido, telefono, whatsapp, lifecycle_stage, giro, sucursales_interes, owner_id, company_id, last_contact_at, no_llamar, companies(nombre, nombre_comercial)', { count: 'exact' })
      .is('archived_at', null)
      // Sin teléfono no hay llamada. Va aquí y no en el navegador para que el
      // número que se enseña sea el número al que se va a marcar.
      .or('telefono.not.is.null,whatsapp.not.is.null')
      .not('no_llamar', 'is', true);

    const etapas = lista(q.get('etapa'));
    if (etapas.length) sel = sel.in('lifecycle_stage', etapas);
    if (excluirClientes) sel = sel.not('lifecycle_stage', 'in', '("cliente")');
    if (q.get('owner') === 'mias') sel = sel.eq('owner_id', user.id);
    if (q.get('owner') === 'sin_asignar') sel = sel.is('owner_id', null);
    if (giros.length) sel = sel.or(giros.map(g => `giro.ilike.%${g}%`).join(','));
    if (sucMin != null) sel = sel.gte('sucursales_interes', sucMin);
    if (sucMax != null) sel = sel.lte('sucursales_interes', sucMax);
    if (sinTocarDias != null) sel = sel.or(`last_contact_at.is.null,last_contact_at.lt.${haceDias(sinTocarDias)}`);
    if (canal === 'wa' || canal === 'wa_verificado') sel = sel.not('whatsapp', 'is', null);
    if (canal === 'solo_tel') sel = sel.is('whatsapp', null);

    /* Se pide de más y se recorta después: los dos filtros que faltan
       —quemados y con reunión— no se pueden expresar en la consulta porque
       viven en otras tablas. Pedir el doble y cortar es más barato que traer
       treinta mil filas para tachar diez. */
    /* Regla del repo: toda lectura mira su error. Sin esto una consulta mal
       armada devuelve cero filas y en pantalla se lee «no hay nadie con esos
       filtros», que es la mentira más cara de este endpoint. */
    const { data, count, error } = await sel.order('last_contact_at', { ascending: true, nullsFirst: true })
      .range(offset, offset + limit * 2 - 1);
    if (error) return json({ error: `CRM: ${error.message}`, detalle: error.details || null }, 500);

    for (const c of data || []) {
      const tel = String(c.telefono || c.whatsapp || '');
      if (!tel || /@/.test(tel)) continue;
      if (quemadosSet.has(tel)) continue;
      if (conReunion.has(String(c.id))) continue;
      filas.push({
        id: `crm:${c.id}`, fuente: 'crm', virtual: true, wa_id: null,
        contact_id: c.id, company_id: c.company_id || null, telefono: tel,
        contacto: { nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim() || null, lifecycle_stage: c.lifecycle_stage },
        empresa: c.companies ? { nombre: (c.companies as any).nombre, nombre_comercial: (c.companies as any).nombre_comercial } : null,
        giro: c.giro || null, sucursales: c.sucursales_interes ?? null,
        tiene_wa: !!c.whatsapp,
      });
    }
    total += Number(count || 0);
  }

  // ══ FUENTE 2 · EL ABM (prospección en frío) ═══════════════════════════════
  if (fuente === 'abm' || fuente === 'ambas') {
    let sel = supabase.from('v_abm_llamables')
      .select('id, nombre, giro, subgiro, ciudad, estado_geo, sucursales, google_rating, google_resenas, puntaje, etapa, ya_es_cliente, ultimo_toque_at, telefono, whatsapp, tiene_wa, wa_verificado, marcar, es_cliente', { count: 'exact' });

    if (giros.length) sel = sel.in('giro', giros);
    /* Las tres opciones que pidió, literales: verificadas con WhatsApp, con
       teléfono pero sin WhatsApp, o las dos cosas. */
    if (canal === 'wa_verificado') sel = sel.eq('wa_verificado', true);
    else if (canal === 'wa') sel = sel.eq('tiene_wa', true);
    else if (canal === 'solo_tel') sel = sel.eq('tiene_wa', false);
    if (sucMin != null) sel = sel.gte('sucursales', sucMin);
    if (sucMax != null) sel = sel.lte('sucursales', sucMax);
    const ratingMin = num(q.get('rating_min'));
    if (ratingMin != null) sel = sel.gte('google_rating', ratingMin);
    const resenasMin = num(q.get('resenas_min'));
    if (resenasMin != null) sel = sel.gte('google_resenas', resenasMin);
    const puntajeMin = num(q.get('puntaje_min'));
    if (puntajeMin != null) sel = sel.gte('puntaje', puntajeMin);
    const estados = lista(q.get('estado_geo'));
    if (estados.length) sel = sel.in('estado_geo', estados);
    const ciudad = q.get('ciudad');
    if (ciudad) sel = sel.ilike('ciudad', `%${ciudad}%`);
    /* `es_cliente` y no `ya_es_cliente`: la columna de la tabla es TEXTO
       ('sí' o nulo) y preguntarle `is true` tumba la consulta con un 500. La
       vista la expone ya convertida. */
    if (excluirClientes) sel = sel.eq('es_cliente', false);
    /* En cadencia = le está escribiendo el ABM ahora mismo. Llamarle encima es
       tocar dos veces el mismo día por dos canales, que es como se gana un
       bloqueo. */
    if (q.get('excluir_en_cadencia') === '1') sel = sel.not('etapa', 'in', '("en_cadencia","respondio")');
    if (sinTocarDias != null) sel = sel.or(`ultimo_toque_at.is.null,ultimo_toque_at.lt.${haceDias(sinTocarDias)}`);
    if (soloNuevos) sel = sel.is('ultimo_toque_at', null);

    /* El orden por defecto es el puntaje: si hay que cortar treinta mil en
       cien, que los cien sean los mejores. */
    const col = orden === 'sucursales' ? 'sucursales' : orden === 'rating' ? 'google_rating' : 'puntaje';
    const { data, count, error } = await sel.order(col, { ascending: false, nullsFirst: false })
      .range(offset, offset + limit * 2 - 1);
    if (error) return json({ error: `ABM: ${error.message}`, detalle: error.details || null }, 500);

    for (const a of data || []) {
      const tel = String((a as any).marcar || '');
      if (!tel) continue;
      if (quemadosSet.has(tel)) continue;
      filas.push({
        id: `abm:${a.id}`, fuente: 'abm', virtual: true, wa_id: null,
        contact_id: null, company_id: null, telefono: tel,
        contacto: { nombre: a.nombre, lifecycle_stage: 'prospección' },
        empresa: { nombre: a.nombre, nombre_comercial: a.nombre },
        giro: a.giro || null, subgiro: (a as any).subgiro || null,
        sucursales: a.sucursales ?? null, ciudad: a.ciudad || null, estado_geo: a.estado_geo || null,
        rating: a.google_rating ?? null, resenas: a.google_resenas ?? null, puntaje: a.puntaje ?? null,
        tiene_wa: !!a.tiene_wa, wa_verificado: !!a.wa_verificado,
      });
    }
    total += Number(count || 0);
  }

  /* El total que se enseña es el de la consulta, PERO los descartes de arriba
     (quemados, con reunión, sin teléfono usable) no se pueden restar sin leer
     todo. Se avisa con `aprox` en vez de presentar un número redondo que luego
     no coincide con lo que marca — un contador que miente se descubre a media
     jornada. */
  const recortado = filas.length;
  return json({
    ok: true,
    conversaciones: filas.slice(0, limit),
    total_filtrado: total,
    aprox: quemadosSet.size > 0 || conReunion.size > 0,
    hay_mas: recortado > limit || offset + recortado < total,
    descartados: { quemados: quemadosSet.size, con_reunion: conReunion.size },
  });
};
