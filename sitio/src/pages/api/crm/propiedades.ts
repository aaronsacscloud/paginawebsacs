// Campos personalizados del CRM — catálogo y valores.
//
// GET    /api/crm/propiedades?entidad=company        → definiciones activas (+ uso)
// POST   { entidad, etiqueta, tipo, ... }            → crear
// PUT    { id, ... }                                 → editar (la `key` NO se toca)
// DELETE { id }                                      → archivar (nunca borrar)
// PUT    /api/crm/propiedades?valores=1 { entidad, entidad_id, valores }
//                                                    → guardar valores de una ficha
//
// La `key` es inmutable a propósito: es lo que guardan los datos ya capturados y
// las vistas guardadas. Renombrar "Giro" a "Giro de negocio" cambia la etiqueta,
// no la llave — si cambiara, todo lo capturado quedaría huérfano en silencio.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const sinTabla = (m?: string) => /relation .* does not exist|schema cache|could not find the table/i.test(m || '');
const TIPOS = ['texto', 'texto_largo', 'numero', 'moneda', 'porcentaje', 'fecha', 'booleano', 'select', 'multiselect', 'email', 'telefono', 'url'];
const TABLA: Record<string, string> = { company: 'companies', deal: 'deals', subscription: 'subscriptions', contact: 'contacts' };

/** Etiqueta → key: sin acentos, sin espacios, estable. */
function aKey(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'campo';
}

/** Valida y NORMALIZA un valor según el tipo. Devuelve `undefined` si hay que
 *  borrarlo (vacío) y `{error}` si no es válido — el servidor es el que manda:
 *  un número tiene que ser número aunque el formulario se salte. */
function normalizar(prop: any, v: any): { valor?: any; error?: string } {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return { valor: undefined };
  switch (prop.tipo) {
    case 'numero': case 'moneda': case 'porcentaje': {
      const n = Number(v);
      if (!Number.isFinite(n)) return { error: `"${prop.etiqueta}" tiene que ser un número.` };
      if (prop.tipo === 'porcentaje' && (n < 0 || n > 100)) return { error: `"${prop.etiqueta}" va de 0 a 100.` };
      return { valor: n };
    }
    case 'booleano': return { valor: v === true || v === 'true' || v === 'si' };
    case 'fecha': {
      const s = String(v).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { error: `"${prop.etiqueta}" tiene que ser una fecha.` };
      return { valor: s };
    }
    case 'email': {
      const s = String(v).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return { error: `"${prop.etiqueta}" no parece un correo.` };
      return { valor: s };
    }
    case 'url': {
      let s = String(v).trim();
      if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
      return { valor: s };
    }
    case 'select': {
      const s = String(v);
      // Las opciones de un campo dependiente viven por valor del padre.
      const validas = prop.depende_de
        ? Object.values(prop.opciones_por_padre || {}).flat().map((o: any) => o.v)
        : (prop.opciones || []).map((o: any) => o.v);
      if (validas.length && !validas.includes(s)) return { error: `"${s}" no es una opción de "${prop.etiqueta}".` };
      return { valor: s };
    }
    case 'multiselect': {
      const arr = Array.isArray(v) ? v.map(String) : [String(v)];
      const validas = (prop.opciones || []).map((o: any) => o.v);
      const mala = validas.length ? arr.find(x => !validas.includes(x)) : null;
      if (mala) return { error: `"${mala}" no es una opción de "${prop.etiqueta}".` };
      return { valor: arr };
    }
    default: return { valor: String(v).slice(0, 4000) };
  }
}

const etiquetaValor = (prop: any, v: any): string => {
  if (v === undefined || v === null || v === '') return '—';
  if (prop.tipo === 'booleano') return v ? 'Sí' : 'No';
  if (prop.tipo === 'select') {
    const todas = prop.depende_de ? Object.values(prop.opciones_por_padre || {}).flat() : (prop.opciones || []);
    return (todas as any[]).find((o: any) => o.v === v)?.l || String(v);
  }
  if (prop.tipo === 'multiselect') return (Array.isArray(v) ? v : [v]).map(x => (prop.opciones || []).find((o: any) => o.v === x)?.l || x).join(', ');
  return String(v);
};

export const GET: APIRoute = async ({ url }) => {
  const entidad = url.searchParams.get('entidad') || 'company';
  const incluirArchivadas = url.searchParams.get('archivadas') === '1';
  let q = supabase.from('crm_propiedades').select('*').eq('entidad', entidad).order('orden');
  if (!incluirArchivadas) q = q.is('archivada_at', null);
  const { data, error } = await q;
  if (error) {
    if (sinTabla(error.message)) return json({ data: [], sin_tabla: true });
    return json({ error: error.message, data: [] });
  }

  // Cuántos registros tienen cada campo lleno: un campo que nadie llena sobra, y
  // sin el número nadie se entera de que sobra.
  const uso: Record<string, number> = {};
  const tabla = TABLA[entidad];
  if (tabla && (data || []).length) {
    const { data: filas } = await supabase.from(tabla).select('propiedades').limit(5000);
    for (const f of filas || []) {
      for (const [k, v] of Object.entries((f as any).propiedades || {})) {
        if (v !== null && v !== '' && !(Array.isArray(v) && !v.length)) uso[k] = (uso[k] || 0) + 1;
      }
    }
  }
  return json({ data: (data || []).map(p => ({ ...p, uso: uso[p.key] || 0 })) });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const etiqueta = String(b.etiqueta || '').trim();
  if (!etiqueta) return json({ error: 'Ponle nombre al campo.' }, 400);
  if (!TIPOS.includes(b.tipo)) return json({ error: 'Tipo no válido.' }, 400);
  // La descripción se pide de verdad: es la diferencia entre un catálogo que se
  // entiende en un año y 200 campos que nadie sabe para qué son.
  if (!String(b.descripcion || '').trim()) return json({ error: 'Escribe para qué sirve el campo: en un año es lo único que dirá por qué existe.' }, 400);

  const entidad = TABLA[b.entidad] ? b.entidad : 'company';
  let key = aKey(b.key || etiqueta);
  const { data: ya } = await supabase.from('crm_propiedades').select('id').eq('entidad', entidad).eq('key', key).maybeSingle();
  if (ya) key = key + '_' + Date.now().toString(36).slice(-4);

  const { data, error } = await supabase.from('crm_propiedades').insert({
    entidad, key, etiqueta, tipo: b.tipo,
    grupo: String(b.grupo || 'General').trim() || 'General',
    descripcion: String(b.descripcion).trim(),
    opciones: Array.isArray(b.opciones) ? b.opciones : null,
    depende_de: b.depende_de || null,
    opciones_por_padre: b.opciones_por_padre || null,
    obligatorio: !!b.obligatorio, importante: !!b.importante,
    solo_interno: b.solo_interno !== false,
    orden: Number(b.orden) || 100,
  }).select().maybeSingle();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.id) return json({ error: 'id requerido' }, 400);
  // Archivar, no borrar: el valor capturado en 60 clientes se queda donde está.
  // Si el campo revive, los datos siguen ahí.
  const { error } = await supabase.from('crm_propiedades').update({ archivada_at: new Date().toISOString() }).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, archivada: true });
};

export const PUT: APIRoute = async ({ request, url }) => {
  const b = await request.json().catch(() => ({} as any));

  // ── Guardar VALORES de una ficha ──
  if (url.searchParams.get('valores') === '1' || b?.valores) {
    const entidad = TABLA[b.entidad] ? b.entidad : 'company';
    const tabla = TABLA[entidad];
    if (!b?.entidad_id) return json({ error: 'entidad_id requerido' }, 400);

    const { data: props } = await supabase.from('crm_propiedades').select('*').eq('entidad', entidad).is('archivada_at', null);
    const porKey = new Map((props || []).map(p => [p.key, p]));

    const { data: actual } = await supabase.from(tabla).select('propiedades').eq('id', b.entidad_id).maybeSingle();
    const antes = (actual as any)?.propiedades || {};
    const nuevo = { ...antes };
    const cambios: string[] = [];

    for (const [k, v] of Object.entries(b.valores || {})) {
      const prop = porKey.get(k);
      if (!prop) continue;                       // campo desconocido o archivado: se ignora
      const r = normalizar(prop, v);
      if (r.error) return json({ error: r.error }, 400);
      const antesV = antes[k];
      if (r.valor === undefined) { if (k in nuevo) { delete nuevo[k]; cambios.push(`${prop.etiqueta}: ${etiquetaValor(prop, antesV)} → vacío`); } continue; }
      if (JSON.stringify(antesV) !== JSON.stringify(r.valor)) {
        cambios.push(`${prop.etiqueta}: ${etiquetaValor(prop, antesV)} → ${etiquetaValor(prop, r.valor)}`);
        nuevo[k] = r.valor;
      }
    }

    // Obligatorios: se exigen al guardar, no al mirar. Un campo obligatorio que
    // bloquea la ficha entera de clientes viejos sería inservible.
    const faltan = (props || []).filter(p => p.obligatorio && (nuevo[p.key] === undefined || nuevo[p.key] === ''));
    if (faltan.length && b.exigir_obligatorios) {
      return json({ error: 'Faltan campos obligatorios: ' + faltan.map(p => p.etiqueta).join(', '), requiere: faltan.map(p => p.key) }, 400);
    }

    if (!cambios.length) return json({ ok: true, sin_cambios: true });
    const { error } = await supabase.from(tabla).update({ propiedades: nuevo }).eq('id', b.entidad_id);
    if (error) return json({ error: error.message }, 500);

    // Todo cambio queda en la Actividad: sin el historial, dentro de tres meses
    // nadie sabe de dónde salió un dato ni quién lo cambió.
    if (entidad === 'company') {
      await supabase.from('activities').insert({
        tipo: 'sistema', automatico: true, company_id: b.entidad_id,
        titulo: '✏️ Información del cliente actualizada',
        descripcion: cambios.join(' · ').slice(0, 900),
        metadata: { audit: 'propiedades_update', cambios },
      }).select().maybeSingle();
    }
    return json({ ok: true, cambios: cambios.length, propiedades: nuevo });
  }

  // ── Editar la DEFINICIÓN (la key nunca) ──
  if (!b?.id) return json({ error: 'id requerido' }, 400);
  const upd: any = {};
  for (const k of ['etiqueta', 'grupo', 'descripcion', 'opciones', 'depende_de', 'opciones_por_padre', 'obligatorio', 'importante', 'solo_interno', 'orden'] as const) {
    if (b[k] !== undefined) upd[k] = b[k];
  }
  if (b.archivada_at === null) upd.archivada_at = null;   // desarchivar
  if (b.tipo !== undefined) return json({ error: 'El tipo no se puede cambiar: los datos ya capturados dejarían de ser válidos. Crea un campo nuevo y archiva este.' }, 400);
  const { data, error } = await supabase.from('crm_propiedades').update(upd).eq('id', b.id).select().maybeSingle();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data });
};
