// ══ CRON · Seguimiento automático por WhatsApp (plan «AXO Gratis: conversión», REQ-35/36) ══════════
//
// Corre de lunes a sábado a las 9:15 de CDMX. Por cada cliente elige UN pendiente (lib/crm/axo-seguimiento.ts)
// y se lo manda a su contacto principal por WhatsApp. Todo queda en la ficha (actividad).
//
// INTERRUPTOR: con AXO_SEGUIMIENTO_ENVIA distinto de «1» NO manda nada: solo registra en la ficha el mensaje
// que habría salido (`metadata.dry = true`), para que el dueño revise el primer lote antes de encenderlo.
// `?dry=1` fuerza el modo de prueba aunque esté encendido.
//
// Candados: cuentas internas/prueba/canceladas fuera; contacto con baja (`wa_optout`) fuera; nunca en domingo;
// la presión de WhatsApp del CRM (`puedeMandarWa`) manda: si alguien le escribió hace poco, hoy no sale.
// Dentro de la ventana de 24 h va texto libre; fuera, la plantilla aprobada «pendiente_retomar».
//
// GET /api/cron/axo-seguimiento[?dry=1][&cuantas=N]
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { esDomingoMx, mensajeLibre, nombreCorto, pendienteDeHoy, type EmpresaSeguimiento } from '../../../lib/crm/axo-seguimiento';
import { sendWhatsApp } from '../../../lib/kapso';
import { supabase } from '../../../lib/supabase';
import { telefonoWhatsApp } from '../../../lib/telefono';
import { enviarPlantilla, sanearParam } from '../../../lib/whatsapp/kapso-api';
import { puedeMandarWa } from '../../../lib/whatsapp/presion';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (n: string) => String((import.meta.env as any)[n] || (process.env as any)[n] || '').trim();

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  const ahora = Date.now();
  const dry = env('AXO_SEGUIMIENTO_ENVIA') !== '1' || url.searchParams.get('dry') === '1';
  const tope = Math.min(400, Math.max(1, Number(url.searchParams.get('cuantas') || 200)));
  if (esDomingoMx(ahora)) return json({ ok: true, domingo: true });

  const out = { revisadas: 0, con_pendiente: 0, enviados: 0, plantilla: 0, propuestos: 0, saltados: {} as Record<string, number>, errores: [] as string[], dry };
  const salta = (m: string) => { out.saltados[m] = (out.saltados[m] || 0) + 1; };

  const { data: empresas, error } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, estado_cuenta, tipo_cuenta, fecha_inicio, created_at, fecha_renovacion, soporte_abiertos, soporte_estancado, dias_sin_venta, propiedades, sacs_account')
    .not('sacs_account', 'is', null)
    .in('estado_cuenta', ['activo', 'trial', 'vencido'])
    .is('archived_at', null)
    .limit(tope);
  if (error) return json({ ok: false, error: error.message }, 500);

  const desde = new Date(ahora - 20 * 3600e3).toISOString();
  for (const e of (empresas || []) as (EmpresaSeguimiento & { sacs_account: string })[]) {
    out.revisadas++;
    try {
      const p = pendienteDeHoy(e, ahora);
      if (!p) { salta('sin pendiente'); continue; }
      out.con_pendiente++;

      // Un solo seguimiento por día por empresa (también en modo de prueba, para no duplicar la ficha).
      const { data: ya } = await supabase.from('activities').select('id')
        .eq('company_id', e.id).contains('metadata', { origen: 'axo-seguimiento' }).gte('created_at', desde).limit(1);
      if (ya?.length) { salta('ya tuvo seguimiento hoy'); continue; }

      const { data: contactos } = await supabase.from('contacts')
        .select('id, nombre, whatsapp, es_principal, rol, wa_optout, archived_at')
        .eq('company_id', e.id).is('archived_at', null).limit(20);
      const c = (contactos || [])
        .filter((x: any) => x.whatsapp && !x.wa_optout && telefonoWhatsApp(x.whatsapp))
        .sort((a: any, b: any) => Number(!!b.es_principal) - Number(!!a.es_principal) || Number(/due/i.test(b.rol || '')) - Number(/due/i.test(a.rol || '')))[0] as any;
      if (!c) { salta('sin WhatsApp o con baja'); continue; }

      const texto = mensajeLibre(c.nombre, p);
      const registro = (enviado: boolean, via: string | null, nota?: string) => supabase.from('activities').insert({
        company_id: e.id, contact_id: c.id, tipo: 'whatsapp', automatico: true,
        titulo: `Seguimiento AXO · ${p.tema}`, descripcion: texto,
        metadata: { origen: 'axo-seguimiento', motivo: p.motivo, enviado, via, dry, nota: nota || null },
      });

      if (dry) { await registro(false, null, 'modo de prueba: no se envió'); out.propuestos++; continue; }

      const presion = await puedeMandarWa(c.whatsapp);
      if (!presion.ok) { await registro(false, null, presion.motivo); salta('presión de WhatsApp'); continue; }

      const r = await sendWhatsApp(c.whatsapp, texto, 'AXO', 'cliente');
      if (r.sent) { await registro(true, 'texto'); out.enviados++; continue; }
      if (/24 h/.test(r.error || '')) {
        const tel = telefonoWhatsApp(c.whatsapp) as string;
        const nombre = (c.nombre || nombreCorto(e) || '').split(/\s+/)[0] || 'Hola';
        await enviarPlantilla(tel, 'pendiente_retomar', 'es_MX', [sanearParam(nombre), sanearParam(p.tema)]);
        await registro(true, 'plantilla pendiente_retomar'); out.plantilla++; continue;
      }
      await registro(false, null, r.error); out.errores.push(`${e.sacs_account}: ${r.error}`);
    } catch (err: any) {
      out.errores.push(`${e.sacs_account}: ${String(err?.message || err).slice(0, 160)}`);
    }
  }
  return json({ ok: true, ...out });
};
