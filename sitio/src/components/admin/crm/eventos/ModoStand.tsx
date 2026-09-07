// MODO STAND · la pantalla del teléfono durante el evento.
//
// Pantalla completa, letra grande, un solo botón. Arriba el marcador del día
// (cuántos llevamos, cuántos faltan para la meta, cuántos esperan red) porque
// en un stand lo que motiva es ver el número subir. Abajo el formulario.
import { useEffect, useState } from 'react';
import { P } from '../../../../lib/crm/paleta';
import FormRegistro, { sincronizarCola, pendientesDe, fallidosDe, olvidarFallido } from './FormRegistro';
import { Btn, fmt, diaMX } from './ui';

export default function ModoStand({ edicion, registros, meta, onCerrar, onNuevo }: {
  edicion: any; registros: any[]; meta?: number | null; onCerrar: () => void; onNuevo: () => void;
}) {
  const [pendientes, setPendientes] = useState(() => pendientesDe(edicion.id));
  const [fallidos, setFallidos] = useState<any[]>(() => fallidosDe(edicion.id));
  const [aviso, setAviso] = useState<{ t: string; tono: 'bien' | 'atencion' } | null>(null);
  const [n, setN] = useState(0);
  const hoy = diaMX();
  const deHoy = registros.filter(r => diaMX(r.capturado_at) === hoy).length;

  useEffect(() => {
    const sync = async () => { const k = await sincronizarCola(edicion.id); setPendientes(pendientesDe(edicion.id)); setFallidos(fallidosDe(edicion.id)); if (k) { setAviso({ t: `Se mandaron ${k} registros que esperaban red.`, tono: 'bien' }); onNuevo(); } };
    sync();
    window.addEventListener('online', sync);
    const t = setInterval(sync, 60_000);
    return () => { window.removeEventListener('online', sync); clearInterval(t); };
  }, [edicion.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: '#fff', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <div style={{ background: P.violeta, color: '#fff', padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .85 }}>Modo stand · {edicion.ev_eventos?.nombre}</div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', marginTop: 4 }}>
            <span><b style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmt(deHoy)}</b> <span style={{ fontSize: '.8125rem', opacity: .85 }}>hoy</span></span>
            <span><b style={{ fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(registros.length)}</b> <span style={{ fontSize: '.8125rem', opacity: .85 }}>{meta ? `de ${fmt(meta)}` : 'en total'}</span></span>
            {pendientes > 0 && <span style={{ fontSize: '.75rem', fontWeight: 700, background: 'rgba(255,255,255,.22)', padding: '3px 9px', borderRadius: 99 }}>{pendientes} sin red</span>}
          </div>
        </div>
        <button onClick={onCerrar} style={{ font: 'inherit', fontSize: '.8125rem', fontWeight: 700, padding: '9px 14px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,.6)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Salir</button>
      </div>
      <div style={{ overflowY: 'auto', padding: '16px 18px calc(24px + env(safe-area-inset-bottom))', WebkitOverflowScrolling: 'touch' as any }}>
        {aviso && (
          <div style={{ marginBottom: 12, padding: '11px 14px', borderRadius: 10, fontSize: '.9375rem', fontWeight: 600, background: aviso.tono === 'bien' ? P.verdeAgua : P.ambarAgua, color: aviso.tono === 'bien' ? P.verdeTinta : P.ambarTinta, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span>{aviso.t}</span><button onClick={() => setAviso(null)} style={{ font: 'inherit', background: 'none', border: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer' }}>Ok</button>
          </div>
        )}
        {fallidos.length > 0 && (
          <div style={{ marginBottom: 12, padding: '11px 14px', borderRadius: 10, fontSize: '.875rem', background: P.rojoAgua, color: P.rojoTinta, display: 'grid', gap: 6 }}>
            <b>{fallidos.length} registro{fallidos.length === 1 ? '' : 's'} que el servidor rechazó — hay que recapturarlo{fallidos.length === 1 ? '' : 's'}:</b>
            {fallidos.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span>{[r.nombre, r.empresa, r.whatsapp].filter(Boolean).join(' · ') || 'sin datos'} <span style={{ opacity: .8 }}>— {r._error}</span></span>
                <button onClick={() => { olvidarFallido(edicion.id, i); setFallidos(fallidosDe(edicion.id)); }} style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', flex: 'none' }}>Quitar</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <FormRegistro key={n} edicionId={edicion.id} modo="stand" grande onListo={(r) => {
            setN(v => v + 1); setPendientes(pendientesDe(edicion.id));
            if (r.local) setAviso({ t: 'Sin red: quedó guardado en este teléfono y se manda solo al volver la señal.', tono: 'atencion' });
            else if (r.duplicado) setAviso({ t: 'Ese registro ya estaba.', tono: 'atencion' });
            else if (r.ya_era) setAviso({ t: `Guardado. Ya lo conocíamos (${r.ya_era}): se anotó el encuentro en su ficha.`, tono: 'bien' });
            else setAviso({ t: 'Guardado. Si dijo que sí, ya le fue la bienvenida.', tono: 'bien' });
            onNuevo();
            window.scrollTo(0, 0);
          }} />
          {edicion.token_publico && (
            <div style={{ marginTop: 22, textAlign: 'center', fontSize: '.8125rem', color: '#777' }}>
              ¿Prefiere registrarse solo? Que escanee el QR del stand.
              <div style={{ marginTop: 6 }}><Btn chico nivel="terciario" onClick={() => window.open(`/e/${edicion.token_publico}`, '_blank')}>Abrir la página del QR</Btn></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
