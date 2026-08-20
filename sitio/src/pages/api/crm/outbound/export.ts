// OUTBOUND · Export CSV de una campaña: eventos crudos + conversiones con
// monto. GET ?id=<campana_id>&que=eventos|conversiones (default eventos).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { leerPaginado } from '../../../../lib/outbound/motor';

export const prerender = false;

const esc = (v: any) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csv = (nombre: string, filas: string[]) => new Response('﻿' + filas.join('\n'), {
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${nombre}"`,
    'Cache-Control': 'no-store',
  },
});

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response('Falta id', { status: 400 });
  const que = url.searchParams.get('que') || 'eventos';

  if (que === 'conversiones') {
    const rows = await leerPaginado((from, to) => supabase.from('inapp_conversiones')
      .select('cuenta, uid, brazo, convirtio_at, detalle').eq('campana_id', id)
      .order('id', { ascending: true }).range(from, to), 20000);
    const filas = ['cuenta,uid,brazo,fecha,monto'];
    for (const r of rows) filas.push([esc(r.cuenta), esc(r.uid), esc(r.brazo), esc(r.convirtio_at), esc(r.detalle?.monto ?? 0)].join(','));
    return csv(`outbound-conversiones-${id}.csv`, filas);
  }

  const rows = await leerPaginado((from, to) => supabase.from('inapp_eventos')
    .select('cuenta, uid, evento, boton, valor, comentario, dia, created').eq('campana_id', id)
    .order('id', { ascending: true }).range(from, to), 100000);
  const filas = ['cuenta,uid,evento,boton,valor,comentario,dia,fecha'];
  for (const r of rows) filas.push([esc(r.cuenta), esc(r.uid), esc(r.evento), esc(r.boton), esc(r.valor), esc(r.comentario), esc(r.dia), esc(r.created)].join(','));
  return csv(`outbound-eventos-${id}.csv`, filas);
};
