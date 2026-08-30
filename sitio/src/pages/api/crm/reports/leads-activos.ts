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
  formulario: 4,          // el tipo REAL que escribe leads/captura.ts (no `form_submit`, que no existe)
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
  formulario: 'Volvió a llenar un formulario',
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

/**
 * NO TODA VISITA ES IGUAL. Las visitas de un lead SÍ traen `page_url` en su
 * metadata (medido: /planes, /producto/punto-de-venta, …). Entrar a PRECIOS no
 * es lo mismo que leer el blog, y hasta ahora las dos contaban igual.
 */
const RUTA_CALIENTE = /^\/(planes|precios|contacto|prueba-gratis|demo)/i;
const rutaDe = (a: any): string | null => a?.metadata?.page_url || null;

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

  // Se piden solo los tipos que cuentan: filtrar en el servidor evita traer el
  // ruido de máquina para tirarlo aquí.
  //
  // Se traen 60 DÍAS, no solo la ventana, y se parte en memoria. Con 326 filas
  // medidas en 60 días eso no cuesta nada, y sirve para dos cosas que una sola
  // ventana no puede contestar: contra qué comparar («¿es su mejor semana?») y
  // quiénes dieron señal fuerte ANTES pero llevan rato callados — que son
  // justo los que hay que rescatar y los únicos que nunca aparecerían en una
  // lista de «últimos 7 días».
  /* El histórico tiene que ser MÁS LARGO que la ventana, no «60 o la ventana»:
     con `dias=90` los dos tramos coincidían, el histórico quedaba vacío,
     `rescatar` salía siempre vacío y `su_record` se volvía cierto para
     cualquiera con 2 señales. Se pide al menos otro tanto de historia. */
  const VENTANA_LARGA = Math.max(60, dias * 2);
  const desdeLargo = new Date(Date.now() - VENTANA_LARGA * 864e5).toISOString();
  const tiposUtiles = [...Object.keys(DEL_LEAD), ...Object.keys(NUESTRA)];
  const { data: actsTodo, error: e2 } = await supabase
    .from('activities')
    .select('contact_id, tipo, titulo, descripcion, created_at, metadata, quote_id')
    .gte('created_at', desdeLargo)
    .in('tipo', tiposUtiles)
    .in('contact_id', [...porId.keys()])
    .order('created_at', { ascending: false })
    /* 1000 y no 8000: PostgREST corta en 1000 EN ESTE PROYECTO (max_rows), así
       que un limit mayor no trae más — solo miente. Pedirlo explícito deja
       claro dónde está el techo, y como el orden es descendente lo que se
       perdería son las filas VIEJAS: justo las del histórico. Hoy son 326 en
       60 días, pero se avisa en la respuesta cuando se toca el tope para que
       nadie interprete un «ritmo previo» hundido como que el lead despertó. */
    .limit(1000);
  if (e2) return json({ error: e2.message }, 500);
  const topeTocado = (actsTodo || []).length >= 1000;
  const acts = (actsTodo || []).filter(a => a.created_at >= desde);

  // Cotizaciones: el monto cambia el peso. Abrir una de $80,000 no es lo mismo
  // que abrir una de $5,000, y hasta ahora pesaban idéntico.
  /* Se mira el error en vez de tragárselo: si esta consulta falla, `cots`
     queda undefined y TODAS las cotizaciones salen en $0 — una respuesta que
     parece correcta y no lo es. Aquí no se aborta (la lista sigue sirviendo
     sin montos), pero se avisa en la respuesta para que no se lea un cero
     como «no tiene cotización». */
  const { data: cots, error: eCot } = await supabase
    .from('quotes')
    .select('id, total, estado, contact_id, created_at')
    .in('contact_id', [...porId.keys()]);
  const cotPorId = new Map((cots || []).map((q: any) => [q.id, q]));

  // Ventana de 24 h de WhatsApp, desde la columna que ya la mantiene: sin esto
  // el botón «Abrir conversación» te lleva y ALLÁ te enteras de que hay que
  // usar plantilla. Saberlo antes cambia con qué vas a abrir.
  const { data: convs, error: eConv } = await supabase
    .from('wa_conversaciones')
    .select('id, contact_id, telefono, ultimo_entrante_at')
    .in('contact_id', [...porId.keys()]);
  const convPorContacto = new Map<string, any>();
  // Se ordena ANTES de quedarse con la primera: un contacto puede tener más de
  // una conversación (números distintos, o una migrada), la consulta no
  // garantiza orden, y quedarse con cualquiera hacía que la ventana de 24 h se
  // leyera de la conversación equivocada — diciendo «abierta» sobre un chat
  // muerto, que es el peor error posible aquí porque manda a escribir libre y
  // WhatsApp lo rechaza.
  for (const c of [...(convs || [])].sort((a: any, b: any) =>
    String(b.ultimo_entrante_at || '').localeCompare(String(a.ultimo_entrante_at || '')))) {
    if (c.contact_id && !convPorContacto.has(c.contact_id)) convPorContacto.set(c.contact_id, c);
  }

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
        company_id: c.company_id || null,
        whatsapp: c.whatsapp || null,
        email: c.email || null,
        ciclo: c.lifecycle_stage || null,
        etapa: c.pipeline_stage || null,
        senales: 0,
        puntos: 0,
        paginas: {} as Record<string, number>,
        _vistas: new Set<string>(),
        visitas_repetidas: 0,
        cotizacion: null as any,
        // Para saber si está subiendo o enfriándose sin pedir otra consulta.
        senales_recientes: 0, senales_antes: 0,
        tipos: {} as Record<string, number>,
        wa_conversation_id: null as string | null,
        ultima: null as any,
        linea: [] as any[],
      };
      porLead.set(a.contact_id, f);
    }
    const ruta = rutaDe(a);
    const caliente = a.tipo === 'page_visit' && !!ruta && RUTA_CALIENTE.test(ruta);
    const item = {
      tipo: a.tipo,
      de: delLead ? 'lead' : 'nosotros',
      que: (delLead ? DEL_LEAD : NUESTRA)[a.tipo] || a.tipo,
      detalle: a.titulo || a.descripcion || null,
      cuando: a.created_at,
      ruta,
      peso: delLead ? (PESO[a.tipo] ?? 1) : 0,
    };
    // RECARGAS DE LA MISMA PÁGINA, EL MISMO DÍA: no son interés nuevo, son una
    // pestaña abierta. `/api/tracking/identify` escribe una fila por CADA
    // carga, sin freno; medido, un contacto con 32 visitas en un día se iba a
    // 160 puntos y encabezaba la lista.
    //
    // El descarte va ANTES de tocar cualquier contador, y antes incluso de la
    // línea de tiempo. La primera versión las contaba aparte pero NO las
    // excluía: seguían sumando señal y puntos mientras la pantalla decía
    // «no cuentan como señal». Un contador que miente es peor que no tenerlo.
    if (delLead && a.tipo === 'page_visit' && ruta) {
      const llave = `${ruta}|${a.created_at.slice(0, 10)}`;
      if (f._vistas.has(llave)) { f.visitas_repetidas++; continue; }
      f._vistas.add(llave);
      f.paginas[ruta] = (f.paginas[ruta] || 0) + 1;
    }

    if (delLead) {
      f.senales++;
      f.tipos[a.tipo] = (f.tipos[a.tipo] || 0) + 1;

      // La cotización: monto y cuántas veces la abrió. `views` viene en la
      // propia actividad («3ª vez»), y el total sale de `quotes`.
      if (a.tipo === 'cotizacion_vista' || a.tipo === 'quote_viewed') {
        /* DOS ESCRITORES, DOS FORMAS. `cotizacion_vista` guarda el id en
           metadata (27 filas) y `quote_viewed` en la COLUMNA quote_id (lo hace
           quotes/vista.ts). Leyendo solo metadata, la mitad de las cotizaciones
           salía en $0 y el peso por monto —la razón de traer la tabla— no se
           aplicaba nunca en ese camino. */
        const qid = a.quote_id || a.metadata?.quote_id;
        const cot = qid ? cotPorId.get(qid) : null;
        const vistas = Number(a.metadata?.views || 1);
        if (!f.cotizacion || Number(cot?.total || 0) > Number(f.cotizacion.total || 0)) {
          f.cotizacion = {
            id: qid || null,
            folio: (a.titulo || '').match(/COT-\d+/)?.[0] || null,
            total: Number(cot?.total || 0),
            estado: cot?.estado || null,
            vistas,
            cuando: a.created_at,
          };
        }
      }

      /* El peso: la ruta caliente vale como una señal fuerte, y la cotización
         escala con el monto. Los topes existen para que una cotización enorme
         no aplaste el resto de la señal —el objetivo es ordenar una lista de
         trabajo, no calcular un pronóstico—. */
      let peso = PESO[a.tipo] ?? 1;
      if (caliente) peso = 5;
      if (a.tipo === 'cotizacion_vista' || a.tipo === 'quote_viewed') {
        const cot = (a.quote_id || a.metadata?.quote_id) ? cotPorId.get(a.quote_id || a.metadata.quote_id) : null;
        const t = Number(cot?.total || 0);
        peso += t >= 50000 ? 3 : t >= 20000 ? 2 : t > 0 ? 1 : 0;
        peso += Math.min(2, Math.max(0, Number(a.metadata?.views || 1) - 1));   // volvió a abrirla
      }
      f.puntos += peso * frescura(a.created_at);
      /* La mitad RECIENTE contra la mitad vieja de la propia ventana, no «3
         días» fijos. Con la ventana en 7 el corte queda en 3.5 —casi igual que
         antes— pero deja de romperse en los extremos: con `dias=1` o `dias=3`
         todo caía en el tramo reciente, `senales_antes` era siempre 0 y NADIE
         podía salir «enfriándose». Y con 30 días, 3 era un corte arbitrario. */
      if (antiguedad(a.created_at) < dias / 2) f.senales_recientes++; else f.senales_antes++;
    }
    if (!f.wa_conversation_id && a.metadata?.wa_conversation_id) f.wa_conversation_id = a.metadata.wa_conversation_id;
    // `acts` viene de más nuevo a más viejo: la primera de cada lead es la última.
    if (!f.ultima) f.ultima = item;
    if (f.linea.length < 25) f.linea.push(item);
  }

  /* SU PROPIO HISTORIAL. Un absoluto miente: un lead que siempre da 1 señal y
     esta semana dio 3 está despertando, y uno que siempre da 10 y esta semana
     dio 6 se está apagando — con el mismo número de por medio. Se compara la
     ventana contra su ritmo del resto de los 60 días. */
  const historico = new Map<string, number>();
  for (const a of actsTodo || []) {
    if (a.created_at >= desde) continue;               // eso ya es la ventana
    if (!DEL_LEAD[a.tipo]) continue;
    historico.set(a.contact_id, (historico.get(a.contact_id) || 0) + 1);
  }

  const leads = [...porLead.values()].map(f => {
    f.puntos = Math.round(f.puntos * 10) / 10;
    delete f._vistas;                                   // Set no serializa a JSON

    // Las páginas, de más vista a menos.
    f.paginas = Object.entries(f.paginas as Record<string, number>)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([ruta, n]) => ({ ruta, n, caliente: RUTA_CALIENTE.test(ruta) }));

    // Ventana de 24 h: null cuando no hay conversación (nunca escribió).
    const cv = convPorContacto.get(f.id);
    f.wa_conversation_id = f.wa_conversation_id || cv?.id || null;
    f.wa_ventana = cv?.ultimo_entrante_at
      ? (Date.now() - new Date(cv.ultimo_entrante_at).getTime() < 24 * 3600e3 ? 'abierta' : 'cerrada')
      : null;

    const antes = historico.get(f.id) || 0;
    /* Cuántas ventanas equivalentes caben en el tramo histórico. El tope
       anterior en 1 subestimaba el ritmo cuando el tramo era más corto que la
       ventana (con dias=45 usaba 1 en vez de 0.33, o sea 3× menos) y hacía
       saltar «su mejor racha» de más. El 0.5 evita dividir entre casi cero. */
    const tramos = Math.max(0.5, (VENTANA_LARGA - dias) / dias);
    const ritmo = antes / tramos;   // señales por ventana equivalente
    f.su_record = f.senales >= 2 && f.senales > ritmo * 1.5;
    f.ritmo_previo = Math.round(ritmo * 10) / 10;
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
    f.tendencia = f.senales_recientes > f.senales_antes ? 'subiendo'
      : (f.senales_recientes === 0 && f.senales_antes > 0) ? 'enfriandose' : 'estable';
    return f;
  }).sort((a, b) => {
    /* EL ORDEN ES LA OPINIÓN DE LA PANTALLA. Antes era «lo más reciente
       primero», que pone arriba a quien ya atendiste hace diez minutos y
       entierra a quien lleva tres días esperándote. Ahora manda la deuda:
       primero lo que te toca a ti, de más tiempo esperando a menos; después
       el resto por recencia. */
    if (a.pelota !== b.pelota) return a.pelota === 'nosotros' ? -1 : 1;
    if (a.pelota === 'nosotros') {
      /* Dentro de lo que te toca, PRIMERO LOS CALIENTES. Ordenar solo por
         tiempo de espera ponía arriba a un lead frío por llevar 152 h y
         enterraba al que abrió la cotización ayer: la deuda más vieja no es
         la más cara. Con el mismo calor, sí manda quien lleva más esperando. */
      const t = (x: any) => (x.temperatura === 'caliente' ? 3 : x.temperatura === 'tibio' ? 2 : 1);
      if (t(a) !== t(b)) return t(b) - t(a);
      return (b.horas_esperando || 0) - (a.horas_esperando || 0);
    }
    return a.ultima?.cuando < b.ultima?.cuando ? 1 : -1;
  });

  /* Se recorta ANTES de contar. Antes los contadores se calculaban sobre la
     lista completa y solo se enviaban 100 leads: con más de 100, el chip decía
     «Calientes 12» y al filtrar aparecían 7, sin que nada explicara la
     diferencia. Se manda un `recortado` para poder decirlo cuando pase. */
  const LIMITE = 100;
  const enviados = leads.slice(0, LIMITE);
  const recortado = leads.length - enviados.length;

  /* A QUIÉN RESCATAR — los que NO salen en la lista y son los que más duelen:
     dieron señal fuerte (cotización, demo, te escribieron) fuera de la ventana
     y llevan callados desde entonces. Una lista de «últimos 7 días» jamás los
     enseña, y son exactamente los que se están cayendo solos. */
  const enVentana = new Set(porLead.keys());
  const rescatar = new Map<string, any>();
  for (const a of actsTodo || []) {
    if (a.created_at >= desde || enVentana.has(a.contact_id)) continue;
    if (!DEL_LEAD[a.tipo]) continue;
    const fuerte = (PESO[a.tipo] ?? 1) >= 4;
    if (!fuerte) continue;
    const c = porId.get(a.contact_id);
    if (!c) continue;
    if (!rescatar.has(a.contact_id)) {
      rescatar.set(a.contact_id, {
        id: c.id, nombre: c.nombre || 'Sin nombre', empresa: (c as any).companies?.nombre || null,
        whatsapp: c.whatsapp || null, ciclo: c.lifecycle_stage || null, etapa: c.pipeline_stage || null,
        que: DEL_LEAD[a.tipo], cuando: a.created_at,
        dias_callado: Math.round(antiguedad(a.created_at)),
        wa_conversation_id: convPorContacto.get(c.id)?.id || null,
      });
    }
  }
  const paraRescatar = [...rescatar.values()].sort((a, b) => a.dias_callado - b.dias_callado).slice(0, 40);

  /* VARIOS CONTACTOS DE LA MISMA EMPRESA moviéndose no son tres leads sueltos:
     es una empresa evaluando, y eso se atiende distinto. */
  const porEmpresa = new Map<string, { empresa: string; n: number; nombres: string[] }>();
  /* Por company_id y no por NOMBRE: dos empresas distintas que se llamen igual
     —cosa que pasa— se fundían en un falso «3 personas de la misma empresa». */
  for (const l of enviados) {
    if (!l.empresa || !l.company_id) continue;
    const e = porEmpresa.get(l.company_id) || { empresa: l.empresa, n: 0, nombres: [] as string[] };
    e.n++; if (e.nombres.length < 4) e.nombres.push(l.nombre);
    porEmpresa.set(l.company_id, e);
  }
  const empresas = [...porEmpresa.values()].filter(e => e.n > 1).sort((a, b) => b.n - a.n);

  /* ¿SIRVE EL SEGUIMIENTO? De los leads a los que les escribimos dentro de la
     ventana, cuántos volvieron a moverse DESPUÉS. Es la única cifra aquí que
     mide nuestro trabajo y no el de ellos. */
  let contestados = 0, revivieron = 0;
  for (const f of porLead.values()) {
    /* El PRIMERO nuestro de la ventana, no el último. `linea` viene de más
       nuevo a más viejo, así que `find` devolvía el más reciente: en una
       secuencia [nosotros mié · lead mar · nosotros lun] el lead SÍ respondió
       a nuestro mensaje del lunes y se contaba como que no. Era un subconteo
       sistemático de la única cifra que mide nuestro trabajo. */
    const nuestros = f.linea.filter((x: any) => x.de === 'nosotros');
    const nuestro = nuestros[nuestros.length - 1];
    if (!nuestro) continue;
    contestados++;
    if (f.linea.some((x: any) => x.de === 'lead' && x.cuando > nuestro.cuando)) revivieron++;
  }
  return json({
    dias,
    total: leads.length,
    recortado,
    aviso_datos: [
      eCot ? 'No se pudieron leer las cotizaciones: los montos salen en cero.' : null,
      eConv ? 'No se pudo leer el estado de las conversaciones: la ventana de 24 h no se muestra.' : null,
      topeTocado ? 'Hay más actividad de la que cabe en una consulta: el ritmo previo puede quedar corto.' : null,
    ].filter(Boolean),
    // Los que además hicieron algo ellos: es el subconjunto accionable y se
    // dice aparte para poder destacarlo sin recalcular en el cliente.
    con_senal: enviados.filter(l => l.senales > 0).length,
    // Contadores para los filtros: se calculan aquí una vez y no en cada
    // pintada del cliente, que además tendría que rehacerlos por pestaña.
    conteos: {
      pelota_nosotros: enviados.filter(l => l.pelota === 'nosotros').length,
      pelota_ellos: enviados.filter(l => l.pelota === 'ellos').length,
      caliente: enviados.filter(l => l.temperatura === 'caliente').length,
      enfriandose: enviados.filter(l => l.tendencia === 'enfriandose').length,
      por_tipo: [...enviados.reduce((m, l) => {
        for (const [t, n] of Object.entries(l.tipos as Record<string, number>)) m.set(t, (m.get(t) || 0) + (n as number));
        return m;
      }, new Map<string, number>())].map(([tipo, n]) => ({ tipo, etiqueta: DEL_LEAD[tipo] || tipo, n }))
        .sort((a, b) => b.n - a.n),
    },
    empresas,
    rescatar: paraRescatar,
    seguimiento: { contestados, revivieron, pct: contestados ? Math.round((revivieron / contestados) * 100) : null },
    leads: enviados,
  });
};

/* 20 s de micro-caché: la pantalla de Inicio la abre cada quien varias veces al
   día y esta consulta cruza contactos con actividades. No más, porque el
   sentido de la lista es enterarte de lo que acaba de pasar. */
export const GET = conMicroCache('reports/leads-activos', 20000, _GET as any);
