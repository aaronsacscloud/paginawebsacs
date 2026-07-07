// Accesos rápidos (presets) de extras para el editor del Partner.
// OJO: NO es una whitelist — los extras libres (nombre/precio custom: hardware,
// consultoría, etc.) SÍ están permitidos en backend (ver permissions.ts). Lo único
// fijado al catálogo son los PLANES/licencias (isPartnerAllowedPlan), para proteger
// el margen. Esta lista solo prellena botones "+ …" para agilizar los extras comunes.

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
  {
    nombre: 'Hardware / Equipo',
    precio_default: 0,
    periodo_extra: 'unico',
    recurrente: false,
    descripcion: 'Terminal, lector de barras, impresora, tablet u otro equipo (pago único)',
  },
  {
    nombre: 'Consultoría',
    precio_default: 0,
    periodo_extra: 'unico',
    recurrente: false,
    descripcion: 'Asesoría o servicio profesional a la medida',
  },
];

export function isPartnerAllowedExtra(nombre: string): boolean {
  return PARTNER_EXTRAS_CATALOG.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase());
}

export function isPartnerAllowedPlan(nombre: string): boolean {
  return Object.keys(PLAN_PRICES).includes(String(nombre || '').toLowerCase());
}
