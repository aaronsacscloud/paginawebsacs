// LEADS QUE SE MOVIERON — el contador de Inicio y la lista que abre.
//
// Un solo componente para teléfono y escritorio, porque el criterio de qué
// cuenta como "actividad" es una regla de negocio y tenerla escrita dos veces
// termina en dos números distintos en dos pantallas. Lo que cambia por
// dispositivo es el envase (hoja que sube vs. tarjeta del tablero), no el dato.
//
// La lista contesta, por renglón, lo que hace falta para decidir a quién
// llamar: quién es y de qué empresa · en qué ciclo de vida está · en qué etapa
// va · QUÉ hizo y CUÁNDO. Y separa lo que hizo el lead de lo que hicimos
// nosotros: son dos cosas distintas y solo la primera es motivo para marcar.
import { useEffect, useState } from 'react';
import { swrGet } from '../../../lib/crm/swr';

export type LeadActivo = {
  id: string; nombre: string; empresa: string | null; whatsapp: string | null;
  ciclo: string | null; etapa: string | null; senales: number;
  ultima: { tipo: string; de: 'lead' | 'nosotros'; que: string; detalle: string | null; cuando: string } | null;
};

export function useLeadsActivos(dias = 7) {
  const [datos, setDatos] = useState<{ total: number; con_senal: number; leads: LeadActivo[] } | null>(null);
  useEffect(() => {
    swrGet(`/api/crm/reports/leads-activos?dias=${dias}`, (j: any) => {
      if (j?.error || !Array.isArray(j?.leads)) return;   // un 504 no debe vaciar la lista
      setDatos({ total: j.total || 0, con_senal: j.con_senal || 0, leads: j.leads });
    }).catch(() => {});
  }, [dias]);
  return datos;
}

const CICLO: Record<string, string> = {
  lead: 'Lead', lead_calificado: 'Calificado', oportunidad: 'Oportunidad',
  rezagado: 'Rezagado', cliente: 'Cliente', churned: 'Baja', descalificado: 'Descalificado',
};

/** «hace 2 h», «ayer», «hace 3 d». En una lista de esta semana, la fecha exacta no dice nada. */
export function haceCuanto(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} d`;
}

export function ListaLeadsActivos({ leads, onAbrir, movil }: {
  leads: LeadActivo[];
  onAbrir?: (l: LeadActivo) => void;
  movil?: boolean;
}) {
  if (!leads.length) {
    return (
      <div style={{ padding: '28px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#241d43' }}>Nadie se movió esta semana</div>
        <div style={{ fontSize: 12.5, color: '#6b6875', marginTop: 5, lineHeight: 1.5 }}>
          Ni visitas al sitio, ni respuestas, ni cotizaciones abiertas. Es buen momento para escribirle a los rezagados.
        </div>
      </div>
    );
  }
  return (
    <div>
      {leads.map(l => {
        const suyo = l.ultima?.de === 'lead';
        return (
          <button key={l.id} onClick={() => onAbrir?.(l)}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none',
              cursor: onAbrir ? 'pointer' : 'default', fontFamily: 'inherit',
              padding: movil ? '13px 16px' : '11px 14px', borderBottom: '1px solid #f1f0f5' }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <b style={{ fontSize: movil ? 15 : 13.5, color: '#241d43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</b>
              {l.empresa && <span style={{ fontSize: 12, color: '#8b8896', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{l.empresa}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#8b8896', flexShrink: 0 }}>{l.ultima ? haceCuanto(l.ultima.cuando) : ''}</span>
            </span>

            {/* Ciclo y etapa. La etapa solo si existe: hoy la mayoría de los
                contactos la tienen vacía y un «—» en cada renglón es ruido. */}
            <span style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.02em', background: '#EEF2FF', color: '#4338CA', borderRadius: 999, padding: '2px 8px' }}>
                {CICLO[l.ciclo || ''] || l.ciclo || 'Sin ciclo'}
              </span>
              {/* El gris NO es #F3F4F6 a propósito. Hay un barrido global de modo
                  oscuro que caza ese valor exacto por cadena de estilo y lo
                  invierte; como esta hoja se queda clara, el chip salía negro
                  sobre blanco — la misma pantalla en dos colores de siempre.
                  Un tono vecino se ve igual y no cae en la trampa. */}
              {l.etapa && (
                <span style={{ fontSize: 10.5, fontWeight: 800, background: '#EEEEF3', color: '#4b5563', borderRadius: 999, padding: '2px 8px', textTransform: 'capitalize' }}>{l.etapa}</span>
              )}
              {/* Varias señales en la misma semana es otra historia que una
                  sola: el que entró tres veces al sitio está caliente. */}
              {l.senales > 1 && (
                <span style={{ fontSize: 10.5, fontWeight: 800, background: '#FEF3C7', color: '#92400E', borderRadius: 999, padding: '2px 8px' }}>{l.senales} señales</span>
              )}
            </span>

            {/* QUÉ pasó. El punto de color dice de quién fue sin gastar
                palabras: morado = lo hizo el lead (motivo para llamar),
                gris = lo hicimos nosotros (contexto). */}
            {l.ultima && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: suyo ? '#5B4BD6' : '#c9c7d2', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: suyo ? '#241d43' : '#6b6875', fontWeight: suyo ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.ultima.que}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
