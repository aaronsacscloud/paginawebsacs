// La cola de teléfono: las cuentas que NO tienen correo pero sí teléfono.
//
// 433 de las 810 no tienen correo, y 343 de ellas sí tienen teléfono. Sin esta
// cola, la mitad de la investigación no tiene salida en el sistema.
//
// Y la llamada NO es para vender: es para preguntar quién ve las compras y
// cuál es su correo. Es enriquecimiento y toque en la misma acción — el
// WhatsApp que tenemos es el del mostrador, no el del dueño.
//
// GET  /api/crm/abm/cola?giro=&limite=   → a quién llamar hoy, con su guion
// POST /api/crm/abm/cola { cuenta_id, resultado, nombre?, cargo?, email?, whatsapp?, nota? }
//   resultado: contesto | no_contesto | volver_llamar | dieron_datos | no_interesa
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar, apuntar, repuntuar, GIROS } from '../../../../lib/crm/abm.lib';

export const prerender = false;

/** Lo que hay que decir, en una frase, según el giro. */
function guion(c: any): string {
  if (c.pausa_motivo === 'abre y no contesta: toca llamada') {
    return `Buenas tardes, le hablo de Sacscloud. Le mandé un par de correos sobre inventario `
      + `y no quiero seguir insistiendo por ahí sin saber si le sirve. `
      + `¿Le late que le cuente en dos minutos y usted me dice si tiene sentido para ${c.nombre}?`;
  }
  const quePasa = c.giro === 'joyeria' ? 'cómo sacan el costo de sus piezas cuando se mueve el precio del oro'
    : c.giro === 'renta' || c.giro === 'novias' ? 'cómo llevan las piezas apartadas entre sus tiendas'
    : c.giro === 'telas' ? 'cómo llevan el metraje que les queda de cada rollo'
    : c.giro === 'western' || c.giro === 'zapaterias' ? 'cómo llevan las tallas entre sus tiendas'
    : c.giro === 'canal' || c.giro === 'aliados' ? 'cómo llevan el inventario los negocios que les compran'
    : 'cómo llevan el inventario entre sus tiendas';
  return `Buenas tardes, le hablo de Sacscloud, hacemos sistemas para negocios de moda. `
    + `No le llamo para venderle nada por teléfono: quería preguntarle ${quePasa}. `
    + `¿Con quién puedo platicar de eso — y cuál sería su correo para mandarle la información?`;
}

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const giro = url.searchParams.get('giro') || '';
  const limite = Math.min(60, Number(url.searchParams.get('limite') || 25));

  // Dos poblaciones, y la segunda es la mejor: las que NO tienen correo (para
  // conseguirlo) y las que abrieron el correo varias veces sin contestar. Esa
  // segunda ya leyó, ya sabe quiénes somos y solo falta hablarle — insistir
  // por correo ahí es lo único que no funciona.
  const SEL = 'id, nombre, giro, subgiro, ciudad, sucursales, google_rating, google_resenas, plataforma_web, contexto, senal_expansion, puntaje, etapa, tiene_email, tiene_wa, pausa_motivo';
  let q = supabase.from('abm_cuentas').select(SEL)
    .neq('etapa', 'no_contactar').is('ya_es_cliente', null)
    .or('tiene_email.eq.false,pausa_motivo.eq.abre y no contesta: toca llamada')
    .order('puntaje', { ascending: false }).limit(limite * 3);
  if (giro) q = q.eq('giro', giro);
  const { data: cuentas } = await q;
  if (!cuentas?.length) return json({ cola: [] });

  const ids = cuentas.map(c => c.id);
  const [{ data: canales }, { data: tocadas }] = await Promise.all([
    supabase.from('abm_canales').select('cuenta_id, tipo, valor').in('cuenta_id', ids).in('tipo', ['telefono', 'whatsapp_tienda', 'dm_ig', 'dm_fb']),
    supabase.from('abm_actividad').select('cuenta_id').in('cuenta_id', ids).eq('canal', 'llamada'),
  ]);
  const porCuenta: Record<string, any[]> = {};
  for (const c of canales || []) (porCuenta[c.cuenta_id] ||= []).push(c);
  const yaLlamadas = new Set((tocadas || []).map((a: any) => a.cuenta_id));

  const cola = cuentas
    .filter(c => (porCuenta[c.id] || []).some(x => x.tipo === 'telefono' || x.tipo === 'whatsapp_tienda'))
    .filter(c => !yaLlamadas.has(c.id))          // primero los que nadie ha llamado
    .slice(0, limite)
    .map(c => ({
      ...c,
      giro_nombre: GIROS[c.giro] || c.giro,
      telefono: (porCuenta[c.id] || []).find(x => x.tipo === 'telefono')?.valor || null,
      whatsapp: (porCuenta[c.id] || []).find(x => x.tipo === 'whatsapp_tienda')?.valor || null,
      guion: guion(c),
      // Si abrió correos, el guion cambia por completo: ya no es presentarse.
      abrio: c.pausa_motivo === 'abre y no contesta: toca llamada',
    }));
  return json({ cola, sin_llamar: cuentas.length - yaLlamadas.size });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  if (!esUuid(b?.cuenta_id)) return json({ error: 'cuenta inválida' }, 400);
  const resultado = String(b.resultado || '');
  const OK = new Set(['contesto', 'no_contesto', 'volver_llamar', 'dieron_datos', 'no_interesa']);
  if (!OK.has(resultado)) return json({ error: 'resultado inválido' }, 400);

  const dicho: Record<string, string> = {
    contesto: 'Contestaron pero no dieron con quién', no_contesto: 'No contestaron',
    volver_llamar: 'Pidieron volver a llamar', dieron_datos: 'Dieron con quién hablar',
    no_interesa: 'Dijeron que no les interesa',
  };
  await apuntar(b.cuenta_id, 'llamada', 'llamada', {
    texto: `${yo.nombre} llamó · ${dicho[resultado]}${b.nota ? ': ' + limpiar(b.nota, 500) : ''}`,
    transcripcion: limpiar(b.transcripcion, 20000) || null,
    detalle: { resultado },
  });

  // Lo que nos dijeron por teléfono es la verdad confirmada: gana sobre lo
  // investigado y abre el camino del correo, que es el que se automatiza.
  if (resultado === 'dieron_datos' && (b.nombre || b.email || b.whatsapp)) {
    const { data: p } = await supabase.from('abm_personas').insert({
      cuenta_id: b.cuenta_id, nombre: limpiar(b.nombre, 120) || 'quien nos atendió',
      cargo: limpiar(b.cargo, 120) || null, es_dueno: true,
      email: limpiar(b.email, 200) || null, whatsapp: limpiar(b.whatsapp, 60) || null,
      confirmado: true, confirmado_por: yo.id, confirmado_at: new Date().toISOString(),
    }).select('id').single();
    if (b.email) await supabase.from('abm_canales').insert({
      cuenta_id: b.cuenta_id, persona_id: p?.id || null, tipo: 'email_direccion', valor: limpiar(b.email, 200),
      confianza: 'alta', es_de_la_tienda: false, estado: 'valido', verificado_at: new Date().toISOString(),
    });
    if (b.whatsapp) await supabase.from('abm_canales').insert({
      cuenta_id: b.cuenta_id, persona_id: p?.id || null, tipo: 'whatsapp_dueno', valor: limpiar(b.whatsapp, 60),
      confianza: 'alta', es_de_la_tienda: false, estado: 'valido', verificado_at: new Date().toISOString(),
    });
    await repuntuar(b.cuenta_id);
  }

  if (resultado === 'no_interesa') {
    await supabase.from('abm_cuentas').update({ etapa: 'perdida', updated_at: new Date().toISOString() }).eq('id', b.cuenta_id);
  }
  return json({ ok: true });
};
