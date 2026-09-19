import { valoresPlantilla, CAMPOS, campoDe, ES_LIBRE, nombreVariable } from './variables-plantilla.ts';
let ok = 0; const f = [];
const es = (a, e, q) => { if (JSON.stringify(a) === JSON.stringify(e)) ok++; else f.push(`${q}\n  esperaba ${JSON.stringify(e)}\n  obtuvo   ${JSON.stringify(a)}`); };
const c = { nombre: 'María López', empresa: 'Boutique Lily', giro: 'zapatería', sucursales: 3, email: 'maria@lily.com', ciudad: 'León' };

es(valoresPlantilla(c, ['primer_nombre', 'empresa'], 2), { ok: true, valores: ['María', 'Boutique Lily'] }, 'nombre y marca');
es(valoresPlantilla(c, ['sucursales'], 1), { ok: true, valores: ['tres tiendas'] }, 'sucursales en palabras');
// El bug que se arregló: «email» existía en la pantalla y no en el motor.
es(valoresPlantilla(c, ['email'], 1).ok, true, 'los campos de la pantalla los entiende el motor');
es(valoresPlantilla({}, ['primer_nombre'], 1), { ok: true, valores: ['👋'] }, 'sin nombre se saluda igual');
es(valoresPlantilla({}, ['giro'], 1), { ok: false, falta: 'Giro' }, 'sin el dato NO se manda, y se dice cuál falta con su nombre');
es(valoresPlantilla(c, ['libre:Promoción del mes'], 1), { ok: false, falta: 'Promoción del mes' }, 'un campo abierto no lo puede resolver una cadencia');
es(ES_LIBRE('libre:X'), true, 'reconoce el campo abierto');
es(nombreVariable('libre:Promoción del mes', 2), 'Promoción del mes', 'el campo abierto se llama por su nombre');
es(nombreVariable('empresa', 0), 'Marca / tienda', 'el campo del CRM también');
es(nombreVariable('', 2), 'Variable {{3}}', 'y sin mapa, el número');
es(CAMPOS.every(x => x.ejemplo && x.etiqueta && x.grupo), true, 'todos los campos traen ejemplo, etiqueta y grupo (Meta exige el ejemplo)');
es(campoDe('mrr').leer({ mrr: 1890 }), '$1,890', 'el MRR sale con formato');

if (f.length) { console.error(`\n❌ ${f.length} fallas de ${ok + f.length}:\n\n${f.join('\n\n')}\n`); process.exit(1); }
console.log(`✅ ${ok} pruebas de las variables de plantilla`);
