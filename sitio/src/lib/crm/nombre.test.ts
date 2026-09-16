/**
 * Con cuánto se saluda.
 *
 * Se ve en el PRIMER RENGLÓN de cada correo frío, y hay dos formas de quedar
 * mal: llamarle Juan a Juan Carlos, o saludar a un desconocido por su apellido
 * —"Buen día, Cielo Inzunza"—, que es lo que delata una base comprada.
 *
 * Los casos son nombres REALES de abm_personas.
 *
 * Correr:  node --experimental-strip-types src/lib/crm/nombre.test.ts
 */
import { nombrePila, nombreBonito } from './nombre.ts';

let ok = 0; const fallas: string[] = [];
const es = (dado: string, esperado: string, porque: string) => {
  if (dado === esperado) { ok++; return; }
  fallas.push(`${porque}\n      esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(dado)}`);
};

// El apellido nunca va en el saludo.
es(nombrePila('Cielo Inzunza'), 'Cielo', 'apellido simple');
es(nombrePila('Gerardo Dunand Spitalier'), 'Gerardo', 'dos apellidos');
es(nombrePila('Adriana Madrid'), 'Adriana', 'apellido que parece nombre de lugar');
es(nombrePila('Jack Haber'), 'Jack', 'nombre extranjero');

// Pero el compuesto se respeta: a Juan Carlos nadie le dice Juan.
es(nombrePila('Juan Carlos Medina Fernández'), 'Juan Carlos', 'compuesto + dos apellidos');
es(nombrePila('José Luis Zaga'), 'José Luis', 'compuesto clásico');
es(nombrePila('Luz María Robles'), 'Luz María', 'compuesto femenino');
es(nombrePila('Marco Antonio Miguel Ángel Zavala Martínez'), 'Marco Antonio', 'nombre larguísimo');

// Los que llevan partícula se arman enteros, o quedan en "María del".
es(nombrePila('María del Carmen Solís'), 'María del Carmen', 'partícula del');
es(nombrePila('Ana de la Luz Pérez'), 'Ana de la Luz', 'partícula de la');

// El tratamiento no es el nombre. Sin esto, "Don Pepe Castro" saludaba "Don".
es(nombrePila('Don Pepe Castro'), 'Pepe', 'don');
es(nombrePila('Lic. Marcela Ruiz'), 'Marcela', 'licenciada con punto');
es(nombrePila('Ing Juan Carlos Medina'), 'Juan Carlos', 'ingeniero sin punto, con compuesto');

// "Ma." abreviado se ve descuidado en un saludo.
es(nombrePila('Ma. Guadalupe Ríos'), 'María Guadalupe', 'Ma. abreviada');

// Sin nombre no se saluda por nombre: el [[si persona]] borra la frase entera.
es(nombrePila(''), '', 'vacío');
es(nombrePila(null), '', 'nulo');
es(nombrePila('   '), '', 'puros espacios');
es(nombrePila('Oscar'), 'Oscar', 'una sola palabra');

// ── nombreBonito: el nombre del negocio como se escribe en el correo ────────
// Los casos salieron de los 3,205 nombres reales de cuentas contactables, no
// de la imaginación: 1,180 cambian al pasar por aquí.

// Gritar es lo más común: 589 cuentas vienen en mayúsculas desde Maps.
es(nombreBonito('ALMACENES SILVON'), 'Almacenes Silvon', 'todo en mayúsculas');
es(nombreBonito('GRUPO COLOSO'), 'Grupo Coloso', 'dos palabras gritando');
es(nombreBonito('TANAT CONTADORES Y ABOGADOS'), 'Tanat Contadores y Abogados', 'la «y» va en minúscula');

// La sigla se distingue por NO TENER VOCAL, no por ser corta. Con la regla de
// «tres letras o menos» salía «Cute AND JOY», peor que el problema original.
es(nombreBonito('GRUPO JYV'), 'Grupo JYV', 'sin vocal sí es sigla');
es(nombreBonito('CUTE AND JOY'), 'Cute And Joy', 'AND y JOY tienen vocal');
es(nombreBonito('JADE YAZ'), 'Jade Yaz', 'YAZ tampoco es sigla');

// La forma legal es de oficio de banco, no de un correo en frío.
es(nombreBonito('TEXTILES OPERTEL S.A DE C.V'), 'Textiles Opertel', 'sociedad anónima sin puntos');
es(nombreBonito('VIA CATTINI, S.A. DE C.V.'), 'Via Cattini', 'con coma y con puntos');

// La ficha de Maps a veces lista todas las marcas que maneja el negocio.
es(nombreBonito('AGORSS / DEEZER / MONACO / ESTUDIO S / DEFAY /'), 'Agorss', 'lista de marcas: la primera');
es(nombreBonito('Alquiler de Smoking / Trajes Mickey'), 'Alquiler de Smoking / Trajes Mickey',
   'UNA diagonal NO es una lista: cortar aquí perdería media razón social');

// Lo que la primera versión rompía, encontrado por la revisión adversarial
// corriendo la función contra los 32,069 nombres reales de la base.
es(nombreBonito("D'LUNA"), "D'Luna", 'apóstrofo: salía «D\'luna» por tomar charAt(0) a ciegas');
es(nombreBonito('H.POLO CLUB'), 'H.Polo Club', 'punto dentro de la palabra');
es(nombreBonito('¡PLAYERAS CON STILO!'), '¡Playeras con Stilo!', 'empieza con signo, no con letra');
es(nombreBonito('"SAN JORGE UNIFORMES"'), '"San Jorge Uniformes"', 'entre comillas');
es(nombreBonito('2MORROW'), '2Morrow', 'empieza con dígito');
es(nombreBonito('Grupo Ultra (Ultrafemme / Ultrajewels / Luxury Avenue)'),
   'Grupo Ultra (Ultrafemme / Ultrajewels / Luxury Avenue)',
   'dos diagonales DENTRO de un paréntesis: cortar dejaba el paréntesis abierto');
es(nombreBonito("PATRICH'S (venta de trajes, vestidos de novia)"),
   "PATRICH'S (venta de trajes, vestidos de novia)",
   'mixto: `.every` sobre arreglo vacío lo daba por grito y lo re-capitalizaba');
es(nombreBonito('Sombrerería -El Vaquero-'), 'Sombrerería -El Vaquero-', 'el guion de cierre tiene pareja');

// Y lo que ya está bien no se toca.
es(nombreBonito('Boutique Marisol'), 'Boutique Marisol', 'bien escrito se queda igual');
es(nombreBonito('  Doble   espacio  '), 'Doble espacio', 'espacios de más');
es(nombreBonito(''), '', 'vacío');
es(nombreBonito(null), '', 'nulo');

if (fallas.length) {
  console.error(`\n✗ ${fallas.length} fallas de ${ok + fallas.length}\n`);
  for (const f of fallas) console.error('  · ' + f);
  process.exit(1);
}
console.log(`✓ nombre: ${ok} casos (saludo + nombre del negocio)`);
