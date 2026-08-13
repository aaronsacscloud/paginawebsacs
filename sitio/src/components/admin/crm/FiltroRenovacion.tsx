// Filtro por periodo de renovación.
//
// Un <select> de una sola opción no puede expresar "del 1 de agosto al 30 de
// septiembre", así que este trae atajos para lo de siempre y un rango libre
// para lo demás. Se ve y se comporta como los otros filtros de la barra: mismo
// alto, mismo lila cuando está puesto.
//
// Filtra por la PRÓXIMA FACTURA de la suscripción, no por la fecha de contrato:
// es la que contesta "¿a quién le toca pagar en este periodo?".
import { useEffect, useRef, useState } from 'react';

export type RangoRenov = { desde: string; hasta: string; etiqueta: string } | null;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const hoy = () => new Date();
const masDias = (n: number) => { const d = hoy(); d.setDate(d.getDate() + n); return d; };
const finDeMes = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const bonita = (s: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '';

export default function FiltroRenovacion({ valor, onCambio }: { valor: RangoRenov; onCambio: (v: RangoRenov) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(valor?.desde || iso(hoy()));
  const [hasta, setHasta] = useState(valor?.hasta || iso(finDeMes(hoy())));
  const caja = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('mousedown', fuera); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', esc); };
  }, [abierto]);

  const atajos: { l: string; r: () => RangoRenov }[] = [
    { l: 'Este mes', r: () => ({ desde: iso(new Date(hoy().getFullYear(), hoy().getMonth(), 1)), hasta: iso(finDeMes(hoy())), etiqueta: 'este mes' }) },
    { l: 'Próximos 30 días', r: () => ({ desde: iso(hoy()), hasta: iso(masDias(30)), etiqueta: '30 días' }) },
    { l: 'Próximos 60 días', r: () => ({ desde: iso(hoy()), hasta: iso(masDias(60)), etiqueta: '60 días' }) },
    { l: 'Próximos 90 días', r: () => ({ desde: iso(hoy()), hasta: iso(masDias(90)), etiqueta: '90 días' }) },
    // Sin fecha inicial: una renovación de hace ocho meses sigue vencida.
    { l: 'Ya vencidas', r: () => ({ desde: '1900-01-01', hasta: iso(masDias(-1)), etiqueta: 'vencidas' }) },
  ];

  const activo = !!valor;
  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setAbierto(a => !a)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', borderRadius: 9,
          cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: activo ? 700 : 600,
          border: '1px solid', borderColor: activo || abierto ? '#c9bcf7' : '#e2e4e9',
          background: activo || abierto ? '#f7f4ff' : '#fff', color: activo ? '#5B4BD6' : '#555',
        }}>
        <span>Renovación</span>
        {valor && <span style={{ color: '#7a6fc9', fontWeight: 600 }}>{valor.etiqueta}</span>}
        <span style={{ color: activo ? '#9B8CFA' : '#b3afbd', fontSize: '0.6rem' }}>▾</span>
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, width: 268,
          background: 'rgba(250,248,255,0.96)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid #e6ddfa', borderRadius: 12, boxShadow: '0 14px 34px rgba(91,75,214,0.16)', padding: 6,
        }}>
          {atajos.map(a => (
            <button key={a.l} type="button" onClick={() => { onCambio(a.r()); setAbierto(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 500, color: '#3f3b4d', cursor: 'pointer' }}>
              {a.l}
            </button>
          ))}
          <div style={{ height: 1, background: '#e9e2fa', margin: '6px 5px' }} />
          <div style={{ padding: '2px 10px 8px' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Periodo exacto</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                style={{ flex: 1, minWidth: 0, border: '1px solid #ddd6fb', borderRadius: 7, padding: '6px 7px', fontSize: '0.72rem', background: '#fff', fontFamily: 'inherit' }} />
              <span style={{ color: '#a5a2af', fontSize: '0.7rem' }}>a</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                style={{ flex: 1, minWidth: 0, border: '1px solid #ddd6fb', borderRadius: 7, padding: '6px 7px', fontSize: '0.72rem', background: '#fff', fontFamily: 'inherit' }} />
            </div>
            <button type="button"
              onClick={() => {
                if (!desde || !hasta) return;
                // Al revés se aplica igual en vez de no devolver nada: teclear
                // las fechas en otro orden es un descuido, no una intención.
                const [d, h] = desde <= hasta ? [desde, hasta] : [hasta, desde];
                onCambio({ desde: d, hasta: h, etiqueta: `${bonita(d)} – ${bonita(h)}` });
                setAbierto(false);
              }}
              style={{ width: '100%', marginTop: 8, border: 'none', borderRadius: 8, padding: '8px 10px', background: '#9B8CFA', color: '#fff', fontSize: '0.77rem', fontWeight: 700, cursor: 'pointer' }}>
              Aplicar periodo
            </button>
          </div>
          {valor && (
            <button type="button" onClick={() => { onCambio(null); setAbierto(false); }}
              style={{ display: 'block', width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: '0.74rem', fontWeight: 700, color: '#7a6fc9', cursor: 'pointer' }}>
              Quitar el filtro
            </button>
          )}
        </div>
      )}
    </div>
  );
}
