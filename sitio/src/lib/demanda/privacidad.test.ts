/**
 * Ninguna señal del motor de demanda puede guardar un dato de contacto.
 *
 * Importa más de lo que parece: estos textos salen de conversaciones reales de
 * clientes, se mandan a un modelo para entenderlos y de ahí sale el contenido
 * que se publica. Si un correo o un teléfono cruza la primera puerta, ya no hay
 * dónde pararlo.
 *
 * Los casos son textos REALES que llegaron por WhatsApp (con los datos
 * cambiados). El tercero es el que se coló de verdad el 15-sep-2026: el
 * anonimizador exigía separadores y un número escrito de corrido pasaba entero.
 *
 * Correr:  node --experimental-strip-types src/lib/demanda/privacidad.test.ts
 */
import { redactPII } from '../ai/redact.ts';

let ok = 0; const fallas: string[] = [];

const noDebeQuedar = (texto: string, patron: RegExp, porque: string) => {
  const limpio = redactPII(texto).text;
  if (!patron.test(limpio)) { ok++; return; }
  fallas.push(`${porque}\n      quedó: ${JSON.stringify(limpio.slice(0, 120))}`);
};
const debeConservar = (texto: string, trozo: string, porque: string) => {
  const limpio = redactPII(texto).text;
  if (limpio.includes(trozo)) { ok++; return; }
  fallas.push(`${porque}\n      se perdió ${JSON.stringify(trozo)} en ${JSON.stringify(limpio.slice(0, 120))}`);
};

const CORREO = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const TEL = /\b\d{10}\b|\d{3}[ .-]\d{3}[ .-]\d{4}/;

// ── Contacto: nada de esto sobrevive ────────────────────────────────────────
noDebeQuedar('Mándame la info a ventas@boutiquelaura.com porfa', CORREO, 'correo suelto');
noDebeQuedar('Mi WhatsApp es 55 4778 0632', TEL, 'teléfono con espacios');
noDebeQuedar('Número de WhatsApp: 5547780632', TEL, 'teléfono DE CORRIDO (el que se coló en producción)');
noDebeQuedar('llámame al +52 477 163 6222', TEL, 'teléfono con lada internacional');
noDebeQuedar('Contacto 7714041226 para la demo', TEL, 'teléfono en medio de una frase');
noDebeQuedar('mi RFC es GODE561231GR8 para la factura', /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i, 'RFC');

// ── Pero el NEGOCIO tiene que seguir entendiéndose ──────────────────────────
// Si la limpieza se come las cifras del ramo, la señal deja de servir: son
// justamente el dato que dice a qué tamaño de negocio le duele el problema.
debeConservar('Tengo 3 sucursales y 1200 modelos en catálogo', '3 sucursales', 'número de sucursales');
debeConservar('Tengo 3 sucursales y 1200 modelos en catálogo', '1200 modelos', 'tamaño del catálogo');
debeConservar('¿Cómo controlo tallas y colores en 2 tiendas?', 'tallas y colores', 'el problema en sí');
debeConservar('vendo como 450 pares al mes', '450 pares', 'volumen de venta');
debeConservar('facturo 180000 al mes', '180000', 'facturación (6 dígitos, no es teléfono)');

if (fallas.length) {
  console.error(`\n❌ ${fallas.length} fallas de privacidad:\n`);
  for (const f of fallas) console.error(`   · ${f}\n`);
  process.exit(1);
}
console.log(`✓ privacidad de las señales: ${ok} casos`);
