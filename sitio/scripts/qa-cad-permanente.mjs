/** ETAPA 4 · Modo permanente: carriles, ritmo y agotamiento. */
import { contacto, secuencia, cron, miembro, check, resumen, limpiar, soloEsta, sb } from './qa-cadencias.mjs';
const { data: pls } = await sb.from('email_templates').select('id, nombre').eq('activo', true).limit(6);
const hace = d => new Date(Date.now() - d * 864e5).toISOString();
const cdmx = new Date(Date.now() - 6 * 3600e3);
const HOY = cdmx.getUTCDay() === 0 ? 7 : cdmx.getUTCDay();
const OTRO = HOY === 1 ? 2 : 1;
const enviados = async (s, c) => Object.keys((await miembro(s, c))?.enviados || {}).length;
const cuales = async (s, c) => Object.keys((await miembro(s, c))?.enviados || {});
const PERM = { modo: 'permanente', entrada: { estatus: ['nuevo','contactado','sin_respuesta'], lifecycle: ['lead'], cada_dias: 1 } };

console.log('  ── a) el carril del día es el único que corre ──');
{
  const s = await secuencia(PERM, [
    { dia: 1, dia_semana: HOY,  canal: 'correo', email_template_id: pls[0].id },
    { dia: 1, dia_semana: OTRO, canal: 'correo', email_template_id: pls[1].id },
  ]);
  await soloEsta(s);
  const c = await contacto();
  await cron(); await cron();
  const { data: ps } = await sb.from('crm_secuencia_pasos').select('id, dia_semana').eq('secuencia_id', s);
  const delDia = ps.find(p => p.dia_semana === HOY).id;
  check('envió UN paso', await enviados(s, c), 1);
  check('y fue el del carril de hoy', (await cuales(s, c))[0], delDia);
}

console.log('  ── b) cada_dias frena entre envíos ──');
{
  const s = await secuencia({ ...PERM, entrada: { ...PERM.entrada, cada_dias: 14 } }, [
    { dia: 1, dia_semana: HOY, canal: 'correo', email_template_id: pls[0].id },
    { dia: 1, dia_semana: HOY, canal: 'correo', email_template_id: pls[1].id },
  ]);
  await soloEsta(s);
  const c = await contacto();
  await cron(); await cron();
  check('primer envío sale', await enviados(s, c), 1);
  await cron();
  check('el segundo NO sale: faltan 14 días', await enviados(s, c), 1);
  // Se envejece el envío para simular que ya pasaron los 14.
  const m = await miembro(s, c);
  const viejos = Object.fromEntries(Object.entries(m.enviados).map(([k]) => [k, hace(20)]));
  await sb.from('crm_secuencia_miembros').update({ enviados: viejos }).eq('secuencia_id', s).eq('contact_id', c);
  /* Y se borra el registro del envío de HOY. Si no, el tope global de un correo
     por lead por día bloquea el segundo — que es correcto, pero taparía lo que
     este caso quiere probar, que es el ritmo de `cada_dias`. */
  await sb.from('activities').delete().eq('contact_id', c).eq('tipo', 'secuencia_envio');
  await cron();
  check('pasados los 14 días, sale el siguiente del carril', await enviados(s, c), 2);
}

console.log('  ── c) la ventana de respeto ──');
{
  const s = await secuencia(PERM, [{ dia: 1, dia_semana: HOY, canal: 'correo', email_template_id: pls[0].id }]);
  await soloEsta(s);
  const activo = await contacto({ ultima_actividad_venta_at: hace(2) });
  const quieto = await contacto({ ultima_actividad_venta_at: hace(60) });
  await cron(); await cron();
  check('con actividad de hace 2 días → se le respeta y no le llega', await enviados(s, activo), 0);
  check('sin actividad reciente → sí le llega', await enviados(s, quieto), 1);
}

console.log('  ── d) vigente_hasta salta los pasos vencidos ──');
{
  const s = await secuencia(PERM, [
    { dia: 1, dia_semana: HOY, canal: 'correo', email_template_id: pls[0].id, vigente_hasta: hace(30).slice(0,10) },
    { dia: 1, dia_semana: HOY, canal: 'correo', email_template_id: pls[1].id },
  ]);
  await soloEsta(s);
  const c = await contacto();
  await cron(); await cron();
  const { data: ps } = await sb.from('crm_secuencia_pasos').select('id, vigente_hasta').eq('secuencia_id', s);
  const vivo = ps.find(p => !p.vigente_hasta).id;
  check('no manda el paso vencido', (await cuales(s, c))[0], vivo);
}

console.log('  ── e) se acaba el contenido y se detiene sin repetir ──');
{
  const s = await secuencia({ ...PERM, entrada: { ...PERM.entrada, cada_dias: 1 } },
    [{ dia: 1, dia_semana: HOY, canal: 'correo', email_template_id: pls[0].id }]);
  await soloEsta(s);
  const c = await contacto();
  await cron(); await cron();
  check('manda el único paso', await enviados(s, c), 1);
  const m = await miembro(s, c);
  await sb.from('crm_secuencia_miembros').update({ enviados: Object.fromEntries(Object.entries(m.enviados).map(([k]) => [k, hace(20)])) })
    .eq('secuencia_id', s).eq('contact_id', c);
  await cron();
  check('agotado el carril NO repite', await enviados(s, c), 1);
  check('y NO lo saca de la cadencia (espera contenido nuevo)', (await miembro(s, c))?.motivo ?? null, null);
}

console.log(`\n  limpiando…`); await limpiar();
process.exit(resumen() ? 0 : 1);
