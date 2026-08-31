#!/usr/bin/env node
/**
 * Aumento del 35%: crea los 8 Price nuevos en Stripe (4 planes × mensual/anual).
 *
 * POR QUÉ EXISTE ESTE SCRIPT
 * Un Price de Stripe es INMUTABLE: no se le cambia el monto. Para subir un
 * precio hay que crear un Price nuevo sobre el mismo Product y apuntar el
 * checkout al id nuevo. Por eso el aumento no se termina editando la base ni
 * el sitio: mientras las variables STRIPE_PRICE_* sigan apuntando a los Price
 * viejos, el sitio anuncia $810 y Stripe cobra $600.
 *
 * QUÉ HACE
 *   1. Lee los Price actuales (los ids de las variables STRIPE_PRICE_*).
 *   2. Averigua a qué Product pertenece cada uno.
 *   3. Crea un Price nuevo en ese mismo Product con el monto nuevo.
 *   4. Imprime las 8 variables de entorno ya listas para pegar en Vercel.
 *
 * QUÉ **NO** HACE, a propósito:
 *   - No archiva ni borra los Price viejos. Las suscripciones existentes
 *     siguen colgadas de ellos: archivarlos no cambia lo que ya se cobra, pero
 *     tampoco hace falta y prefiero no tocar nada que no sea necesario.
 *   - No migra a ningún cliente al precio nuevo. El aumento es SOLO para
 *     ventas nuevas (decisión del dueño, 2026-08-31).
 *   - No escribe las variables en Vercel. Eso se hace a mano, para que quede
 *     claro en qué momento el checkout empieza a cobrar el precio nuevo.
 *
 * USO
 *   export STRIPE_SECRET_KEY=sk_live_...        # o sk_test_ para ensayar
 *   node sitio/scripts/stripe-precios-35.mjs             # simulacro (no crea nada)
 *   node sitio/scripts/stripe-precios-35.mjs --aplicar   # crea los 8 Price
 *
 * Las variables STRIPE_PRICE_* se leen del entorno; si no están, se pueden
 * pasar con --ids=archivo.json (un objeto {VENDE_MONTHLY: 'price_...', ...}).
 */

import { readFileSync } from 'node:fs';

// Montos NUEVOS en centavos de MXN (el 35% ya aplicado y verificado).
//   vende      600 → 810      6,000 → 8,100
//   controla   900 → 1,215    9,000 → 12,150
//   fideliza 1,400 → 1,890   14,000 → 18,900
//   automatiza 2,800 → 3,780 28,000 → 37,800
const NUEVOS = {
  VENDE_MONTHLY:      { pesos: 810,   intervalo: 'month' },
  VENDE_ANNUAL:       { pesos: 8100,  intervalo: 'year'  },
  CONTROLA_MONTHLY:   { pesos: 1215,  intervalo: 'month' },
  CONTROLA_ANNUAL:    { pesos: 12150, intervalo: 'year'  },
  FIDELIZA_MONTHLY:   { pesos: 1890,  intervalo: 'month' },
  FIDELIZA_ANNUAL:    { pesos: 18900, intervalo: 'year'  },
  AUTOMATIZA_MONTHLY: { pesos: 3780,  intervalo: 'month' },
  AUTOMATIZA_ANNUAL:  { pesos: 37800, intervalo: 'year'  },
};

const APLICAR = process.argv.includes('--aplicar');
const KEY = process.env.STRIPE_SECRET_KEY;

if (!KEY) {
  console.error('Falta STRIPE_SECRET_KEY en el entorno.');
  process.exit(1);
}

// ids de los Price viejos: del entorno, o de un JSON pasado con --ids=
const argIds = process.argv.find((a) => a.startsWith('--ids='));
const desdeArchivo = argIds ? JSON.parse(readFileSync(argIds.slice(6), 'utf8')) : {};
const idsViejos = {};
for (const clave of Object.keys(NUEVOS)) {
  idsViejos[clave] = process.env['STRIPE_PRICE_' + clave] || desdeArchivo[clave] || '';
}

const faltantes = Object.keys(idsViejos).filter((k) => !idsViejos[k]);
if (faltantes.length) {
  console.error('Sin el id del Price viejo no se sabe a qué Product agregarle el precio nuevo.');
  console.error('Faltan: ' + faltantes.map((f) => 'STRIPE_PRICE_' + f).join(', '));
  process.exit(1);
}

async function stripe(ruta, metodo = 'GET', cuerpo = null) {
  const res = await fetch('https://api.stripe.com/v1/' + ruta, {
    method: metodo,
    headers: {
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: cuerpo ? new URLSearchParams(cuerpo).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(ruta + ' → ' + (json.error?.message || res.status));
  return json;
}

const salida = {};
let creados = 0;

for (const [clave, def] of Object.entries(NUEVOS)) {
  const viejo = await stripe('prices/' + idsViejos[clave]);
  const producto = typeof viejo.product === 'string' ? viejo.product : viejo.product.id;
  const antes = (viejo.unit_amount / 100).toLocaleString('es-MX');
  const moneda = viejo.currency.toUpperCase();

  console.log(
    `${clave.padEnd(20)} ${moneda} ${antes.padStart(9)} → ${def.pesos.toLocaleString('es-MX').padStart(9)}` +
    `   (product ${producto})`
  );

  if (viejo.currency !== 'mxn') {
    console.log('   ⚠️  Este Price NO está en pesos. Los montos de este script son MXN — revísalo a mano.');
  }
  if (viejo.recurring?.interval !== def.intervalo) {
    console.log(`   ⚠️  El Price viejo cobra por "${viejo.recurring?.interval}" y aquí se asume "${def.intervalo}".`);
  }

  if (!APLICAR) { salida[clave] = '(simulacro)'; continue; }

  const nuevo = await stripe('prices', 'POST', {
    product: producto,
    currency: viejo.currency,
    unit_amount: String(def.pesos * 100),
    'recurring[interval]': def.intervalo,
    nickname: `${clave.toLowerCase()} · aumento 35% 2026-08-31`,
    'metadata[origen]': 'aumento-35-2026-08-31',
    'metadata[price_anterior]': idsViejos[clave],
  });
  salida[clave] = nuevo.id;
  creados++;
}

console.log('');
if (!APLICAR) {
  console.log('Simulacro: no se creó nada. Corre con --aplicar para crear los 8 Price.');
} else {
  console.log(`Creados ${creados} Price. Pega estas variables en Vercel (los 3 entornos):`);
  console.log('');
  for (const [clave, id] of Object.entries(salida)) console.log(`STRIPE_PRICE_${clave}=${id}`);
  console.log('');
  console.log('⚠️  El checkout sigue cobrando el precio VIEJO hasta que estas variables');
  console.log('   estén puestas y el sitio se vuelva a desplegar.');
}
