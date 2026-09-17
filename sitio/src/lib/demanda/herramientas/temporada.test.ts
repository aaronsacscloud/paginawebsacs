/**
 * ¿Sale o no sale este estilo a tiempo?
 *
 * Esta herramienta no informa: RECOMIENDA. Le dice a un comprador que rebaje o
 * que no rebaje, y las dos equivocaciones cuestan dinero real —rebajar de más
 * regala margen, rebajar tarde deja la mercancía muerta—. Por eso los casos de
 * abajo guardan sobre todo los BORDES del veredicto, que es donde una función
 * así se rompe sin avisar.
 *
 * Correr:  node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *            src/lib/demanda/herramientas/temporada.test.ts
 */
import { calcular } from './temporada.ts';

let ok = 0; const fallas: string[] = [];
const cmp = (real: unknown, esp: unknown, que: string) => {
  const a = JSON.stringify(real), b = JSON.stringify(esp);
  if (a === b) { ok++; return; }
  fallas.push(`${que}\n      esperaba ${b}\n      llegó    ${a}`);
};
const si = (c: boolean, que: string) => { c ? ok++ : fallas.push(que); };
const base = { aceleracion_max: 2 };

// ── El sell-through se divide entre lo RECIBIDO ─────────────────────────────
{
  const r = calcular({ ...base, recibidas: 100, vendidas: 60, semanas_transcurridas: 4, semanas_restantes: 8 });
  cmp(r.sell_through, 60, 'sell-through = vendidas ÷ recibidas, no ÷ existencia (daría 150%)');
  cmp(r.existencia, 40, 'la existencia es lo recibido menos lo vendido');
  cmp(r.ritmo_semanal, 15, '60 piezas en 4 semanas son 15 por semana');
  cmp(r.veredicto, 'sale_solo', 'con 2.7 semanas de cobertura y 8 por delante, sale solo');
}

// ── El borde que motivó rehacer el veredicto ────────────────────────────────
{
  // Sobrar 3 piezas de 100 NO es «no lo vas a sacar». La primera versión partía
  // en sobrante > 0 —que es exactamente aceleración > 1— y daba la misma alarma
  // por 3 piezas que por 80. Un aviso que salta por nada enseña a ignorarlo.
  const chico = calcular({ ...base, recibidas: 100, vendidas: 45, semanas_transcurridas: 6, semanas_restantes: 7 });
  cmp(chico.veredicto, 'ajustado', 'sobrar 3 de 100 (2.5%) es «ajustado», no «no sale»');
  si(!chico.lectura.includes('No lo vas a sacar'), 'con 3 piezas de sobra no se dispara la alarma grande');

  const grande = calcular({ ...base, recibidas: 200, vendidas: 60, semanas_transcurridas: 6, semanas_restantes: 6 });
  cmp(grande.veredicto, 'no_sale', 'sobrar 80 de 200 (40%) sí es «no sale»');

  // El corte está en 5% de lo recibido: justo debajo y justo encima.
  const justoDebajo = calcular({ ...base, recibidas: 100, vendidas: 48, semanas_transcurridas: 6, semanas_restantes: 6 });
  si(justoDebajo.sobrante_proyectado <= 5 && justoDebajo.veredicto === 'ajustado',
    'hasta 5% de sobrante el veredicto es «ajustado»');
}

// ── Casos degenerados: la función tiene que decir algo verdadero ────────────
{
  const sinVentas = calcular({ ...base, recibidas: 100, vendidas: 0, semanas_transcurridas: 4, semanas_restantes: 8 });
  cmp(sinVentas.aceleracion_necesaria, null, 'sin ventas no hay aceleración que calcular: null, no 0');
  si(!sinVentas.lectura.includes('0× más rápido'),
    'sin ventas jamás debe decir «vender 0× más rápido», que no significa nada');
  si(sinVentas.lectura.includes('no ha') || sinVentas.lectura.includes('No has'),
    'sin ventas la lectura tiene que nombrar el problema real: el estilo no arrancó');

  const agotado = calcular({ ...base, recibidas: 100, vendidas: 100, semanas_transcurridas: 5, semanas_restantes: 7 });
  cmp(agotado.veredicto, 'ya_se_acabo', 'vendido todo = ya_se_acabo');
  si(agotado.lectura.includes('faltó') || agotado.lectura.includes('falt'),
    'vendido todo: la pregunta útil pasa a ser si faltó mercancía');

  const pronto = calcular({ ...base, recibidas: 100, vendidas: 8, semanas_transcurridas: 1, semanas_restantes: 11 });
  cmp(pronto.veredicto, 'muy_pronto', 'con menos de 2 semanas el ritmo es ruido y hay que decirlo');

  const sinTiempo = calcular({ ...base, recibidas: 100, vendidas: 30, semanas_transcurridas: 8, semanas_restantes: 0 });
  si(Number.isFinite(sinTiempo.sobrante_proyectado), 'sin semanas restantes el sobrante sigue siendo un número');
  cmp(sinTiempo.aceleracion_necesaria, null, 'sin semanas restantes la aceleración es null, no Infinity');
}

// ── La semana límite ────────────────────────────────────────────────────────
{
  // Cada semana sin actuar sube la aceleración necesaria: la existencia baja
  // despacio y las semanas restantes bajan rápido. El límite es la última
  // semana en que todavía cabe en el múltiplo que el usuario cree alcanzable.
  const r = calcular({ ...base, recibidas: 100, vendidas: 30, semanas_transcurridas: 5, semanas_restantes: 10 });
  si(r.semana_limite === null || r.semana_limite < 10,
    'la semana límite nunca puede caer fuera de la temporada');

  const holgado = calcular({ aceleracion_max: 5, recibidas: 200, vendidas: 60, semanas_transcurridas: 6, semanas_restantes: 6 });
  const apretado = calcular({ aceleracion_max: 2, recibidas: 200, vendidas: 60, semanas_transcurridas: 6, semanas_restantes: 6 });
  si((holgado.semana_limite ?? -1) >= (apretado.semana_limite ?? -1),
    'creer que puedes acelerar más da MÁS margen para actuar, nunca menos');
}

// ── Nada de NaN ni Infinity saliendo a la vista ─────────────────────────────
{
  for (const e of [
    { recibidas: 1, vendidas: 0, semanas_transcurridas: 0.5, semanas_restantes: 0 },
    { recibidas: 1, vendidas: 1, semanas_transcurridas: 0.5, semanas_restantes: 0 },
    { recibidas: 10000, vendidas: 9999, semanas_transcurridas: 260, semanas_restantes: 260 },
  ]) {
    const r = calcular({ ...base, ...e });
    const nums = [r.sell_through, r.ritmo_semanal, r.existencia, r.sobrante_proyectado];
    si(nums.every(Number.isFinite), `ningún número puede salir NaN/Infinity (${JSON.stringify(e)})`);
    si(typeof r.lectura === 'string' && r.lectura.length > 20 && !r.lectura.includes('NaN'),
      `la lectura siempre dice algo legible (${JSON.stringify(e)})`);
  }
}

console.log(fallas.length
  ? `\n✗ sale o no sale: ${fallas.length} fallas de ${ok + fallas.length}\n\n  · ${fallas.join('\n\n  · ')}\n`
  : `✓ sale o no sale: ${ok} casos`);
process.exit(fallas.length ? 1 : 0);
