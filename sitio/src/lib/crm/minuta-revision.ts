// La REVISIÓN del cliente sobre una minuta de consultoría: «de acuerdo» por
// acuerdo y la firma de autorización (12-oct-2026).
//
// Misma bitácora que los reportes (ver reporte-revision.ts), en `activities`
// con metadata.booking_id: guarda la hora de cada cosa, sale en la Actividad de
// la cuenta y no depende de columnas nuevas en `bookings`.
import { supabase } from '../supabase';
import { armar, type Revision } from './reporte-revision';

export const EVM = { revisado: 'minuta_revisado', firma: 'minuta_firma' } as const;
export const LEYENDA_MINUTA = {
  titulo: 'Autorización del cliente',
  frase: 'Estoy de acuerdo con lo que se revisó en esta reunión y autorizo lo acordado.',
};

export async function leerRevisionMinuta(bookingId: string): Promise<Revision> {
  const { data } = await supabase.from('activities')
    .select('tipo, created_at, metadata')
    .in('tipo', [EVM.revisado, EVM.firma]).eq('metadata->>booking_id', bookingId)
    .order('created_at', { ascending: true }).limit(1000);
  // armar() habla el idioma de los reportes: se traduce el tipo y listo.
  return armar((data || []).map((e: any) => ({ ...e, tipo: e.tipo === EVM.firma ? 'reporte_firma' : 'reporte_revisado' })));
}

export async function registrarMinuta(o: { tipo: string; bookingId: string; companyId: string | null; titulo: string; metadata: Record<string, any> }) {
  return supabase.from('activities').insert({
    company_id: o.companyId, tipo: o.tipo, titulo: o.titulo, automatico: true,
    metadata: { booking_id: o.bookingId, at: new Date().toISOString(), ...o.metadata },
  });
}
