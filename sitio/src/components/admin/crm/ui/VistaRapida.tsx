// ══ VISTA RÁPIDA — UNA HOJA, DOS ALTURAS (mock aprobado) ══
// Nivel 1 «peek»: nombre + UN número héroe + ≤3 acciones + ≤3 datos.
// Nivel 2 «full»: la MISMA hoja sube a 94dvh y adentro se monta la ficha
// completa (`ficha`). No hay pantalla nueva, no se desmonta nada y el tema
// se hereda: por eso `ficha` va envuelta en .hoja-ficha, que el dark repinta.
//
// Gestos: en peek ↓ cierra y ↑ expande; en full ↓ REGRESA a peek (un paso
// atrás, nunca un salto a la lista). El botón atrás del teléfono hace lo
// mismo gracias a los dos useDrawerHistory apilados.
//
// Si una pantalla todavía no tiene `ficha`, «Ver todo» cae en `onVerTodo`
// (comportamiento viejo). Así se migra pantalla por pantalla sin romper.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDrawerHistory } from '../../../../lib/ui/mobile';

export type VRAccion = { label: string; primaria?: boolean; onClick?: () => void; href?: string };
export type VRClave = { k: string; v: ReactNode; tono?: 'verde' | 'rojo' | 'ambar' };
const TONO: Record<string, string> = { verde: '#1E8A63', rojo: '#C0554E', ambar: '#a06600', morado: '#5B4BD6' };
/** +527773041399 → +52 777 304 1399 (solo presentación) */
export const telBonito = (t?: string | null) => {
  const d = String(t || '').replace(/\D/g, '');
  if (!d) return t || '—';
  const m = d.match(/^(52)?1?(\d{3})(\d{3})(\d{4})$/);
  return m ? `+52 ${m[2]} ${m[3]} ${m[4]}` : (t || '—');
};

/** Esqueleto de la ficha: va sobre la superficie de la hoja, nunca en blanco.
 *  Es el `fallback` de los Suspense que antes eran `null` (el parpadeo). */
export function HojaEsqueleto() {
  const barra = (w: string, h = 12) => (
    <span className="hoja-sk" style={{ display: 'block', width: w, height: h, borderRadius: 7, background: '#ecebf0' }} />
  );
  return (
    <div style={{ padding: '4px 0 20px' }} aria-busy="true" aria-label="Cargando la ficha">
      {barra('42%', 20)}
      <div style={{ height: 16 }} />
      {[['34%', '42%'], ['28%', '52%'], ['32%', '38%']].map(([a, b], i) => (
        <div key={i} className="hoja-skrow" style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #efeef2' }}>
          {barra(a)}{barra(b)}
        </div>
      ))}
      <div style={{ height: 20 }} />
      {barra('60%', 20)}
    </div>
  );
}

export default function VistaRapida({ abierta, onCerrar, onVerTodo, nombre, estado, estadoTono, contexto, heroLabel, heroValor, heroTono, heroLectura, acciones, claves, verTodoLabel = 'Ver todo ›', ficha }: {
  abierta: boolean; onCerrar: () => void; onVerTodo?: () => void;
  nombre: string; estado?: string; estadoTono?: 'verde' | 'rojo' | 'ambar' | 'morado'; contexto?: ReactNode;
  heroLabel: string; heroValor: ReactNode; heroTono?: 'verde' | 'rojo' | 'ambar'; heroLectura?: ReactNode;
  acciones: VRAccion[]; claves: VRClave[]; verTodoLabel?: string;
  /** La ficha completa. Si viene, «Ver todo» sube la hoja en vez de abrir otra pantalla. */
  ficha?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [full, setFull] = useState(false);
  const [dy, setDy] = useState(0);
  const y0 = useRef<number | null>(null);
  const cuerpo = useRef<HTMLDivElement | null>(null);
  // Dos niveles de historial: el de arriba (full) responde primero al botón
  // atrás y baja a peek; el de abajo cierra la hoja. El stack del hook evita
  // que un solo popstate se lleve los dos.
  useDrawerHistory(abierta, () => cerrar());
  useDrawerHistory(abierta && full, () => setFull(false));
  useEffect(() => {
    if (!abierta) { setVisible(false); setFull(false); return; }
    setDy(0);
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [abierta]);
  // Cada cambio de altura arranca el cuerpo arriba: subir a la ficha y caer a
  // media página sería el mismo desconcierto que la pantalla nueva.
  useEffect(() => { if (cuerpo.current) cuerpo.current.scrollTop = 0; }, [full]);
  if (!abierta) return null;

  const cerrar = () => { setVisible(false); setTimeout(onCerrar, 200); };
  const expandir = () => {
    if (ficha) { setDy(0); setFull(true); return; }        // misma hoja, más alta
    setVisible(false); setTimeout(() => onVerTodo?.(), 160); // pantalla vieja
  };
  // En full el arrastre solo cuenta desde el asa/cabecera: si escuchara al
  // cuerpo, leer la ficha hacia abajo la cerraría en la cara del usuario.
  const onTS = (e: React.TouchEvent) => { y0.current = e.touches[0].clientY; };
  const onTM = (e: React.TouchEvent) => { if (y0.current != null) setDy(e.touches[0].clientY - y0.current); };
  const onTE = () => {
    if (full) { if (dy > 70) setFull(false); setDy(0); }
    else if (dy > 70) cerrar();
    else if (dy < -50) { setDy(0); expandir(); }
    else setDy(0);
    y0.current = null;
  };
  const gestos = { onTouchStart: onTS, onTouchMove: onTM, onTouchEnd: onTE };

  const accs = (acciones.some(x => x.primaria) ? acciones : acciones.map((x, i) => i === 0 ? { ...x, primaria: true } : x)).slice(0, 3);
  const filaAcciones = (
    <div style={{ display: 'flex', gap: 8, margin: full ? '11px 0 0' : '16px 0 4px' }}>
      {accs.map(a => {
        const st: React.CSSProperties = {
          flex: 1, height: 44, display: 'grid', placeItems: 'center', borderRadius: 13, fontWeight: 700,
          fontSize: '0.82rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none',
          background: a.primaria ? '#5B4BD6' : '#f4f3f6', color: a.primaria ? '#fff' : '#1a1a1a',
        };
        return a.href
          ? <a key={a.label} className={a.primaria ? 'vr-accp' : 'vr-acc'} href={a.href} target="_blank" rel="noreferrer" style={st}>{a.label}</a>
          : <button key={a.label} className={a.primaria ? 'vr-accp' : 'vr-acc'} onClick={a.onClick} style={st}>{a.label}</button>;
      })}
    </div>
  );

  // La identidad vive en la cabecera fija: al subir la hoja no se re-lee, se
  // queda donde estaba. Es lo que hace que no se sienta otra pantalla.
  const identidad = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div className="vr-nom" style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1a1a1a' }}>{nombre}</div>
        {estado && <div className="vr-estado" style={{ fontSize: '0.72rem', fontWeight: 700, flex: 'none', color: estadoTono ? TONO[estadoTono] : '#8f8d98' }}>{estado}</div>}
      </div>
      {contexto && <div className="vr-ctx" style={{ fontSize: '0.78rem', color: '#8f8d98', marginTop: 2 }}>{contexto}</div>}
    </>
  );

  return (
    <>
      <div onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(12,11,18,.45)', opacity: visible ? 1 : 0, transition: 'opacity .22s ease' }} />
      <div className={'vr-sheet' + (full ? ' vr-full' : '')}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 901, background: '#fff',
          top: full ? 'max(8px, env(safe-area-inset-top))' : 'auto',
          display: full ? 'flex' : 'block', flexDirection: 'column',
          borderRadius: '28px 28px 0 0',
          padding: full ? '10px 0 0' : '10px 24px calc(18px + env(safe-area-inset-bottom))',
          boxShadow: '0 -18px 60px rgba(12,11,18,.28)',
          transform: visible ? `translateY(${Math.max(0, dy)}px)` : 'translateY(105%)',
          transition: y0.current != null ? 'none' : 'transform .22s cubic-bezier(.3,.9,.3,1), top .26s cubic-bezier(.3,.9,.3,1)',
          touchAction: full ? 'auto' : 'none',
        }}>

        {full ? (
          <>
            <div {...gestos} style={{ flex: 'none', padding: '0 24px 11px', touchAction: 'none' }}>
              <div className="vr-handle" style={{ width: 40, height: 5, borderRadius: 99, background: '#e2e1e8', margin: '0 auto 16px' }} />
              {identidad}
              {filaAcciones}
            </div>
            <div ref={cuerpo} className="hoja-ficha" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 24px', background: '#fff' }}>
              {ficha}
            </div>
            <div className="vr-hint" style={{ flex: 'none', textAlign: 'center', fontSize: '0.68rem', color: '#c4c2cc', padding: '9px 0 calc(12px + env(safe-area-inset-bottom))' }}>
              arrastra ↓ para volver a la vista rápida
            </div>
          </>
        ) : (
          <div {...gestos}>
            <div className="vr-handle" style={{ width: 40, height: 5, borderRadius: 99, background: '#e2e1e8', margin: '0 auto 16px' }} />
            {identidad}
            <div className="vr-hl" style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8f8d98', marginTop: 18 }}>{heroLabel}</div>
            <div className="vr-hv" style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, marginTop: 2, color: heroTono ? TONO[heroTono] : '#1a1a1a' }}>{heroValor}</div>
            {heroLectura && <div className="vr-hd" style={{ fontSize: '0.78rem', color: '#8f8d98', marginTop: 3 }}>{heroLectura}</div>}
            {filaAcciones}
            <div style={{ margin: '6px 0 0' }}>
              {claves.slice(0, 3).map((c, i, arr) => (
                <div key={c.k} className="vr-cl" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid #efeef2' : 'none', fontSize: '0.84rem' }}>
                  <span className="vr-k" style={{ color: '#8f8d98', flex: 'none' }}>{c.k}</span>
                  <span className="vr-v" style={{ fontWeight: 600, textAlign: 'right', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: c.tono ? TONO[c.tono] : '#1a1a1a' }}>{c.v}</span>
                </div>
              ))}
            </div>
            <button onClick={expandir} className="vr-vertodo" style={{ display: 'block', width: '100%', textAlign: 'center', padding: '14px 0 0', color: '#5B4BD6', fontWeight: 700, fontSize: '0.88rem', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{verTodoLabel}</button>
            <div className="vr-hint" style={{ textAlign: 'center', fontSize: '0.68rem', color: '#c4c2cc', marginTop: 6 }}>desliza ↑ para ver todo · ↓ para salir</div>
          </div>
        )}
      </div>
    </>
  );
}
