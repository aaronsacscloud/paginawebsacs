// MOTOR DE DEMANDA · piezas compartidas de sus pantallas.
//
// Mismo idioma visual que el resto del CRM: paleta de lib/crm/paleta, marco de
// lib/crm/layout, tarjetas blancas con franja. Aquí solo vive lo que este
// módulo repite en más de una pantalla.
import type { ReactNode } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';

/** Los cuatro estados de riesgo tienen color propio y NO son el color de la
 *  sección: en el CRM el color de un dato significa algo (verde entró dinero,
 *  ámbar urge) y eso no se negocia por estética. */
export const TONO_RIESGO: Record<string, { fondo: string; tinta: string }> = {
  LOW:      { fondo: P.verdeAgua,  tinta: P.verdeTinta },
  MEDIUM:   { fondo: P.ambarAgua,  tinta: P.ambarTinta },
  HIGH:     { fondo: P.rosaAgua,   tinta: P.rosaTinta },
  CRITICAL: { fondo: P.rojoAgua,   tinta: P.rojoTinta },
};

export const TONO_ESTADO: Record<string, { fondo: string; tinta: string; label: string }> = {
  pendiente:           { fondo: P.lineaSuave,  tinta: P.suave,       label: 'esperando turno' },
  lista:               { fondo: P.azulAgua,    tinta: P.azulTinta,   label: 'lista' },
  corriendo:           { fondo: P.violetaAgua, tinta: P.violetaHondo, label: 'corriendo' },
  terminada:           { fondo: P.verdeAgua,   tinta: P.verdeTinta,  label: 'hecha' },
  fallida:             { fondo: P.ambarAgua,   tinta: P.ambarTinta,  label: 'reintentando' },
  muerta:              { fondo: P.rojoAgua,    tinta: P.rojoTinta,   label: 'se rindió' },
  necesita_aprobacion: { fondo: P.ambarAgua,   tinta: P.ambarTinta,  label: 'espera tu OK' },
  aprobada:            { fondo: P.azulAgua,    tinta: P.azulTinta,   label: 'aprobada' },
  rechazada:           { fondo: P.lineaSuave,  tinta: P.suave,       label: 'rechazada' },
  para_operador:       { fondo: P.violetaAgua, tinta: P.violetaHondo, label: 'para el operador' },
  cancelada:           { fondo: P.lineaSuave,  tinta: P.gris,        label: 'cancelada' },
};

export function Pastilla({ tono, children }: { tono: { fondo: string; tinta: string }; children: ReactNode }) {
  return (
    <span style={{
      background: tono.fondo, color: tono.tinta, borderRadius: 5,
      padding: '2px 8px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
      letterSpacing: '.01em', display: 'inline-block',
    }}>{children}</span>
  );
}

export function Kpi({ franja, titulo, valor, pie }: { franja?: string; titulo: string; valor: ReactNode; pie?: ReactNode }) {
  return (
    <div style={tarjetaKpi(franja || P.violeta)}>
      <div style={{ fontSize: 11.5, color: P.tenue, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: P.tinta, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {pie ? <div style={{ fontSize: 12.5, color: P.suave, marginTop: 3 }}>{pie}</div> : null}
    </div>
  );
}

export function Seccion({ titulo, aparte, children }: { titulo: string; aparte?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15.5, color: P.tinta, fontWeight: 700 }}>{titulo}</h3>
        {aparte}
      </div>
      {children}
    </section>
  );
}

export function Tarjeta({ franja, children, style }: { franja?: string; children: ReactNode; style?: any }) {
  return <div style={{ ...tarjetaKpi(franja || P.violeta), padding: '14px 16px', ...(style || {}) }}>{children}</div>;
}

export const btn = (primario = false) => ({
  border: `1px solid ${primario ? P.violetaTinta : P.linea}`,
  background: primario ? P.violetaTinta : P.papel,
  color: primario ? '#fff' : P.texto,
  borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', minHeight: 38,
});

/** Hace legible un momento sin traer una librería de fechas por tres usos. */
export function haceRato(iso?: string | null): string {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
