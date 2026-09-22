// DÍA → HORA · el selector de horarios compartido por la cabina, la llamada
// manual y Acciones → Reunión del inbox (22-sep-2026).
import { useMemo, useState } from 'react';
import type React from 'react';
import { C } from './estilo';

/* ══ DÍA → HORA, HASTA 7 DÍAS (22-sep-2026) ════════════════════════════════
   Pedido del dueño: «cuando veo los horarios, dame la opción de ver más allá
   de 2 días: hay veces que el usuario quiere 3, 5, hasta 7 días después».
   Antes era una tira de los 8 primeros huecos — hoy y mañana, nada más. Ahora
   una fila de DÍAS (los 7 primeros con hueco) y debajo las HORAS del día
   elegido. En el teléfono las dos filas se deslizan de lado. Lo usan los
   horarios de la tarjeta y el «Ponerle una ahora» del cierre. */
/** «4:00 pm», como se dice por teléfono. */
export const horaBonita = (h: string) => {
  const [H, M] = String(h).slice(0, 5).split(':').map(Number);
  return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${H < 12 ? 'am' : 'pm'}`;
};
export const diaCorto = (f: string) => {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const man = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(Date.now() + 864e5));
  if (f === hoy) return 'Hoy';
  if (f === man) return 'Mañana';
  return new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
};
export default function SelectorHorarios({ huecos, onElegir, movil, deshabilitado, texto, elegida }: { huecos: { fecha: string; hora: string }[]; onElegir?: (h: { fecha: string; hora: string }) => void; elegida?: { fecha: string; hora: string } | null; movil?: boolean; deshabilitado?: boolean; texto?: string }) {
  const dias = useMemo(() => Array.from(new Set(huecos.map(h => h.fecha))).sort().slice(0, 7), [huecos]);
  const [dia, setDia] = useState<string>('');
  const elegido = dias.includes(dia) ? dia : dias[0] || '';
  const horas = huecos.filter(h => h.fecha === elegido);
  const tira = (activo: boolean): React.CSSProperties => ({ border: `1.5px solid ${activo ? '#c9bcf7' : C.g200}`, background: activo ? C.moradoAgua : '#fff', color: activo ? C.moradoTinta : C.g900, borderRadius: 999, padding: movil ? '8px 13px' : '5px 11px', fontSize: movil ? 13 : 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, scrollSnapAlign: 'start' });
  const fila: React.CSSProperties = movil ? { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x proximity' } : { display: 'flex', gap: 6, flexWrap: 'wrap' };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="wa-scroll" style={fila}>
        {dias.map(f => (
          <button key={f} onClick={() => setDia(f)} style={tira(f === elegido)}>
            {diaCorto(f)} <span style={{ fontWeight: 500, color: C.g500 }}>· {huecos.filter(h => h.fecha === f).length}</span>
          </button>
        ))}
      </div>
      <div className="wa-scroll" style={fila}>
        {horas.map(h => (
          <button key={`${h.fecha}-${h.hora}`} onClick={() => onElegir?.(h)} disabled={deshabilitado || !onElegir}
            style={{ ...tira(!!elegida && elegida.fecha === h.fecha && elegida.hora === h.hora), fontWeight: 800, cursor: onElegir ? 'pointer' : 'default' }}>
            {texto || horaBonita(h.hora)}
          </button>
        ))}
      </div>
    </div>
  );
}

