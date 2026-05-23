// Whitelist de items que un Partner puede agregar a una cotización.
// Cualquier item fuera de esta lista se rechaza en backend (anti revenue-leak).

import { PLAN_PRICES, IMPL_PRICES } from './constants';

export interface PartnerExtraDef {
  nombre: string;
  precio_default: number;
  periodo_extra: 'unico' | 'mensual' | 'anual';
  recurrente: boolean;
  descripcion?: string;
}

export const PARTNER_EXTRAS_CATALOG: PartnerExtraDef[] = [
  {
    nombre: 'Implementación',
    precio_default: IMPL_PRICES.controla, // 4000 MXN base
    periodo_extra: 'unico',
    recurrente: false,
    descripcion: 'Setup inicial: catálogo, sucursales, capacitación básica',
  },
  {
    nombre: 'Capacitación adicional',
    precio_default: 1500,
    periodo_extra: 'unico',
    recurrente: false,
    descripcion: 'Sesión extra de capacitación (hasta 2 horas)',
  },
  {
    nombre: 'Migración de datos',
    precio_default: 3500,
    periodo_extra: 'unico',
    recurrente: false,
    descripcion: 'Importación de productos / clientes desde sistema previo',
  },
  {
    nombre: 'Hora de soporte premium',
    precio_default: 800,
    periodo_extra: 'unico',
    recurrente: false,
    descripcion: 'Bloque de 1 hora de soporte 1:1 con consultor SACS',
  },
  {
    nombre: 'Consultor dedicado',
    precio_default: 4500,
    periodo_extra: 'mensual',
    recurrente: true,
    descripcion: 'Consultor SACS asignado mensualmente',
  },
];

export function isPartnerAllowedExtra(nombre: string): boolean {
  return PARTNER_EXTRAS_CATALOG.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase());
}

export function isPartnerAllowedPlan(nombre: string): boolean {
  return Object.keys(PLAN_PRICES).includes(String(nombre || '').toLowerCase());
}
