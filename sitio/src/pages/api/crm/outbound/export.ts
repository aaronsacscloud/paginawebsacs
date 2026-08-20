// OUTBOUND · Export CSV de una campaña: eventos crudos + conversiones con
// monto. GET ?id=<campana_id>&que=eventos|conversiones (default eventos).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { leerPaginado } from '../../../../lib/outbound/motor';

export const prerender = false;

const esc = (v: any) => {
  let s = v == null ? '' : String(v);
  // Anti-inyeccion de formulas: un campo (ej. comentario de NPS del cliente)
  // que empieza con = + - @ tab o CR se ejecuta al abrirlo en Excel/Sheets.
  // Un apostrofo al frente lo vuelve texto literal.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
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
    const TOPE = 20000;
    const rows = await leerPaginado((from, to) => supabase.from('inapp_conversiones')
      .select('cuenta, uid, brazo, convirtio_at, detalle').eq('campana_id', id)
      .order('id', { ascending: true }).range(from, to), TOPE);
    const filas = ['cuenta,uid,brazo,fecha,monto'];
    for (const r of rows) filas.push([esc(r.cuenta), esc(r.uid), esc(r.brazo), esc(r.convirtio_at), esc(r.detalle?.monto ?? 0)].join(','));
    // No truncar en silencio: si se llegó al tope, el archivo lo dice.
    if (rows.length >= TOPE) filas.push(`# AVISO: export truncado a ${TOPE} filas — hay más conversiones`);
    return csv(`outbound-conversiones-${id}.csv`, filas);
  }

  const TOPE = 100000;
  const rows = await leerPaginado((from, to) => supabase.from('inapp_eventos')
    .select('cuenta, uid, evento, boton, valor, comentario, dia, created').eq('campana_id', id)
    .order('id', { ascending: true }).range(from, to), TOPE);
  const filas = ['cuenta,uid,evento,boton,valor,comentario,dia,fecha'];
  for (const r of rows) filas.push([esc(r.cuenta), esc(r.uid), esc(r.evento), esc(r.boton), esc(r.valor), esc(r.comentario), esc(r.dia), esc(r.created)].join(','));
  if (rows.length >= TOPE) filas.push(`# AVISO: export truncado a ${TOPE} filas — hay más eventos`);
  return csv(`outbound-eventos-${id}.csv`, filas);
};
