// Cuentas objetivo · HOY: todo lo que había que consultar a mano, en una llamada.
//
// Por qué existe. Esta semana la prospección tuvo tres problemas que no se
// veían desde ninguna pantalla: 554 correos esperando (115 vencidos), la
// cadencia de novias escribiendo correos que nunca salían porque los goteos
// grandes se llevaban el cupo, y un tope real de ~20 correos al día —el
// dominio calentando— contra los 320 configurados. Todo se descubrió con SQL
// desde una terminal. Esto lo pone en pantalla.
//
// GET /api/crm/abm/panel?giro=novias
//   remitentes  · cada dominio con su rampa, su cupo de hoy y lo que lleva
//   fila        · por giro: en cola, vencidos y desde cuándo, enviados 24 h
//   goteos      · estado, prioridad, último lote y POR QUÉ no enroló
//   embudo      · correo 1..8 con enviados, abiertos y clics
//   respuestas  · quién contestó en 7 días y qué dijo
//   salud       · rebotes, quejas y bajas del día, y el disyuntor
//   datos       · cuentas sin vía, correos rotos, WhatsApp de otro país
//   costo       · lo que gastó la IA de las cadencias
//   alertas     · lo que hay que mirar hoy, ya masticado
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, limpiar } from '../../../../lib/crm/abm.lib';
import { cupoDelDia } from '../../cron/abm-cadencias';

export const prerender = false;

const HOY = () => new Date().toISOString().slice(0, 10);

/** La rampa de un remitente: días con envíos REALES suyos y cupo de hoy. */
async function remitente(t: any, cupoInicial: number, tope: number) {
  const [{ data: env }, { count: hoyYa }] = await Promise.all([
    supabase.from('email_sends').select('sent_at').eq('tenant_id', t.id).eq('categoria', 'abm').not('sent_at', 'is', null).limit(5000),
    supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).eq('categoria', 'abm').gte('sent_at', HOY() + 'T00:00:00Z'),
  ]);
  const dias = new Set((env || []).map((e: any) => String(e.sent_at).slice(0, 10))).size;
  const cupo = cupoDelDia(dias, cupoInicial, tope);
  return {
    slug: t.slug, from_email: t.from_email, dias_calentando: dias, cupo,
    enviados_hoy: Number(hoyYa || 0), sobra: Math.max(0, cupo - Number(hoyYa || 0)),
    // Cuándo llega al tope: la rampa sube 30% cada tres días con envíos.
    dias_al_tope: cupo >= tope ? 0 : Math.ceil(Math.log(tope / Math.max(1, cupo)) / Math.log(1.3)) * 3,
  };
}

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const url = new URL(request.url);
  const giro = limpiar(url.searchParams.get('giro'), 40) || null;
  const hoy = HOY();
  const hace7 = new Date(Date.now() - 7 * 864e5).toISOString();

  const { data: cfg } = await supabase.from('abm_config').select('clave, valor, nota, hasta');
  const conf: Record<string, any> = Object.fromEntries((cfg || []).map((r: any) => [r.clave, r]));
  const tope = Number(conf.tope_diario?.valor || 120);
  const cupoInicial = Number(conf.cupo_inicial?.valor || 15);

  const slugs = [conf.tenant_slug?.valor, conf.tenant_slug_intl?.valor].filter(Boolean);
  const { data: inquilinos } = slugs.length
    ? await supabase.from('email_tenants').select('id, slug, from_email').in('slug', slugs)
    : { data: [] as any[] };

  const [fila, goteos, embudo, datos, respuestas, rebotes, quejas, salidos, costo] = await Promise.all([
    giro ? supabase.from('v_abm_fila').select('*').eq('giro', giro) : supabase.from('v_abm_fila').select('*'),
    supabase.from('abm_goteo').select('id, nombre, estado, prioridad, cuentas_dia, filtro, ultimo_lote, cadencia:abm_cadencias(giro, ruta, region)').neq('estado', 'terminado').order('prioridad'),
    giro ? supabase.from('v_abm_embudo').select('*').eq('giro', giro).eq('canal', 'email') : supabase.from('v_abm_embudo').select('*').eq('canal', 'email'),
    giro ? supabase.from('v_abm_salud_datos').select('*').eq('giro', giro) : supabase.from('v_abm_salud_datos').select('*'),
    supabase.from('abm_actividad').select('texto, ocurrio_at, canal, cuenta:abm_cuentas(nombre, pais, giro, etapa)').eq('tipo', 'respuesta').gte('ocurrio_at', hace7).order('ocurrio_at', { ascending: false }).limit(40),
    supabase.from('email_sends').select('id', { count: 'exact', head: true }).not('bounced_at', 'is', null).gte('sent_at', hoy + 'T00:00:00Z'),
    supabase.from('abm_actividad').select('id', { count: 'exact', head: true }).eq('tipo', 'spam').eq('canal', 'email').gte('ocurrio_at', hoy + 'T00:00:00Z'),
    supabase.from('email_sends').select('id', { count: 'exact', head: true }).gte('sent_at', hoy + 'T00:00:00Z'),
    supabase.from('ia_uso').select('costo_usd, created_at').gte('created_at', hace7).limit(5000).then((r: any) => r, () => ({ data: null })),
  ]);

  const remitentes = [];
  for (const t of inquilinos || []) remitentes.push(await remitente(t, cupoInicial, tope));

  // El último lote de cada goteo: cuántas entraron y, si no entró ninguna, por qué.
  const lotes: Record<string, any> = {};
  for (const g of goteos.data || []) {
    const { data: l } = await supabase.from('abm_goteo_lotes').select('fecha, cuentas, sin_ia, motivo').eq('goteo_id', g.id).order('fecha', { ascending: false }).limit(1).maybeSingle();
    lotes[g.id] = l || null;
  }

  const f = (fila.data || []) as any[];
  const suma = (k: string) => f.reduce((a, b) => a + Number(b[k] || 0), 0);
  const gastoIA = (costo as any)?.data ? (costo as any).data.reduce((a: number, r: any) => a + Number(r.costo_usd || 0), 0) : null;

  // ── Las alertas: lo que hay que mirar hoy, ya masticado ────────────────────
  const alertas: { nivel: 'alto' | 'medio'; texto: string }[] = [];
  if (String(conf.pausado?.valor || 'si') !== 'no') alertas.push({ nivel: 'alto', texto: `El cartero está ${conf.pausado?.valor === 'auto' ? 'en pausa automática' : 'apagado'}: no sale ni un correo.${conf.pausado?.nota ? ` ${conf.pausado.nota}` : ''}` });
  const vencidos = suma('vencidos');
  if (vencidos > 0) {
    const masViejo = f.filter(x => x.vencido_mas_viejo).sort((a, b) => String(a.vencido_mas_viejo).localeCompare(String(b.vencido_mas_viejo)))[0];
    alertas.push({ nivel: vencidos > 50 ? 'alto' : 'medio', texto: `${vencidos} correos ya debían haber salido${masViejo ? `; el más viejo esperaba desde el ${String(masViejo.vencido_mas_viejo).slice(0, 10)}` : ''}.` });
  }
  for (const g of goteos.data || []) {
    const l = lotes[g.id];
    if (g.estado === 'activo' && l && l.fecha === hoy && !l.cuentas) alertas.push({ nivel: 'medio', texto: `«${g.nombre}» no enroló hoy: ${l.motivo || 'sin motivo apuntado'}.` });
  }
  for (const x of f) {
    if (Number(x.enviados) > 0 && x.ultimo_envio && Date.now() - Date.parse(x.ultimo_envio) > 48 * 36e5)
      alertas.push({ nivel: 'medio', texto: `${x.giro} · ${x.pais} lleva más de 48 h sin enviar por ${x.canal}.` });
  }
  const salidosHoy = Number((salidos as any).count || 0);
  const rebotesHoy = Number((rebotes as any).count || 0);
  if (salidosHoy >= 20 && rebotesHoy / salidosHoy > 0.03) alertas.push({ nivel: 'alto', texto: `${rebotesHoy} rebotes de ${salidosHoy} correos hoy (${Math.round(rebotesHoy / salidosHoy * 100)}%): arriba del 3% se quema el dominio.` });
  const sinVia = (datos.data || []).reduce((a: number, b: any) => a + Number(b.sin_via || 0), 0);
  const rotos = (datos.data || []).reduce((a: number, b: any) => a + Number(b.correo_roto || 0), 0);
  if (rotos > 0) alertas.push({ nivel: 'medio', texto: `${rotos} cuentas tienen un correo que no tiene forma de correo: van a rebotar.` });

  return json({
    giro, hoy,
    motor: { pausado: conf.pausado?.valor || 'si', nota: conf.pausado?.nota || null, tope_diario: tope, cupo_inicial: cupoInicial },
    remitentes,
    fila: f,
    totales: { en_fila: suma('en_fila'), vencidos, enviados: suma('enviados'), enviados_24h: suma('enviados_24h'), borradores: suma('borradores') },
    goteos: (goteos.data || []).map((g: any) => ({ ...g, ultimo: lotes[g.id] })),
    embudo: embudo.data || [],
    respuestas: (respuestas.data || []).map((r: any) => ({ texto: r.texto, cuando: r.ocurrio_at, canal: r.canal, ...(r.cuenta || {}) })),
    salud: { rebotes_hoy: rebotesHoy, quejas_hoy: Number((quejas as any).count || 0), salidos_hoy: salidosHoy },
    datos: datos.data || [],
    datos_totales: { sin_via: sinVia, correo_roto: rotos },
    costo_ia_7d: gastoIA,
    alertas,
  });
};
