// El formulario de captura en el evento. Uno solo para las tres puertas:
// el modo stand (grande, a una mano, sin red), la lista de registros del CRM
// y el recorrido de pasillos (viene con el expositor precargado).
//
// Sin red: el registro se guarda en localStorage con un id local y se manda
// cuando vuelva la señal. El servidor acepta el mismo id una sola vez.
import { useEffect, useRef, useState } from 'react';
import { P } from '../../../../lib/crm/paleta';
import { GIROS, Btn, INPUT, post } from './ui';

const CLAVE = (edicionId: string) => `ev-cola-${edicionId}`;
const leerCola = (edicionId: string): any[] => { try { return JSON.parse(localStorage.getItem(CLAVE(edicionId)) || '[]'); } catch { return []; } };
const escribirCola = (edicionId: string, l: any[]) => { try { localStorage.setItem(CLAVE(edicionId), JSON.stringify(l)); } catch {} };

/** Manda lo que quedó pendiente. Devuelve cuántos se sincronizaron. */
export async function sincronizarCola(edicionId: string): Promise<number> {
  const cola = leerCola(edicionId);
  if (!cola.length) return 0;
  const quedan: any[] = []; let ok = 0;
  for (const r of cola) {
    try { await post('/api/crm/eventos/edicion', { accion: 'registro', ...r }); ok++; }
    catch (e: any) {
      // Un error de datos (400) no se va a arreglar reintentando; uno de red sí.
      if (/^Error 5|Failed to fetch|NetworkError|Load failed/i.test(e.message)) quedan.push(r);
      else { r._error = e.message; quedan.push(r); }
    }
  }
  escribirCola(edicionId, quedan);
  return ok;
}
export const pendientesDe = (edicionId: string) => leerCola(edicionId).length;

const VACIO = { nombre: '', empresa: '', puesto: '', giro: '', sucursales: '', sistema_actual: '', whatsapp: '', email: '', ciudad: '', instagram: '', temperatura: 'tibio', quiere_demo: false, interes: '', nota: '', stand_visitado: '', consentimiento: false };

export default function FormRegistro({ edicionId, modo, grande, precargado, expositorId, abmCuentaId, onListo, onCancelar }: {
  edicionId: string; modo: 'stand' | 'recorrido'; grande?: boolean; precargado?: Partial<typeof VACIO>; expositorId?: string; abmCuentaId?: string;
  onListo: (r: { ok: boolean; duplicado?: boolean; ya_era?: string | null; local?: boolean }) => void; onCancelar?: () => void;
}) {
  const [f, setF] = useState<any>({ ...VACIO, ...(precargado || {}) });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const nombreRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nombreRef.current?.focus(); }, []);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const enviar = async () => {
    if (!f.nombre.trim() && !f.whatsapp.trim() && !f.email.trim()) return setError('Al menos el nombre, el WhatsApp o el correo.');
    const wa = f.whatsapp.replace(/\D/g, '');
    if (wa && wa.length < 10) return setError('El WhatsApp necesita 10 dígitos.');
    setError(''); setEnviando(true);
    const cuerpo = { edicion_id: edicionId, modo, ...f, sucursales: f.sucursales === '' ? null : Number(f.sucursales), cliente_local_id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, expositor_id: expositorId, abm_cuenta_id: abmCuentaId };
    try {
      const r = await post('/api/crm/eventos/edicion', { accion: 'registro', ...cuerpo });
      onListo(r);
    } catch (e: any) {
      if (/Failed to fetch|NetworkError|Load failed|^Error 5/i.test(e.message)) {
        // Sin red: a la cola. Se manda solo cuando regrese.
        escribirCola(edicionId, [...leerCola(edicionId), cuerpo]);
        onListo({ ok: true, local: true });
      } else setError(e.message);
    } finally { setEnviando(false); }
  };

  const inp = grande ? { ...INPUT, fontSize: '1.0625rem', padding: '13px 14px', borderRadius: 10 } : INPUT;
  const seg = (k: string, v: string, l: string, tinta: string, agua: string) => {
    const on = f[k] === v;
    return <button key={v} type="button" onClick={() => set(k, v)} style={{ font: 'inherit', flex: 1, fontSize: grande ? '.9375rem' : '.8125rem', fontWeight: 700, padding: grande ? '12px 8px' : '7px 8px', borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${on ? tinta : '#e4e4e4'}`, background: on ? agua : '#fff', color: on ? tinta : '#777' }}>{l}</button>;
  };

  return (
    <div style={{ display: 'grid', gap: grande ? 12 : 10 }}>
      <input ref={nombreRef} style={inp} value={f.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre de la persona" autoComplete="off" />
      <div style={{ display: 'grid', gridTemplateColumns: grande ? '1fr' : '1fr 1fr', gap: 10 }}>
        <input style={inp} value={f.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Negocio o marca" autoComplete="off" />
        <input style={inp} value={f.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="WhatsApp (10 dígitos)" inputMode="tel" autoComplete="off" />
      </div>
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
      <div style={{ display: 'flex', gap: 6 }}>
        {seg('temperatura', 'caliente', 'Caliente', P.rojoTinta, P.rojoAgua)}
        {seg('temperatura', 'tibio', 'Tibio', P.ambarTinta, P.ambarAgua)}
        {seg('temperatura', 'frio', 'Frío', P.azulTinta, P.azulAgua)}
      </div>
      <button type="button" onClick={() => set('quiere_demo', !f.quiere_demo)} style={{ font: 'inherit', fontSize: grande ? '.9375rem' : '.8125rem', fontWeight: 700, padding: grande ? '12px 14px' : '8px 12px', borderRadius: 9, cursor: 'pointer', textAlign: 'left', border: `1.5px solid ${f.quiere_demo ? P.violeta : '#e4e4e4'}`, background: f.quiere_demo ? P.violetaAgua : '#fff', color: f.quiere_demo ? P.violetaTinta : '#777' }}>
        <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 5, marginRight: 9, verticalAlign: -4, border: `1.5px solid ${f.quiere_demo ? P.violeta : '#c9c9c9'}`, background: f.quiere_demo ? P.violeta : '#fff', color: '#fff', fontSize: 12, lineHeight: '16px', textAlign: 'center' }}>{f.quiere_demo ? '✓' : ''}</span>
        {f.quiere_demo ? 'Quiere una demo' : '¿Quiere una demo?'}
      </button>
      <textarea style={{ ...inp, minHeight: grande ? 72 : 56, resize: 'vertical' }} value={f.nota} onChange={e => set('nota', e.target.value)} placeholder="Qué le interesó, qué le duele, qué prometimos" />
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: grande ? '.9375rem' : '.8125rem', color: '#444', padding: grande ? '12px 14px' : '9px 12px', borderRadius: 9, border: `1.5px solid ${f.consentimiento ? P.verde : '#e4e4e4'}`, background: f.consentimiento ? P.verdeAgua : '#fff', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.consentimiento} onChange={e => set('consentimiento', e.target.checked)} style={{ width: 20, height: 20, marginTop: 1 }} />
        <span><b>Dijo que sí</b> a que le mandemos información por WhatsApp y correo. Sin esto se guarda, pero no se le escribe.</span>
      </label>
      {error && <div style={{ fontSize: '.8125rem', color: P.rojoTinta, background: P.rojoAgua, padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancelar && <Btn nivel="terciario" onClick={onCancelar}>Cancelar</Btn>}
        <Btn nivel="primario" onClick={enviar} disabled={enviando} style={grande ? { flex: 1, padding: '14px', fontSize: '1rem' } : undefined}>{enviando ? 'Guardando…' : 'Guardar registro'}</Btn>
      </div>
    </div>
  );
}
