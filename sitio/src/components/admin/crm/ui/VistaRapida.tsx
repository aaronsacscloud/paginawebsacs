// ══ VISTA RÁPIDA — el detalle mínimo que sube desde abajo (mock aprobado) ══
// Bottom sheet estilo Square: nombre + UN número héroe + ≤3 acciones + ≤3
// datos con hairlines. Gestos: deslizar ↓ (o velo/atrás) cierra; deslizar ↑
// o «Ver todo ›» expande a la ficha completa. 220 ms, radio 28, cero bordes.
// El dark lo pintan las reglas [data-crm-dark="1"] .vr-* de CRM_MOBILE_CSS.
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

export default function VistaRapida({ abierta, onCerrar, onVerTodo, nombre, estado, estadoTono, contexto, heroLabel, heroValor, heroTono, heroLectura, acciones, claves, verTodoLabel = 'Ver todo ›' }: {
  abierta: boolean; onCerrar: () => void; onVerTodo: () => void;
  nombre: string; estado?: string; estadoTono?: 'verde' | 'rojo' | 'ambar' | 'morado'; contexto?: ReactNode;
  heroLabel: string; heroValor: ReactNode; heroTono?: 'verde' | 'rojo' | 'ambar'; heroLectura?: ReactNode;
  acciones: VRAccion[]; claves: VRClave[]; verTodoLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [dy, setDy] = useState(0);
  const y0 = useRef<number | null>(null);
  useDrawerHistory(abierta, onCerrar);
  useEffect(() => {
    if (!abierta) { setVisible(false); return; }
    setDy(0);
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [abierta]);
  if (!abierta) return null;

  const cerrar = () => { setVisible(false); setTimeout(onCerrar, 200); };
  const expandir = () => { setVisible(false); setTimeout(onVerTodo, 160); };
  const onTS = (e: React.TouchEvent) => { y0.current = e.touches[0].clientY; };
  const onTM = (e: React.TouchEvent) => { if (y0.current != null) setDy(e.touches[0].clientY - y0.current); };
  const onTE = () => {
    if (dy > 70) cerrar();
    else if (dy < -50) expandir();
    else setDy(0);
    y0.current = null;
  };

  return (
    <>
      <div onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(12,11,18,.45)', opacity: visible ? 1 : 0, transition: 'opacity .22s ease' }} />
      <div className="vr-sheet" onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 901, background: '#fff',
          borderRadius: '28px 28px 0 0', padding: '10px 24px calc(18px + env(safe-area-inset-bottom))',
          boxShadow: '0 -18px 60px rgba(12,11,18,.28)',
          transform: visible ? `translateY(${Math.max(0, dy)}px)` : 'translateY(105%)',
          transition: y0.current != null ? 'none' : 'transform .22s cubic-bezier(.3,.9,.3,1)',
          touchAction: 'none',
        }}>
        <div className="vr-handle" style={{ width: 40, height: 5, borderRadius: 99, background: '#e2e1e8', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <div className="vr-nom" style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1a1a1a' }}>{nombre}</div>
          {estado && <div className="vr-estado" style={{ fontSize: '0.72rem', fontWeight: 700, flex: 'none', color: estadoTono ? TONO[estadoTono] : '#8f8d98' }}>{estado}</div>}
        </div>
        {contexto && <div className="vr-ctx" style={{ fontSize: '0.78rem', color: '#8f8d98', marginTop: 2 }}>{contexto}</div>}
        <div className="vr-hl" style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8f8d98', marginTop: 18 }}>{heroLabel}</div>
        <div className="vr-hv" style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, marginTop: 2, color: heroTono ? TONO[heroTono] : '#1a1a1a' }}>{heroValor}</div>
        {heroLectura && <div className="vr-hd" style={{ fontSize: '0.78rem', color: '#8f8d98', marginTop: 3 }}>{heroLectura}</div>}
        <div style={{ display: 'flex', gap: 8, margin: '16px 0 4px' }}>
          {(acciones.some(x => x.primaria) ? acciones : acciones.map((x, i) => i === 0 ? { ...x, primaria: true } : x)).slice(0, 3).map(a => {
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
    </>
  );
}
