// POST /api/crm/demanda/correr — disparar el motor a mano desde el CRM.
//
// { que: 'ciclo', tipo: 'diario' } abre un ciclo · { que: 'worker' } empuja la
// cola · { que: 'prueba' } deja tres acciones de prueba de vida · { que:
// 'tecnico' } vuelve a rastrear el sitio en vivo y audita lo que trajo.
//
// Existe porque un motor que solo se puede observar no se puede depurar: tiene
// que haber una forma de decirle «corre ahora» y ver qué pasa.
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { abrirCiclo, armarCadena } from '../../../../lib/demanda/ciclo';
import { leerConfig } from '../../../../lib/demanda/config';
import { encolarVarias } from '../../../../lib/demanda/cola';
import { inventariar } from '../../../../lib/demanda/paginas';
import { auditar } from '../../../../lib/demanda/tecnico';
import { correrWorker } from '../../../../lib/demanda/worker';
import { diaCdmx } from '../../../../lib/demanda/fechas';
import '../../../../lib/demanda/registro';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ ok: false, error: 'sin sesión' }, 401);
  const body = await request.json().catch(() => ({}));
  const cfg = await leerConfig(true);

  try {
    if (body.que === 'ciclo') {
      const tipo = ['diario', 'semanal', 'mensual', 'manual'].includes(body.tipo) ? body.tipo : 'manual';
      const { id, nuevo } = await abrirCiclo(tipo, body.objetivo || 'disparado a mano desde el CRM', cfg.modo === 'simulacion');
      const cadena = await armarCadena(id, tipo, cfg);
      return json({ ok: true, ciclo_id: id, nuevo, ...cadena });
    }
    if (body.que === 'worker') {
      const r = await correrWorker(Math.min(Number(body.ms) || 25_000, 60_000), 6);
      return json({ ok: true, ...r });
    }
    if (body.que === 'tecnico') {
      /* «Revisar ahora» tiene que leer el sitio de verdad, no solo relimpiar lo
         que ya estaba guardado: `auditar()` sola solo reaplica las reglas sobre
         `de_paginas`, y ese rastreo normalmente solo corre en el ciclo SEMANAL
         (`ingerir.sitio`, ver ciclo.ts). Sin `inventariar()` primero, el botón le
         diría al dueño que su corrección sigue rota — leyendo el HTML de hace
         hasta una semana, que es justo el problema que este botón viene a
         resolver.

         El sitio declara 143 URLs entre sus dos sitemaps (99 del build + 44 del
         propio motor); 200 les da margen sin dejar la corrida abierta. Medido en
         producción con las 138 que ya conocía: 36.9 s (fetch secuencial, uno por
         uno) — muy por debajo del maxDuration de 300 s del adaptador (astro.config.mjs),
         así que cabe entera en una sola función de Vercel sin partir el trabajo. */
      const limite = Math.min(Number(body.limite) || 200, 250);
      const rastreo = await inventariar(limite);
      const r = await auditar();
      return json({ ok: true, paginas_rastreadas: rastreo.vistas, paginas_nuevas: rastreo.nuevas, errores_rastreo: rastreo.errores, ...r });
    }
    if (body.que === 'prueba') {
      const sello = `${diaCdmx()}:${Date.now()}`;
      const r = await encolarVarias([
        { tipo: 'sistema.noop', clave_idem: `prueba:ok:${sello}`, prioridad: 99, payload: { eco: 'prueba de vida' } },
        { tipo: 'sistema.noop', clave_idem: `prueba:falla:${sello}`, prioridad: 98, payload: { fallar: true, mensaje: 'fallo de prueba: esto debe reintentar' } },
        { tipo: 'sistema.salud', clave_idem: `prueba:salud:${sello}`, prioridad: 97 },
      ], cfg);
      return json({ ok: true, ...r });
    }
    return json({ ok: false, error: 'qué corro?' }, 400);
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
};
