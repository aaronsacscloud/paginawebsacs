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
   elegido. En el teléfono, un carril de días que se desliza y las horas en
   rejilla de tres. Lo usan los
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
  /* En el teléfono cada hueco es un blanco de pulgar (44 px, 8 entre uno y
     otro): se pica con el cliente hablando, sin tiempo de apuntar. */
  /* En el teléfono, la opción de contenido de la cabina (guía §3.3, ronda 1):
     contorno lila, texto morado, radio 12, agua al elegirla. Era otra píldora
     gris distinta de «Cómo quedó». */
  const tira = (activo: boolean): React.CSSProperties => movil
    ? { border: '1.5px solid #9B8CFA', background: activo ? C.moradoAgua : '#fff', color: C.moradoTinta, borderRadius: 12, padding: '0 15px', minHeight: 44, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }
    : ({ border: `1.5px solid ${activo ? '#c9bcf7' : C.g200}`, background: activo ? C.moradoAgua : '#fff', color: activo ? C.moradoTinta : C.g900, borderRadius: 999, padding: movil ? '0 15px' : '5px 11px', ...(movil ? { minHeight: 44 } : null), fontSize: movil ? 14 : 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 });
  /* En el teléfono, REJILLAS y no tiras que se deslizan (23-sep-2026): de
     lado, el tercer día salía cortado en «s…» y nada decía que había más, y la
     última hora tocaba el borde. Los 7 días caben en dos renglones de cuatro
     —día arriba, cuántos huecos abajo— y las horas en columnas de tres: todo
     a la vista, sin buscar. En escritorio siguen envolviéndose como antes. */
  const fila: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
  /* Ronda 6: los días en UN carril con scroll-snap. En rejilla de cuatro el
     quinto día quedaba solo en un segundo renglón y empujaba las horas bajo la
     barra. Cada día mide 3.5 por pantalla: el medio día cortado a la derecha
     es lo que dice «hay más», y el snap evita que quede a medias al soltar. */
  const carrilDias: React.CSSProperties = { display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'calc((100% - 24px) / 3.5)', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'touch', paddingBottom: 2, scrollbarWidth: 'none' };
  const rejillaHoras: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 };
  // «Mañana», «Hoy» o «vie 25»: el mes sobra en una semana.
  const diaCelda = (f: string) => { const d = diaCorto(f); return /^(Hoy|Mañana)$/.test(d) ? d : d.replace(/ de .*$/, ''); };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {movil ? (
        <div className="wa-scroll" style={carrilDias}>
          {dias.map(f => {
            const n = huecos.filter(h => h.fecha === f).length;
            return (
              <button key={f} onClick={() => setDia(f)} aria-pressed={f === elegido} aria-label={`${diaCorto(f)}: ${n} ${n === 1 ? 'hueco' : 'huecos'}`}
                style={{ ...tira(f === elegido), borderRadius: 12, padding: '6px 2px', minWidth: 0, scrollSnapAlign: 'start', display: 'grid', justifyItems: 'center', gap: 1, lineHeight: 1.2 }}>
                <span style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{diaCelda(f)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: f === elegido ? C.moradoTinta : C.g500 }}>{n} {n === 1 ? 'libre' : 'libres'}</span>
              </button>
            );
          })}
        </div>
      ) : (
      <div className="wa-scroll" style={fila}>
        {dias.map(f => (
          <button key={f} onClick={() => setDia(f)} style={tira(f === elegido)}>
            {diaCorto(f)} <span style={{ fontWeight: 500, color: C.g500 }}>· {huecos.filter(h => h.fecha === f).length}</span>
          </button>
        ))}
      </div>
      )}
      <div className="wa-scroll" style={movil ? rejillaHoras : fila}>
        {horas.map(h => (
          <button key={`${h.fecha}-${h.hora}`} onClick={() => onElegir?.(h)} disabled={deshabilitado || !onElegir}
            style={{ ...tira(!!elegida && elegida.fecha === h.fecha && elegida.hora === h.hora), fontWeight: 800, cursor: onElegir ? 'pointer' : 'default', ...(movil ? { padding: '0 4px', minWidth: 0, whiteSpace: 'nowrap' } : null) }}>
            {texto || horaBonita(h.hora)}
          </button>
        ))}
      </div>
    </div>
  );
}

