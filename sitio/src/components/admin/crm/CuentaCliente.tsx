// ══ El botón «Cuenta SACS»: los tres caminos del alta obligatoria ══════════
//
// Vive en la ficha del cliente. Pregunta al servidor QUÉ camino aplica y
// pinta solo ese: activar la prueba (se vuelve indefinida), ligar una cuenta
// que ya existe, o crear una nueva sin marca de prueba. Con cuenta ligada y
// sin prueba pendiente, no pinta nada — un trámite cerrado no ocupa lugar.
import { useEffect, useState } from 'react';

const btn = (primario = false) => ({
  border: '1px solid', borderColor: primario ? '#5B4BD6' : '#ddd6fb',
  background: primario ? '#5B4BD6' : '#fff', color: primario ? '#fff' : '#5B4BD6',
  borderRadius: 9, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit' as const,
});
const inp = { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', background: '#fdfcff', fontFamily: 'inherit' as const, outline: 'none', width: '100%', boxSizing: 'border-box' as const };

/* RFC mexicano: 3-4 letras + fecha + homoclave. Laxo a propósito (mayúsculas
   se normalizan): el candado fuerte es del SAT, no de este input. */
const RFC_OK = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

/* Los regímenes del SAT que de verdad aparecen en comercio. El catálogo
   completo tiene 20+; enseñar los ocho de siempre y dejar «Otro» evita un
   select interminable donde nadie encuentra el suyo. */
const REGIMENES = [
  '601 · General de Ley Personas Morales',
  '626 · RESICO (Régimen Simplificado de Confianza)',
  '612 · Personas Físicas con Actividades Empresariales',
  '621 · Incorporación Fiscal',
  '603 · Personas Morales con Fines no Lucrativos',
  '625 · Actividades a través de Plataformas Tecnológicas',
  '616 · Sin obligaciones fiscales',
  'Otro',
];

export default function CuentaCliente({ companyId, alCambiar }: { companyId: string; alCambiar?: () => void }) {
  const [st, setSt] = useState<any>(null);
  const [fisc, setFisc] = useState<any>(null);        // null = cargando · {rfc, razon_social}
  const [fiscForm, setFiscForm] = useState<any>({ rfc: '', razon_social: '', cp_fiscal: '', regimen_fiscal: '' });
  const [constancia, setConstancia] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [fiscOcupado, setFiscOcupado] = useState(false);
  const [fiscError, setFiscError] = useState('');
  const [modo, setModo] = useState<'' | 'crear' | 'ligar'>('');
  const [f, setF] = useState<any>({ cuenta: '', email: '', whatsapp: '' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<any>(null);

  const cargar = () => fetch(`/api/crm/onboarding/cuenta?company_id=${companyId}`).then(r => r.json()).then(setSt).catch(() => {});
  useEffect(() => {
    cargar();
    fetch(`/api/crm/onboarding/cuenta?company_id=${companyId}&fiscales=1`).then(r => r.json())
      .then(j => setFisc(j.fiscales || { rfc: '', razon_social: '' })).catch(() => setFisc({ rfc: '', razon_social: '' }));
  }, [companyId]);

  if (!st || st.error) return null;
  const pruebaViva = (st.pruebas || []).some((p: any) => p.prueba_estado && p.prueba_estado !== 'convertida');
  const faltanFiscales = fisc != null && (
    !String(fisc.rfc || '').trim() || !String(fisc.razon_social || '').trim()
    || !String(fisc.cp_fiscal || '').trim() || !String(fisc.regimen_fiscal || '').trim());
  /* Trámite cerrado = cuenta ligada, prueba convertida Y datos fiscales
     capturados. Los tres son el alta; dos de tres es un alta a medias. */
  if (st.cuenta && !pruebaViva && !faltanFiscales && !listo) return null;

  const manda = async (body: any) => {
    setOcupado(true); setError('');
    const r = await fetch('/api/crm/onboarding/cuenta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, ...body }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false);
    if (r.error) { setError(r.error); return; }
    setListo(r); setModo(''); cargar(); alCambiar?.();
  };

  return (
    <div style={{ border: '1px solid #e6ddfa', background: '#fbfaff', borderRadius: 12, padding: '13px 16px', margin: '10px 0' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6b5fa8', marginBottom: 8 }}>
        Cuenta SACS · paso obligatorio del alta
      </div>

      {listo ? (
        <div style={{ fontSize: '0.8rem', color: '#1E8A63', fontWeight: 600 }}>
          Listo: cuenta <b>{listo.cuenta}</b> {listo.password_temporal ? 'creada y ligada' : 'activada y ligada'}.
          {listo.password_temporal && (
            <div style={{ marginTop: 6, color: '#7a5a10', background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 9, padding: '8px 11px', fontWeight: 500 }}>
              Contraseña temporal (se enseña UNA vez, dásela al cliente): <b style={{ fontFamily: 'monospace' }}>{listo.password_temporal}</b>
            </div>
          )}
          {listo.onboarding && !listo.onboarding.creado && listo.onboarding.motivo === 'onboarding pausado' && (
            <div style={{ fontSize: '0.72rem', color: '#9a97a5', marginTop: 4 }}>El onboarding está pausado: el caso no se abrió (se abrirá si lo enciendes).</div>
          )}
        </div>
      ) : pruebaViva && st.cuenta ? (
        <div>
          <div style={{ fontSize: '0.8rem', color: '#4a4a52', marginBottom: 8 }}>
            La cuenta <b>{st.cuenta}</b> sigue marcada como <b>prueba</b> y su vencimiento corre aunque ya sea cliente.
          </div>
          <button disabled={ocupado} onClick={() => manda({ accion: 'activar' })} style={btn(true)}>
            {ocupado ? 'Activando…' : 'Activar: volverla indefinida'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '0.8rem', color: '#4a4a52', marginBottom: 8 }}>
            Este cliente <b>no tiene cuenta de SACS ligada</b>. Sin cuenta no hay sistema que usar ni onboarding que medir.
          </div>
          {!modo && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setModo('crear')} style={btn(true)}>Crear su cuenta</button>
              <button onClick={() => setModo('ligar')} style={btn()}>Ligar una que ya existe</button>
            </div>
          )}
          {modo && (
            <div style={{ display: 'grid', gap: 8, marginTop: 4, maxWidth: 380 }}>
              <input value={f.cuenta} onChange={e => setF({ ...f, cuenta: e.target.value.toLowerCase() })}
                placeholder="identificador de la cuenta (ej. miboutique)" style={inp} />
              {modo === 'crear' && <>
                <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="correo del dueño (su acceso)" style={inp} />
                <input value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder="WhatsApp (opcional)" style={inp} />
              </>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={ocupado} onClick={() => manda(modo === 'crear'
                  ? { accion: 'crear', cuenta: f.cuenta, email: f.email, whatsapp: f.whatsapp }
                  : { accion: 'ligar', cuenta: f.cuenta })} style={btn(true)}>
                  {ocupado ? 'Un momento…' : modo === 'crear' ? 'Crear y ligar' : 'Ligar'}
                </button>
                <button onClick={() => { setModo(''); setError(''); }} style={btn()}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <div style={{ fontSize: '0.76rem', color: '#C0554E', marginTop: 8 }}>{error}</div>}

      {/* ── Los datos fiscales: la otra mitad del alta ──
          Medido al construirlo: los 82 clientes activos, TODOS sin RFC ni
          razón social — los campos existían en la ficha y nadie los llenaba,
          porque llenar «cuando haya tiempo» es nunca. Aquí son parte del
          trámite y el recuadro no se cierra sin ellos. */}
      {faltanFiscales && (
        <div style={{ borderTop: '1px solid #ece7f8', marginTop: 12, paddingTop: 12 }}>
          <div style={{ fontSize: '0.8rem', color: '#4a4a52', marginBottom: 8 }}>
            Faltan sus <b>datos fiscales</b> — sin RFC y razón social no se le puede facturar.
          </div>
          <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
            <input value={fiscForm.razon_social || fisc?.razon_social || ''} onChange={e => setFiscForm({ ...fiscForm, razon_social: e.target.value })}
              placeholder="Razón social (como en su constancia)" style={inp} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
              <input value={fiscForm.rfc || fisc?.rfc || ''} onChange={e => setFiscForm({ ...fiscForm, rfc: e.target.value.toUpperCase() })}
                placeholder="RFC" style={{ ...inp, textTransform: 'uppercase' as const }} />
              <input value={fiscForm.cp_fiscal || fisc?.cp_fiscal || ''} onChange={e => setFiscForm({ ...fiscForm, cp_fiscal: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                placeholder="C.P. fiscal" style={inp} inputMode="numeric" />
            </div>
            <select value={fiscForm.regimen_fiscal || fisc?.regimen_fiscal || ''} onChange={e => setFiscForm({ ...fiscForm, regimen_fiscal: e.target.value })} style={inp as any}>
              <option value="">Régimen fiscal…</option>
              {REGIMENES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* La constancia: se arrastra o se escoge, y con eso basta. Sube
                por el mismo camino que los adjuntos de notas (PDF o foto). */}
            <label style={{ border: '1.5px dashed #cfc6f2', borderRadius: 10, padding: '11px 13px', fontSize: '0.76rem',
              color: constancia ? '#1E8A63' : '#6b5fa8', background: '#fff', cursor: 'pointer', textAlign: 'center' as const }}>
              {subiendo ? 'Subiendo la constancia…'
                : constancia ? `Constancia adjunta: ${constancia.nombre}`
                : 'Adjuntar su constancia de situación fiscal (PDF o foto)'}
              <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return;
                setSubiendo(true); setFiscError('');
                const fd = new FormData(); fd.append('file', file);
                const r = await fetch('/api/crm/notas/upload', { method: 'POST', body: fd }).then(x => x.json()).catch(err => ({ error: String(err) }));
                setSubiendo(false);
                if (r.error) { setFiscError(`La constancia no subió: ${r.error}`); return; }
                setConstancia({ url: r.url, nombre: file.name });
              }} />
            </label>

            <div>
              <button disabled={fiscOcupado || subiendo} onClick={async () => {
                const rfc = String(fiscForm.rfc || fisc?.rfc || '').trim().toUpperCase();
                const razon = String(fiscForm.razon_social || fisc?.razon_social || '').trim();
                const cp = String(fiscForm.cp_fiscal || fisc?.cp_fiscal || '').trim();
                const regimen = String(fiscForm.regimen_fiscal || fisc?.regimen_fiscal || '').trim();
                if (!razon) { setFiscError('Falta la razón social.'); return; }
                if (!RFC_OK.test(rfc)) { setFiscError('Ese RFC no tiene la forma correcta (ej. XAXX010101000).'); return; }
                if (!/^\d{5}$/.test(cp)) { setFiscError('El código postal son 5 dígitos.'); return; }
                if (!regimen) { setFiscError('Falta el régimen fiscal (viene en su constancia).'); return; }
                setFiscOcupado(true); setFiscError('');
                const r = await fetch('/api/crm/onboarding/cuenta', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ company_id: companyId, accion: 'fiscales', rfc, razon_social: razon,
                    cp_fiscal: cp, regimen_fiscal: regimen,
                    ...(constancia ? { constancia_url: constancia.url, constancia_nombre: constancia.nombre } : {}) }),
                }).then(x => x.json()).catch(err => ({ error: String(err) }));
                setFiscOcupado(false);
                if (r.error) { setFiscError(r.error); return; }
                setFisc({ rfc, razon_social: razon, cp_fiscal: cp, regimen_fiscal: regimen }); alCambiar?.();
              }} style={btn(true)}>{fiscOcupado ? 'Guardando…' : 'Guardar datos fiscales'}</button>
            </div>
            {fiscError && <div style={{ fontSize: '0.76rem', color: '#C0554E' }}>{fiscError}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
