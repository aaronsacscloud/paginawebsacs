// Contrato de los datos fiscales.
//
// Estas reglas deciden si un cobro se puede facturar después. Un RFC que pasa
// aquí y el SAT rechaza se descubre semanas más tarde, con el cliente pidiendo
// su factura, así que las formas válidas e inválidas quedan fijadas.
import assert from 'node:assert';
import { RFC_OK, REGIMENES, faltantes, faltanFiscales, textoFaltantes, validarFiscales } from './fiscal.ts';

let n = 0;
const t = (nombre: string, fn: () => void) => { fn(); n++; console.log('  ✓', nombre); };

const COMPLETO = { razon_social: 'Dibujo Técnico SA de CV', rfc: 'DIT010101AB1', cp_fiscal: '82000', regimen_fiscal: REGIMENES[0] };

console.log('\nRFC');
t('acepta moral (12) y física (13)', () => {
  assert.ok(RFC_OK.test('DIT010101AB1'), 'moral de 12');
  assert.ok(RFC_OK.test('GODE561231GR8'), 'física de 13');
  assert.ok(RFC_OK.test('XAXX010101000'), 'el genérico del SAT');
});
t('rechaza lo que no tiene forma de RFC', () => {
  for (const malo of ['', 'DIT', 'DIT01', 'DITO10101AB1', '123456789012', 'DIT010101AB', 'DIT010101AB12'])
    assert.ok(!RFC_OK.test(malo), `debería rechazar «${malo}»`);
});

console.log('\nfaltantes');
t('sin datos faltan los cuatro', () => {
  assert.equal(faltantes(null).length, 4);
  assert.equal(faltantes({}).length, 4);
});
t('completo no falta ninguno', () => {
  assert.deepEqual(faltantes(COMPLETO), []);
  assert.equal(faltanFiscales(COMPLETO), false);
});
t('un campo en blanco o con puros espacios cuenta como faltante', () => {
  assert.deepEqual(faltantes({ ...COMPLETO, cp_fiscal: '' }), ['cp_fiscal']);
  assert.deepEqual(faltantes({ ...COMPLETO, rfc: '   ' }), ['rfc']);
});
t('la constancia NO es obligatoria: exigirla frenaría el cobro', () => {
  assert.equal(faltanFiscales({ ...COMPLETO, constancia_fiscal_url: null }), false);
});
t('el texto se lee como frase, no como lista de campos', () => {
  assert.equal(textoFaltantes({ ...COMPLETO, rfc: '' }), 'Falta el RFC');
  assert.equal(textoFaltantes({ ...COMPLETO, rfc: '', cp_fiscal: '' }), 'Faltan el RFC y el código postal');
  assert.equal(textoFaltantes(COMPLETO), '');
});

console.log('\nvalidarFiscales');
t('normaliza el RFC a mayúsculas y recorta espacios', () => {
  const r = validarFiscales({ ...COMPLETO, rfc: '  dit010101ab1 ', razon_social: '  Dibujo Técnico SA de CV  ' });
  assert.ok(r.ok);
  assert.equal((r as any).datos.rfc, 'DIT010101AB1');
  assert.equal((r as any).datos.razon_social, 'Dibujo Técnico SA de CV');
});
t('el CP son exactamente 5 dígitos', () => {
  for (const cp of ['8200', '820000', '8200a', '']) {
    const r = validarFiscales({ ...COMPLETO, cp_fiscal: cp });
    assert.equal(r.ok, false, `debería rechazar CP «${cp}»`);
    assert.equal((r as any).campo, 'cp_fiscal');
  }
  assert.ok(validarFiscales({ ...COMPLETO, cp_fiscal: '82000' }).ok);
});
t('avisa del PRIMER problema en el orden de la pantalla, no del último', () => {
  const r = validarFiscales({ razon_social: '', rfc: 'malo', cp_fiscal: '', regimen_fiscal: '' });
  assert.equal((r as any).campo, 'razon_social', 'con todo mal, manda al primero');
});
t('el régimen es obligatorio aunque lo demás esté bien', () => {
  const r = validarFiscales({ ...COMPLETO, regimen_fiscal: '' });
  assert.equal(r.ok, false);
  assert.equal((r as any).campo, 'regimen_fiscal');
});
t('los cuatro válidos pasan', () => {
  const r = validarFiscales(COMPLETO);
  assert.ok(r.ok);
  assert.deepEqual((r as any).datos, { rfc: 'DIT010101AB1', razon_social: 'Dibujo Técnico SA de CV', cp_fiscal: '82000', regimen_fiscal: REGIMENES[0] });
});

console.log(`\n${n} contratos de datos fiscales ✓\n`);
