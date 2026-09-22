// El correo EJECUTIVO a una cuenta, desde su ficha (opción A del 22-sep-2026).
//
// POST { accion: 'vista'|'enviar'|'redactar', company_id, para[], asunto, mensaje,
//        reportes: [{ tipo: 'entregas'|'curso'|'trabajo', desde, hasta }],
//        documentos: [id de la biblioteca] }
//
//  · vista    → el HTML tal como le va a llegar. Los reportes se CALCULAN pero no
//               se guardan: la vista previa no puede dejar folios huérfanos.
//  · enviar   → genera y guarda los reportes, manda un correo POR PERSONA (cada
//               quien con sus ligas, para saber quién abrió qué), marca los
//               reportes como enviados y deja el rastro en la Actividad.
//  · redactar → un borrador del mensaje con lo que pasó en la cuenta este mes.
//
// El correo se ARMA CON BLOQUES y se compila con el mismo compilador de las
// plantillas (regla del dueño: todo correo viaja por el sistema del CRM). Los
// documentos van con el bloque «documento», que desde hoy existe para
// cualquier plantilla.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { sendEmail } from '../../../lib/email';
import { compilar, compilarTexto, type Bloque } from '../../../lib/email/plantillas';
import { resolverTenant } from '../../../lib/email/tenant';
import { reunirEntregas, reunirEnCurso, reunirHechos } from '../../../lib/crm/reporte-hechos';
import { generarReporteCuenta, type TipoReporteCuenta } from '../../../lib/crm/reporte-generar';
import { pedirJSON } from '../../../lib/ia';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS: TipoReporteCuenta[] = ['entregas', 'curso', 'trabajo'];

const fCorta = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace(/\./g, '')
  : '';
const periodo = (a: string, b: string) => `${fCorta(a)} al ${fCorta(b)}`;

/* Cómo se presenta cada reporte en el correo: etiqueta, color y una línea con
   las cifras que hacen que lo abran. */
function tarjetaReporte(tipo: TipoReporteCuenta, h: any, desde: string, hasta: string, href: string): Bloque {
  if (tipo === 'entregas') {
    const n = Number(h?.total || 0), v = Number(h?.con_video || 0);
    return { id: 'r-entregas', tipo: 'documento', etiqueta: 'Entregas', tono: 'verde', titulo: 'Reporte de entregas',
      texto: `${n} ${n === 1 ? 'entrega' : 'entregas'}${v ? `, ${v} con video` : ''} · ${periodo(desde, hasta)}`, href, boton: 'Ver' };
  }
  if (tipo === 'curso') {
    const n = Number(h?.total || 0);
    return { id: 'r-curso', tipo: 'documento', etiqueta: 'En curso', tono: 'rosa', titulo: 'Trabajo en curso',
      texto: `${n} ${n === 1 ? 'trabajo' : 'trabajos'} en el taller${h?.proxima ? ` · el próximo, ${fCorta(h.proxima)}` : ''}`, href, boton: 'Ver' };
  }
  const ent = (h?.entregadas || []).filter((m: any) => m.visible_cliente !== false).length;
  const folios = Number(h?.soporte?.folios || 0);
  return { id: 'r-trabajo', tipo: 'documento', etiqueta: 'Ejecutivo', tono: 'lila', titulo: 'Reporte ejecutivo',
    texto: `${ent} mejoras entregadas · ${folios} folios de soporte · ${periodo(desde, hasta)}`, href, boton: 'Ver' };
}

const TIPO_DOC: Record<string, string> = { presentacion: 'Presentación', pdf: 'PDF', liga: 'Documento' };

export const POST: APIRoute = async ({ request }) => {
  const user: any = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const accion = ['vista', 'enviar', 'redactar'].includes(b?.accion) ? b.accion : 'vista';
  const companyId = String(b?.company_id || '');
  if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);

  const { data: co } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, sacs_account').eq('id', companyId).maybeSingle();
  if (!co) return json({ error: 'Esa cuenta ya no existe.' }, 404);
  const cliente = co.nombre_comercial || co.nombre || co.sacs_account || 'la cuenta';

  /* ── REDACTAR: un borrador con lo que de verdad pasó en el mes ── */
  if (accion === 'redactar') {
    const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
    const desde = hoy.slice(0, 8) + '01';
    const [h, cur] = await Promise.all([reunirHechos(companyId, desde, hoy), reunirEnCurso(companyId, desde, hoy)]);
    // El mes va escrito: sin él, el modelo adivinaba y un borrador de
    // septiembre salió titulado «Enero».
    const mes = new Date(hoy + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const hechos = {
      cliente, mes, periodo: `del 1 al ${Number(hoy.slice(8, 10))} de ${mes}`,
      entregadas: (h?.entregadas || []).filter((m: any) => m.visible_cliente !== false).map((m: any) => m.titulo).slice(0, 10),
      en_taller: (cur?.trabajos || []).map((t: any) => t.titulo).slice(0, 8),
      soporte_folios: h?.soporte?.folios || 0,
      reuniones: h?.reuniones?.asistidas || 0,
      para: Array.isArray(b?.nombres) ? b.nombres.slice(0, 4) : [],
    };
    try {
      const out = await pedirJSON({
        system: `Redactas el correo ejecutivo que un consultor de Sacs (sistema de punto de venta para retail de moda en México) le manda a su cliente.
Español de México, cálido y directo, de tú a tú con el dueño; nada de emoji ni de lenguaje corporativo. Máximo 90 palabras.
Usa SOLO los hechos que recibes: no inventes cifras, fechas ni compromisos. Si no hubo entregas, no digas que las hubo.
El periodo es el que viene en «periodo»; si nombras el mes, usa «mes» tal cual.
Empieza saludando por su nombre si viene. No firmes: la firma la pone el sistema.
Responde ÚNICAMENTE con JSON: { "asunto": "…", "mensaje": "…" }`,
        user: JSON.stringify(hechos),
      });
      return json({ asunto: String(out?.asunto || '').slice(0, 140), mensaje: String(out?.mensaje || '').slice(0, 2000) });
    } catch (e: any) {
      return json({ error: 'No se pudo redactar: ' + String(e?.message || e) }, 500);
    }
  }

  /* ── Lo que va en el correo ── */
  const para: string[] = Array.from(new Set((Array.isArray(b?.para) ? b.para : []).map((x: any) => String(x || '').trim().toLowerCase()).filter((x: string) => CORREO.test(x)))).slice(0, 10) as string[];
  const asunto = String(b?.asunto || '').trim().slice(0, 160);
  const mensaje = String(b?.mensaje || '').trim().slice(0, 5000);
  const reportes = (Array.isArray(b?.reportes) ? b.reportes : [])
    .filter((r: any) => TIPOS.includes(r?.tipo))
    .map((r: any) => ({ tipo: r.tipo as TipoReporteCuenta, desde: String(r.desde || '').slice(0, 10), hasta: String(r.hasta || '').slice(0, 10) }))
    .filter((r: any, i: number, a: any[]) => a.findIndex(x => x.tipo === r.tipo) === i);
  const docIds = (Array.isArray(b?.documentos) ? b.documentos : []).map(String).filter((x: string) => UUID.test(x)).slice(0, 10);

  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const { data: docs } = docIds.length
    ? await supabase.from('crm_documentos').select('id, titulo, descripcion, tipo, url, vence, activo').in('id', docIds).is('archived_at', null)
    : { data: [] as any[] };
  // Solo lo prendido y vigente puede salir, aunque la pantalla lo haya mandado.
  const vivos = (docs || []).filter((d: any) => d.activo && !(d.vence && d.vence < hoy));

  const tenant = await resolverTenant().catch(() => null);
  if (!tenant) return json({ error: 'El correo del CRM no está configurado.' }, 500);
  const origen = new URL(request.url).origin;
  const firma: Bloque = { id: 'firma', tipo: 'firma', ...(user?.nombre ? { nombre: user.nombre } : {}), ...(user?.foto_url ? { foto_url: user.foto_url } : {}) };
  const cuerpo = (tarjetas: Bloque[]): Bloque[] => [
    ...(mensaje ? [{ id: 'msg', tipo: 'texto', texto: mensaje } as Bloque] : []),
    ...tarjetas,
    firma,
  ];

  /* ── VISTA PREVIA: se calcula todo, no se guarda nada ── */
  if (accion === 'vista') {
    const tarjetas: Bloque[] = [];
    const avisos: string[] = [];
    for (const r of reportes) {
      const h: any = r.tipo === 'entregas' ? await reunirEntregas(companyId, r.desde, r.hasta, null)
        : r.tipo === 'curso' ? await reunirEnCurso(companyId, r.desde, r.hasta) : await reunirHechos(companyId, r.desde, r.hasta);
      if ((r.tipo === 'entregas' || r.tipo === 'curso') && !h?.total) {
        avisos.push(r.tipo === 'entregas' ? 'No hay entregas visibles en ese periodo: el reporte de entregas no se mandaría.' : 'No hay nada vivo en el taller: el reporte de trabajo en curso no se mandaría.');
        continue;
      }
      tarjetas.push(tarjetaReporte(r.tipo, h, r.desde, r.hasta, origen + '/reporte/…'));
    }
    for (const d of vivos) {
      tarjetas.push({ id: 'd-' + d.id, tipo: 'documento', variante: 'noche', etiqueta: TIPO_DOC[d.tipo] || 'Documento', titulo: d.titulo, texto: d.descripcion || '', href: d.url, boton: 'Ver' });
    }
    const ctx = { nombre: '', empresa: cliente } as any;
    return json({ html: compilar(cuerpo(tarjetas), ctx, tenant, null, 'simple'), avisos });
  }

  /* ── ENVIAR ── */
  if (!para.length) return json({ error: 'Elige al menos a una persona con correo.' }, 400);
  if (!asunto) return json({ error: 'Ponle asunto al correo.' }, 400);
  if (!mensaje && !reportes.length && !vivos.length) return json({ error: 'El correo va vacío: escribe algo o adjunta un documento.' }, 400);

  // 1) Los reportes se generan UNA vez; todos los destinatarios ven el mismo folio.
  const generados: { tipo: TipoReporteCuenta; id: string; folio: string; hechos: any; desde: string; hasta: string }[] = [];
  for (const r of reportes) {
    const g = await generarReporteCuenta({ tipo: r.tipo, companyId, desde: r.desde, hasta: r.hasta, creadoPor: user?.email || user?.nombre || null });
    if ('error' in g) return json({ error: g.error }, g.status);
    generados.push({ ...g, tipo: r.tipo, desde: r.desde, hasta: r.hasta } as any);
  }

  // 2) Un correo por persona: cada quien con sus ligas de la biblioteca.
  const { data: contactos } = await supabase.from('contacts').select('id, nombre, email').eq('company_id', companyId);
  const porCorreo = new Map((contactos || []).filter((c: any) => c.email).map((c: any) => [String(c.email).toLowerCase(), c]));
  const resultados: { para: string; ok: boolean; error?: string }[] = [];
  for (const dest of para) {
    const ct: any = porCorreo.get(dest) || null;
    const tarjetas: Bloque[] = generados.map(g => tarjetaReporte(g.tipo, g.hechos, g.desde, g.hasta, origen + '/reporte/' + g.id));
    for (const d of vivos) {
      const { data: env } = await supabase.from('crm_documento_envios').insert({
        documento_id: d.id, company_id: companyId, contact_id: ct?.id || null, para: dest,
        enviado_por: user?.email || user?.nombre || null,
      }).select('id').single();
      tarjetas.push({ id: 'd-' + d.id, tipo: 'documento', variante: 'noche', etiqueta: TIPO_DOC[d.tipo] || 'Documento', titulo: d.titulo,
        texto: d.descripcion || '', href: env?.id ? origen + '/d/' + env.id : d.url, boton: 'Ver' });
    }
    const ctx = { nombre: String(ct?.nombre || '').split(' ')[0], empresa: cliente, email: dest } as any;
    const bloques = cuerpo(tarjetas);
    const r = await sendEmail({
      to: dest, subject: asunto,
      html: compilar(bloques, ctx, tenant, null, 'simple'), text: compilarTexto(bloques, ctx, tenant),
      contact_id: ct?.id || null, categoria: 'relacion',
      // Es servicio a una cuenta que ya paga, a pedido de quien la atiende: una
      // baja de campañas no puede dejarla sin sus reportes.
      transaccional: true,
      replyTo: user?.email || null,
    });
    resultados.push({ para: dest, ok: r.status !== 'failed', error: r.error || undefined });
  }

  const enviados = resultados.filter(r => r.ok).map(r => r.para);
  if (enviados.length && generados.length) {
    await supabase.from('reportes_trabajo').update({ estado: 'enviado', enviado_at: new Date().toISOString(), enviado_a: enviados.join(', ') })
      .in('id', generados.map(g => g.id));
  }
  await supabase.from('activities').insert({
    company_id: companyId, tipo: 'correo_ejecutivo', automatico: false,
    titulo: 'Correo: ' + asunto,
    descripcion: [mensaje.slice(0, 400), generados.length ? 'Reportes: ' + generados.map(g => g.folio).join(', ') : '', vivos.length ? 'Documentos: ' + vivos.map((d: any) => d.titulo).join(', ') : ''].filter(Boolean).join('\n'),
    metadata: { para: enviados, fallaron: resultados.filter(r => !r.ok), reportes: generados.map(g => ({ id: g.id, folio: g.folio, tipo: g.tipo })), documentos: vivos.map((d: any) => d.id), por: user?.email || null },
  }).then(() => {}, () => {});

  if (!enviados.length) return json({ error: 'No salió ningún correo: ' + (resultados[0]?.error || 'error del proveedor') }, 502);
  return json({ ok: true, enviados, fallaron: resultados.filter(r => !r.ok), reportes: generados.map(g => ({ tipo: g.tipo, folio: g.folio })) });
};
