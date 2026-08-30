/** ETAPA 3 · Topes, horarios y pausas. */
import { contacto, empresa, secuencia, campanaInapp, cron, miembro, envios, check, resumen, limpiar, soloEsta, sb } from './qa-cadencias.mjs';
const { data: pls } = await sb.from('email_templates').select('id').eq('activo', true).limit(2);
const P1 = { dia: 1, canal: 'correo', email_template_id: pls[0].id };
const hace = d => new Date(Date.now() - d * 864e5).toISOString();
const enviados = async (s, c) => Object.keys((await miembro(s, c))?.enviados || {}).length;

console.log('  ── a) tope GLOBAL: 1 correo por lead por día entre TODAS las secuencias ──');
{
  const sA = await secuencia({}, [P1]);
  const sB = await secuencia({}, [{ dia: 1, canal: 'correo', email_template_id: pls[1].id }]);
  const c = await contacto();
  await cron(); await cron();
  const nA = await enviados(sA, c), nB = await enviados(sB, c);
  check('recibió UN correo en total, no uno por secuencia', nA + nB, 1);
  await cron();
  check('y en la misma corrida no le llega el segundo', (await enviados(sA, c)) + (await enviados(sB, c)), 1);
}

console.log('  ── b) el horario ──');
{
  const s = await secuencia({ hora_inicio: 23, hora_fin: 24 }, [P1]);
  const c = await contacto();
  await soloEsta(s);
  await cron(); await cron();
  check('fuera de la ventana horaria NO envía', await enviados(s, c), 0);
  await sb.from('crm_secuencias').update({ hora_inicio: 0, hora_fin: 24 }).eq('id', s);
  await cron();
  check('dentro de la ventana SÍ envía', await enviados(s, c), 1);
}

console.log('  ── c) los días de envío ──');
{
  const cdmx = new Date(Date.now() - 6 * 3600e3);
  const hoy = cdmx.getUTCDay() === 0 ? 7 : cdmx.getUTCDay();
  const otro = hoy === 1 ? 2 : 1;
  const s = await secuencia({ dias_envio: [otro] }, [P1]);
  const c = await contacto();
  await soloEsta(s);
  await cron(); await cron();
  check(`hoy es día ${hoy} y la secuencia solo envía el ${otro} → no envía`, await enviados(s, c), 0);
  await sb.from('crm_secuencias').update({ dias_envio: [hoy] }).eq('id', s);
  await cron();
  check('con el día de hoy en la lista → envía', await enviados(s, c), 1);
}

console.log('  ── d) blackout congela la secuencia entera ──');
{
  const hoyISO = new Date().toISOString().slice(0, 10);
  const s = await secuencia({ blackout: [{ desde: hoyISO, hasta: hoyISO }] }, [P1]);
  const c = await contacto();
  await soloEsta(s);
  await cron(); await cron();
  check('en blackout no envía', await enviados(s, c), 0);
  await sb.from('crm_secuencias').update({ blackout: [] }).eq('id', s);
  /* Dos corridas: el blackout congela la secuencia ENTERA —el `continue` va
     antes del enrolamiento— así que durante el congelamiento nadie entra. Al
     levantarlo, la primera corrida enrola y la segunda envía. */
  await cron(); await cron();
  check('fuera del blackout envía', await enviados(s, c), 1);
}

console.log('  ── e) retenido_hasta pausa sin sacar ──');
{
  const s = await secuencia({}, [P1]);
  const c = await contacto({ retenido_hasta: new Date(Date.now() + 10 * 864e5).toISOString() });
  await soloEsta(s);
  await cron(); await cron();
  check('en pausa no le llega nada', await enviados(s, c), 0);
  check('pero NO salió de la cadencia', (await miembro(s, c))?.motivo ?? null, null);
  await sb.from('contacts').update({ retenido_hasta: hace(1) }).eq('id', c);
  await cron();
  check('vencida la pausa, sigue donde iba', await enviados(s, c), 1);
}

console.log('  ── f) el in-app NO consume el cupo del correo ──');
{
  const co = await empresa({ sacs_account: 'cuentademonueva' });
  const s = await secuencia({}, []);
  const camp = await campanaInapp(s);
  await sb.from('crm_secuencia_pasos').insert([
    { secuencia_id: s, orden: 10, dia: 1, canal: 'correo', email_template_id: pls[0].id, activo: true },
    { secuencia_id: s, orden: 20, dia: 1, canal: 'inapp', inapp_campana_id: camp, activo: true },
  ]);
  const c = await contacto({ company_id: co, prueba_cuenta: 'cuentademonueva' });
  await soloEsta(s);
  await cron(); await cron();
  check('el mismo día recibe correo Y mensaje dentro de Sacs', (await envios(c)).sort(), ['correo', 'inapp']);
}

console.log(`\n  limpiando…`); await limpiar();
process.exit(resumen() ? 0 : 1);
