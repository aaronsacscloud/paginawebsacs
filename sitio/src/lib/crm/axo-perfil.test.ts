/**
 * Perfil del negocio que el CRM manda a AXO.
 * Correr:  node --experimental-strip-types src/lib/crm/axo-perfil.test.ts
 */
import { etapaDe, perfilDe } from './axo-perfil.ts';

let ok = 0; const fallas: string[] = [];
const es = (dado: unknown, esperado: unknown, porque: string) => {
  if (JSON.stringify(dado) === JSON.stringify(esperado)) { ok++; return; }
  fallas.push(`${porque}: esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(dado)}`);
};
const hoy = Date.parse('2026-10-26T15:00:00Z');

es(etapaDe({ estado_cuenta: 'trial' }, hoy), 'prueba', 'prueba gratis');
es(etapaDe({ estado_cuenta: 'activo', fecha_inicio: '2026-10-10' }, hoy), 'cliente_nuevo', 'menos de 30 días');
es(etapaDe({ estado_cuenta: 'activo', fecha_inicio: '2026-08-20' }, hoy), 'adopcion', 'entre 30 y 90 días');
es(etapaDe({ estado_cuenta: 'activo', fecha_inicio: '2025-10-01' }, hoy), 'estable', 'más de 90 días');
es(etapaDe({ estado_cuenta: 'activo', fecha_inicio: '2025-10-01', dias_sin_venta: 30 }, hoy), 'en_riesgo', 'sin vender 3 semanas');
es(etapaDe({ estado_cuenta: 'activo', fecha_inicio: '2026-10-20', dias_sin_venta: 40 }, hoy), 'cliente_nuevo', 'el arranque gana al riesgo');
es(etapaDe({ estado_cuenta: 'cancelado' }, hoy), 'baja', 'cancelado');
es(etapaDe({ estado_cuenta: 'vencido', propiedades: { plan_modalidad: 'vitalicio' } }, hoy), 'estable', 'vitalicia no vence');
es(etapaDe({ estado_cuenta: 'activo' }, hoy), 'estable', 'sin fecha de inicio');

es(perfilDe({
  giro: 'suplementos', sucursales: 1, plan: 'controla', estado_cuenta: 'activo', fecha_inicio: '2025-10-01',
  fecha_renovacion: '2027-04-11', dias_sin_venta: 17,
  propiedades: { industria: 'Salud', canal_venta: 'Menudeo', listas_precios: 0, sucursales_sacs: 2 },
}, hoy), {
  industria: 'Salud', giro: 'suplementos', canal_venta: 'Menudeo', listas_precios: 0, sucursales: 2, plan: 'controla',
  estado_cuenta: 'activo', etapa: 'estable', fecha_inicio: '2025-10-01', fecha_renovacion: '2027-04-11',
  dias_sin_venta: 17, soporte_estancado: false,
}, 'perfil completo');

if (fallas.length) { console.error(`✗ ${fallas.length} fallas\n  ` + fallas.join('\n  ')); process.exit(1); }
console.log(`✓ axo-perfil: ${ok} casos`);
