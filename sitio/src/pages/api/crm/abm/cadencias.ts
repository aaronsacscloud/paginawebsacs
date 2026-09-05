// El motor de cadencias: analizar → generar con IA → aprobar a mano → programar.
//
// El orden importa y no se salta: NADA sale sin que una persona lo apruebe.
//
// GET  /api/crm/abm/cadencias                  → cadencias y plantillas por giro
// GET  /api/crm/abm/cadencias?cuenta_id=       → el análisis de esa cuenta y su cadencia sugerida
// POST /api/crm/abm/cadencias { accion, … }
//   generar   { cuenta_id }            → la IA redacta los 7 correos con los datos REALES de la cuenta
//   aprobar   { toque_id }             → lo pone en la fila de envío
//   editar    { toque_id, asunto?, cuerpo? }
//   cancelar  { toque_id }
//   aprobar_todo { cuenta_id }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { anthropic, MODELS } from '../../../../lib/ai/client';
import { json, quien, esUuid, limpiar, apuntar, GIROS, variablesDe, rellenar } from '../../../../lib/crm/abm.lib';

export const prerender = false;

/** Lo que sabemos de la cuenta, resumido para que la IA no invente nada. */
function expediente(c: any, canales: any[], personas: any[], senales: any[]) {
  const l: string[] = [];
  l.push(`Negocio: ${c.nombre}`);
  l.push(`Giro: ${GIROS[c.giro] || c.giro}${c.subgiro ? ` (${c.subgiro})` : ''}`);
  l.push(`Ciudad: ${c.ciudad || 'México'} · País: ${c.pais} · Moneda: ${c.moneda}`);
  if (c.sucursales) l.push(`Sucursales: ${c.sucursales} (${c.sucursales_confianza})`);
  else l.push('Sucursales: no verificadas');
  if (c.google_rating) l.push(`Google: ${c.google_rating}${c.google_resenas ? ` con ${c.google_resenas} reseñas` : ''}`);
  if (c.plataforma_web) l.push(`Su tienda en línea corre en ${c.plataforma_web}`);
  if (c.sitio_http === 0 || Number(c.sitio_http) >= 400) l.push('Su sitio NO responde ahora mismo');
  if (c.sitio_carrito === false) l.push('No vende en línea (su sitio no tiene carrito)');
  if (c.ig_seguidores) l.push(`Instagram: ${c.ig_seguidores} seguidores`);
  if (c.senal_expansion) l.push(`Señal de que crece: ${c.senal_expansion}`);
  if (c.ultima_publicacion) l.push(`Última publicación: ${c.ultima_publicacion}`);
  if (c.contexto) l.push(`Contexto: ${c.contexto}`);
  if (c.nota) l.push(`Nota de la investigación: ${c.nota}`);
  const p = personas[0];
  if (p) l.push(`Persona que decide: ${p.nombre}${p.cargo ? `, ${p.cargo}` : ''}`);
  const cs = canales.map(x => x.tipo).join(', ');
  l.push(`Canales disponibles: ${cs || 'ninguno verificado'}`);
  // Las quejas de sus clientes van aparte y marcadas: son lo mejor que
  // tenemos para abrir, porque el problema lo dice su comprador, no nosotros.
  const quejas = senales.filter((s: any) => s.tipo === 'resena_mala');
  for (const s of quejas.slice(0, 3)) l.push(`QUEJA DE UN CLIENTE SUYO en Google: "${s.detalle}"`);
  for (const s of senales.filter((s: any) => s.tipo !== 'resena_mala').slice(0, 3)) l.push(`Señal (${s.fecha || 'del estudio'}): ${s.detalle}`);
  return l.join('\n');
}

const REGLAS = `Reglas de escritura, sin excepción:
- Español de México, tono de persona. Nada de "solución integral", "potenciar", "revolucionar", "líder".
- El correo 1 va en TEXTO PLANO, máximo 90 palabras, sin enlaces ni imágenes.
- Cada correo AVANZA: no repetir el anterior con otras palabras.
- Una sola pregunta al final, concreta.
- Asunto de 3 a 6 palabras, en minúscula, sin signos de admiración ni emoji.
- NO INVENTES NADA. Solo puedes usar hechos del expediente. Si un dato no está, no escribas esa frase.
- Prohibido inventar cifras de resultados. El único caso que puedes citar: en un cliente nuestro,
  cadena de moda, encontramos 1.2 millones de pesos mal repartidos entre su centro de distribución
  y sus tiendas, con apenas 50 claves de producto.
- No prometas llamadas ni juntas largas: se ofrece un diagnóstico de 15 minutos con sus datos.
- Si el expediente trae una QUEJA DE UN CLIENTE SUYO, úsala en el primer correo, pero
  CON CUIDADO: se alude a lo que pasó, no se restriega ni se cita entre comillas. "Vi que a
  alguien le pasó que…" suena a reproche; "cuando hay varias tiendas, lo típico es que se
  venda algo que ya no está" reconoce el problema sin humillar a nadie. Nunca digas que
  leíste sus reseñas malas.`;

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);

  const cuenta_id = url.searchParams.get('cuenta_id');
  if (cuenta_id) {
    if (!esUuid(cuenta_id)) return json({ error: 'id inválido' }, 400);
    const { data: c } = await supabase.from('abm_cuentas').select('*').eq('id', cuenta_id).maybeSingle();
    if (!c) return json({ error: 'no existe' }, 404);
    const [{ data: canales }, { data: personas }, { data: toques }] = await Promise.all([
      supabase.from('abm_canales').select('*').eq('cuenta_id', cuenta_id),
      supabase.from('abm_personas').select('*').eq('cuenta_id', cuenta_id),
      supabase.from('abm_toques').select('*').eq('cuenta_id', cuenta_id).order('programado_at'),
    ]);
    const { data: cad } = await supabase.from('abm_cadencias')
      .select('id, nombre, giro, ruta').eq('giro', c.giro).eq('ruta', c.ruta || 'demo').eq('activa', true).maybeSingle();
    return json({ cuenta: c, canales: canales || [], personas: personas || [], toques: toques || [], cadencia: cad || null });
  }

  const [{ data: cadencias }, { data: plantillas }] = await Promise.all([
    supabase.from('abm_cadencias').select('*').order('giro'),
    supabase.from('abm_plantillas').select('id, giro, canal, nombre, orden, asunto, objetivo').order('giro').order('orden'),
  ]);
  return json({ cadencias: cadencias || [], plantillas: plantillas || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  const accion = String(b?.accion || '');

  if (accion === 'generar') {
    if (!esUuid(b.cuenta_id)) return json({ error: 'cuenta inválida' }, 400);
    const { data: c } = await supabase.from('abm_cuentas').select('*').eq('id', b.cuenta_id).maybeSingle();
    if (!c) return json({ error: 'no existe' }, 404);
    if (c.etapa === 'no_contactar') return json({ error: 'esta cuenta pidió no ser contactada' }, 409);
    // A un cliente que ya nos paga no se le manda correo en frío.
    if (c.ya_es_cliente) return json({ error: `ya es cliente nuestro (${c.ya_es_cliente}): no entra a prospección en frío` }, 409);

    const [{ data: canales }, { data: personas }, { data: senales }] = await Promise.all([
      supabase.from('abm_canales').select('*').eq('cuenta_id', c.id).neq('estado', 'opt_out'),
      supabase.from('abm_personas').select('*').eq('cuenta_id', c.id).order('confirmado', { ascending: false }),
      supabase.from('abm_senales').select('*').eq('cuenta_id', c.id).order('fecha', { ascending: false }).limit(5),
    ]);
    // Solo una dirección con forma de dirección: seis truncadas sin dominio
    // bastaban para disparar el disyuntor de rebotes el primer día.
    const CORREO_OK = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
    const correo = (canales || []).find(x => x.tipo.startsWith('email') && x.estado !== 'invalido' && x.estado !== 'rebote' && CORREO_OK.test(String(x.valor || '')));
    if (!correo) return json({ error: 'esta cuenta no tiene correo verificado: su cadencia empieza por otro canal' }, 409);

    // Nadie recibe dos veces: si ya hay toques vivos, no se genera otra cadencia.
    const { count: vivos } = await supabase.from('abm_toques').select('id', { count: 'exact', head: true })
      .eq('cuenta_id', c.id).in('estado', ['borrador', 'aprobado', 'programado']);
    if (vivos) return json({ error: `ya tiene ${vivos} correos en la fila; cancélalos antes de generar otra cadencia` }, 409);

    const ruta = c.ruta || 'demo';
    const { data: base } = await supabase.from('abm_cadencias')
      .select('id, nombre').eq('giro', c.giro).eq('ruta', ruta).eq('activa', true).maybeSingle();
    const { data: pasos } = base
      ? await supabase.from('abm_pasos').select('dia, orden, canal, nota, plantilla_id').eq('cadencia_id', base.id).order('dia')
      : { data: [] as any[] };
    const { data: plantillas } = await supabase.from('abm_plantillas')
      .select('orden, asunto, cuerpo, objetivo').eq('giro', c.giro).eq('ruta', ruta).eq('canal', 'email').eq('activa', true).order('orden');

    const guion = (plantillas || []).map((p: any, i: number) =>
      `Correo ${i + 1} (día ${(pasos || [])[i]?.dia ?? [1, 3, 7, 11, 16, 22, 30][i] ?? 1}) — objetivo: ${p.objetivo || 'avanzar'}\nAsunto base: ${p.asunto}\nTexto base:\n${p.cuerpo}`
    ).join('\n\n---\n\n');
    if (!guion) return json({ error: `todavía no hay plantillas escritas para el giro ${c.giro}` }, 409);

    const prompt = `Eres el redactor de correo frío de Sacscloud (sistema mexicano de inventario y punto de venta para negocios de moda).
Te doy el EXPEDIENTE de un prospecto real y el GUION de la cadencia de su giro. Tu trabajo es adaptar cada correo
del guion a ESTE negocio, usando solo lo que dice el expediente.

EXPEDIENTE
${expediente(c, canales || [], personas || [], senales || [])}

GUION DE LA CADENCIA (${GIROS[c.giro] || c.giro}, ruta ${ruta})
${guion}

${REGLAS}

Devuelve SOLO un JSON válido, sin explicaciones ni cercas de código:
{"correos":[{"dia":1,"asunto":"…","cuerpo":"…"}, …]}`;

    // La cadencia se arma SOLA con los datos de la cuenta. La IA es una mejora
    // encima, no un requisito: si no hay crédito o falla, los correos salen
    // igual —rellenados con lo que sabemos— y se marca que no pasó por IA.
    const persona0 = (personas || [])[0];
    const vars = variablesDe(c, persona0);
    const base0 = (plantillas || []).map((p: any, i: number) => ({
      dia: [1, 3, 7, 11, 16, 22, 30][i] ?? (i * 4 + 1),
      asunto: rellenar(p.asunto, vars),
      cuerpo: rellenar(p.cuerpo, vars),
    }));

    let correos = base0;
    let conIa = false;
    if (b.con_ia !== false) {
      try {
        const r: any = await (anthropic as any).messages.create({
          model: MODELS.sonnet, max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });
        const txt = (r?.content || []).map((x: any) => x?.text || '').join('').trim();
        const limpio = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const salida = JSON.parse(limpio);
        const lista = Array.isArray(salida?.correos) ? salida.correos.slice(0, 8) : [];
        if (lista.length) {
          correos = lista.map((m: any, i: number) => ({
            dia: Number(m.dia) || base0[i]?.dia || (i * 4 + 1),
            asunto: rellenar(String(m.asunto || base0[i]?.asunto || ''), vars),
            cuerpo: rellenar(String(m.cuerpo || base0[i]?.cuerpo || ''), vars),
          }));
          conIa = true;
        }
      } catch (e: any) {
        console.warn('[abm] la IA no pudo pulir la cadencia, va la versión de plantilla:', String(e?.message || e).slice(0, 160));
      }
    }
    if (!correos.length) return json({ error: 'no se pudo armar la cadencia' }, 500);

    const hoy = Date.now();
    const filas = correos.map((m: any, i: number) => ({
      cuenta_id: c.id, cadencia_id: base?.id || null, persona_id: persona0?.id || null,
      canal: 'email', destino: correo.valor,
      asunto: limpiar(m.asunto, 200), cuerpo: limpiar(m.cuerpo, 6000),
      estado: 'borrador',                                   // NADA sale sin que una persona lo apruebe
      programado_at: new Date(hoy + (Number(m.dia) || (i * 4 + 1)) * 864e5).toISOString(),
    }));
    const { error } = await supabase.from('abm_toques').insert(filas);
    if (error) return json({ error: error.message }, 500);
    await apuntar(c.id, 'sistema', 'nota', { texto: `${yo.nombre} generó una cadencia de ${filas.length} correos${conIa ? '' : ' (sin IA: se armó con la plantilla del giro)'}, pendiente de aprobar` });
    return json({ ok: true, correos: filas.length, con_ia: conIa });
  }

  if (accion === 'aprobar' || accion === 'cancelar' || accion === 'editar') {
    if (!esUuid(b.toque_id)) return json({ error: 'toque inválido' }, 400);
    const patch: any = {};
    if (accion === 'aprobar') { patch.estado = 'aprobado'; patch.aprobado_por = yo.id; patch.aprobado_at = new Date().toISOString(); }
    if (accion === 'cancelar') patch.estado = 'cancelado';
    if (accion === 'editar') {
      if (b.asunto !== undefined) patch.asunto = limpiar(b.asunto, 200);
      if (b.cuerpo !== undefined) patch.cuerpo = limpiar(b.cuerpo, 6000);
      patch.estado = 'borrador';                            // editar un correo lo regresa a revisión
    }
    const { error } = await supabase.from('abm_toques').update(patch).eq('id', b.toque_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (accion === 'aprobar_todo') {
    if (!esUuid(b.cuenta_id)) return json({ error: 'cuenta inválida' }, 400);
    const { error } = await supabase.from('abm_toques')
      .update({ estado: 'aprobado', aprobado_por: yo.id, aprobado_at: new Date().toISOString() })
      .eq('cuenta_id', b.cuenta_id).eq('estado', 'borrador');
    if (error) return json({ error: error.message }, 500);
    await supabase.from('abm_cuentas').update({ etapa: 'en_cadencia', updated_at: new Date().toISOString() }).eq('id', b.cuenta_id).eq('etapa', 'sin_tocar');
    await apuntar(b.cuenta_id, 'sistema', 'nota', { texto: `${yo.nombre} aprobó la cadencia completa` });
    return json({ ok: true });
  }

  return json({ error: 'acción desconocida' }, 400);
};
