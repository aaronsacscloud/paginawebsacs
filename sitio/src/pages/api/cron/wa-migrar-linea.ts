// WHATSAPP · Migración asistida de línea (multilínea, idea 5). Diario.
// Cuando el negocio cambia de número (el +1 → el +52), la gente que ya nos hablaba al viejo
// no se entera sola. Este cron les manda, POR EL NÚMERO NUEVO, una plantilla de aviso
// («este es nuestro nuevo número, guárdalo»), en tandas diarias para no reventar la calidad
// de la línea recién nacida. A quién: conversaciones que viven en `migracion_desde`, con
// contacto en el CRM, con actividad reciente (migracion_dias_actividad) y sin `migrada_at`.
// Apagado por defecto: wa_config.migracion_activa = false. Se enciende en Ajustes → Líneas.
// GET (CRON_SECRET) ?cuantos=&simular=1
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { enviarPlantilla, usarNumero, enContexto, KapsoError } from '../../../lib/whatsapp/kapso-api';
import { registrarMensaje } from '../../../lib/whatsapp/espejo';
import { infoLinea, cupoLinea } from '../../../lib/whatsapp/linea';
import { puedeMandarWa } from '../../../lib/whatsapp/presion';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return new Response('No', { status: 401 });
  const simular = url.searchParams.get('simular') === '1';
  const { data: cfg } = await supabase.from('wa_config').select('migracion_activa, migracion_desde, migracion_hacia, migracion_plantilla, migracion_tope_diario, migracion_dias_actividad').eq('id', 1).maybeSingle();
  if (!cfg?.migracion_activa && !simular) return json({ ok: true, apagada: true });
  if (!cfg?.migracion_desde || !cfg?.migracion_hacia || !cfg?.migracion_plantilla) return json({ ok: false, error: 'Faltan línea origen, línea destino o plantilla en wa_config' }, 400);
  if (cfg.migracion_desde === cfg.migracion_hacia) return json({ ok: false, error: 'Origen y destino son la misma línea' }, 400);

  const hacia = await infoLinea(cfg.migracion_hacia);
  if (!hacia?.activo) return json({ ok: false, error: 'La línea destino no está activa' }, 400);
  if (hacia.pausada) return json({ ok: true, pausada: true, motivo: hacia.pausada_motivo });
  const { data: pl } = await supabase.from('wa_plantillas').select('nombre, idioma, status, variables').eq('nombre', cfg.migracion_plantilla).order('status').limit(1).maybeSingle();
  if (!pl || pl.status !== 'APPROVED') return json({ ok: false, error: `La plantilla ${cfg.migracion_plantilla} no está APPROVED` }, 400);

  // Tope del día: el propio de la migración y, si la línea tiene tope, lo que le quede.
  const cupo = await cupoLinea(cfg.migracion_hacia).catch(() => null);
  let tope = Math.max(0, Number(url.searchParams.get('cuantos') || cfg.migracion_tope_diario || 40));
  if (cupo?.libres != null) tope = Math.min(tope, cupo.libres);
  if (!tope) return json({ ok: true, enviados: 0, motivo: 'sin cupo hoy' });

  const desde = new Date(Date.now() - (cfg.migracion_dias_actividad || 180) * 86400e3).toISOString();
  const { data: convs } = await supabase.from('wa_conversaciones')
    .select('id, telefono, contact_id, interna, contacts(nombre, apellido, wa_optout)')
    .eq('phone_number_id', cfg.migracion_desde).is('migrada_at', null).not('contact_id', 'is', null)
    .gte('ultimo_mensaje_at', desde).order('ultimo_mensaje_at', { ascending: false }).limit(tope * 3);

  const candidatos = (convs || []).filter((c: any) => !c.interna && !c.contacts?.wa_optout);
  if (simular) return json({ ok: true, simulado: true, tope, candidatos: candidatos.length, muestra: candidatos.slice(0, 10).map((c: any) => ({ id: c.id, telefono: c.telefono, nombre: c.contacts?.nombre })) });

  enContexto('sistema'); usarNumero(cfg.migracion_hacia);
  let enviados = 0, saltados = 0; const errores: string[] = [];
  for (const c of candidatos) {
    if (enviados >= tope) break;
    // Un WhatsApp por persona por día: si hoy ya le escribió alguien (cadencia, asesor), mañana.
    const presion = await puedeMandarWa(c.telefono).catch(() => ({ ok: true } as any));
    if (!presion.ok) { saltados++; continue; }
    const nombre = String((c as any).contacts?.nombre || '').trim().split(/\s+/)[0] || 'Hola';
    const params = (pl.variables || 0) > 0 ? [nombre].slice(0, pl.variables) : [];
    try {
      const r = await enviarPlantilla(c.telefono, pl.nombre, pl.idioma || 'es_MX', params);
      const wamid = r?.messages?.[0]?.id;
      // Se registra como saliente de ESTA conversación (que sigue viva en la línea vieja hasta que él conteste al nuevo).
      if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: c.telefono, direccion: 'saliente', tipo: 'template', cuerpo: `[plantilla ${pl.nombre}] aviso de número nuevo`, status: 'sent', autor: 'Sistema', metadata: { plantilla: pl.nombre, migracion_linea: cfg.migracion_hacia } } as any);
      await supabase.from('wa_conversaciones').update({ migrada_at: new Date().toISOString() }).eq('id', c.id);
      await supabase.from('wa_eventos').insert({ conversation_id: c.id, tipo: 'sistema', autor: 'Sistema', detalle: `Aviso de número nuevo enviado desde ${hacia.numero}` });
      enviados++;
    } catch (e: any) {
      errores.push(`${c.telefono}: ${e instanceof KapsoError ? e.message : String(e)}`);
      if (errores.length >= 5) break;   // algo está mal (plantilla, línea): no seguir quemando cupo
    }
  }
  return json({ ok: true, enviados, saltados, tope, candidatos: candidatos.length, errores });
};
