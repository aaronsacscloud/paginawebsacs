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
// DOS PASADAS, Y LA PRIMERA ES GRATIS
// Antes de gastar un crédito se comprueba el DNS del dominio. Un dominio sin
// MX ni A no recibe correo: el rebote no es mala suerte, es seguro, y saberlo
// cuesta milisegundos en vez de un crédito. Los dominios se agrupan, así que
// mil direcciones de gmail son UNA consulta.
//
// Se agregó tras la primera tanda real (14-sep-2026): salieron 15 correos y
// rebotaron 3 —veinte por ciento—. El disyuntor corta con 3, o sea que la
// segunda tanda ya no habría salido. La causa de raíz no fue ZeroBounce: fue
// que este cron NO ESTABA AGENDADO en vercel.json y nunca había corrido solo.
// De 2,214 correos del motor solo 3 habían pasado por aquí.
//
// Y ahora funciona SIN LLAVE: sin ZeroBounce hace la pasada de DNS y reporta
// lo que falta, en vez de salirse con 409 y dejar todo sin verificar. Una
// verificación gratis a medias vale más que ninguna.
//
// GET /api/cron/abm-verificar-correos?cuantas=100&giro=renta&solo_dns=1
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { promises as dns } from 'node:dns';

/** Los que sabemos de memoria que reciben correo: consultarlos es tirar
 *  milisegundos y arriesgarse a que un DNS lento los marque mal. */
const DOMINIOS_SEGUROS = new Set([
  'gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es',
  'yahoo.com', 'yahoo.com.mx', 'icloud.com', 'live.com', 'live.com.mx',
  'msn.com', 'prodigy.net.mx', 'me.com',
]);

/** ¿Este dominio puede recibir correo? Un dominio sin MX pero CON registro A
 *  sí puede: el RFC entrega al host del A. Es raro, pero descartarlo tiraría
 *  direcciones buenas. */
async function recibeCorreo(dom: string): Promise<boolean> {
  if (DOMINIOS_SEGUROS.has(dom)) return true;
  try { const mx = await dns.resolveMx(dom); if (mx?.length) return true; } catch { /* sigue */ }
  try { const a = await dns.resolve4(dom); return !!a?.length; } catch { return false; }
}

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
  const soloDns = url.searchParams.get('solo_dns') === '1' || !key;

  const giro = url.searchParams.get('giro');
  const pedidas = Math.min(500, Math.max(1, Number(url.searchParams.get('cuantas') || 100)));

  let creditos = 0;
  if (!soloDns) {
    const cred = await fetch(`${ZB}/getcredits?api_key=${key}`).then(r => r.json()).catch(() => null);
    creditos = Number(cred?.Credits ?? -1);
  }

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
  /* ── Pasada 1: el DNS, gratis ─────────────────────────────────────────────
     Se agrupa por dominio, así que mil gmails son una sola consulta. Lo que no
     recibe correo se marca inválido aquí y NO llega a gastar un crédito. */
  const todos = [...porCorreo.keys()];
  const dominios = [...new Set(todos.map((e) => e.split('@')[1]))];
  const vivo = new Map<string, boolean>();
  for (let i = 0; i < dominios.length; i += 20) {
    const t = dominios.slice(i, i + 20);
    const r = await Promise.all(t.map(async (d) => [d, await recibeCorreo(d)] as const));
    for (const [d, ok] of r) vivo.set(d, ok);
  }
  const muertos = todos.filter((e) => !vivo.get(e.split('@')[1]));
  const ahoraDns = new Date().toISOString();
  for (const e of muertos) {
    for (const f of porCorreo.get(e) || []) {
      await supabase.from('abm_canales').update({ estado: 'invalido', verificado_at: ahoraDns }).eq('id', f.id);
      await supabase.from('abm_fuentes').insert({
        cuenta_id: f.cuenta_id, campo: 'email_verificacion',
        valor: `${e}: el dominio ${e.split('@')[1]} no recibe correo (sin MX ni A)`,
        metodo: 'dns', confianza: 'alta', agente: 'abm-verificar-correos',
      });
    }
    porCorreo.delete(e);
  }
  /* Y lo que estuviera armado para salirle a esas direcciones se cancela. Sin
     esto el canal queda muerto pero el correo igual sale y rebota, que es
     exactamente lo que pasó el 14-sep. */
  if (muertos.length) {
    await supabase.from('abm_toques').update({ estado: 'cancelado' })
      .in('estado', ['borrador', 'aprobado', 'programado']).in('destino', muertos);
  }

  if (soloDns) {
    return json({
      modo: 'solo DNS', revisados: todos.length, dominios: dominios.length,
      invalidados_por_dns: muertos.length, quedan_para_zerobounce: porCorreo.size,
      nota: key ? 'pedido con solo_dns=1' : 'sin ZEROBOUNCE_API_KEY: se hizo la pasada gratis',
    });
  }

  const correos = [...porCorreo.keys()].slice(0, Math.min(pedidas, creditos));
  if (!correos.length) return json({ verificados: 0, invalidados_por_dns: muertos.length, creditos, nota: 'no quedan correos sin probar' });

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
  return json({ verificados: correos.length, invalidados_por_dns: muertos.length, ...cuenta, sugeridos, creditos_antes: creditos, creditos_despues: Number(despues?.Credits ?? -1) });
};
