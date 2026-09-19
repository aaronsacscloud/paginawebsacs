// El Taller — órdenes de trabajo entre consultoría y desarrollo.
//
// GET  ?id=…            → una orden con su bitácora, comentarios y revisiones
// GET                   → todas las órdenes vivas + el equipo + lo que falta traer del CRM
// POST {accion:…}       → crear | importar | revisar | lote | preguntar | responder
// PUT  {id, …}          → mover de etapa, poner fecha, asignar, completar datos
//
// La orden es la MISMA cosa que el renglón de `mejoras`, en dos vistas: allá es
// lo que el cliente ve (qué se hizo y cuándo), aquí es cómo se trabaja (fechas,
// rebotes, SLA, quién tardó). Por eso lo interno vive aquí y NO se copia allá:
// si el cliente ve que su mejora rebotó dos veces, la conversación deja de ser
// sobre lo que recibió.
//
// Y es 1↔N: la misma falla la sufren tres cuentas y se arregla UNA vez. Al
// aprobar se cierran los N renglones con el mismo video.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { notificar } from '../../../lib/crm/notificaciones';
import { pedirJSON } from '../../../lib/ia';
import { esModuloValido } from '../../../lib/crm/modulos-sacs';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hoy = () => new Date().toISOString().slice(0, 10);

/* Las etapas, en el orden en que se trabajan. `espera` y `trabada` están fuera
   del avance a propósito: no son progreso, son cosas detenidas. */
export const ETAPAS = ['recibida', 'analisis', 'desarrollo', 'pruebas', 'lista', 'entregada', 'devuelta', 'espera', 'trabada'] as const;
const MOTIVOS = ['no_resuelve', 'rompe_otra', 'falta_video', 'incompleta', 'mal_entendida'];

/* El resumen es para PROGRAMAR, no para archivar. Por eso el prompt prohíbe
   adornar y obliga a decir dónde se toca y con qué se da por buena: son los dos
   datos por los que desarrollo vuelve a preguntar. */
const SYSTEM_RESUMEN = `Resumes una orden de trabajo de SACS (plataforma de punto de venta y gestión para retail en México) para que el equipo de desarrollo la entienda en veinte segundos.

Recibes lo que escribió quien la levantó: puede venir largo y repetido porque se escribió para dejar constancia de lo acordado con el cliente.

REGLAS QUE NO SE ROMPEN:
- NO inventes nada. Si algo no está en el texto, no existe. No supongas pantallas, campos ni tiempos.
- Nada de adornos ni de lenguaje corporativo. Español de México, directo.
- Cada punto empieza con una etiqueta en negritas seguida de dos puntos, así: "Qué falta hoy: ...".
- Entre 4 y 7 puntos. Uno por idea; si dos dicen lo mismo, van juntos.
- Incluye SIEMPRE, si están en el texto: qué falta o qué falla hoy, qué debe hacer el sistema, dónde se toca (el módulo o la ruta), con qué se da por buena, y —si viene— qué tiene que mostrar el video de entrega, en un punto que empiece con "El video debe mostrar:".
- Si el texto enumera campos o datos concretos, ponlos en UN punto separados por " · " en vez de en varios renglones.
- Nada de emoji.

Responde ÚNICAMENTE con este JSON:
{ "puntos": ["Qué falta hoy: ...", "Qué debe hacer: ...", "Dónde: ...", "Queda bien cuando: ..."] }`;
const SEL = '*, companies(id, nombre, nombre_comercial), team_members!taller_ordenes_asignado_id_fkey(id, nombre)';

/** Campos que la pantalla puede mandar. Lista blanca: un update con `folio` o
 *  `rebotes` colados falsearía la métrica que este módulo existe para medir. */
function limpia(b: any) {
  const p: any = {};
  const txt = (k: string, max = 4000) => { if (typeof b?.[k] === 'string') p[k] = b[k].trim().slice(0, max) || null; };
  txt('titulo', 200); txt('problema'); txt('esperado'); txt('pasos'); txt('criterios');
  txt('modulo', 120); txt('evidencia_url', 600); txt('video_url', 600); txt('verificacion');
  txt('entorno', 160); txt('sucursal', 160); txt('usuario_caso', 160); txt('dato_caso', 200);
  txt('espera_cliente', 300);
  // El resumen del paso 1 que lee desarrollo. Se edita a mano cuando el
  // generado no dice lo importante; nunca sustituye a `problema`/`esperado`.
  txt('resumen', 3000);
  // Qué tiene que MOSTRAR el video de entrega. Lo pide quien levanta la orden,
  // junto al criterio: es la misma pregunta vista desde la cámara.
  txt('video_pide', 1500);
  if (['falla', 'mejora'].includes(b?.tipo)) p.tipo = b.tipo;
  /* baja · alta · urgente. «media» se retiró: no significaba nada —nadie
     programa por lo que «estorba»— y las 18 órdenes que la tenían pasaron a
     baja. Se sigue aceptando por si llega de una pantalla vieja, y cae en baja. */
  if (['alta', 'urgente', 'baja'].includes(b?.prioridad)) p.prioridad = b.prioridad;
  else if (b?.prioridad === 'media') p.prioridad = 'baja';
  if (['cortesia', 'pagada'].includes(b?.cobro)) p.cobro = b.cobro;
  if ('asignado_id' in b) p.asignado_id = b.asignado_id || null;
  if ('fecha_prometida' in b) p.fecha_prometida = b.fecha_prometida || null;
  if (b?.dias_revision !== undefined) p.dias_revision = Math.min(30, Math.max(1, Number(b.dias_revision) || 3));
  return p;
}

/** Quién movió la orden, con nombre y no con un uuid: la bitácora se lee. */
const quien = (u: any) => u?.nombre || u?.email || 'CRM';

async function apunta(orden_id: string, actor: string, de: string | null, a: string | null, nota?: string) {
  await supabase.from('taller_bitacora').insert({ orden_id, actor, de, a, nota: nota || null }).then(() => {}, () => {});
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const id = url.searchParams.get('id') || '';
  if (id) {
    const { data: orden, error } = await supabase.from('taller_ordenes').select(SEL).eq('id', id).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!orden) return json({ error: 'Esa orden ya no existe.' }, 404);
    const [bit, com, rev, lig] = await Promise.all([
      supabase.from('taller_bitacora').select('*').eq('orden_id', id).order('at', { ascending: true }),
      supabase.from('taller_comentarios').select('*').eq('orden_id', id).order('at', { ascending: true }),
      supabase.from('taller_revisiones').select('*').eq('orden_id', id).order('at', { ascending: true }),
      supabase.from('taller_orden_mejoras').select('mejora_id, mejoras(id, titulo, estado, company_id, companies(nombre_comercial, nombre))').eq('orden_id', id),
    ]);
    return json({
      orden, bitacora: bit.data || [], comentarios: com.data || [],
      revisiones: rev.data || [], mejoras: lig.data || [],
      yo: { id: user.id, nombre: quien(user), rol: user.role },
    });
  }

  /* Con `company_id` devuelve el taller DE ESA CUENTA. Lo pide la pestaña
     Taller de la ficha del cliente: traer las 500 órdenes del CRM para pintar
     tres es tráfico que se paga en cada apertura de ficha. */
  const empresa = url.searchParams.get('company_id') || '';
  let q = supabase.from('taller_ordenes').select(SEL)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (empresa) q = q.eq('company_id', empresa);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const { data: equipo } = await supabase.from('team_members')
    .select('id, nombre, rol').eq('activo', true).order('nombre');

  /* Lo que está comprometido con el cliente y todavía no tiene orden. Es el
     puente con lo que ya existe: sin esto el taller nace vacío el primer día
     y nadie lo abre dos veces. */
  const { data: ligadas } = await supabase.from('taller_orden_mejoras')
    .select('mejora_id, orden_id, mejoras(booking_id, modulo)');
  const yaLigadas = new Set((ligadas || []).map((x: any) => x.mejora_id));
  /* Qué renglón del cliente está ya en el taller y cómo va: es lo que deja a la
     ficha del cliente decir "en desarrollo, para el 26" sin copiar nada. */
  const porOrden = new Map((data || []).map((o: any) => [o.id, o]));
  const ligas: Record<string, any> = {};
  for (const l of ligadas || []) {
    const o: any = porOrden.get(l.orden_id);
    // El módulo viaja en la liga: la ficha del cliente filtra por él y sin esto
    // tendría que pedir la orden completa de cada renglón.
    if (o) ligas[l.mejora_id] = { id: o.id, folio: o.folio, etapa: o.etapa, fecha_prometida: o.fecha_prometida, modulo: o.modulo || null };
  }
  /* Lo comprometido con el cliente que todavía no tiene orden. Sin `tipo` —en
     null— también cuenta: los renglones viejos nacieron antes de que el campo
     existiera y son justo los que llevan más tiempo prometidos. La capacitación
     y los videos se quedan fuera a propósito: los da el consultor, no el
     taller, y en un tablero de ingeniería solo meten ruido. */
  let qa = supabase.from('mejoras')
    .select('id, titulo, tipo, categoria, estado, modulo, fecha_compromiso, company_id, companies(nombre, nombre_comercial)')
    .is('archived_at', null)
    .in('estado', ['cotizada', 'en_proceso'])
    .in('categoria', ['personalizacion', 'plugin', 'modulo', 'ajuste']);
  if (empresa) qa = qa.eq('company_id', empresa);
  const { data: abiertas } = await qa;
  const sinOrden = (abiertas || []).filter((m: any) => !yaLigadas.has(m.id));

  /* EL VALOR DE LA CUENTA. Una cuenta es un proyecto, y al abrirlo hay que
     saber de quién se trata: cuánto paga al año, cuánto trabajo ya se le cobró
     y cuánto se le ha entregado. Sin eso, «14 órdenes» es el mismo renglón para
     el cliente de $200 mil y para el de cortesía.
     Va en el MISMO viaje que la lista —tres consultas agregadas— y no en una
     por cuenta al abrirla: con veinte cuentas serían veinte viajes. */
  const ids = Array.from(new Set((data || []).map((o: any) => o.company_id).filter(Boolean)));
  const cuentas: Record<string, any> = {};
  if (ids.length) {
    const [subs, entregadas, cos] = await Promise.all([
      supabase.from('subscriptions').select('company_id, arr, estado').in('company_id', ids),
      supabase.from('mejoras').select('company_id, valor, cortesia').in('company_id', ids)
        .is('archived_at', null).eq('estado', 'entregada'),
      supabase.from('companies').select('id, sacs_account, giro').in('id', ids),
    ]);
    for (const id of ids) cuentas[id as string] = { arr: 0, entregadas: 0, sacs: null, giro: null };
    for (const x of subs.data || []) {
      if (x.estado === 'activa' && cuentas[x.company_id]) cuentas[x.company_id].arr += Number(x.arr || 0);
    }
    for (const m of entregadas.data || []) if (cuentas[m.company_id]) cuentas[m.company_id].entregadas++;
    for (const c of cos.data || []) if (cuentas[c.id]) { cuentas[c.id].sacs = c.sacs_account; cuentas[c.id].giro = c.giro; }
  }

  /* DE QUÉ REUNIÓN SALIÓ Y EN QUÉ MÓDULO SE TRABAJA.
     Las dos viven en el renglón del cliente (`mejoras`) y no en la orden: la
     reunión ya venía guardada ahí desde que la minuta reparte —64 de las 81 de
     Ruben's la traen— y duplicarla en la orden sería tener dos verdades. El
     taller las LEE por la liga y las escribe en el mismo sitio.
     El módulo se lee de la orden si lo tiene y si no, del renglón: las órdenes
     viejas lo capturaron allá. */
  const meta: Record<string, any> = {};
  for (const l of ligadas || []) {
    const m: any = (l as any).mejoras;
    if (!m || !porOrden.has(l.orden_id)) continue;
    const o: any = porOrden.get(l.orden_id);
    meta[l.orden_id] = { mejora_id: l.mejora_id, booking_id: m.booking_id || null, modulo: o?.modulo || m.modulo || null };
  }
  /* Solo el encabezado de las reuniones REFERIDAS: para pintar la pastilla
     hacen falta fecha y asunto, nada más. La lista completa de una cuenta se
     pide al abrir el selector, que es cuando de verdad se necesita. */
  const bIds = Array.from(new Set(Object.values(meta).map((x: any) => x.booking_id).filter(Boolean)));
  const reuniones: Record<string, any> = {};
  if (bIds.length) {
    const { data: bk } = await supabase.from('bookings').select('id, fecha, asunto').in('id', bIds as string[]);
    for (const b2 of bk || []) reuniones[b2.id] = { fecha: b2.fecha, asunto: b2.asunto || '' };
  }

  /* LAS PREGUNTAS ABIERTAS. Van en el mismo viaje que la lista porque son la
     otra mitad de la bandeja: lo que desarrollo no entendió y está esperando
     respuesta para poder seguir. Una orden detenida por una duda sin contestar
     se ve igual que una orden que nadie ha tocado, y no es lo mismo. */
  const { data: preg } = await supabase.from('taller_comentarios')
    .select('id, orden_id, autor, texto, at')
    .eq('tipo', 'pregunta').is('resuelta_at', null)
    .order('at', { ascending: true }).limit(100);
  const preguntas = (preg || []).filter((q: any) => porOrden.has(q.orden_id)).map((q: any) => {
    const o: any = porOrden.get(q.orden_id);
    return { ...q, folio: o.folio, titulo: o.titulo, etapa: o.etapa,
      cuenta: o.companies?.nombre_comercial || o.companies?.nombre || 'Sin cuenta' };
  });

  return json({
    ordenes: data || [],
    equipo: equipo || [],
    preguntas,
    ligas,
    sinOrden,
    cuentas,
    meta,
    reuniones,
    yo: { id: user.id, nombre: quien(user), rol: user.role },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const accion = String(b?.accion || '');

  // ── Crear la orden desde un renglón del cliente ──
  // No se recaptura nada: título, cuenta, módulo y el cobro viajan del renglón.
  if (accion === 'crear' || accion === 'importar') {
    const ids: string[] = accion === 'importar'
      ? (b?.mejora_ids || []).map(String)
      : [String(b?.mejora_id || '')].filter(Boolean);
    if (!ids.length) return json({ error: 'No hay nada que mandar al taller.' }, 400);

    const { data: yaLig } = await supabase.from('taller_orden_mejoras').select('mejora_id').in('mejora_id', ids);
    const ligadas = new Set((yaLig || []).map((x: any) => x.mejora_id));
    const nuevas = ids.filter(id => !ligadas.has(id));
    if (!nuevas.length) return json({ error: 'Eso ya está en el taller.' }, 400);

    const { data: mej } = await supabase.from('mejoras')
      .select('id, titulo, descripcion, tipo, categoria, modulo, company_id, cobro, url, booking_id')
      .in('id', nuevas);

    const creadas: any[] = [];
    for (const m of mej || []) {
      const tipo = m.tipo === 'falla' ? 'falla' : 'mejora';
      const { data: orden, error } = await supabase.from('taller_ordenes').insert({
        company_id: m.company_id,
        tipo,
        titulo: m.titulo,
        problema: tipo === 'falla' ? (m.descripcion || null) : null,
        esperado: null,
        criterios: tipo === 'mejora' ? (m.descripcion || null) : null,
        modulo: m.modulo || null,
        evidencia_url: m.url || null,
        cobro: m.cobro || null,
        solicitante_id: user.id,
        etapa: 'recibida',
      }).select(SEL).single();
      if (error || !orden) continue;
      await supabase.from('taller_orden_mejoras').insert({ orden_id: orden.id, mejora_id: m.id });
      await apunta(orden.id, quien(user), null, 'recibida', 'Llegó desde la ficha del cliente');
      creadas.push(orden);
    }
    return json({ ok: true, creadas: creadas.length, ordenes: creadas }, 201);
  }

  // ── La conversación técnica vive en la orden ──
  if (accion === 'comentar') {
    const id = String(b?.id || '');
    const texto = String(b?.texto || '').trim().slice(0, 4000);
    if (!id || !texto) return json({ error: 'Falta el texto.' }, 400);
    const { error } = await supabase.from('taller_comentarios').insert({ orden_id: id, autor: quien(user), texto });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── La revisión del dueño: aprobar o pedir cambios ──
  // Aprobar CIERRA los renglones del cliente (los N, si el bug era compartido)
  // con la fecha y el video. Pedir cambios devuelve a desarrollo y cuenta un
  // rebote con motivo de lista cerrada: en texto libre no se puede contar cuál
  // se repite, que es justo lo que dice si el problema es cómo se pide o cómo
  // se entrega.
  if (accion === 'revisar') {
    const id = String(b?.id || '');
    const veredicto = b?.veredicto === 'aprobada' ? 'aprobada' : 'cambios';
    const motivo = MOTIVOS.includes(b?.motivo) ? b.motivo : null;
    const nota = String(b?.nota || '').trim().slice(0, 1000) || null;
    if (!id) return json({ error: 'Falta la orden.' }, 400);
    if (veredicto === 'cambios' && !motivo) return json({ error: 'Dinos por qué la devuelves: sin motivo el rebote no se puede contar.' }, 400);

    const { data: o } = await supabase.from('taller_ordenes').select('*, companies(nombre, nombre_comercial)').eq('id', id).maybeSingle();
    if (!o) return json({ error: 'Esa orden ya no existe.' }, 404);
    if (o.etapa !== 'lista') return json({ error: 'Solo se revisa lo que está marcado como listo.' }, 400);

    // Cuánto tardaste TÚ. Se guarda con la revisión porque la ventana que pidió
    // desarrollo se mide igual que la fecha que ellos pusieron.
    const dias = o.lista_at ? (Date.now() - Date.parse(o.lista_at)) / 86400000 : null;
    await supabase.from('taller_revisiones').insert({
      orden_id: id, revisor: quien(user), veredicto, motivo, nota,
      dias_tardaste: dias != null ? Math.round(dias * 10) / 10 : null,
    });

    const cuenta = o.companies?.nombre_comercial || o.companies?.nombre || 'la cuenta';
    if (veredicto === 'aprobada') {
      await supabase.from('taller_ordenes').update({
        etapa: 'entregada', entregada_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', id);
      await apunta(id, quien(user), o.etapa, 'entregada', 'Aprobada' + (nota ? ': ' + nota : ''));

      // Cierra el renglón (o los N) en la ficha del cliente. Esto es lo único
      // que cruza el muro: qué se hizo, cuándo y el video.
      const { data: lig } = await supabase.from('taller_orden_mejoras').select('mejora_id').eq('orden_id', id);
      for (const l of lig || []) {
        const cierre: any = {
          estado: 'entregada',
          fecha_entrega: hoy(),
          tipo: o.tipo,
          updated_at: new Date().toISOString(),
        };
        if (o.video_url) cierre.url = o.video_url;
        if (o.cobro) { cierre.cobro = o.cobro; cierre.cortesia = o.cobro === 'cortesia'; }
        await supabase.from('mejoras').update(cierre).eq('id', l.mejora_id);
      }
      await notificar({
        clave: 'taller_aprobada:' + id, tipo: 'taller_aprobada', nivel: 'info', destino: 'taller',
        company_id: o.company_id,
        titulo: `${cuenta} · ${o.folio} aprobada y entregada al cliente`,
        detalle: o.titulo,
      });
      return json({ ok: true, etapa: 'entregada' });
    }

    // Pedir cambios. Al tercero sale del flujo: no vuelve a "lista" sin que el
    // criterio de aceptación quede escrito.
    const rebotes = (o.rebotes || 0) + 1;
    const etapa = rebotes >= 3 ? 'trabada' : 'devuelta';
    await supabase.from('taller_ordenes').update({
      etapa, rebotes, lista_at: null, revision_vence: null, updated_at: new Date().toISOString(),
    }).eq('id', id);
    await apunta(id, quien(user), 'lista', etapa, 'Pidió cambios: ' + motivo + (nota ? ' — ' + nota : ''));
    await notificar({
      clave: `taller_devuelta:${id}:${rebotes}`, tipo: 'taller_devuelta',
      nivel: rebotes >= 2 ? 'alerta' : 'info', destino: 'taller', company_id: o.company_id,
      titulo: `${cuenta} · ${o.folio} devuelta (${rebotes}º) — ${motivo.replace(/_/g, ' ')}`,
      detalle: o.titulo,
    });
    return json({ ok: true, etapa, rebotes });
  }

  /* ── Nace en el taller, pero el cliente la ve ──
     Antes una orden solo podía venir de un renglón que ya existía en la ficha
     del cliente. Lo que se detectaba trabajando —una falla que salió probando,
     algo que hay que arreglar y nadie levantó— se quedaba sin registrar o se
     capturaba dos veces: una aquí y otra allá.
     Esto crea LAS DOS a la vez y las liga. Sin la mejora, el trabajo existe
     para desarrollo y no existe para el cliente: no sale en su ficha, ni en el
     reporte de entregas, ni se cierra cuando se aprueba. */
  if (accion === 'nueva') {
    const company_id = String(b?.company_id || '');
    const titulo = String(b?.titulo || '').trim().slice(0, 200);
    if (!company_id || !titulo) return json({ error: 'Falta el cliente o el nombre.' }, 400);
    const tipo = b?.tipo === 'falla' ? 'falla' : 'mejora';
    const CATS = ['personalizacion', 'plugin', 'modulo', 'ajuste'];
    const categoria = CATS.includes(b?.categoria) ? b.categoria : 'personalizacion';
    const p = limpia(b);

    const { data: mej, error: eM } = await supabase.from('mejoras').insert({
      company_id, titulo, descripcion: p.problema || p.esperado || null,
      categoria, tipo, estado: 'en_proceso', visible_cliente: true,
      /* De dónde salió. Si se ligó a una junta, el origen se deduce —es junta—
         y el renglón queda colgado de esa minuta en la ficha del cliente: así
         se puede volver a leer qué se dijo el día que se pidió. */
      booking_id: b?.booking_id || null,
      origen: b?.booking_id ? 'junta' : 'manual',
      // El módulo se guarda en los dos: aquí lo usan los reportes del cliente
      // y en la orden lo usa desarrollo. Es el mismo dato, escrito una vez.
      modulo: p.modulo || null,
      cobro: p.cobro || null, cortesia: p.cobro === 'cortesia',
      fecha_compromiso: p.fecha_prometida || null,
      creado_por: quien(user),
    }).select('id').single();
    if (eM || !mej) return json({ error: eM?.message || 'No se pudo registrar en la ficha del cliente.' }, 500);

    const { data: orden, error: eO } = await supabase.from('taller_ordenes').insert({
      ...p, company_id, tipo, titulo, etapa: 'recibida', solicitante_id: user.id,
    }).select(SEL).single();
    if (eO || !orden) {
      // Sin orden, la mejora sola sería un compromiso que nadie va a trabajar.
      await supabase.from('mejoras').delete().eq('id', mej.id).then(() => {}, () => {});
      return json({ error: eO?.message || 'No se pudo crear la orden.' }, 500);
    }
    await supabase.from('taller_orden_mejoras').insert({ orden_id: orden.id, mejora_id: mej.id });
    await apunta(orden.id, quien(user), null, 'recibida', 'Nació en el taller y quedó ligada a la ficha del cliente');
    return json({ ok: true, orden, mejora_id: mej.id }, 201);
  }

  /* ── La duda, pegada a su folio ──
     Antes lo que no se entendía del encargo se preguntaba por WhatsApp: se
     perdía, y la orden acababa rebotando por «mal entendida» sin que nadie
     supiera que había una duda. Ahora la pregunta vive en la orden y aparece en
     la bandeja del dueño de la cuenta hasta que la contesta. */
  if (accion === 'preguntar' || accion === 'responder') {
    const texto = String(b?.texto || '').trim().slice(0, 4000);
    if (!texto) return json({ error: 'Escribe la pregunta.' }, 400);

    if (accion === 'preguntar') {
      const orden_id = String(b?.orden_id || '');
      if (!orden_id) return json({ error: 'Falta la orden.' }, 400);
      const { data: o } = await supabase.from('taller_ordenes')
        .select('id, folio, titulo, company_id, companies(nombre, nombre_comercial)').eq('id', orden_id).maybeSingle();
      if (!o) return json({ error: 'Esa orden ya no existe.' }, 404);
      const { data: q, error } = await supabase.from('taller_comentarios')
        .insert({ orden_id, autor: quien(user), texto, tipo: 'pregunta' }).select('*').single();
      if (error) return json({ error: error.message }, 500);
      const cta = (o as any).companies?.nombre_comercial || (o as any).companies?.nombre || 'Sin cuenta';
      await apunta(orden_id, quien(user), null, null, 'Preguntó: ' + texto.slice(0, 160));
      await notificar({
        clave: 'taller_pregunta:' + q.id, tipo: 'taller_pregunta', nivel: 'alerta', destino: 'taller',
        company_id: o.company_id,
        titulo: `${cta} · ${o.folio} — desarrollo tiene una duda`,
        detalle: texto.slice(0, 200),
      });
      return json({ ok: true, pregunta: q }, 201);
    }

    const pregunta_id = String(b?.pregunta_id || '');
    if (!pregunta_id) return json({ error: 'Falta la pregunta.' }, 400);
    const { data: pq } = await supabase.from('taller_comentarios').select('id, orden_id, resuelta_at').eq('id', pregunta_id).maybeSingle();
    if (!pq) return json({ error: 'Esa pregunta ya no existe.' }, 404);
    const { error: eR } = await supabase.from('taller_comentarios')
      .insert({ orden_id: pq.orden_id, autor: quien(user), texto, tipo: 'respuesta', responde_a: pregunta_id });
    if (eR) return json({ error: eR.message }, 500);
    // La pregunta se marca contestada aunque ya lo estuviera: contestar dos
    // veces es normal; lo que no puede pasar es que siga saliendo en la bandeja.
    await supabase.from('taller_comentarios').update({ resuelta_at: new Date().toISOString() }).eq('id', pregunta_id);
    await apunta(pq.orden_id, quien(user), null, null, 'Contestó: ' + texto.slice(0, 160));
    return json({ ok: true });
  }

  /* ── Varias a la vez ──
     Tres cosas se corrigen SIEMPRE en bloque y nunca de una en una: la fecha
     que se prometió en una junta, de qué reunión salió todo lo que se pidió
     ese día, y en qué parte del sistema se trabaja. Entrar a quince órdenes
     para escribir quince veces «14-sep» es exactamente por lo que el campo
     acaba vacío —módulo estaba en 12 de 81—.
     Lo que no viene en el cuerpo NO se toca: mandar solo `modulo` deja la
     fecha y la reunión como estaban. */
  if (accion === 'lote') {
    const ids: string[] = Array.from(new Set((b?.ids || []).map(String).filter(Boolean))).slice(0, 200) as string[];
    if (!ids.length) return json({ error: 'No hay órdenes seleccionadas.' }, 400);

    const ponFecha = 'fecha_prometida' in (b || {});
    const ponModulo = 'modulo' in (b || {});
    const ponJunta = 'booking_id' in (b || {});
    const ponCobro = 'cobro' in (b || {});
    if (!ponFecha && !ponModulo && !ponJunta && !ponCobro) return json({ error: 'No hay nada que cambiar.' }, 400);

    const fecha = b?.fecha_prometida || null;
    const modulo = typeof b?.modulo === 'string' && b.modulo.trim() ? b.modulo.trim().slice(0, 120) : null;
    const booking = b?.booking_id || null;
    /* Cortesía o pagada. Se decide en bloque porque se decide en bloque: lo que
       salió de una junta va sin cargo COMPLETO, y lo que se cotizó se cobra
       completo. Marcarlo orden por orden es como se llega a un reporte donde
       la mitad dice «sin costo» y la otra mitad de lo mismo no dice nada. */
    const cobro = ['cortesia', 'pagada'].includes(b?.cobro) ? b.cobro : null;
    if (ponCobro && b?.cobro && !cobro) return json({ error: 'El cobro solo puede ser cortesía o pagada.' }, 400);
    if (modulo && !esModuloValido(modulo)) return json({ error: 'Ese módulo no está en el menú de SACS.' }, 400);

    const { data: antes } = await supabase.from('taller_ordenes')
      .select('id, folio, fecha_prometida, fecha_prometida_1, modulo, cobro, company_id').in('id', ids);
    if (!antes?.length) return json({ error: 'Esas órdenes ya no existen.' }, 404);

    const patch: any = { updated_at: new Date().toISOString() };
    if (ponFecha) patch.fecha_prometida = fecha;
    if (ponModulo) patch.modulo = modulo;
    if (ponCobro) patch.cobro = cobro;
    const { error: eU } = await supabase.from('taller_ordenes').update(patch).in('id', ids);
    if (eU) return json({ error: eU.message }, 500);

    /* La PRIMERA fecha se guarda una sola vez: es contra la que se mide si se
       cumplió, y si se reescribe al recorrerla el porcentaje siempre da 100. */
    if (ponFecha && fecha) {
      const virgenes = (antes || []).filter((o: any) => !o.fecha_prometida_1).map((o: any) => o.id);
      if (virgenes.length) await supabase.from('taller_ordenes').update({ fecha_prometida_1: fecha }).in('id', virgenes);
    }

    // El renglón del cliente: ahí viven la reunión de origen y el módulo que
    // sale en sus reportes.
    if (ponJunta || ponModulo || ponCobro) {
      const { data: lig } = await supabase.from('taller_orden_mejoras').select('mejora_id').in('orden_id', ids);
      const mIds = (lig || []).map((x: any) => x.mejora_id);
      if (mIds.length) {
        const pm: any = { updated_at: new Date().toISOString() };
        if (ponJunta) { pm.booking_id = booking; pm.origen = booking ? 'junta' : 'manual'; }
        if (ponModulo) pm.modulo = modulo;
        /* `cortesia` se mueve con `cobro` y no se deja para después: es la
           columna que lee el reporte de entregas para poner «sin costo», y las
           dos desincronizadas son un documento que le cobra al cliente algo que
           se le regaló. */
        if (ponCobro) { pm.cobro = cobro; pm.cortesia = cobro === 'cortesia'; }
        await supabase.from('mejoras').update(pm).in('id', mIds);
      }
    }

    // La bitácora, orden por orden: dentro de seis semanas la pregunta es
    // «¿quién le movió la fecha a esta?», no «¿qué pasó ese martes?».
    const nota = [
      ponFecha ? (fecha ? 'fecha de entrega → ' + fecha : 'se le quitó la fecha') : '',
      ponJunta ? (booking ? 'ligada a una reunión' : 'se le quitó la reunión') : '',
      ponModulo ? (modulo ? 'módulo → ' + modulo : 'se le quitó el módulo') : '',
      ponCobro ? (cobro === 'cortesia' ? 'queda como cortesía' : cobro === 'pagada' ? 'queda como pagada' : 'se le quitó el cobro') : '',
    ].filter(Boolean).join(' · ');
    for (const o of antes || []) await apunta(o.id, quien(user), null, null, 'En bloque: ' + nota);

    return json({ ok: true, n: (antes || []).length });
  }

  /* ── El resumen para desarrollo ──
     Lo que se escribe en el paso 1 se escribe para que quede constancia de lo
     acordado con el cliente, y sale largo: en OT-0013 son 1,900 caracteres.
     Nadie lee eso antes de programar, así que se lee el resumen y se programa
     mal. Esto lo condensa a viñetas —qué falta, qué debe hacer, dónde, con qué
     se da por buena— SIN tocar el original: el acuerdo se queda en las palabras
     de quien lo acordó. */
  if (accion === 'resumir') {
    const id = String(b?.id || '');
    if (!id) return json({ error: 'Falta la orden.' }, 400);
    const { data: o } = await supabase.from('taller_ordenes')
      .select('titulo, tipo, problema, esperado, pasos, criterios, video_pide').eq('id', id).maybeSingle();
    if (!o) return json({ error: 'Esa orden ya no existe.' }, 404);

    const fuente = [
      `TÍTULO: ${o.titulo || ''}`,
      o.problema ? `QUÉ PASA HOY: ${o.problema}` : '',
      o.esperado ? `QUÉ DEBERÍA PASAR: ${o.esperado}` : '',
      o.pasos ? `CÓMO REPRODUCIRLO: ${o.pasos}` : '',
      o.criterios ? `CON QUÉ SE DA POR BUENA: ${o.criterios}` : '',
      o.video_pide ? `QUÉ TIENE QUE MOSTRAR EL VIDEO: ${o.video_pide}` : '',
    ].filter(Boolean).join('\n\n');
    if (fuente.length < 60) return json({ error: 'Todavía no hay suficiente escrito en el paso 1 para resumir.' }, 400);

    const out = await pedirJSON({ system: SYSTEM_RESUMEN, user: fuente }).catch(() => null);
    const puntos: string[] = Array.isArray((out as any)?.puntos)
      ? (out as any).puntos.filter((x: any) => typeof x === 'string' && x.trim()).slice(0, 8).map((x: string) => x.trim())
      : [];
    if (!puntos.length) return json({ error: 'No se pudo armar el resumen. Escríbelo a mano o vuelve a intentar.' }, 500);

    const resumen = puntos.map(x => '· ' + x).join('\n');
    await supabase.from('taller_ordenes').update({ resumen, updated_at: new Date().toISOString() }).eq('id', id);
    return json({ ok: true, resumen });
  }

  return json({ error: 'Acción desconocida.' }, 400);
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!id) return json({ error: 'Falta la orden.' }, 400);

  const { data: o } = await supabase.from('taller_ordenes').select('*, companies(nombre, nombre_comercial)').eq('id', id).maybeSingle();
  if (!o) return json({ error: 'Esa orden ya no existe.' }, 404);

  const p = limpia(b);
  const cuenta = o.companies?.nombre_comercial || o.companies?.nombre || 'la cuenta';

  // ── La fecha la pone quien va a hacer el trabajo ──
  // La PRIMERA se guarda aparte y no se vuelve a tocar: medir el cumplimiento
  // contra la fecha ya recorrida siempre da 100%.
  if ('fecha_prometida' in p && p.fecha_prometida && !o.fecha_prometida_1) p.fecha_prometida_1 = p.fecha_prometida;
  if ('fecha_prometida' in p && o.fecha_prometida && p.fecha_prometida && o.fecha_prometida !== p.fecha_prometida) {
    await apunta(id, quien(user), null, null, `Movió la fecha del ${o.fecha_prometida} al ${p.fecha_prometida}` + (b?.motivo ? ': ' + b.motivo : ''));
  }

  // ── Pedir un dato congela el reloj ──
  // Ni les reclamas un SLA que empezó sin poder trabajar, ni se quedan colgados
  // de un dato que nunca llegó.
  if ('falta_dato' in b) {
    const falta = String(b.falta_dato || '').trim().slice(0, 300);
    p.falta_dato = falta || null;
    p.falta_dato_at = falta ? new Date().toISOString() : null;
    if (falta) {
      await apunta(id, quien(user), null, null, 'Falta un dato: ' + falta);
      await notificar({
        clave: `taller_falta_dato:${id}:${Date.now()}`, tipo: 'taller_falta_dato', nivel: 'alerta',
        destino: 'taller', company_id: o.company_id,
        titulo: `${cuenta} · ${o.folio}: falta un dato para poder trabajarla`,
        detalle: falta,
      });
    } else {
      await apunta(id, quien(user), null, null, 'Se completó el dato que faltaba');
    }
  }

  // ── Mover de etapa, con las dos puertas que no se negocian ──
  const etapa = (ETAPAS as readonly string[]).includes(String(b?.etapa)) ? String(b.etapa) : null;
  if (etapa && etapa !== o.etapa) {
    const videoNuevo = p.video_url ?? o.video_url;
    const verifNueva = p.verificacion ?? o.verificacion;
    const fechaNueva = ('fecha_prometida' in p ? p.fecha_prometida : o.fecha_prometida);
    const criteriosNuevos = p.criterios ?? o.criterios;

    if (etapa === 'desarrollo' && !fechaNueva) {
      return json({ error: 'Antes de empezar hay que decir para cuándo: ponle fecha de entrega.' }, 400);
    }
    if (etapa === 'desarrollo' && !criteriosNuevos) {
      return json({ error: 'Escribe con qué se va a dar por buena antes de desarrollarla.' }, 400);
    }
    if (etapa === 'lista' && !videoNuevo && !verifNueva) {
      return json({ error: 'Sin video de entrega (o una nota de cómo verificarlo) no se puede marcar lista.' }, 400);
    }
    if (etapa === 'lista' && o.etapa === 'trabada' && !criteriosNuevos) {
      return json({ error: 'Esta orden va por su tercer rebote: no vuelve a revisión sin criterios escritos.' }, 400);
    }

    p.etapa = etapa;
    if (etapa === 'lista') {
      p.lista_at = new Date().toISOString();
      const dias = p.dias_revision ?? o.dias_revision ?? 3;
      p.revision_vence = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
      await notificar({
        clave: `taller_lista:${id}:${o.rebotes || 0}`, tipo: 'taller_lista', nivel: 'alerta', destino: 'taller',
        company_id: o.company_id,
        titulo: `${cuenta} · ${o.folio} lista para tu OK`,
        detalle: `${o.tipo === 'falla' ? 'Falla' : 'Mejora'}: ${o.titulo}. Tienes ${dias} día${dias === 1 ? '' : 's'} para revisarla.`,
      });
    }
    if (etapa === 'espera') p.espera_desde = new Date().toISOString();
    if (o.etapa === 'espera' && etapa !== 'espera') p.espera_desde = null;
    await apunta(id, quien(user), o.etapa, etapa, b?.nota || null);
  }

  /* El nombre viaja al renglón del cliente. La orden y la mejora son la MISMA
     cosa vista desde dos lados —así está construido— y si solo se renombra de
     este lado, el cliente sigue viendo el nombre viejo en su ficha y en el
     reporte de entregas: dos nombres para lo mismo son dos verdades. */
  if (p.titulo && p.titulo !== o.titulo) {
    const { data: lig } = await supabase.from('taller_orden_mejoras').select('mejora_id').eq('orden_id', id);
    for (const l of lig || []) {
      await supabase.from('mejoras').update({ titulo: p.titulo, updated_at: new Date().toISOString() })
        .eq('id', l.mejora_id).then(() => {}, () => {});
    }
    await apunta(id, quien(user), null, null, `Le cambió el nombre: «${o.titulo}» → «${p.titulo}»`);
  }

  p.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('taller_ordenes').update(p).eq('id', id).select(SEL).single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, orden: data });
};

// Archiva, no borra: una orden que ya se trabajó es historia del cliente.
export const DELETE: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!id) return json({ error: 'Falta la orden.' }, 400);
  const { error } = await supabase.from('taller_ordenes').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) return json({ error: error.message }, 500);

  /* Si se levantó por error, el renglón del cliente TAMBIÉN se va. Archivar
     solo la orden dejaba al cliente con un compromiso en su ficha que nadie iba
     a trabajar —y que salía en su reporte—: peor que no haberlo capturado.
     Se archiva, no se borra: una cosa que se le prometió a un cliente, aunque
     haya sido por error, es historia de esa cuenta.
     Solo pasa cuando se pide explícitamente (`con_mejora`): la orden también se
     archiva cuando el trabajo se abandona por otras razones y ahí el renglón
     del cliente sí se queda. */
  if (b?.con_mejora) {
    const { data: lig } = await supabase.from('taller_orden_mejoras').select('mejora_id').eq('orden_id', id);
    for (const l of lig || []) {
      await supabase.from('mejoras')
        .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', l.mejora_id).then(() => {}, () => {});
    }
  }
  return json({ ok: true });
};
