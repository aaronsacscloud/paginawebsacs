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
import { nombrePila } from './nombre.ts';

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

if (fallas.length) {
  console.error(`\n✗ ${fallas.length} fallas de ${ok + fallas.length}\n`);
  for (const f of fallas) console.error('  · ' + f);
  process.exit(1);
}
console.log(`✓ nombre-pila: ${ok} casos`);
