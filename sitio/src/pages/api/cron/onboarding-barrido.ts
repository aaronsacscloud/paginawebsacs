// GET /api/cron/onboarding-barrido — corre a las 4:00 am CDMX (10:00 UTC),
// DESPUÉS del sync de uso: los hitos se calculan con los datos de hoy.
//
// El vigilante del onboarding. Con el interruptor APAGADO no hace nada — sale
// en la primera línea y lo dice; así el motor completo puede vivir desplegado
// sin mandar un solo mensaje hasta que el dueño lo encienda.
//
// Qué hace por cada caso abierto:
//   1. recalcula los hitos del uso_sacs vivo y fecha los nuevos;
//   2. avanza la etapa (o gradúa al día 30 con uso constante);
//   3. detecta atorados por etapa y avisa ESCALONADO al consultor;
//   4. ejecuta la cadencia de los primeros días (correo; WhatsApp cuando las
//      plantillas estén aprobadas), condicionada por hito faltante;
//   5. si el cliente canceló, cierra como perdido_temprano — churn toma la
//      estafeta con su propio caso.
// Y dos redes: clientes pagados sin cuenta ligada (pendiente que no muere) y
// uso_sacs viejo (>48 h) — un tablero leyendo datos viejos es peor que ninguno.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';
import {
  configOnboarding, hitosDeUso, etapaDeCaso, umbralAtorado, ETAPA_ONB,
  type EtapaOnboarding,
} from '../../../lib/crm/onboarding.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

const ESCALONES = [3, 7, 14];
const hoyMx = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);

async function avisar(companyId: string, tipo: string, titulo: string, detalle: string, extra?: any, consultor?: { nombre?: string; email?: string } | null) {
  const desde = new Date(Date.now() - 20 * 3600e3).toISOString();
  const { data: ya } = await supabase.from('crm_notificaciones')
    .select('id').eq('tipo', tipo).eq('company_id', companyId).gte('created_at', desde).limit(1);
  if (ya?.length) return false;
  await supabase.from('crm_notificaciones').insert({
    tipo, nivel: 'alerta', destino: 'onboarding', company_id: companyId, titulo, detalle,
    metadata: { ...(extra || {}), consultor: consultor?.nombre || null },
  });
  /* Y al CONSULTOR por correo. El join de team_members se traía y no se usaba:
     el «aviso escalonado al consultor» dependía de que alguien mirara la
     campana global, que es de todos y por lo tanto de nadie. */
  if (consultor?.email) {
    await notify({ channel: 'email', to: consultor.email, template: 'onboarding_consultor',
      data: { asunto: titulo, titulo, cuerpo: detalle,
        cta_url: 'https://www.sacscloud.com/admin/crm?tab=onboarding', cta_texto: 'Ver el caso' } })
      .catch(() => null);
  }
  return true;
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });

  const cfg = await configOnboarding();
  if (!cfg.activo) return json({ ok: true, pausado: true, detalle: 'El onboarding está apagado: nada que hacer.' });

  const out = { casos: 0, avanzaron: 0, graduados: 0, atorados: 0, avisos: 0, correos: 0, cerrados_churn: 0, sin_cuenta: 0, uso_viejo: 0, errores: [] as string[] };

  const { data: casos } = await supabase.from('onboarding_casos')
    .select('*, companies(id, nombre, nombre_comercial, sacs_account, uso_sacs, uso_sync_at, owner_id), team_members:consultor_id(nombre, whatsapp, email)')
    .is('cerrado_at', null).limit(500);

  for (const caso of (casos || []) as any[]) {
    try {
      out.casos++;
      const co = caso.companies || {};
      const nombre = co.nombre_comercial || co.nombre || 'el cliente';
      const dias = Math.floor((Date.now() - Date.parse(caso.inicio + 'T06:00:00Z')) / 86400000);

      // ── ¿Canceló a media rampa? Churn toma la estafeta. ──
      const { data: vivas } = await supabase.from('subscriptions')
        .select('id').eq('company_id', co.id).eq('estado', 'activa').limit(1);
      if (!vivas?.length) {
        await supabase.from('onboarding_casos').update({
          cerrado_at: new Date().toISOString(), cierre_motivo: 'perdido_temprano', etapa: 'perdido_temprano',
          updated_at: new Date().toISOString(),
        }).eq('id', caso.id);
        const { abrirCasoSiAplica } = await import('../../../lib/crm/churn.lib');
        await abrirCasoSiAplica(String(co.id)).catch(() => null);
        out.cerrados_churn++;
        continue;
      }

      // ── El dato del que todo cuelga: ¿está fresco? ──
      const usoAt = co.uso_sync_at ? Date.parse(co.uso_sync_at) : 0;
      if (usoAt && Date.now() - usoAt > 48 * 3600e3) {
        out.uso_viejo++;
        if (await avisar(co.id, 'onboarding_uso_viejo', 'El uso de ' + nombre + ' tiene más de 48 h',
          'El onboarding está midiendo con datos viejos: revisa el sync de uso.')) out.avisos++;
      }

      // ── Hitos y etapa ──
      const h = hitosDeUso(co.uso_sacs, cfg.reglas);
      const hitos = { ...(caso.hitos || {}) };
      let fecho = false;
      for (const k of ['configurado', 'primer_uso', 'uso_constante'] as const) {
        if ((h as any)[k] && !hitos[k]) { hitos[k] = hoyMx(); fecho = true; }
      }
      const etapaNueva = etapaDeCaso(hitos, caso.inicio, cfg.reglas);
      const avanza = etapaNueva !== caso.etapa;

      // ── ¿Atorado? Desde el último movimiento (hito fechado o inicio). ──
      const ultimoMov = Math.max(Date.parse(caso.inicio + 'T06:00:00Z'),
        ...Object.values(hitos).map((f: any) => Date.parse(String(f) + 'T06:00:00Z') || 0));
      const sinMover = Math.floor((Date.now() - ultimoMov) / 86400000);
      const atorado = !avanza && etapaNueva !== 'graduado' && sinMover >= umbralAtorado(etapaNueva as EtapaOnboarding, cfg.reglas);

      const upd: any = { hitos, etapa: etapaNueva, updated_at: new Date().toISOString() };
      if (atorado && !caso.atorado_desde) upd.atorado_desde = new Date().toISOString();
      if (!atorado && caso.atorado_desde) upd.atorado_desde = null;
      if (etapaNueva === 'graduado') { upd.cerrado_at = new Date().toISOString(); upd.cierre_motivo = 'graduado'; }
      if (fecho || avanza || upd.atorado_desde !== caso.atorado_desde || upd.cerrado_at) {
        await supabase.from('onboarding_casos').update(upd).eq('id', caso.id);
      }
      if (avanza) {
        out.avanzaron++;
        await supabase.from('activities').insert({
          company_id: co.id, onboarding_caso_id: caso.id, tipo: 'sistema', automatico: true,
          titulo: `Onboarding: ${nombre} pasó a «${ETAPA_ONB(etapaNueva).l}» (día ${dias})`,
        });
      }
      if (etapaNueva === 'graduado') { out.graduados++; continue; }

      // ── Atorado: aviso escalonado al consultor, con el dato que lo prueba ──
      if (atorado) {
        out.atorados++;
        /* Por umbral CRUZADO, no por igualdad. `includes(sinMover)` exigía
           que el cron corriera justo el día 3, 7 o 14: un día sin corrida
           —deploy, 500, límite de Vercel— hacía saltar de 2 a 4 y el aviso
           no salía NUNCA. Ahora se compara contra el último escalón avisado. */
        const yaAvisado = Number((caso.hitos || {})._escalon || 0);
        const escalon = [...ESCALONES].reverse().find(e => sinMover >= e && e > yaAvisado);
        if (escalon) {
          const prueba = etapaNueva === 'cuenta_lista' ? 'sigue sin cargar catálogo ni invitar a su equipo'
            : etapaNueva === 'configurado' ? 'configuró pero no ha hecho su primera venta'
            : 'dejó de vender esta semana';
          if (await avisar(co.id, 'onboarding_atorado',
            `${nombre} lleva ${sinMover} días atorado en «${ETAPA_ONB(etapaNueva).l}»`,
            `${prueba}. Día ${dias} de 30 — una llamada del consultor vale más que otro correo.`,
            { onboarding_caso_id: caso.id }, caso.team_members)) {
            out.avisos++;
            await supabase.from('onboarding_casos')
              .update({ hitos: { ...hitos, _escalon: escalon } }).eq('id', caso.id);
          }
        }
      }

      // ── La cadencia de los primeros días (condicionada por hito faltante) ──
      // Cada envío se marca en activities para no repetirse; los pasos de
      // WhatsApp entran cuando sus plantillas estén aprobadas por Meta.
      const enviado = async (paso: string) => {
        const { data } = await supabase.from('activities').select('id')
          .contains('metadata', { onboarding_paso: paso, onboarding_caso_id: caso.id }).limit(1);
        return !!data?.length;
      };
      const marcar = (paso: string, titulo: string) => supabase.from('activities').insert({
        company_id: co.id, onboarding_caso_id: caso.id, tipo: 'sistema', automatico: true,
        titulo, metadata: { onboarding_paso: paso, onboarding_caso_id: caso.id },
      });
      const { data: cont } = await supabase.from('contacts')
        .select('nombre, email').eq('company_id', co.id).not('email', 'is', null).limit(1);
      const email = cont?.[0]?.email || null;

      if (dias >= 0 && email && !(await enviado('d0'))) {
        const r = await notify({
          channel: 'email', to: email, template: 'onboarding_bienvenida',
          data: { nombre: cont?.[0]?.nombre || '', empresa: nombre, cuenta: co.sacs_account || '', agendar_url: 'https://www.sacscloud.com/agendar/configuracion' },
        });
        if (r.ok) { await marcar('d0', 'Onboarding día 0: bienvenida enviada'); out.correos++; }
        else out.errores.push(`${co.id} d0: ${r.reason}`);
      }
      if (dias >= 3 && email && !hitos.configurado && !(await enviado('d3'))) {
        const r = await notify({
          channel: 'email', to: email, template: 'onboarding_configura',
          data: { nombre: cont?.[0]?.nombre || '', empresa: nombre, cuenta: co.sacs_account || '', agendar_url: 'https://www.sacscloud.com/agendar/configuracion' },
        });
        if (r.ok) { await marcar('d3', 'Onboarding día 3: guía de configuración enviada'); out.correos++; }
        else out.errores.push(`${co.id} d3: ${r.reason}`);
      }
      /* Sin ningún correo en la empresa, los pasos d0/d3 se saltaban en
         silencio y el cliente arrancaba sin recibir NADA. Se dice una vez. */
      if (!email && dias >= 1 && !(await enviado('sin_correo'))) {
        if (await avisar(co.id, 'onboarding_sin_correo', `${nombre} no tiene correo`,
          'Su onboarding no puede mandar la bienvenida ni la guía de arranque: captura un correo en su ficha.',
          { onboarding_caso_id: caso.id })) { await marcar('sin_correo', 'Onboarding: sin correo para escribirle'); out.avisos++; }
      }
      if (dias >= 7 && !hitos.primer_uso && !(await enviado('d7'))) {
        // Al CONSULTOR, no al cliente: al día 7 sin vender, lo que toca es llamada.
        if (await avisar(co.id, 'onboarding_sin_primera_venta',
          `${nombre} lleva 7 días con cuenta y sin su primera venta`,
          'Es la señal de rescate temprano: una llamada del consultor, no otro correo.',
          { onboarding_caso_id: caso.id }, caso.team_members)) { await marcar('d7', 'Onboarding día 7: aviso al consultor (sin primera venta)'); out.avisos++; }
      }
    } catch (e: any) {
      out.errores.push(`${caso.id}: ${e?.message || e}`);
    }
  }

  // ── La red: clientes pagados SIN cuenta ligada (el pendiente no muere) ──
  const { data: cos } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, sacs_account').is('archived_at', null).limit(1000);
  const ids = (cos || []).filter((c: any) => !c.sacs_account).map((c: any) => c.id);
  if (ids.length) {
    const { data: conLiga } = await supabase.from('company_sacs_accounts').select('company_id').in('company_id', ids);
    const ligadas = new Set((conLiga || []).map((x: any) => x.company_id));
    const { data: activas } = await supabase.from('subscriptions')
      .select('company_id').eq('estado', 'activa').in('company_id', ids.filter(i => !ligadas.has(i)));
    for (const s of activas || []) {
      const co = (cos || []).find((c: any) => c.id === s.company_id);
      out.sin_cuenta++;
      if (await avisar(s.company_id, 'onboarding_sin_cuenta',
        `${(co as any)?.nombre_comercial || (co as any)?.nombre || 'Un cliente'} paga y sigue sin cuenta de SACS`,
        'El paso obligatorio del alta no se ha hecho: ficha del cliente → botón «Cuenta SACS».')) out.avisos++;
    }
  }

  return json({ ok: true, ...out });
};
