// Unificar la fecha de cobro de varias licencias de un mismo cliente.
//
// NO fusiona ni cancela nada: el cliente sigue teniendo sus N licencias, con su
// precio y sus sucursales. Lo único que se mueve es CUÁNDO se cobran, para que
// dejen de llegar tres recibos en tres meses distintos.
//
// El ARR no cambia — antes y después es la misma suma— y por eso esto no toca
// el ledger de movimientos: no hay alta ni baja, hay reacomodo de fechas.
//
// La cuenta es por días. Cada licencia tiene su tarifa diaria (precio ÷ días del
// ciclo) y con ella se calcula, contra la fecha ancla:
//
//   · Días ya PAGADOS que quedan por delante → crédito. Se guarda como saldo a
//     favor y se descuenta del cobro de ese año. Sin eso se le cobraría dos
//     veces el mismo periodo, que es exactamente lo que hay que evitar.
//   · Días que le FALTAN para llegar al ancla → puente. Se suma al primer cobro
//     unificado: es cobertura que todavía no ha pagado.
//
// GET  ?company_id=            → qué se puede unificar y con qué anclas
// POST { company_id, ids[], ancla, dry } → simula o aplica
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const num = (x: any) => Number(x || 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
const dias = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000);

// Licencias que se pueden juntar: activas y CÍCLICAS. Una vitalicia no tiene
// próxima factura que alinear, y una pausada no se está cobrando.

const CAMPOS = 'id, company_id, nombre_plan, ciclo, estado, precio, monto_proximo, proxima_factura, arr, mrr, saldo_favor, grupo_cobro';

const DIAS_CICLO = (ciclo: string) => (ciclo === 'mensual' ? 30 : 365);

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id') || '';
  if (!companyId) return json({ error: 'Falta el cliente.' }, 400);

  // Se traen TODAS las del cliente, no solo las unificables. Antes se filtraba
  // aquí y una licencia sin fecha de renovación —o pausada— simplemente no
  // aparecía en la lista: el usuario unificaba dos de tres sin enterarse de que
  // faltaba una, y no había forma de saber por qué. Ahora vienen con el motivo.
  const { data } = await supabase.from('subscriptions').select(CAMPOS)
    .eq('company_id', companyId).order('proxima_factura', { nullsFirst: false });

  const porQueNo = (s: any): string | null => {
    if (!['activa', 'pendiente_pago'].includes(s.estado)) return `está ${s.estado}: solo se unifican las que se están cobrando`;
    if (s.ciclo === 'vitalicia') return 'es de pago único: no tiene renovación que alinear';
    if (!s.proxima_factura) return 'no tiene fecha de próxima factura capturada';
    return null;
  };
  const todas = (data || []).map((s: any) => ({ ...s, _no: porQueNo(s) }));
  const subs = todas.filter((s: any) => !s._no);
  // Se agrupan por ciclo: una mensual y una anual no comparten cadencia, así
  // que alinearlas una vez no las mantiene alineadas. Cada ciclo se unifica
  // dentro de su propio grupo.
  const grupos: Record<string, any[]> = {};
  subs.forEach((s: any) => { (grupos[s.ciclo] = grupos[s.ciclo] || []).push(s); });
  // Las que no se pueden unificar se cuelgan del grupo de su ciclo para que la
  // pantalla las enseñe apagadas con su motivo. Sin ciclo utilizable van a la
  // bolsa del primer grupo, que es donde el usuario las va a buscar.
  const fuera = todas.filter((s: any) => s._no).map((s: any) => ({
    id: s.id, nombre_plan: s.nombre_plan, ciclo: s.ciclo, estado: s.estado,
    proxima_factura: s.proxima_factura ? String(s.proxima_factura).slice(0, 10) : null,
    motivo: s._no,
  }));

  // Propuestas que ya se le mandaron al cliente y siguen esperando su OK: sin
  // esto se generaría una nueva cada vez que alguien abre la ficha.
  const { data: props } = await supabase.from('unificaciones')
    .select('id, ancla, ciclo, a_pagar, credito, estado, autorizada_at, created_at, detalle')
    .eq('company_id', companyId).in('estado', ['propuesta', 'autorizada'])
    .order('created_at', { ascending: false });

  return json({
    propuestas: props || [],
    grupos: Object.entries(grupos).map(([ciclo, lista]) => ({
      ciclo,
      // Con una sola no hay nada que unificar; con fechas iguales, tampoco.
      unificable: lista.length > 1 && new Set(lista.map((s: any) => String(s.proxima_factura).slice(0, 10))).size > 1,
      anclas: Array.from(new Set(lista.map((s: any) => String(s.proxima_factura).slice(0, 10)))).sort(),
      subs: lista.map((s: any) => ({
        id: s.id, nombre_plan: s.nombre_plan, precio: Math.round(num(s.monto_proximo ?? s.precio)),
        proxima_factura: String(s.proxima_factura).slice(0, 10), saldo_favor: num(s.saldo_favor),
        grupo_cobro: s.grupo_cobro,
      })),
      // Se enseñan apagadas: que falte una licencia sin explicación es lo que
      // hace pensar que la unificación "no jaló".
      fuera: fuera.filter((f: any) => f.ciclo === ciclo || !['mensual', 'anual'].includes(f.ciclo)),
    })),
    fuera,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const ids: string[] = Array.isArray(b?.ids) ? b.ids.filter(Boolean) : [];
  const ancla = String(b?.ancla || '').slice(0, 10);
  const dry = b?.dry !== false;   // por defecto SIMULA: aplicar se pide expreso
  if (ids.length < 2) return json({ error: 'Hay que elegir al menos dos licencias.' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ancla)) return json({ error: 'Falta la fecha en la que quedan todas.' }, 400);

  const { data: subs } = await supabase.from('subscriptions').select(CAMPOS).in('id', ids);
  if (!subs || subs.length !== ids.length) return json({ error: 'Alguna licencia ya no existe.' }, 404);

  // ── Candados ──
  // Cada uno responde a una forma distinta de ensuciar el dato, y por eso se
  // explican en vez de fallar con "no se puede".
  const mala = subs.find((s: any) => !['activa', 'pendiente_pago'].includes(s.estado));
  if (mala) return json({ error: `“${mala.nombre_plan}” no está activa. Solo se unifican licencias que se están cobrando.` }, 400);
  const vit = subs.find((s: any) => s.ciclo === 'vitalicia' || !s.proxima_factura);
  if (vit) return json({ error: `“${vit.nombre_plan}” es de pago único: no tiene fecha de renovación que alinear.` }, 400);
  const ciclos = new Set(subs.map((s: any) => s.ciclo));
  if (ciclos.size > 1) return json({ error: 'No se pueden juntar mensuales con anuales: no comparten cadencia, y alinearlas hoy no las deja alineadas el próximo periodo.' }, 400);
  const empresas = new Set(subs.map((s: any) => s.company_id));
  if (empresas.size > 1) return json({ error: 'Las licencias son de clientes distintos.' }, 400);

  const ciclo = String(subs[0].ciclo);
  const dc = DIAS_CICLO(ciclo);

  const detalle = subs.map((s: any) => {
    const precio = num(s.monto_proximo ?? s.precio);
    const hasta = String(s.proxima_factura).slice(0, 10);
    const d = dias(ancla, hasta);                 // + = pagado de más, − = le falta
    const tarifa = precio / dc;
    const credito = d > 0 ? r2(tarifa * d) : 0;   // días ya pagados que sobran
    const puente = d < 0 ? r2(tarifa * -d) : 0;   // días que faltan para llegar
    return {
      id: s.id, nombre_plan: s.nombre_plan, precio: Math.round(precio),
      proxima_factura: hasta, dias: d,
      credito: Math.round(credito), puente: Math.round(puente),
      saldo_favor_actual: num(s.saldo_favor),
      // Lo que se le cobrará a ESTA licencia en el ancla, ya con su ajuste.
      cobro: Math.round(precio + puente - credito),
    };
  });

  const totalAnual = detalle.reduce((a, x) => a + x.precio, 0);
  const credito = detalle.reduce((a, x) => a + x.credito, 0);
  const puente = detalle.reduce((a, x) => a + x.puente, 0);
  const aPagar = Math.max(0, totalAnual + puente - credito);

  const resumen = {
    ancla, ciclo, licencias: detalle.length,
    total_periodo: totalAnual, credito, puente, a_pagar: aPagar,
    // El ARR es el mismo antes y después: es el argumento de por qué esto no
    // pasa por el ledger ni cuenta como baja.
    arr: Math.round(subs.reduce((a: number, s: any) => a + (num(s.arr) || (s.ciclo === 'mensual' ? num(s.mrr) * 12 : num(s.precio))), 0)),
    detalle,
  };

  if (dry) return json({ ok: true, simulacion: true, ...resumen });

  // ── Propuesta ──
  // Antes de mover una sola fecha se genera el documento que ve el cliente. Es
  // la diferencia entre proponerle un cambio y hacérselo: el cobro cambia de
  // monto y de fecha, y eso se acuerda, no se avisa.
  if (b?.accion === 'propuesta') {
    const { data, error } = await supabase.from('unificaciones').insert({
      company_id: subs[0].company_id, ciclo, ancla, ids,
      detalle, total_periodo: totalAnual, credito, puente, a_pagar: aPagar, arr: resumen.arr,
      estado: 'propuesta',
    }).select('id').single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, propuesta_id: data.id, url: `/propuesta/${data.id}`, ...resumen }, 201);
  }

  // ── Aplicar ──
  // El crédito vive en saldo_favor: se consume solo al registrar el pago y no
  // hay que acordarse de revertir nada. El puente se suma a monto_proximo, que
  // es justo "cuánto se cobra la próxima vez".
  const grupo = crypto.randomUUID();
  const ahora = new Date().toISOString();
  const errores: string[] = [];
  for (const x of detalle) {
    const upd: any = {
      proxima_factura: ancla,
      grupo_cobro: grupo, grupo_cobro_at: ahora,
      updated_at: ahora,
    };
    if (x.credito > 0) upd.saldo_favor = r2(x.saldo_favor_actual + x.credito);
    if (x.puente > 0) upd.monto_proximo = Math.round(x.precio + x.puente);
    const { error } = await supabase.from('subscriptions').update(upd).eq('id', x.id);
    if (error) errores.push(`${x.nombre_plan}: ${error.message}`);
  }
  if (errores.length) return json({ error: 'No se pudieron alinear todas: ' + errores.join(' · ') }, 500);

  // Queda constancia: en la renovación alguien va a preguntar por qué el cobro
  // de este año trae descuento.
  await supabase.from('activities').insert({
    company_id: subs[0].company_id,
    tipo: 'sistema',
    titulo: `Fechas de cobro unificadas al ${ancla}`,
    metadata: { grupo, ancla, ciclo, detalle, credito, puente, a_pagar: aPagar },
    automatico: true,
  }).then(() => {}, () => {});

  // La propuesta queda cerrada con la fecha en que se aplicó; las demás de esa
  // cuenta se cancelan solas: dos propuestas vivas sobre las mismas licencias
  // acabarían aplicándose dos veces.
  const ahoraIso = new Date().toISOString();
  if (b?.propuesta_id) {
    await supabase.from('unificaciones').update({ estado: 'aplicada', aplicada_at: ahoraIso }).eq('id', b.propuesta_id);
  }
  await supabase.from('unificaciones').update({ estado: 'cancelada', cancelada_at: ahoraIso })
    .eq('company_id', subs[0].company_id).in('estado', ['propuesta', 'autorizada']);

  return json({ ok: true, grupo, ...resumen });
};
