// El formulario de captura en el evento. Uno solo para las tres puertas:
// el modo stand (grande, a una mano, sin red), la lista de registros del CRM
// y el recorrido de pasillos (viene con el expositor precargado).
//
// Dos toques: WhatsApp, nombre, «dijo que sí» y guardar. Todo lo demás vive
// detrás de «Agregar detalle» porque en el stand hay una fila esperando y un
// formulario de 14 campos se llena a medias o no se llena. El WhatsApp va
// primero y con foco: es el dato con el que se le escribe; sin él la persona
// se conoció y se perdió.
//
// Sin red: el registro se guarda en localStorage con un id local y se manda
// cuando vuelva la señal. El servidor acepta el mismo id una sola vez.
import { useEffect, useRef, useState } from 'react';
import { P } from '../../../../lib/crm/paleta';
import { GIROS, Btn, INPUT, post } from './ui';

const CLAVE = (edicionId: string) => `ev-cola-${edicionId}`;
const CLAVE_F = (edicionId: string) => `ev-fallidos-${edicionId}`;
const leer = (k: string): any[] => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const escribir = (k: string, l: any[]) => { try { localStorage.setItem(k, JSON.stringify(l)); } catch {} };
const leerCola = (edicionId: string) => leer(CLAVE(edicionId));
const escribirCola = (edicionId: string, l: any[]) => escribir(CLAVE(edicionId), l);
const esRed = (m: string) => /^Error 5|Failed to fetch|NetworkError|Load failed|demasiados registros/i.test(m);

/** Manda lo que quedó pendiente. Devuelve cuántos se sincronizaron. */
export async function sincronizarCola(edicionId: string): Promise<number> {
  const cola = leerCola(edicionId);
  if (!cola.length) return 0;
  const quedan: any[] = []; const fallidos = leer(CLAVE_F(edicionId)); let ok = 0;
  for (const r of cola) {
    try { await post('/api/crm/eventos/edicion', { accion: 'registro', ...r }); ok++; }
    catch (e: any) {
      // Un error de red se reintenta. Uno de datos (400) NO se va a arreglar
      // reintentando cada minuto: sale de la cola y queda en «fallidos», visible,
      // con su motivo — antes se quedaba dando vueltas para siempre.
      if (esRed(String(e.message))) quedan.push(r);
      else fallidos.push({ ...r, _error: e.message, _at: new Date().toISOString() });
    }
  }
  escribirCola(edicionId, quedan);
  escribir(CLAVE_F(edicionId), fallidos.slice(-50));
  return ok;
}
export const pendientesDe = (edicionId: string) => leerCola(edicionId).length;
/** Los que el servidor rechazó por datos; se enseñan para recapturarlos a mano. */
export const fallidosDe = (edicionId: string): any[] => leer(CLAVE_F(edicionId));
export const olvidarFallido = (edicionId: string, i: number) => { const l = fallidosDe(edicionId); l.splice(i, 1); escribir(CLAVE_F(edicionId), l); };

const VACIO = { nombre: '', empresa: '', puesto: '', giro: '', sucursales: '', sistema_actual: '', whatsapp: '', email: '', ciudad: '', instagram: '', temperatura: '', quiere_demo: false, interes: '', nota: '', stand_visitado: '', consentimiento: false };

export default function FormRegistro({ edicionId, modo, grande, precargado, expositorId, abmCuentaId, onListo, onCancelar }: {
  edicionId: string; modo: 'stand' | 'recorrido'; grande?: boolean; precargado?: Partial<typeof VACIO>; expositorId?: string; abmCuentaId?: string;
  onListo: (r: { ok: boolean; duplicado?: boolean; ya_era?: string | null; local?: boolean }) => void; onCancelar?: () => void;
}) {
  const [f, setF] = useState<any>({ ...VACIO, ...(precargado || {}) });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // En el stand el detalle empieza cerrado; en el CRM (sin prisa) abierto.
  const [detalle, setDetalle] = useState(!grande);
  const waRef = useRef<HTMLInputElement>(null);
  useEffect(() => { waRef.current?.focus(); }, []);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const enviar = async () => {
    if (!f.nombre.trim() && !f.whatsapp.trim() && !f.email.trim()) return setError('Al menos el nombre, el WhatsApp o el correo.');
    const wa = f.whatsapp.replace(/\D/g, '');
    if (wa && wa.length < 10) return setError('El WhatsApp necesita 10 dígitos.');
    setError(''); setEnviando(true);
    // Sin temperatura elegida: pidió demo = caliente, si no tibio. Frío se marca a mano.
    const temperatura = f.temperatura || (f.quiere_demo ? 'caliente' : 'tibio');
    const cuerpo = { edicion_id: edicionId, modo, ...f, temperatura, sucursales: f.sucursales === '' ? null : Number(f.sucursales), cliente_local_id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, expositor_id: expositorId, abm_cuenta_id: abmCuentaId };
    try {
      const r = await post('/api/crm/eventos/edicion', { accion: 'registro', ...cuerpo });
      onListo(r);
    } catch (e: any) {
      if (esRed(String(e.message))) {
        // Sin red: a la cola. Se manda solo cuando regrese.
        escribirCola(edicionId, [...leerCola(edicionId), cuerpo]);
        onListo({ ok: true, local: true });
      } else setError(e.message);
    } finally { setEnviando(false); }
  };

  const inp = grande ? { ...INPUT, fontSize: '1.0625rem', padding: '13px 14px', borderRadius: 10 } : INPUT;
  const seg = (k: string, v: string, l: string, tinta: string, agua: string) => {
    const on = f[k] === v;
    return <button key={v} type="button" onClick={() => set(k, on ? '' : v)} style={{ font: 'inherit', flex: 1, fontSize: grande ? '.9375rem' : '.8125rem', fontWeight: 700, padding: grande ? '12px 8px' : '7px 8px', borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${on ? tinta : '#e4e4e4'}`, background: on ? agua : '#fff', color: on ? tinta : '#777' }}>{l}</button>;
  };
  const palomita = (on: boolean, color: string) => <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 6, marginRight: 10, verticalAlign: -5, flex: 'none', border: `1.5px solid ${on ? color : '#c9c9c9'}`, background: on ? color : '#fff', color: '#fff', fontSize: 13, lineHeight: '18px', textAlign: 'center' }}>{on ? '✓' : ''}</span>;
  const toggle = (on: boolean, tinta: string, agua: string, borde: string, onClick: () => void, children: any) => (
    <button type="button" onClick={onClick} style={{ font: 'inherit', fontSize: grande ? '.9375rem' : '.8125rem', fontWeight: 700, padding: grande ? '13px 14px' : '9px 12px', borderRadius: 9, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', border: `1.5px solid ${on ? borde : '#e4e4e4'}`, background: on ? agua : '#fff', color: on ? tinta : '#666', lineHeight: 1.3 }}>{children}</button>
  );

  return (
    <div style={{ display: 'grid', gap: grande ? 12 : 10 }}>
      <input ref={waRef} style={inp} value={f.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="WhatsApp (10 dígitos)" inputMode="tel" autoComplete="off" />
      <input style={inp} value={f.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre de la persona" autoComplete="off" />
      <input style={inp} value={f.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Negocio o marca" autoComplete="off" />

      {toggle(f.consentimiento, P.verdeTinta, P.verdeAgua, P.verde, () => set('consentimiento', !f.consentimiento), <>{palomita(f.consentimiento, P.verde)}<span><b>Dijo que sí</b> a que le escribamos por WhatsApp y correo{grande ? '' : '. Sin esto se guarda, pero no se le escribe'}</span></>)}
      {toggle(f.quiere_demo, P.violetaTinta, P.violetaAgua, P.violeta, () => set('quiere_demo', !f.quiere_demo), <>{palomita(f.quiere_demo, P.violeta)}<span>{f.quiere_demo ? 'Quiere una demo · se le busca mañana' : '¿Quiere una demo?'}</span></>)}

      {!detalle && (
        <button type="button" onClick={() => setDetalle(true)} style={{ font: 'inherit', fontSize: grande ? '.9375rem' : '.8125rem', fontWeight: 700, padding: grande ? '11px 14px' : '8px 12px', borderRadius: 9, cursor: 'pointer', border: '1.5px dashed #d5d5d5', background: '#fff', color: P.violetaTinta, textAlign: 'left' }}>
          + Agregar detalle <span style={{ fontWeight: 500, color: '#888' }}>· correo, giro, tiendas, con qué operan, nota</span>
        </button>
      )}
      {detalle && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: grande ? '1fr' : '1fr 1fr', gap: 10 }}>
            <input style={inp} value={f.email} onChange={e => set('email', e.target.value)} placeholder="Correo" inputMode="email" autoComplete="off" />
            <select style={inp} value={f.giro} onChange={e => set('giro', e.target.value)}><option value="">Giro…</option>{Object.entries(GIROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input style={inp} value={f.sucursales} onChange={e => set('sucursales', e.target.value)} placeholder="Tiendas (n)" inputMode="numeric" />
            <input style={inp} value={f.sistema_actual} onChange={e => set('sistema_actual', e.target.value)} placeholder="Con qué operan hoy" autoComplete="off" />
          </div>
          {!grande && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <input style={inp} value={f.puesto} onChange={e => set('puesto', e.target.value)} placeholder="Puesto" />
              <input style={inp} value={f.ciudad} onChange={e => set('ciudad', e.target.value)} placeholder="Ciudad" />
              <input style={inp} value={f.instagram} onChange={e => set('instagram', e.target.value)} placeholder="Instagram" />
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }} title="Si no eliges: pidió demo = caliente, si no tibio">
            {seg('temperatura', 'caliente', 'Caliente', P.rojoTinta, P.rojoAgua)}
            {seg('temperatura', 'tibio', 'Tibio', P.ambarTinta, P.ambarAgua)}
            {seg('temperatura', 'frio', 'Frío', P.azulTinta, P.azulAgua)}
          </div>
          <textarea style={{ ...inp, minHeight: grande ? 72 : 56, resize: 'vertical' }} value={f.nota} onChange={e => set('nota', e.target.value)} placeholder="Qué le interesó, qué le duele, qué prometimos" />
        </>
      )}
      {error && <div style={{ fontSize: '.8125rem', color: P.rojoTinta, background: P.rojoAgua, padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancelar && <Btn nivel="terciario" onClick={onCancelar}>Cancelar</Btn>}
        <Btn nivel="primario" onClick={enviar} disabled={enviando} style={grande ? { flex: 1, padding: '14px', fontSize: '1rem' } : undefined}>{enviando ? 'Guardando…' : 'Guardar registro'}</Btn>
      </div>
    </div>
  );
}
