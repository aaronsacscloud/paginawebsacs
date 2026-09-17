// Los HECHOS del reporte de trabajo de una cuenta en un periodo.
//
// Una sola función que reúne todo, para que el reporte que se ve en el CRM y el
// que el cliente abre por su liga digan exactamente lo mismo. Dos consultas
// parecidas en dos archivos es como acaban diciendo números distintos.
//
// Regla que gobierna el archivo: aquí NO se interpreta nada. Se cuenta lo que
// pasó y se deja dicho lo que falta. Un reporte que se le manda al cliente con
// un dato inventado cuesta la cuenta.
import { supabase } from '../supabase';
import { normalizaEstado } from './reuniones';
import { cotizacionEsUnico, netoDePartida, baseDeCotizacion } from './pagos-unicos';

const ANULADOS = ['anulado', 'cancelado', 'duplicado', 'reembolsado'];

/** Los módulos que una foto de uso dice que el cliente usaba. */
function modulosDe(snap: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const m of (snap?.uso?.modulos || [])) out[String(m.modulo)] = m;
  return out;
}

/** Etiqueta legible del tema de un folio de soporte. */
const TEMA_L: Record<string, string> = {
  facturacion: 'Facturación', reportes: 'Reportes', bancos: 'Bancos', catalogo: 'Catálogo',
  pos: 'Punto de venta', usuarios: 'Usuarios', inventario: 'Inventario', nivelacion: 'Nivelación',
  pagos: 'Pagos', ecommerce: 'E-commerce', otros: 'Otros',
};

export async function reunirHechos(companyId: string, desde: string, hasta: string) {
  const { data: co } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, plan, sacs_account').eq('id', companyId).maybeSingle();
  if (!co) return null;

  const [
    { data: mejoras }, { data: enCurso }, { data: bookings }, { data: cts },
    { data: snaps }, { data: tickets }, { data: pagos }, { data: subs },
  ] = await Promise.all([
    supabase.from('mejoras').select('*, bookings(fecha, asunto, event_types(nombre, categoria))')
      .eq('company_id', companyId).is('archived_at', null)
      .eq('estado', 'entregada').gte('fecha_entrega', desde).lte('fecha_entrega', hasta)
      .order('fecha_entrega', { ascending: true }),
    supabase.from('mejoras').select('titulo, descripcion, estado, fecha_compromiso, valor')
      .eq('company_id', companyId).is('archived_at', null)
      .in('estado', ['cotizada', 'en_proceso']).order('fecha_compromiso', { ascending: true }),
    supabase.from('bookings')
      .select('id, fecha, asunto, estado, minuta, company_id, contact_id, invitee_email, event_types(nombre, categoria)')
      .gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true }),
    supabase.from('contacts').select('id, email').eq('company_id', companyId).is('archived_at', null),
    supabase.from('uso_snapshots')
      .select('fecha, uso, usuarios_operando, clientes_total, lealtad_inscritos, ventas_30d, total_30d')
      .eq('company_id', companyId).order('fecha', { ascending: true }),
    supabase.from('crm_soporte_tickets')
      .select('id, estado, tema, asunto, abierto_at, resuelto_at, primera_respuesta_at, csat_score')
      .eq('company_id', companyId).gte('abierto_at', desde).lte('abierto_at', `${hasta}T23:59:59`),
    supabase.from('payments')
      .select('id, fecha, monto, metodo, estado, quote_id, subscription_id, quotes(numero, items, descuento_global, descuento_tipo, pagado_fecha)')
      .eq('company_id', companyId).gte('fecha', desde).lte('fecha', hasta),
    supabase.from('subscriptions').select('nombre_plan, ciclo, estado, precio, proxima_factura')
      .eq('company_id', companyId).eq('estado', 'activa'),
  ]);

  // ── Reuniones de esta cuenta ──
  const ctIds = new Set((cts || []).map((c: any) => c.id));
  const ctMails = new Set((cts || []).map((c: any) => String(c.email || '').toLowerCase()).filter(Boolean));
  const reuniones = (bookings || []).filter((r: any) => r.company_id === companyId
    || (r.contact_id && ctIds.has(r.contact_id))
    || (r.invitee_email && ctMails.has(String(r.invitee_email).toLowerCase())));
  const capacitaciones = reuniones.filter((r: any) => r.event_types?.categoria === 'capacitacion');
  const asistidas = reuniones.filter((r: any) => normalizaEstado(r.estado) === 'asistio');
  const faltas = reuniones.filter((r: any) => normalizaEstado(r.estado) === 'no_asistio');

  // ── Uso: el primero y el último retrato del periodo ──
  const dentro = (snaps || []).filter((s: any) => s.fecha >= desde && s.fecha <= hasta);
  const primera = dentro[0] || null;
  const ultima = dentro.length > 1 ? dentro[dentro.length - 1] : null;
  // Para "tu cuenta hoy" se usa el retrato MÁS RECIENTE que exista, aunque caiga
  // fuera del periodo: al cliente le importa cómo está su cuenta, no cómo estaba
  // el día que cerró el corte.
  const actual = (snaps || [])[(snaps || []).length - 1] || null;

  let modulosNuevos: any[] = [];
  let operacion: any = null;
  if (primera && ultima) {
    const antes = modulosDe(primera), despues = modulosDe(ultima);
    for (const [nombre, m] of Object.entries(despues)) {
      if ((m as any).usa && antes[nombre] && !antes[nombre].usa) {
        const cap = capacitaciones
          .filter((c: any) => (c.asunto || '').toLowerCase().includes(String(nombre).toLowerCase().split(' ')[0])
            || JSON.stringify(c.minuta || {}).toLowerCase().includes(String(nombre).toLowerCase().split(' ')[0]))
          .sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null;
        modulosNuevos.push({
          modulo: nombre, familia: (m as any).familia || null,
          docs_30d: (m as any).docs_30d || 0, primer_uso: (m as any).ultimo || null,
          capacitacion: cap ? { fecha: cap.fecha, asunto: cap.asunto } : null,
        });
      }
    }
    operacion = {
      usuarios: { antes: primera.usuarios_operando ?? null, despues: ultima.usuarios_operando ?? null },
      lealtad: { antes: primera.lealtad_inscritos ?? null, despues: ultima.lealtad_inscritos ?? null },
      clientes: { antes: primera.clientes_total ?? null, despues: ultima.clientes_total ?? null },
      ventas_30d: { antes: primera.ventas_30d ?? null, despues: ultima.ventas_30d ?? null },
      facturado_30d: { antes: primera.total_30d ?? null, despues: ultima.total_30d ?? null },
    };
  }

  // ── Lo que NUNCA ha usado: la lista de lo que ya paga y no aprovecha ──
  let oportunidades: any = null;
  if (actual) {
    const todos = (actual.uso?.modulos || []) as any[];
    const sinUsar = todos.filter(m => !m.usa);
    const porFamilia: Record<string, string[]> = {};
    for (const m of sinUsar) {
      const f = m.familia || 'Otros';
      (porFamilia[f] = porFamilia[f] || []).push(m.modulo);
    }
    oportunidades = {
      total: todos.length, en_uso: todos.length - sinUsar.length, sin_usar: sinUsar.length,
      familias: Object.entries(porFamilia).map(([familia, modulos]) => ({ familia, modulos })),
      medido_el: actual.fecha,
    };
  }

  // ── Soporte del periodo ──
  const tk = tickets || [];
  const cerrados = tk.filter((t: any) => t.resuelto_at);
  const dias = cerrados
    .map((t: any) => (Date.parse(t.resuelto_at) - Date.parse(t.abierto_at)) / 86400000)
    .filter((d: number) => Number.isFinite(d) && d >= 0);
  const porTema: Record<string, number> = {};
  for (const t of tk) porTema[t.tema || 'otros'] = (porTema[t.tema || 'otros'] || 0) + 1;
  const conCsat = tk.filter((t: any) => t.csat_score != null);
  const soporte = {
    folios: tk.length,
    resueltos: cerrados.length,
    abiertos: tk.length - cerrados.length,
    dias_promedio: dias.length ? Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10 : null,
    temas: Object.entries(porTema).map(([k, n]) => ({ tema: k, etiqueta: TEMA_L[k] || k, n }))
      .sort((a, b) => b.n - a.n),
    // Solo se reporta la satisfacción si de verdad hay calificaciones. Un
    // promedio de cero encuestas es un número inventado.
    csat: conCsat.length
      ? { n: conCsat.length, promedio: Math.round((conCsat.reduce((a: number, t: any) => a + Number(t.csat_score), 0) / conCsat.length) * 10) / 10 }
      : null,
  };

  // ── Lo que pagó en el periodo, con sus partidas ──
  const cobros: any[] = [];
  for (const p of (pagos || [])) {
    if (ANULADOS.includes(String(p.estado || '').toLowerCase())) continue;
    const q = (p as any).quotes;
    const partidas = q && Array.isArray(q.items)
      ? q.items.filter((i: any) => Number(i?.monto) > 0).map((i: any) => ({
          nombre: i.nombre, descripcion: i.descripcion || null,
          lista: Math.round(Number(i.monto) || 0),
          neto: netoDePartida(Number(i.monto) || 0, q.descuento_global, q.descuento_tipo, baseDeCotizacion(q.items)),
        }))
      : [];
    cobros.push({
      fecha: p.fecha, monto: Number(p.monto || 0), metodo: p.metodo,
      numero: q?.numero || null,
      // Un cobro por cotización sin licencia detrás es pago único; con licencia
      // es la renovación. La distinción cambia cómo se lee el reporte.
      unico: !p.subscription_id && !!q && cotizacionEsUnico(q.items),
      partidas,
    });
  }
  const pagado = {
    total: cobros.reduce((s, c) => s + c.monto, 0),
    unico: cobros.filter(c => c.unico).reduce((s, c) => s + c.monto, 0),
    cobros,
  };

  const capsMejora = (mejoras || []).filter((m: any) => m.categoria === 'capacitacion');
  const entregadasReales = (mejoras || []).filter((m: any) => m.categoria !== 'capacitacion');
  const cortesias = entregadasReales.filter((m: any) => m.cortesia);

  const licencia = (subs || [])[0] || null;

  return {
    cliente: co.nombre_comercial || co.nombre,
    cuenta_sacs: co.sacs_account || null,
    plan: co.plan || null,
    licencia: licencia ? {
      nombre: licencia.nombre_plan, ciclo: licencia.ciclo,
      precio: Number(licencia.precio || 0), proxima_factura: licencia.proxima_factura,
    } : null,
    periodo: { desde, hasta, dias: Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) },
    entregadas: entregadasReales.map((m: any) => ({
      titulo: m.titulo, descripcion: m.descripcion, fecha: m.fecha_entrega,
      categoria: m.categoria, cortesia: !!m.cortesia, valor: Number(m.valor || 0),
      surgio_en: m.bookings ? { fecha: m.bookings.fecha, tipo: m.bookings.event_types?.nombre } : null,
      visible_cliente: m.visible_cliente !== false,
    })),
    cortesias: cortesias.length,
    en_curso: enCurso || [],
    reuniones: {
      total: reuniones.length, asistidas: asistidas.length, inasistencias: faltas.length,
      lista: reuniones.map((r: any) => ({
        fecha: r.fecha, asunto: r.asunto || r.event_types?.nombre || 'Sesión',
        categoria: r.event_types?.categoria || null,
        asistio: normalizaEstado(r.estado) === 'asistio',
      })),
      capacitaciones: [
        ...capacitaciones.map((c: any) => ({ fecha: c.fecha, asunto: c.asunto, asistio: normalizaEstado(c.estado) === 'asistio', minuta: c.minuta || null, modo: 'sesión agendada' })),
        ...capsMejora.map((m: any) => ({ fecha: m.fecha_entrega, asunto: m.titulo, asistio: true, minuta: null, modo: m.url ? 'video enviado' : 'en junta', detalle: m.descripcion || null, modulo: m.modulo || null })),
      ].sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha))),
    },
    soporte,
    pagado,
    oportunidades,
    modulos_nuevos: modulosNuevos,
    operacion,
    cuenta_hoy: actual ? {
      fecha: actual.fecha, usuarios: actual.usuarios_operando, ventas_30d: actual.ventas_30d,
      facturado_30d: actual.total_30d, clientes: actual.clientes_total, lealtad: actual.lealtad_inscritos,
    } : null,
    sin_datos_de_uso: !(primera && ultima),
  };
}

/**
 * Los hechos del REPORTE DE ENTREGAS.
 *
 * El reporte de trabajo cuenta el periodo entero; este contesta una sola
 * pregunta —«¿qué me han hecho?»— y por eso trae lo que el otro no: el VIDEO de
 * cada mejora. Se lee aparte y no reusando `reunirHechos` porque aquel hace
 * ocho consultas —fotos de uso, tickets, pagos, suscripciones— que aquí no se
 * miran; pedirlas para tirarlas es pagar el costo sin usar el dato.
 *
 * Misma regla de la casa: aquí no se interpreta nada. Se cuenta lo entregado y
 * se dice cuál trae video y cuál no.
 */
/** `modulos` acota el documento a esas partes del sistema. Vacío = todo.
 *  Existe porque un reporte de doce entregas repartidas en cinco módulos no
 *  contesta «¿cómo va lo del portal?»: el dueño manda uno POR tema cuando la
 *  conversación con el cliente es sobre un tema. */
export async function reunirEntregas(companyId: string, desde: string, hasta: string, soloModulos?: string[] | null) {
  const { data: co } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, sacs_account').eq('id', companyId).maybeSingle();
  if (!co) return null;

  const { data: mejoras } = await supabase.from('mejoras')
    .select('titulo, descripcion, categoria, cortesia, valor, fecha_entrega, modulo, url, visible_cliente, origen')
    .eq('company_id', companyId).is('archived_at', null).eq('estado', 'entregada')
    .gte('fecha_entrega', desde).lte('fecha_entrega', hasta)
    .order('fecha_entrega', { ascending: true });

  /* Lo INTERNO no se guarda siquiera en la foto. En el reporte de trabajo se
     filtra al pintar; aquí se filtra al generar, porque este documento no tiene
     otra cosa adentro: una foto con lo interno sería una fuga esperando a que
     alguien lea el jsonb. */
  const pedidos = (soloModulos || []).filter(Boolean);
  const visibles = (mejoras || [])
    .filter((m: any) => m.visible_cliente !== false)
    .filter((m: any) => !pedidos.length || pedidos.includes(m.modulo || 'Sin módulo'));

  const entregas = visibles.map((m: any) => ({
    titulo: m.titulo,
    descripcion: m.descripcion || null,
    categoria: m.categoria || 'otro',
    modulo: m.modulo || null,
    fecha: m.fecha_entrega,
    cortesia: !!m.cortesia,
    /* Solo http(s). Una liga guardada a mano puede traer «javascript:» o
       «www.loom…» sin esquema: la primera es un agujero en un documento
       público y la segunda no abre. Se guarda limpia o no se guarda. */
    video: /^https?:\/\//i.test(String(m.url || '').trim()) ? String(m.url).trim() : null,
  }));

  const modulos = Array.from(new Set(entregas.map(e => e.modulo).filter(Boolean)));

  return {
    cliente: co.nombre_comercial || co.nombre,
    cuenta_sacs: co.sacs_account || null,
    periodo: { desde, hasta, dias: Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) },
    entregas,
    total: entregas.length,
    con_video: entregas.filter(e => e.video).length,
    cortesias: entregas.filter(e => e.cortesia).length,
    modulos,
    // Qué se pidió, para que el documento pueda decirlo: «solo lo de Portal de
    // clientes» no es lo mismo que «no hubo nada más».
    solo_modulos: pedidos.length ? pedidos : null,
    // Cuántas se ocultaron por internas: el consultor tiene que poder explicar
    // por qué el documento trae ocho y en su pantalla se ven diez.
    internas: (mejoras || []).length - visibles.length,
  };
}

/* ═══ LO QUE SE ESTÁ CONSTRUYENDO ═══
 *
 * El hermano del reporte de entregas. Aquel contesta «¿qué me han hecho?»;
 * este contesta «¿qué me están haciendo?» — la pregunta que el cliente hace
 * entre una entrega y la siguiente, y que hasta hoy se respondía por WhatsApp
 * de memoria.
 *
 * Sale de las ÓRDENES VIVAS del taller, no de las mejoras: es ahí donde vive
 * la etapa, la fecha comprometida y —lo que el cliente pidió ver— la
 * especificación de qué va a cambiar dentro del sistema.
 *
 * Lo entregado NO entra: eso ya es el otro documento, y repetirlo aquí haría
 * que el cliente lea dos veces lo mismo y no sepa cuál manda.
 *
 * Lo interno tampoco: ni rebotes, ni quién la trabaja, ni cuántas veces se
 * movió la fecha. Se filtra al GENERAR y no al pintar, porque la foto se
 * guarda en un jsonb que alguien puede leer.
 */
const ETAPA_CLIENTE: Record<string, { l: string; orden: number }> = {
  analisis:   { l: 'En análisis', orden: 1 },
  desarrollo: { l: 'En desarrollo', orden: 2 },
  pruebas:    { l: 'En pruebas', orden: 3 },
  lista:      { l: 'Lista, en revisión', orden: 4 },
  devuelta:   { l: 'En desarrollo', orden: 2 },   // un rebote es asunto interno
  trabada:    { l: 'En desarrollo', orden: 2 },
  espera:     { l: 'Esperando un dato tuyo', orden: 5 },
  recibida:   { l: 'Por arrancar', orden: 6 },
};

export async function reunirEnCurso(companyId: string, desde: string, hasta: string) {
  const { data: co } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, sacs_account').eq('id', companyId).maybeSingle();
  if (!co) return null;

  const { data: ordenes } = await supabase.from('taller_ordenes')
    .select('folio, titulo, tipo, etapa, esperado, problema, criterios, modulo, cobro, fecha_prometida, created_at')
    .eq('company_id', companyId).is('archived_at', null)
    .neq('etapa', 'entregada')
    .order('fecha_prometida', { ascending: true, nullsFirst: false });

  /* El periodo filtra por CUÁNDO SE PIDIÓ, no por cuándo se entrega: el
     documento dice «esto es lo que te estamos construyendo», y una orden
     levantada en agosto que sigue viva pertenece al reporte de septiembre
     igual que una de ayer. Por eso el corte es `created_at <= hasta`. */
  const vivas = (ordenes || []).filter((o: any) => String(o.created_at || '').slice(0, 10) <= hasta);

  const trabajos = vivas.map((o: any) => {
    const e = ETAPA_CLIENTE[o.etapa] || ETAPA_CLIENTE.recibida;
    return {
      folio: o.folio,
      titulo: o.titulo,
      // La especificación que el cliente pidió ver. «Qué debería pasar» es lo
      // que se acordó; si no está, el criterio de aceptación dice lo mismo con
      // otras palabras. Si no hay ninguno, el renglón va solo con su título.
      cambio: (o.esperado || o.criterios || '').trim() || null,
      categoria: o.tipo === 'falla' ? 'pendiente' : 'personalizacion',
      modulo: o.modulo || null,
      etapa: e.l,
      orden: e.orden,
      fecha: o.fecha_prometida || null,
      cortesia: o.cobro === 'cortesia',
    };
  });

  const conFecha = trabajos.filter(t => t.fecha);
  return {
    cliente: co.nombre_comercial || co.nombre,
    cuenta_sacs: co.sacs_account || null,
    periodo: { desde, hasta, dias: Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) },
    trabajos,
    total: trabajos.length,
    // «En desarrollo» para el cliente es todo lo que ya arrancó: análisis,
    // desarrollo, pruebas y lo que está en revisión. Lo que no ha arrancado se
    // cuenta aparte porque es lo único que todavía no tiene compromiso.
    en_curso: trabajos.filter(t => t.orden <= 4).length,
    por_arrancar: trabajos.filter(t => t.orden === 6).length,
    cortesias: trabajos.filter(t => t.cortesia).length,
    proxima: conFecha.length ? conFecha.map(t => t.fecha).sort()[0] : null,
    sin_fecha: trabajos.filter(t => !t.fecha).length,
  };
}
