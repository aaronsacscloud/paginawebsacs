// El reporte de RECOMENDACIONES de una cuenta: los flujos de trabajo que se
// cierran completos dentro de SACS y los que se quedan a medias.
//
// Pedido del dueño (22-sep-2026): «un reporte con recomendaciones de la cuenta,
// como cosas que veo que faltan y que no están cerrando los flujos de trabajo».
//
// Dos capas, a propósito:
//  1. Los HECHOS. Cada flujo es una cadena fija de módulos y se evalúa contra
//     el uso real de la cuenta (`companies.uso_sacs`, el mismo que pinta la
//     pestaña Actividad). Qué eslabón se usa y cuál no lo decide el dato, no
//     un modelo.
//  2. La REDACCIÓN. La IA escribe la evidencia y la recomendación de cada
//     flujo con esos hechos, más lo que el consultor ve y escribe, y el
//     consultor lo corrige antes de generar. Nada sale sin que alguien lo lea.
import { supabase } from '../supabase';
import { pedirJSON } from '../ia';

export type Estado = 'completo' | 'medio' | 'sin_usar';
export type Eslabon = { paso: string; ok: boolean; dato?: string };
export type Flujo = { clave: string; nombre: string; estado: Estado; cadena: Eslabon[]; hechos: string[]; evidencia?: string; recomendacion?: string };

const n = (x: any) => Number(x || 0);
const mx = (x: number) => x.toLocaleString('es-MX');
const diasDesde = (f?: string | null) => f ? Math.round((Date.now() - Date.parse(f + 'T12:00:00')) / 86400000) : null;

/** Lo que se sabe de la cuenta, en crudo: uso por módulo, sucursales, soporte, taller. */
export async function reunirCuenta(companyId: string) {
  const { data: co } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, sacs_account, uso_sacs, actividad').eq('id', companyId).maybeSingle();
  if (!co) return null;
  const hace60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const [{ data: tickets }, { data: taller }] = await Promise.all([
    supabase.from('crm_soporte_tickets').select('tema, asunto, estado, abierto_at').eq('company_id', companyId).gte('abierto_at', hace60).order('abierto_at', { ascending: false }).limit(30),
    supabase.from('taller_ordenes').select('titulo, etapa').eq('company_id', companyId).is('archived_at', null).is('entregada_at', null).limit(20),
  ]);
  const mods: any[] = Array.isArray((co as any).uso_sacs?.modulos) ? (co as any).uso_sacs.modulos : [];
  const act: any = (co as any).actividad || {};
  return {
    cliente: co.nombre_comercial || co.nombre || co.sacs_account,
    mod: (nombre: string) => mods.find(m => m.modulo === nombre) || null,
    sucursales: n(act.sucursales ?? act.por_cuenta?.[co.sacs_account || '']?.sucursales ?? 1) || 1,
    ventas30: n(act.ventas_30d),
    usuarios: n(act.usuarios), operando: n(act.por_cuenta?.[co.sacs_account || '']?.usuarios_operando ?? act.usuarios_operando),
    tendencia: act.tendencia_pct ?? act.por_cuenta?.[co.sacs_account || '']?.tendencia_pct ?? null,
    lealtad: (co as any).uso_sacs?.lealtad || null,
    conteos: (co as any).uso_sacs?.conteos || null,
    tickets: (tickets || []).map((t: any) => `${t.tema || 'general'}: ${t.asunto || ''}`.trim()).slice(0, 15),
    taller: (taller || []).map((t: any) => t.titulo).filter(Boolean).slice(0, 10),
    tieneUso: mods.length > 0,
  };
}

/** Evalúa las cadenas fijas contra el uso. Devuelve solo las que aplican a la cuenta. */
export function evaluarFlujos(c: NonNullable<Awaited<ReturnType<typeof reunirCuenta>>>): Flujo[] {
  const usa = (m: string) => n(c.mod(m)?.docs_30d) > 0;
  const d30 = (m: string) => n(c.mod(m)?.docs_30d);
  const esl = (paso: string, modulo: string | null, ok?: boolean, dato?: string): Eslabon =>
    ({ paso, ok: ok ?? (modulo ? usa(modulo) : true), dato: dato ?? (modulo ? `${mx(d30(modulo))} en 30 días` : undefined) });
  const estado = (cad: Eslabon[]): Estado => cad.every(e => e.ok) ? 'completo' : cad.some(e => e.ok) ? 'medio' : 'sin_usar';
  const out: Flujo[] = [];

  // 1 · Venta → corte de caja → factura
  {
    const cad = [esl('Se vende en caja', 'Punto de venta'), esl('Corte de caja', 'Cortes de caja'), esl('Factura', 'Facturación electrónica')];
    out.push({ clave: 'venta', nombre: 'Venta → corte de caja → factura', estado: estado(cad), cadena: cad,
      hechos: [`${mx(d30('Punto de venta'))} ventas, ${mx(d30('Cortes de caja'))} cortes y ${mx(d30('Facturación electrónica'))} facturas en 30 días.`] });
  }
  // 2 · Devoluciones y cambios: en moda siempre hay; si no se registran, se hacen por fuera.
  if (d30('Punto de venta') > 300) {
    const dev = d30('Devoluciones'), cam = d30('Cambios de producto');
    const cad = [esl('Venta', 'Punto de venta'), esl('Cambio de producto', 'Cambios de producto'), esl('Devolución', 'Devoluciones'), esl('Regresa al inventario', null, dev + cam > 0, dev + cam > 0 ? undefined : 'sin registro')];
    out.push({ clave: 'devoluciones', nombre: 'Cambios y devoluciones → inventario', estado: dev + cam > 0 ? 'completo' : 'medio', cadena: cad,
      hechos: [`${mx(d30('Punto de venta'))} ventas y ${mx(cam)} cambios / ${mx(dev)} devoluciones registradas en 30 días.`] });
  }
  // 3 · Compra → recepción → conteo
  {
    const ult = c.mod('Conteos físicos')?.ultimo || c.conteos?.ultimo?.fecha || null;
    const dias = diasDesde(ult);
    const conteoAlDia = dias != null && dias <= 30;
    const cad = [esl('Proveedor', 'Proveedores'), esl('Orden de compra', 'Órdenes de compra'), esl('Alta de producto', 'Catálogo de productos'),
      esl('Conteo físico', 'Conteos físicos', conteoAlDia, ult ? `último hace ${dias} días` : 'nunca')];
    out.push({ clave: 'compra', nombre: 'Compra → recepción → conteo de inventario', estado: estado(cad), cadena: cad,
      hechos: [`${mx(d30('Órdenes de compra'))} órdenes de compra en 30 días; último conteo físico ${ult ? `el ${ult} (hace ${dias} días)` : 'nunca'}.`] });
  }
  // 4 · Entre sucursales: solo si hay más de una.
  if (c.sucursales > 1) {
    const cad = [esl('Sale de una sucursal', 'Transferencias'), esl('Se recibe en la otra', 'Transferencias'), esl('Existencia disponible', null, usa('Transferencias'))];
    out.push({ clave: 'traspasos', nombre: 'Traspasos entre sucursales', estado: estado(cad), cadena: cad,
      hechos: [`${c.sucursales} sucursales y ${mx(d30('Transferencias'))} transferencias en 30 días.`] });
  }
  // 5 · Cliente → lealtad → recompra
  {
    const lea = !!c.lealtad?.activo || usa('Programa de lealtad');
    const cad = [esl('Se registra al cliente', 'Catálogo de clientes'), esl('Acumula en lealtad', 'Programa de lealtad', lea), esl('Promoción para que regrese', 'Promociones')];
    out.push({ clave: 'clientes', nombre: 'Cliente → lealtad → recompra', estado: estado(cad), cadena: cad,
      hechos: [`${mx(d30('Catálogo de clientes'))} clientes nuevos en 30 días; programa de lealtad ${lea ? 'activo' : 'apagado'}${c.lealtad?.inscritos ? ` con ${mx(n(c.lealtad.inscritos))} inscritos` : ''}; ${mx(d30('Promociones'))} promociones.`] });
  }
  // 6 · Apartados: en moda es cómo se vende a plazos.
  {
    const cad = [esl('Se aparta', 'Apartados'), esl('Abonos', 'Apartados'), esl('Se liquida y entrega', 'Apartados')];
    out.push({ clave: 'apartados', nombre: 'Apartados → abonos → liquidación', estado: usa('Apartados') ? 'completo' : 'sin_usar', cadena: cad,
      hechos: [`${mx(d30('Apartados'))} apartados en 30 días.`] });
  }
  // 7 · Gasto → banco → conciliación
  if (usa('Gastos') || c.mod('Cuentas de efectivo / bancos')) {
    const ultB = c.mod('Cuentas de efectivo / bancos')?.ultimo || null;
    const cad = [esl('Se registra el gasto', 'Gastos'), esl('Sale de una cuenta', 'Cuentas de efectivo / bancos', n(c.mod('Cuentas de efectivo / bancos')?.docs_30d) > 0, ultB ? `último ${ultB}` : 'sin uso'),
      esl('Se concilia con el banco', 'Bancos')];
    out.push({ clave: 'gastos', nombre: 'Gasto → cuenta → conciliación bancaria', estado: estado(cad), cadena: cad,
      hechos: [`${mx(d30('Gastos'))} gastos en 30 días; cuentas de efectivo con último movimiento ${ultB || 'nunca'}; conciliación bancaria ${usa('Bancos') ? 'en uso' : 'sin usar'}.`] });
  }
  return out;
}

/** La IA redacta evidencia y recomendación con los hechos y las notas del consultor. */
export async function redactarRecomendaciones(cliente: string, flujos: Flujo[], extra: { notas?: string; tickets?: string[]; taller?: string[]; tendencia?: number | null }) {
  const out = await pedirJSON({
    system: `Eres consultor de Sacs (sistema de punto de venta e inventario para retail de moda en México) y preparas el documento «Lo que vemos en tu cuenta» para el dueño del negocio.
Recibes flujos de trabajo ya evaluados con datos reales (qué eslabón se usa y cuál no) y las notas del consultor.
Para CADA flujo escribe:
- evidencia: 1-2 frases con los números que recibes. No inventes cifras ni supongas causas que no estén en los datos o en las notas.
- recomendacion: 1 frase, empieza con verbo, qué hacer dentro de SACS para cerrar el flujo. Si el flujo está completo, di que se mantiene así.
Si las notas del consultor describen un problema que NO está en los flujos, agrégalo como flujo nuevo (clave "nota-1", "nota-2"…) con su nombre corto «A → B», estado "medio" y su cadena de 2-4 pasos; la evidencia sale de la nota.
Además: intro — 1-2 frases de por qué importa cerrar los flujos para este negocio, sin exagerar.
Tono: claro, respetuoso, de tú; nada de emoji; español de México.
Responde ÚNICAMENTE con JSON: { "intro": "…", "flujos": [ { "clave": "…", "nombre": "…", "estado": "completo|medio|sin_usar", "cadena": [ { "paso": "…", "ok": true } ], "evidencia": "…", "recomendacion": "…" } ] }`,
    user: JSON.stringify({ cliente, flujos: flujos.map(f => ({ clave: f.clave, nombre: f.nombre, estado: f.estado, cadena: f.cadena, hechos: f.hechos })), notas_del_consultor: extra.notas || '', tickets_de_soporte_60_dias: extra.tickets || [], trabajos_en_taller: extra.taller || [], tendencia_ventas_pct: extra.tendencia ?? null }),
  });
  const porClave = new Map(flujos.map(f => [f.clave, f]));
  const flujosOut: Flujo[] = (Array.isArray(out?.flujos) ? out.flujos : []).map((x: any) => {
    const base = porClave.get(String(x?.clave || ''));
    /* De los flujos EVALUADOS la IA solo redacta: el estado y la cadena son
       los del dato. Los que agrega de las notas sí traen los suyos. */
    return base
      ? { ...base, evidencia: String(x?.evidencia || '').slice(0, 400), recomendacion: String(x?.recomendacion || '').slice(0, 300) }
      : {
          clave: String(x?.clave || 'nota'), nombre: String(x?.nombre || 'Observación').slice(0, 90),
          estado: (['completo', 'medio', 'sin_usar'].includes(x?.estado) ? x.estado : 'medio') as Estado,
          cadena: (Array.isArray(x?.cadena) ? x.cadena : []).slice(0, 5).map((e: any) => ({ paso: String(e?.paso || '').slice(0, 40), ok: e?.ok === true })),
          hechos: [], evidencia: String(x?.evidencia || '').slice(0, 400), recomendacion: String(x?.recomendacion || '').slice(0, 300),
        };
  });
  // Si el modelo se saltó alguno evaluado, entra igual con sus hechos crudos.
  for (const f of flujos) if (!flujosOut.some(x => x.clave === f.clave)) flujosOut.push({ ...f, evidencia: f.hechos.join(' '), recomendacion: '' });
  return { intro: String(out?.intro || '').slice(0, 400), flujos: flujosOut };
}
