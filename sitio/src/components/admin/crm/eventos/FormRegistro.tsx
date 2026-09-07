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

// ── Punto 6 · leer el gafete (QR con vCard) o la tarjeta (foto → IA) ──
/** vCard o MECARD del gafete de la feria → los campos del formulario. */
function parsearGafete(txt: string): Partial<typeof VACIO> | null {
  const t = String(txt || '');
  const out: any = {};
  if (/BEGIN:VCARD/i.test(t)) {
    const l = (re: RegExp) => { const m = t.match(re); return m ? m[1].replace(/\\,/g, ',').replace(/\\n/gi, ' ').trim() : ''; };
    out.nombre = l(/^FN[^:]*:(.+)$/im) || l(/^N[^:]*:([^;]*;[^;]*)/im).split(';').reverse().join(' ').trim();
    out.empresa = l(/^ORG[^:]*:(.+)$/im).split(';')[0];
    out.puesto = l(/^TITLE[^:]*:(.+)$/im);
    out.email = l(/^EMAIL[^:]*:(.+)$/im);
    const tel = l(/^TEL[^:]*:(.+)$/im).replace(/\D/g, '');
    out.whatsapp = tel.length > 10 ? tel.slice(-10) : tel;
    out.ciudad = l(/^ADR[^:]*:(.+)$/im).split(';').filter(Boolean)[2] || '';
  } else if (/^MECARD:/i.test(t)) {
    const l = (k: string) => { const m = t.match(new RegExp(k + ':([^;]*)', 'i')); return m ? m[1].trim() : ''; };
    out.nombre = l('N').split(',').reverse().join(' ').trim(); out.empresa = l('ORG'); out.email = l('EMAIL');
    const tel = l('TEL').replace(/\D/g, ''); out.whatsapp = tel.length > 10 ? tel.slice(-10) : tel;
  } else return null;
  return out;
}
/** El QR del gafete, con el detector del navegador (Chrome/Android; en iOS no existe y se cae a la foto). */
async function leerQr(img: ImageBitmap): Promise<string | null> {
  const BD = (window as any).BarcodeDetector;
  if (!BD) return null;
  try { const d = new BD({ formats: ['qr_code'] }); const r = await d.detect(img); return r?.[0]?.rawValue || null; } catch { return null; }
}
/** La foto se encoge antes de mandarse: una tarjeta se lee igual a 1280 px y pesa 10 veces menos. */
async function fotoADataUrl(img: ImageBitmap) {
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .85);
}

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

export default function FormRegistro({ edicionId, modo, grande, precargado, expositorId, abmCuentaId, citaId, onListo, onCancelar }: {
  edicionId: string; modo: 'stand' | 'recorrido'; grande?: boolean; precargado?: Partial<typeof VACIO>; expositorId?: string; abmCuentaId?: string; citaId?: string;
  onListo: (r: { ok: boolean; duplicado?: boolean; ya_era?: string | null; local?: boolean }) => void; onCancelar?: () => void;
}) {
  const [f, setF] = useState<any>({ ...VACIO, ...(precargado || {}) });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // En el stand el detalle empieza cerrado; en el CRM (sin prisa) abierto.
  const [detalle, setDetalle] = useState(!grande);
  const waRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [via, setVia] = useState<'manual' | 'gafete_qr' | 'tarjeta'>('manual');
  const [leyendo, setLeyendo] = useState('');
  useEffect(() => { waRef.current?.focus(); }, []);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const leerFoto = async (file: File) => {
    setError(''); setLeyendo('Leyendo…');
    try {
      const img = await createImageBitmap(file);
      const qr = await leerQr(img);
      const g = qr ? parsearGafete(qr) : null;
      if (g) { setF((p: any) => ({ ...p, ...Object.fromEntries(Object.entries(g).filter(([, v]) => v)) })); setVia('gafete_qr'); setDetalle(true); setLeyendo('Gafete leído: revisa y guarda.'); return; }
      setLeyendo('Leyendo la tarjeta con IA…');
      const r = await post('/api/crm/eventos/leer-tarjeta', { imagen: await fotoADataUrl(img) });
      const dts = r.datos || {};
      const nuevos: any = {};
      for (const k of ['nombre', 'empresa', 'puesto', 'whatsapp', 'email', 'ciudad', 'instagram', 'giro'] as const) if (dts[k]) nuevos[k] = dts[k];
      if (!Object.keys(nuevos).length) { setLeyendo(''); setError('No se pudo leer nada de la foto. Toma otra con más luz, de frente.'); return; }
      setF((p: any) => ({ ...p, ...nuevos })); setVia('tarjeta'); setDetalle(true); setLeyendo('Tarjeta leída: revisa y guarda.');
    } catch (e: any) { setLeyendo(''); setError(String(e.message || e)); }
    finally { if (fotoRef.current) fotoRef.current.value = ''; }
  };

  const enviar = async () => {
    if (!f.nombre.trim() && !f.whatsapp.trim() && !f.email.trim()) return setError('Al menos el nombre, el WhatsApp o el correo.');
    const wa = f.whatsapp.replace(/\D/g, '');
    if (wa && wa.length < 10) return setError('El WhatsApp necesita 10 dígitos.');
    setError(''); setEnviando(true);
    // Sin temperatura elegida: pidió demo = caliente, si no tibio. Frío se marca a mano.
    const temperatura = f.temperatura || (f.quiere_demo ? 'caliente' : 'tibio');
    const cuerpo = { edicion_id: edicionId, modo, ...f, temperatura, sucursales: f.sucursales === '' ? null : Number(f.sucursales), cliente_local_id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, expositor_id: expositorId, abm_cuenta_id: abmCuentaId, capturado_via: via, cita_id: citaId };
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
      {!citaId && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const fl = e.target.files?.[0]; if (fl) leerFoto(fl); }} />
          <Btn nivel="secundario" chico={!grande} onClick={() => fotoRef.current?.click()} disabled={leyendo === 'Leyendo…' || /IA/.test(leyendo)} style={grande ? { padding: '12px 14px' } : undefined}>Leer gafete o tarjeta</Btn>
          <span style={{ fontSize: grande ? '.875rem' : '.75rem', color: /leída|leído/.test(leyendo) ? P.verdeTinta : '#888', fontWeight: /leída|leído/.test(leyendo) ? 700 : 500 }}>{leyendo || 'Foto del QR del gafete o de la tarjeta: se llena solo.'}</span>
        </div>
      )}
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
