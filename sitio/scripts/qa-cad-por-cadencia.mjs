/**
 * ETAPA 8 · LO QUE SOLO TIENE UNA CADENCIA
 *
 * Las etapas 1-7 probaron el motor común. Aquí van las reglas que existen para
 * UNA sola cadencia y que, por eso mismo, nadie más ejercita: si se rompen, se
 * rompen calladas y solo se nota en el correo que recibe un cliente.
 */
import { contacto, empresa, secuencia, suscripcion, cron, miembro, check, resumen, limpiar, soloEsta, sb } from './qa-cadencias.mjs';
import { randomUUID } from 'node:crypto';

const hace = d => new Date(Date.now() - d * 864e5);
const en = d => new Date(Date.now() + d * 864e5);
const fecha = d => d.toISOString().slice(0, 10);
const enviados = async (s, c) => Object.keys((await miembro(s, c))?.enviados || {}).length;

const { data: pl } = await sb.from('email_templates').select('id').eq('activo', true).limit(1).single();
const CORREO = { canal: 'correo', email_template_id: pl.id };

/** Una reunión desechable. */
const RESERVAS = [];
async function reserva(contactId, dias, campos = {}) {
  const { data: et } = await sb.from('event_types').select('id').limit(1).single();
  const { data: host } = await sb.from('team_members').select('id').limit(1).single();
  const id = randomUUID();
  const { error } = await sb.from('bookings').insert({
    id, event_type_id: et.id, host_id: host.id, contact_id: contactId,
    fecha: fecha(en(dias)), hora_inicio: '10:00', hora_fin: '10:30',
    timezone_invitado: 'America/Mexico_City', timezone_host: 'America/Mexico_City',
    invitee_nombre: 'QA', estado: 'confirmada',
    token_cancelar: id, token_reagendar: id, ...campos,
  });
  if (error) throw new Error('sembrando reunión: ' + error.message);
  RESERVAS.push(id);
  return id;
}

console.log('\n  ── a) Prueba gratis · el disparador sella las fechas solo ──');
{
  const c = await contacto({ lifecycle_stage: 'lead' });
  await sb.from('contacts').update({ lifecycle_stage: 'prueba_gratis' }).eq('id', c);
  const { data: d } = await sb.from('contacts').select('prueba_inicio, prueba_fin, prueba_dias, prueba_estado').eq('id', c).single();
  check('al mover la etapa se sella el inicio', d.prueba_inicio != null, true);
  check('y el fin', d.prueba_fin != null, true);
  check('con 14 días por omisión', d.prueba_dias, 14);
  check('y estado activa', d.prueba_estado, 'activa');
  const antes = d.prueba_inicio;
  await sb.from('contacts').update({ lifecycle_stage: 'lead' }).eq('id', c);
  await sb.from('contacts').update({ lifecycle_stage: 'prueba_gratis' }).eq('id', c);
  const { data: d2 } = await sb.from('contacts').select('prueba_inicio').eq('id', c).single();
  check('salir y volver a entrar NO le regala otra prueba', d2.prueba_inicio, antes);
}

console.log('\n  ── b) Renovación · la cuenta regresiva ubica el día ──');
{
  /* El motor traduce «faltan N» a un día normal: dia = 90 − faltan + 1. El día
     se calcula con la MISMA fórmula que el motor —redondeo hacia arriba sobre
     la fecha a mediodía UTC— porque a según qué hora del día «dentro de 33»
     cuenta como 34, y una prueba que fija el número a mano falla por el reloj
     y no por el producto. */
  const faltanDe = f => Math.ceil((Date.parse(f + 'T12:00:00Z') - Date.now()) / 86400000);
  const fJusto = fecha(en(33)), fAun = fecha(en(80));
  const diaJusto = 90 - faltanDe(fJusto) + 1;

  const s = await secuencia({ corte_dias: 3650, entrada: { estatus: ['nuevo','contactado','sin_respuesta'], lifecycle: ['lead'], ancla: 'renovacion', para_clientes: true } },
    [{ dia: diaJusto, ...CORREO }]);
  await soloEsta(s);
  const mk = async (f, extra = {}) => { const co = await empresa(); await suscripcion(co, { proxima_factura: f, monto_proximo: 24000, ...extra }); return contacto({ company_id: co }); };
  const justo = await mk(fJusto), aun = await mk(fAun), lejos = await mk(fecha(en(200)));
  /* Hay suscripciones reales sin monto. Con ellas el correo diría «renueva
     antes del 2 de octubre por  y te ahorras » — con los huecos a la vista.
     Se prefiere saltarlo. */
  const sinMonto = await mk(fJusto, { monto_proximo: 0 });
  await cron(); await cron();
  check(`a ~33 días le toca el paso del día ${diaJusto}`, await enviados(s, justo), 1);
  check('sin monto NO se manda un correo con huecos', await enviados(s, sinMonto), 0);
  check('a 80 días todavía no (contrafactual)', await enviados(s, aun), 0);
  check('a 200 días ni siquiera entra: fuera de la ventana de 90', await miembro(s, lejos), null);
}

console.log('\n  ── c) Renovación · el corte entrega a arr-reminders ──');
{
  // corte_dias 76 = «faltan 15». De ahí en adelante manda el recordatorio de
  // cobro, no la cadencia: dos sistemas escribiéndole el mismo día es lo feo.
  const s = await secuencia({ corte_dias: 76, entrada: { estatus: ['nuevo','contactado','sin_respuesta'], lifecycle: ['lead'], ancla: 'renovacion', para_clientes: true } },
    [{ dia: 58, ...CORREO }, { dia: 85, ...CORREO }]);
  await soloEsta(s);
  const mk = async d => { const co = await empresa(); await suscripcion(co, { proxima_factura: fecha(en(d)), monto_proximo: 24000 }); return contacto({ company_id: co }); };
  const dentro = await mk(33), pasado = await mk(10);
  await cron(); await cron();
  check('a 33 días sigue viva', (await miembro(s, dentro))?.motivo ?? null, null);
  check('a 10 días ya salió por corte', (await miembro(s, pasado))?.motivo, 'corte');
  check('y no le llegó el paso del día 85', await enviados(s, pasado), 0);
}

console.log('\n  ── d) Rezagados · la entrada mueve la etapa sola ──');
{
  const hoy = (() => { const d = new Date(Date.now() - 6 * 3600e3); return d.getUTCDay() === 0 ? 7 : d.getUTCDay(); })();
  const s = await secuencia({
    modo: 'permanente',
    entrada: { estatus: ['nuevo','contactado','sin_respuesta'], lifecycle: ['lead'], cada_dias: 1,
               filtros: [{ campo: 'sin_actividad', op: 'hace_mas', valor: '30' }] },
    acciones: { al_entrar: { lifecycle: 'rezagado' } },
  }, [{ dia: 1, dia_semana: hoy, ...CORREO }]);
  await soloEsta(s);
  const frio = await contacto({ ultima_actividad_venta_at: hace(120).toISOString() });
  const tibio = await contacto({ ultima_actividad_venta_at: hace(3).toISOString() });
  await cron();
  const { data: d } = await sb.from('contacts').select('lifecycle_stage').eq('id', frio).single();
  check('al entrar, la cadencia lo marca rezagado', d.lifecycle_stage, 'rezagado');
  check('quien sí tuvo movimiento hace 3 días no entra', await miembro(s, tibio), null);
  await cron();
  check('y el goteo permanente sí le manda', await enviados(s, frio) >= 1, true);
}

console.log('\n  ── e) Demo agendada · los dos tramos y la parada ──');
{
  const s = await secuencia({ objetivo: 'demo_hecha' }, [
    { dia: 2, ...CORREO },   // preparación (día ≤ 4)
    { dia: 8, ...CORREO },   // rescate (día > 4)
  ]);
  await soloEsta(s);
  const conReunion = await contacto();
  const sinNada = await contacto();
  await cron();                                  // enrola a los dos
  /* El arco se mide en días desde que entró. Recién enrolado va en el día 1 y
     ningún paso le toca: para probar el tramo hay que envejecer al miembro. */
  const envejecer = async (c, d) => sb.from('crm_secuencia_miembros')
    .update({ inicio: new Date(Date.now() - d * 864e5).toISOString() }).eq('secuencia_id', s).eq('contact_id', c);
  await envejecer(conReunion, 2); await envejecer(sinNada, 2);
  await reserva(conReunion, 3);                  // sesión por delante
  await cron();
  check('con sesión por delante llega la preparación', await enviados(s, conReunion), 1);
  check('sin sesión por delante NO se prepara nada', await enviados(s, sinNada), 0);

  /* Y con la sesión viva tampoco se rescata: el rescate es para quien faltó. */
  await envejecer(conReunion, 9);
  await cron();
  check('con la sesión todavía viva no se le manda el rescate', await enviados(s, conReunion), 1);

  // La reunión pasó y nadie marcó asistencia: la cadencia se para sola.
  const { data: conv } = await sb.from('wa_conversaciones')
    .insert({ telefono: '+520000000000', contact_id: conReunion, estado: 'abierta' }).select('id').single();
  await sb.from('bookings').update({ fecha: fecha(hace(2)) }).eq('contact_id', conReunion);
  await cron();
  const m = await miembro(s, conReunion);
  check('reunión pasada sin marcar → se detiene', m?.motivo, 'reunion_sin_marcar');
  const { data: notas } = await sb.from('wa_notas').select('texto').eq('contact_id', conReunion);
  check('y deja el aviso en el inbox', (notas || []).some(n => n.texto.includes('en pausa')), true);
  check('no le mandó el rescate por un registro sin marcar', await enviados(s, conReunion), 1);
  await sb.from('wa_notas').delete().eq('contact_id', conReunion);
  await sb.from('wa_conversaciones').delete().eq('id', conv.id);
}

console.log('\n  ── f) Winback · ignorar la salida por descartado ──');
{
  const s = await secuencia({ entrada: { estatus: ['descartado'], lifecycle: ['lead'], ignorar_salidas: ['descartado'], para_clientes: true } }, [{ dia: 1, ...CORREO }]);
  await soloEsta(s);
  const ido = await contacto({ estatus_lead: 'descartado' });
  await cron(); await cron();
  check('un descartado sí recibe el winback', await enviados(s, ido), 1);
  check('y no sale por descartado', (await miembro(s, ido))?.motivo ?? null, null);

  const s2 = await secuencia({ entrada: { estatus: ['descartado'], lifecycle: ['lead'] } }, [{ dia: 1, ...CORREO }]);
  await soloEsta(s2);
  const ido2 = await contacto({ estatus_lead: 'descartado' });
  await cron(); await cron();
  check('contrafactual: sin ignorar_salidas, sale de inmediato', (await miembro(s2, ido2))?.motivo, 'descartado');
}

console.log('\n  ── g) Crecimiento · solo a quien SÍ está usando el sistema ──');
{
  const s = await secuencia({ entrada: { estatus: ['nuevo','contactado','sin_respuesta'], lifecycle: ['cliente'], para_clientes: true,
    filtros: [{ campo: 'sin_actividad', op: 'hace_menos', valor: '15' }] } }, [{ dia: 1, ...CORREO }]);
  await soloEsta(s);
  const activo = await contacto({ lifecycle_stage: 'cliente', ultima_actividad_venta_at: hace(4).toISOString() });
  const dormido = await contacto({ lifecycle_stage: 'cliente', ultima_actividad_venta_at: hace(90).toISOString() });
  await cron(); await cron();
  check('al que la usa se le ofrece la extensión', await enviados(s, activo), 1);
  check('al dormido NO: decirle «la usas muy bien» sería mentira', await miembro(s, dormido), null);
}

console.log('\n  limpiando…');
for (const id of RESERVAS) await sb.from('bookings').delete().eq('id', id);
await limpiar();
process.exit(resumen() ? 0 : 1);
