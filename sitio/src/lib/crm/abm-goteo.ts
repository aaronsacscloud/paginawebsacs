// El goteo: una base entra a su cadencia de a poco, N cuentas nuevas por día.
//
// Villa Hidalgo son 185 proveedores que se conocen entre ellos. Si los 171 con
// correo reciben la presentación la misma mañana, a mediodía ya se preguntan
// en el grupo «¿de dónde sacaron la base?». De diez en diez, cada día a diez
// negocios distintos, el correo llega como lo que es: alguien que investigó
// ese negocio y le escribió.
//
// Un renglón de abm_goteo = una cadencia + cuántas por día + un filtro. Cada
// día hábil (lo corre el cartero, /api/cron/abm-cadencias, antes de repartir)
// se toman las N cuentas elegibles mejor puntuadas que todavía no tienen
// cadencia, se les escribe la suya —la misma redacción con IA que desde la
// ficha— y se deja APROBADA con la firma de quien encendió el goteo. Esa es la
// aprobación humana de la regla 8.3: se da una vez, al encender, para toda la
// base. El motor global (abm_config.pausado) sigue mandando: con el motor
// pausado el goteo no enrola a nadie.
//
// Lo que NO hace: no manda. Mandar es del cartero, con su cupo, su rampa y su
// disyuntor. El goteo solo decide QUIÉN entra hoy a la fila.
import { promises as dns } from 'node:dns';
import { supabase } from '../supabase';
import { paisDe } from './abm-paises';
import { apuntar } from './abm.lib';
import { generarCadencia, CORREO_OK } from './abm-generar';

/** MX obligatorio (manual §5.1): un dominio sin MX es rebote duro seguro. La
 *  base de Villa Hidalgo entró con siete direcciones tipo `gmail.con` y
 *  `hotmail.como` en `sin_probar`: tres de esas en un lote abren el
 *  disyuntor el primer día. Se prueba aquí, al elegir, y el canal que falla
 *  queda `invalido` para que nadie lo vuelva a intentar. Nunca se corrige. */
const mxCache = new Map<string, boolean>();
export async function tieneMx(correo: string): Promise<boolean> {
  const dom = correo.split('@')[1]?.toLowerCase();
  if (!dom) return false;
  if (mxCache.has(dom)) return mxCache.get(dom)!;
  let ok = false;
  try { ok = (await dns.resolveMx(dom)).length > 0; }
  catch (e: any) {
    // Sin MX pero con A todavía puede recibir (RFC 5321); un NXDOMAIN no.
    if (e?.code === 'ENODATA') { try { ok = (await dns.resolve4(dom)).length > 0; } catch { ok = false; } }
    else ok = false;
  }
  mxCache.set(dom, ok);
  return ok;
}

const MS_PRESUPUESTO = 170_000;   // el cartero comparte los 300 s de la función con el reparto
// Cadencias con IA a la vez. Medido: ~60 s cada una (8 correos), y el tiempo
// es de la IA, no del servidor, así que diez en paralelo tardan lo mismo que
// cinco. Con 170 s caben dos tandas: 20 cuentas por corrida, 40 al día con las
// dos corridas del cartero (10:00 y 13:00). Ese es el pedido del dueño para
// SAPICA (13-sep-2026: «de 40 en 40»); con 5 en paralelo se quedaban en ~15.
const EN_PARALELO = 10;

const SIN_TIEMPO = 'sin tiempo en esta corrida; entra en la siguiente';

export type ResultadoLote = { goteo_id: string; nombre: string; fecha: string; cuentas: number; sin_ia: number; motivo: string | null; detalle: any[] };

/** Las cuentas que HOY podrían entrar a este goteo, en el orden en que entrarían. */
export async function elegibles(g: any, limite = 500): Promise<{ cuentas: any[]; total_base: number }> {
  const { data: cad } = await supabase.from('abm_cadencias').select('id, giro, ruta').eq('id', g.cadencia_id).maybeSingle();
  if (!cad) return { cuentas: [], total_base: 0 };

  let q = supabase.from('abm_cuentas')
    .select('id, nombre, ciudad, subgiro, puntaje, ruta, created_at')
    .eq('giro', cad.giro).eq('etapa', 'sin_tocar').is('ya_es_cliente', null)
    .order('puntaje', { ascending: false, nullsFirst: false }).order('created_at').order('id').limit(limite);  // el id desempata: una carga masiva deja el mismo created_at en toda la base
  // Una cuenta sin ruta es demo: nadie la mandó a diagnóstico.
  q = cad.ruta === 'demo' ? q.or('ruta.eq.demo,ruta.is.null') : q.eq('ruta', cad.ruta);
  const f = g.filtro || {};
  if (f.ciudad) q = q.ilike('ciudad', `%${String(f.ciudad).trim()}%`);
  if (f.subgiro) q = q.ilike('subgiro', `%${String(f.subgiro).trim()}%`);
  /* Por país (14-sep-2026): un goteo es de UN país o de México. Sin filtro
     se queda en México, que es donde viven las 21,107 cuentas de siempre;
     un goteo viejo no se traga de pronto a Colombia por el solo hecho de que
     la base creció. Se compara con el nombre tal como se guarda en
     abm_cuentas.pais («Colombia»), acepte el iso o el nombre. */
  q = q.eq('pais', paisDe(f.pais).nombre);
  const { data: base } = await q;
  const ids = (base || []).map((c: any) => c.id);
  if (!ids.length) return { cuentas: [], total_base: 0 };

  // Fresca = sin un solo toque, del estado que sea. Una cadencia cancelada o
  // enviada a medias no se vuelve a empezar desde aquí: eso lo decide alguien.
  // Por tandas de 150 ids, como resumen.ts y cuentas.ts. Un `in(...)` de 500
  // ids es una URL de ~19 KB: en Vercel pasó, pero con el Node del servidor
  // de desarrollo murió con «fetch failed» desde 400 ids (medido el 13-sep-2026
  // con la base de calzado), y `data` vacío aquí se lee como «quedan 0».
  const tocadas: any[] = [], canales: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const tanda = ids.slice(i, i + 150);
    const [t, k] = await Promise.all([
      /* Los toques CANCELADOS no cuentan: si la cadencia entera se canceló y
         la cuenta volvió a `sin_tocar`, está libre para entrar de nuevo. Sin
         esto, una cuenta cancelada quedaba excluida para siempre — y el camino
         más fácil de llegar ahí era justamente hacer clic (ver abm-ritmo). Lo
         que de verdad protege de volver a escribirle a quien no quiere es
         `etapa = no_contactar` y la lista de no contactar, no este filtro. */
      supabase.from('abm_toques').select('cuenta_id').in('cuenta_id', tanda)
        .neq('estado', 'cancelado').limit(5000),
      supabase.from('abm_canales').select('cuenta_id, valor, estado').in('cuenta_id', tanda).like('tipo', 'email%')
        .not('estado', 'in', '("invalido","rebote","opt_out")'),
    ]);
    tocadas.push(...(t.data || [])); canales.push(...(k.data || []));
  }
  const conToques = new Set(tocadas.map((t: any) => t.cuenta_id));
  const { data: no } = await supabase.from('abm_no_contactar').select('valor');
  const bloqueadas = new Set((no || []).map((r: any) => String(r.valor).toLowerCase()));
  const correoDe = new Map<string, string>();
  for (const k of canales) {
    const v = String(k.valor || '').toLowerCase();
    if (!CORREO_OK.test(v) || bloqueadas.has(v) || correoDe.has(k.cuenta_id)) continue;
    correoDe.set(k.cuenta_id, v);
  }

  // Un buzón, una cadencia: hay direcciones compartidas por dos negocios. Si
  // entraran los dos, el cartero cancelaría al segundo a media cadencia.
  const { data: vivas } = await supabase.from('abm_toques').select('destino')
    .in('estado', ['borrador', 'aprobado', 'programado', 'enviando', 'enviado'])
    .gte('created_at', new Date(Date.now() - 45 * 864e5).toISOString()).limit(5000);
  const buzonesOcupados = new Set((vivas || []).map((t: any) => String(t.destino || '').toLowerCase()));

  const cuentas: any[] = [];
  for (const c of base || []) {
    if (conToques.has(c.id)) continue;
    const correo = correoDe.get(c.id);
    if (!correo || buzonesOcupados.has(correo)) continue;
    buzonesOcupados.add(correo);
    cuentas.push({ ...c, correo });
  }
  return { cuentas, total_base: ids.length };
}

/** Enrola el lote de hoy de UN goteo: escribe, aprueba y deja constancia. */
export async function enrolarLote(g: any, hoy: string, quien = 'el goteo', tope = Number(g.cuentas_dia) || 10, limite = Date.now() + MS_PRESUPUESTO): Promise<ResultadoLote> {
  const res: ResultadoLote = { goteo_id: g.id, nombre: g.nombre, fecha: hoy, cuentas: 0, sin_ia: 0, motivo: null, detalle: [] };
  const cerrar = async (patch: Record<string, any> = {}) => {
    await supabase.from('abm_goteo_lotes').insert({ goteo_id: g.id, fecha: hoy, cuentas: res.cuentas, sin_ia: res.sin_ia, detalle: res.detalle, motivo: res.motivo });
    await supabase.from('abm_goteo').update({ ultimo_lote: hoy, updated_at: new Date().toISOString(), ...patch }).eq('id', g.id);
    return res;
  };

  /* Si lo de días anteriores sigue en la fila, no se apila más encima: la
     rampa del cartero manda, y enrolar diez más solo alarga la cola.
     SOLO CORREO (16-sep-2026). Un WhatsApp cuya plantilla todavía no aprueba
     Meta se queda en `aprobado` para siempre a propósito —espera su permiso—,
     y contándolo aquí el goteo se frenaba solo a los dos o tres días y decía
     «N correos de días anteriores siguen sin salir», que además es falso. Le
     habría pasado a España el martes de estrenarla: 472 de sus 1,737 cuentas
     llevan WhatsApp. */
  const { count: atorados } = await supabase.from('abm_toques').select('id', { count: 'exact', head: true })
    .eq('goteo_id', g.id).eq('canal', 'email').eq('estado', 'aprobado').lt('programado_at', hoy + 'T00:00:00Z');
  if ((atorados || 0) > Number(g.cuentas_dia)) {
    res.motivo = `${atorados} correos de días anteriores siguen sin salir: no se enrolan más hasta que el cartero se ponga al día`;
    return cerrar();
  }

  const { cuentas } = await elegibles(g, 300);
  if (!cuentas.length) {
    res.motivo = 'ya no quedan cuentas elegibles en esta base: el goteo terminó';
    return cerrar({ estado: 'terminado' });
  }
  // Se camina la lista probando MX hasta juntar el lote: la que falla se
  // marca invalida y no cuenta, la siguiente de la fila ocupa su lugar.
  const lote: any[] = [];
  for (const c of cuentas) {
    if (lote.length >= tope) break;
    if (await tieneMx(c.correo)) { lote.push(c); continue; }
    await supabase.from('abm_canales').update({ estado: 'invalido', verificado_at: new Date().toISOString() })
      .eq('cuenta_id', c.id).ilike('valor', c.correo).like('tipo', 'email%');
    await apuntar(c.id, 'email', 'nota', { texto: `${c.correo}: el dominio no recibe correo (sin MX). Canal marcado inválido; no entra al goteo.` });
    res.detalle.push({ cuenta_id: c.id, nombre: c.nombre, error: 'dominio sin MX, canal marcado inválido' });
  }
  if (!lote.length) { res.motivo = 'ninguna elegible con dominio que reciba correo'; return cerrar(); }
  const autor = `${quien} («${g.nombre}»)`;

  const una = async (c: any) => {
    if (Date.now() > limite) { res.detalle.push({ cuenta_id: c.id, nombre: c.nombre, error: SIN_TIEMPO }); return; }
    const r = await generarCadencia(c.id, { autor, con_ia: g.con_ia !== false, goteo_id: g.id, arranca_hoy: true });
    if (!r.ok) { res.detalle.push({ cuenta_id: c.id, nombre: c.nombre, error: r.error }); return; }
    await supabase.from('abm_toques')
      .update({ estado: 'aprobado', aprobado_por: g.creado_por || null, aprobado_at: new Date().toISOString() })
      .in('id', r.toque_ids).eq('estado', 'borrador');
    await supabase.from('abm_cuentas').update({ etapa: 'en_cadencia', updated_at: new Date().toISOString() }).eq('id', c.id).eq('etapa', 'sin_tocar');
    await apuntar(c.id, 'sistema', 'nota', { texto: `Entró al goteo «${g.nombre}»: ${r.correos} correos${r.whatsapps ? ` y ${r.whatsapps} WhatsApp` : ''} aprobados con la firma de quien encendió la opción` });
    res.cuentas++; if (!r.con_ia) res.sin_ia++;
    res.detalle.push({ cuenta_id: c.id, nombre: c.nombre, correos: r.correos, whatsapps: r.whatsapps, con_ia: r.con_ia, destino: r.destino });
  };
  for (let i = 0; i < lote.length; i += EN_PARALELO) await Promise.all(lote.slice(i, i + EN_PARALELO).map(una));

  if (!res.cuentas) res.motivo = 'ninguna de las elegibles pudo entrar (ver detalle)';
  return cerrar({ enroladas: Number(g.enroladas || 0) + res.cuentas });
}

/** Corre los goteos que toquen hoy. `forzar` repite aunque ya haya corrido (botón «enrolar ahora»). */
export async function correrGoteos(op: { hoy?: string; solo_id?: string; forzar?: boolean; quien?: string } = {}): Promise<ResultadoLote[]> {
  const hoy = op.hoy || new Date().toISOString().slice(0, 10);
  /* Por PRIORIDAD, no por antigüedad (17-sep-2026). El presupuesto de la
     corrida (170 s de IA) se lo comían los goteos grandes y los de más abajo
     se quedaban con «sin tiempo en esta corrida» día tras día: la cadencia de
     novias llevaba una semana escribiendo correos que nunca salían. Ahora el
     dueño decide quién entra primero cuando no alcanza. */
  let q = supabase.from('abm_goteo').select('*').eq('estado', 'activo').order('prioridad').order('created_at');
  if (op.solo_id) q = q.eq('id', op.solo_id);
  const { data: goteos } = await q;
  const salida: ResultadoLote[] = [];
  // El presupuesto de tiempo es de la CORRIDA, no de cada goteo: tres goteos
  // con 170 s cada uno se pasaban de los 300 s de la función y el cartero ya
  // no alcanzaba a mandar. Y el que todavía no tiene lote hoy va primero, para
  // que uno grande completando el suyo no deje sin turno a los demás.
  const limite = Date.now() + MS_PRESUPUESTO;
  const orden = [...(goteos || [])].sort((a: any, b: any) => Number(a.ultimo_lote === hoy) - Number(b.ultimo_lote === hoy));
  for (const g of orden) {
    if (String(g.inicio) > hoy) continue;
    if (g.hasta && String(g.hasta) < hoy) {
      await supabase.from('abm_goteo').update({ estado: 'terminado', updated_at: new Date().toISOString() }).eq('id', g.id);
      continue;
    }
    // Un lote por día… salvo que la corrida de la mañana se haya quedado sin
    // tiempo a medio lote: entonces la de la tarde lo completa, con lo que
    // falte. Sin esto, «40 al día» eran 20: la segunda corrida veía el lote
    // de hoy hecho y pasaba de largo.
    let tope = Number(g.cuentas_dia) || 10;
    if (g.ultimo_lote === hoy && !op.forzar) {
      const { data: lotes } = await supabase.from('abm_goteo_lotes').select('cuentas, detalle').eq('goteo_id', g.id).eq('fecha', hoy);
      const hechas = (lotes || []).reduce((n: number, l: any) => n + Number(l.cuentas || 0), 0);
      const sinTiempo = (lotes || []).some((l: any) => (Array.isArray(l.detalle) ? l.detalle : []).some((d: any) => d?.error === SIN_TIEMPO));
      if (!sinTiempo || hechas >= tope) continue;
      tope -= hechas;
    }
    salida.push(await enrolarLote(g, hoy, op.quien, tope, limite));
  }
  return salida;
}
