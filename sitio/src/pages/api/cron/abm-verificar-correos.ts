// Verificación de correos con ZeroBounce ANTES de que entren a una cadencia.
//
// Por qué: la cadencia en frío se pausa sola con 3 rebotes en un día (ver
// abm-cadencias). Una base recién barrida trae direcciones muertas, y cada
// una que rebota quema reputación del dominio. Verificar cuesta un crédito
// por dirección (~1 centavo de dólar); un rebote cuesta mucho más.
//
// Qué hace con cada respuesta de ZeroBounce:
//   valid                         → estado 'valido'
//   do_not_mail + role_based      → 'valido' con confianza media: ventas@ o
//                                   contacto@ es JUSTO el buzón del mostrador
//                                   que queremos; ZeroBounce lo marca por ser
//                                   genérico, no porque no exista.
//   invalid / spamtrap / abuse /
//   do_not_mail (desechable,
//   tóxico, lista de supresión…)  → 'invalido' (nadie vuelve a escribir ahí)
//   catch-all / unknown           → queda 'sin_probar' con confianza baja y
//                                   verificado_at puesto (no se vuelve a cobrar);
//                                   la cadencia sí puede usarla, el rebote decide.
//
// Cada veredicto queda en abm_fuentes (metodo 'zerobounce') con su sub-estado.
// Sin llave o sin créditos no falla: dice qué falta.
//
// GET /api/cron/abm-verificar-correos?cuantas=100&giro=renta
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const ZB = 'https://api.zerobounce.net/v2';

type Veredicto = { estado: 'valido' | 'invalido' | 'sin_probar'; confianza?: 'baja' | 'media' };
function veredicto(status: string, sub: string): Veredicto {
  if (status === 'valid') return { estado: 'valido' };
  if (status === 'do_not_mail' && sub === 'role_based') return { estado: 'valido', confianza: 'media' };
  if (status === 'catch-all' || status === 'unknown') return { estado: 'sin_probar', confianza: 'baja' };
  return { estado: 'invalido' };            // invalid, spamtrap, abuse, do_not_mail (resto)
}
/** Nunca sube la confianza que ya tenía: gmail sigue siendo media aunque sea válido. */
const menor = (a: string | null, b?: string) => {
  const orden = ['baja', 'media', 'alta'];
  if (!b) return a;
  return orden.indexOf(String(a)) < orden.indexOf(b) ? a : b;
};

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = (import.meta.env.CRON_SECRET || process.env.CRON_SECRET || '').trim();
  if (secret && auth !== `Bearer ${secret}`) return json({ error: 'no autorizado' }, 401);

  const key = String(import.meta.env.ZEROBOUNCE_API_KEY || process.env.ZEROBOUNCE_API_KEY || '').trim();
  if (!key) return json({ error: 'falta ZEROBOUNCE_API_KEY', que_hace: 'verifica que cada correo exista antes de meterlo a una cadencia' }, 409);

  const giro = url.searchParams.get('giro');
  const pedidas = Math.min(500, Math.max(1, Number(url.searchParams.get('cuantas') || 100)));

  const cred = await fetch(`${ZB}/getcredits?api_key=${key}`).then(r => r.json()).catch(() => null);
  const creditos = Number(cred?.Credits ?? -1);
  if (creditos < 1) return json({ error: creditos === 0 ? 'ZeroBounce sin créditos: hay que comprar' : 'ZeroBounce no respondió', creditos }, 409);

  // Correos sin probar de cuentas contactables, las de más puntaje primero.
  let q = supabase.from('abm_canales')
    .select('id, cuenta_id, valor, confianza, abm_cuentas!inner(giro, puntaje, etapa, ya_es_cliente)')
    .like('tipo', 'email%').eq('estado', 'sin_probar').is('verificado_at', null)
    .neq('abm_cuentas.etapa', 'no_contactar').is('abm_cuentas.ya_es_cliente', null)
    .order('puntaje', { referencedTable: 'abm_cuentas', ascending: false })
    .limit(pedidas * 2);
  if (giro) q = q.eq('abm_cuentas.giro', giro);
  const { data: filas, error } = await q;
  if (error) return json({ error: error.message }, 500);

  // Una dirección repetida en varias cuentas se paga una sola vez.
  const porCorreo = new Map<string, any[]>();
  for (const f of filas || []) {
    const v = String(f.valor || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) continue;
    if (!porCorreo.has(v)) porCorreo.set(v, []);
    porCorreo.get(v)!.push(f);
  }
  const correos = [...porCorreo.keys()].slice(0, Math.min(pedidas, creditos));
  if (!correos.length) return json({ verificados: 0, creditos, nota: 'no hay correos sin probar' });

  const cuenta: Record<string, number> = { valido: 0, valido_generico: 0, invalido: 0, sin_definir: 0 };
  const sugeridos: string[] = [];
  const ahora = new Date().toISOString();
  for (let i = 0; i < correos.length; i += 100) {
    const lote = correos.slice(i, i + 100);
    const r = await fetch(`${ZB}/validatebatch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, email_batch: lote.map(e => ({ email_address: e })) }),
    }).then(x => x.json()).catch(e => ({ errors: [String(e)] }));
    if (!Array.isArray(r?.email_batch)) return json({ error: 'ZeroBounce falló', detalle: r?.errors || r, verificados: i, ...cuenta }, 502);

    for (const res of r.email_batch) {
      const email = String(res.address || '').toLowerCase();
      const filasDe = porCorreo.get(email) || [];
      const v = veredicto(String(res.status), String(res.sub_status || ''));
      if (v.estado === 'valido') cuenta[res.sub_status === 'role_based' ? 'valido_generico' : 'valido']++;
      else if (v.estado === 'invalido') cuenta.invalido++;
      else cuenta.sin_definir++;
      if (res.did_you_mean) sugeridos.push(`${email} → ${res.did_you_mean}`);

      for (const f of filasDe) {
        await supabase.from('abm_canales').update({
          estado: v.estado, verificado_at: ahora,
          confianza: menor(f.confianza, v.confianza),
        }).eq('id', f.id);
        await supabase.from('abm_fuentes').insert({
          cuenta_id: f.cuenta_id, campo: 'email_verificacion',
          valor: `${email}: ${res.status}${res.sub_status ? '/' + res.sub_status : ''}${res.did_you_mean ? ' · ¿quiso decir ' + res.did_you_mean + '?' : ''}`,
          metodo: 'zerobounce', confianza: v.estado === 'sin_probar' ? 'baja' : 'alta', agente: 'abm-verificar-correos',
        });
      }
    }
  }
  const despues = await fetch(`${ZB}/getcredits?api_key=${key}`).then(r => r.json()).catch(() => null);
  return json({ verificados: correos.length, ...cuenta, sugeridos, creditos_antes: creditos, creditos_despues: Number(despues?.Credits ?? -1) });
};
