// GET /api/crm/espacio/menciones?q=&tipo=   → { grupos: [{ tipo, etiqueta, items: [...] }] }
// GET /api/crm/espacio/menciones?ficha=pago|cobranza&id=  → { ficha }
//
// El "@" del chat: escribir @ y un nombre trae cotizaciones, clientes, leads,
// pagos y cobranza en una sola lista para etiquetarlos en el mensaje. Escribir
// solo la palabra del tipo (@cotización, @pago…) trae lo más reciente de ese
// tipo, que es como el dueño lo pidió: "pongo cotización y me aparecen las
// cotizaciones".
//
// Cobranza no es una tabla: es lo que el tablero de Cobranza calcula (deuda
// acumulada, exhibiciones, promesas). Se reutiliza SU handler —con su
// micro-caché de 60 s— para que el chat diga lo mismo que la pestaña.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid } from '../../../../lib/crm/espacio.lib';
import { GET as cobranzaGET } from '../cobranza';

export const prerender = false;

const sinAcentos = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = (s: string) => s.replace(/[%_\\,()]/g, ' ').trim();
const money = (n: any) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fecha = (f: any) => f ? String(f).slice(0, 10) : '';

export const TIPOS: Record<string, { etiqueta: string; palabras: string[] }> = {
  cotizacion: { etiqueta: 'Cotizaciones', palabras: ['cotizacion', 'cotizaciones', 'cot'] },
  cliente: { etiqueta: 'Clientes', palabras: ['cliente', 'clientes', 'cuenta'] },
  lead: { etiqueta: 'Leads', palabras: ['lead', 'leads', 'prospecto'] },
  pago: { etiqueta: 'Pagos', palabras: ['pago', 'pagos'] },
  cobranza: { etiqueta: 'Cobranza', palabras: ['cobranza', 'cobrar', 'deuda', 'vencido'] },
};

const ESTADO_COT: Record<string, string> = { sent: 'enviada', paid: 'pagada', accepted: 'aceptada', rejected: 'rechazada', expired: 'vencida', draft: 'borrador' };

type Item = { tipo: string; id: string; nombre: string; sub?: string; monto?: number; estado?: string; company_id?: string | null };

async function cobranzaFilas(request: Request): Promise<any> {
  try {
    const r = await cobranzaGET({ request: new Request(new URL('/api/crm/cobranza', request.url).toString(), { headers: request.headers }) } as any);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function buscar(request: Request, q: string, solo: string | null): Promise<{ tipo: string; etiqueta: string; items: Item[] }[]> {
  const like = `%${esc(q)}%`;
  const likeN = `%${esc(sinAcentos(q))}%`;
  const n = solo ? 8 : 4;
  const quiere = (t: string) => !solo || solo === t;
  const vacio = Promise.resolve({ data: [] as any[] });

  const [cots, emps, conts, pagosRef, cob] = await Promise.all([
    quiere('cotizacion')
      ? (q ? supabase.from('quotes').select('id, numero, empresa, contacto, total, estado, created_at, company_id').not('estado', 'in', '(deleted,plantilla)').or(`empresa.ilike.${like},numero.ilike.${like},contacto.ilike.${like}`).order('created_at', { ascending: false }).limit(n)
        : supabase.from('quotes').select('id, numero, empresa, contacto, total, estado, created_at, company_id').not('estado', 'in', '(deleted,plantilla)').order('created_at', { ascending: false }).limit(n))
      : vacio,
    quiere('cliente') || quiere('pago')
      ? (q ? supabase.from('companies').select('id, nombre, nombre_comercial, sacs_account, plan, estado_cuenta, mrr').is('archived_at', null).or(`nombre_norm.ilike.${likeN},nombre.ilike.${like},nombre_comercial.ilike.${like},sacs_account.ilike.${like}`).limit(quiere('pago') && !quiere('cliente') ? 12 : n)
        : supabase.from('companies').select('id, nombre, nombre_comercial, sacs_account, plan, estado_cuenta, mrr').is('archived_at', null).eq('estado_cuenta', 'activo').order('updated_at', { ascending: false }).limit(n))
      : vacio,
    quiere('lead')
      ? (q ? supabase.from('contacts').select('id, nombre, apellido, email, whatsapp, lifecycle_stage, company_id, giro').is('archived_at', null).eq('tipo', 'lead').or(`nombre_norm.ilike.${likeN},nombre.ilike.${like},email.ilike.${like}`).order('created_at', { ascending: false }).limit(n)
        : supabase.from('contacts').select('id, nombre, apellido, email, whatsapp, lifecycle_stage, company_id, giro').is('archived_at', null).eq('tipo', 'lead').order('created_at', { ascending: false }).limit(n))
      : vacio,
    quiere('pago') && q
      ? supabase.from('payments').select('id, monto, fecha, metodo, referencia, numero_acuse, company_id, quote_id').neq('estado', 'duplicado').or(`referencia.ilike.${like},numero_acuse.ilike.${like}`).order('fecha', { ascending: false }).limit(n)
      : vacio,
    quiere('cobranza') ? cobranzaFilas(request) : Promise.resolve(null),
  ]);

  const grupos: { tipo: string; etiqueta: string; items: Item[] }[] = [];
  const empresas = (emps.data || []) as any[];
  const nombreEmp = (c: any) => c.nombre_comercial || c.nombre || 'Cuenta';

  if (quiere('cotizacion')) grupos.push({ tipo: 'cotizacion', etiqueta: TIPOS.cotizacion.etiqueta, items: (cots.data || []).map((c: any) => ({
    tipo: 'cotizacion', id: c.id, nombre: `${c.numero || 'COT'} · ${c.empresa || c.contacto || 'sin empresa'}`,
    sub: `${money(c.total)} · ${ESTADO_COT[c.estado] || c.estado} · ${fecha(c.created_at)}`, monto: Number(c.total || 0), estado: c.estado, company_id: c.company_id,
  })) });
  if (quiere('cliente')) grupos.push({ tipo: 'cliente', etiqueta: TIPOS.cliente.etiqueta, items: empresas.slice(0, n).map((c: any) => ({
    tipo: 'cliente', id: c.id, nombre: nombreEmp(c),
    sub: [c.plan, c.estado_cuenta, c.mrr ? money(c.mrr) + '/mes' : ''].filter(Boolean).join(' · '), estado: c.estado_cuenta, company_id: c.id,
  })) });
  if (quiere('lead')) grupos.push({ tipo: 'lead', etiqueta: TIPOS.lead.etiqueta, items: (conts.data || []).map((c: any) => ({
    tipo: 'lead', id: c.id, nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || 'Lead',
    sub: [c.lifecycle_stage, c.giro, c.email].filter(Boolean).join(' · '), estado: c.lifecycle_stage, company_id: c.company_id,
  })) });

  if (quiere('pago')) {
    // Los pagos se buscan por el NOMBRE del cliente (que es como uno se acuerda
    // de ellos) o por referencia/acuse. Sin texto: los últimos que entraron.
    let filas: any[] = [];
    const ids = empresas.map((c: any) => c.id);
    if (!q) {
      const { data } = await supabase.from('payments').select('id, monto, fecha, metodo, referencia, numero_acuse, company_id, quote_id').neq('estado', 'duplicado').order('fecha', { ascending: false }).limit(n);
      filas = data || [];
    } else {
      const porEmp = ids.length ? (await supabase.from('payments').select('id, monto, fecha, metodo, referencia, numero_acuse, company_id, quote_id').neq('estado', 'duplicado').in('company_id', ids).order('fecha', { ascending: false }).limit(n)).data || [] : [];
      const vistos = new Set<string>();
      filas = [...(pagosRef.data || []), ...porEmp].filter((p: any) => !vistos.has(p.id) && vistos.add(p.id)).sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, n);
    }
    const faltan = filas.map((p: any) => p.company_id).filter((id: any) => id && !empresas.some((c: any) => c.id === id));
    const extra = faltan.length ? (await supabase.from('companies').select('id, nombre, nombre_comercial').in('id', faltan)).data || [] : [];
    const todas = [...empresas, ...extra];
    grupos.push({ tipo: 'pago', etiqueta: TIPOS.pago.etiqueta, items: filas.map((p: any) => {
      const co = todas.find((c: any) => c.id === p.company_id);
      return { tipo: 'pago', id: p.id, nombre: `${money(p.monto)} · ${co ? nombreEmp(co) : (p.referencia || 'sin cliente')}`,
        sub: [fecha(p.fecha), p.metodo, p.numero_acuse ? 'acuse ' + p.numero_acuse : p.referencia].filter(Boolean).join(' · '), monto: Number(p.monto || 0), company_id: p.company_id };
    }) });
  }

  if (quiere('cobranza')) {
    const qn = sinAcentos(q);
    const filas: any[] = [...(cob?.vencido || []), ...(cob?.por_vencer || [])]
      .filter((f: any) => !qn || sinAcentos(f.cliente).includes(qn) || sinAcentos(f.cuenta).includes(qn) || sinAcentos(f.plan).includes(qn))
      .slice(0, n);
    grupos.push({ tipo: 'cobranza', etiqueta: TIPOS.cobranza.etiqueta, items: filas.map((f: any) => ({
      tipo: 'cobranza', id: f.id, nombre: `${f.cliente} · ${money(f.deuda)}`,
      sub: [f.dias > 0 ? `${f.dias} días de atraso` : f.dias === 0 ? 'vence hoy' : `vence en ${-f.dias} días`, f.plan, f.gestion === 'promesa' ? 'promesa ' + fecha(f.promesa) : ''].filter(Boolean).join(' · '),
      monto: f.deuda, estado: f.gestion, company_id: f.company_id,
    })) });
  }
  return grupos.filter(g => g.items.length);
}

// La ficha de un pago o de una fila de cobranza: no existen como pantalla
// propia en el CRM (el pago es una fila de la tabla; la cobranza, una fila del
// tablero), así que el chat arma la suya con los mismos datos.
async function ficha(request: Request, tipo: string, id: string) {
  if (tipo === 'pago') {
    const { data: p } = await supabase.from('payments').select('id, monto, fecha, metodo, referencia, numero_acuse, notas, estado, periodo_cubierto, comprobante_url, comprobante_path, comprobante_nombre, reembolsado, pasarela, comision, neto, company_id, contact_id, quote_id, subscription_id, created_at').eq('id', id).maybeSingle();
    if (!p) return null;
    const [co, cot, sub] = await Promise.all([
      p.company_id ? supabase.from('companies').select('id, nombre, nombre_comercial, sacs_account, plan').eq('id', p.company_id).maybeSingle() : Promise.resolve({ data: null }),
      p.quote_id ? supabase.from('quotes').select('id, numero, empresa, total, estado').eq('id', p.quote_id).maybeSingle() : Promise.resolve({ data: null }),
      p.subscription_id ? supabase.from('subscriptions').select('id, nombre_plan, ciclo, precio, proxima_factura, estado').eq('id', p.subscription_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return { tipo: 'pago', pago: p, cliente: co.data, cotizacion: cot.data, suscripcion: sub.data };
  }
  if (tipo === 'cobranza') {
    const cob = await cobranzaFilas(request);
    const fila = [...(cob?.vencido || []), ...(cob?.por_vencer || [])].find((f: any) => f.id === id) || null;
    if (!fila) {
      // Ya no está en cobranza: se pagó o se canceló. Se enseña la suscripción tal cual.
      const { data: s } = await supabase.from('subscriptions').select('id, company_id, nombre_plan, ciclo, precio, monto_proximo, proxima_factura, estado, total_pagado, pagos_realizados, cobranza_estado, cobranza_promesa, cobranza_nota').eq('id', id).maybeSingle();
      if (!s) return null;
      const { data: co } = s.company_id ? await supabase.from('companies').select('id, nombre, nombre_comercial, sacs_account').eq('id', s.company_id).maybeSingle() : { data: null };
      return { tipo: 'cobranza', fila: null, suscripcion: s, cliente: co };
    }
    return { tipo: 'cobranza', fila, suscripcion: null, cliente: { id: fila.company_id, nombre: fila.cliente, sacs_account: fila.cuenta } };
  }
  return null;
}

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);

  const fichaDe = url.searchParams.get('ficha');
  if (fichaDe) {
    const id = url.searchParams.get('id') || '';
    if (!esUuid(id) || !(fichaDe in TIPOS)) return json({ error: 'Ficha inválida' }, 400);
    const f = await ficha(request, fichaDe, id);
    if (!f) return json({ error: 'No se encontró' }, 404);
    return json({ ficha: f });
  }

  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const tipo = url.searchParams.get('tipo');
  const solo = tipo && tipo in TIPOS ? tipo : null;
  // Sin tipo y sin texto no hay nada que listar; con tipo y sin texto, lo reciente.
  if (!solo && q.length < 2) return json({ grupos: [] });
  return json({ grupos: await buscar(request, q, solo) });
};
