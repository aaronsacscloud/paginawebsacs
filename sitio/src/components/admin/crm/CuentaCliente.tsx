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

export default function CuentaCliente({ companyId, alCambiar }: { companyId: string; alCambiar?: () => void }) {
  const [st, setSt] = useState<any>(null);
  const [modo, setModo] = useState<'' | 'crear' | 'ligar'>('');
  const [f, setF] = useState<any>({ cuenta: '', email: '', whatsapp: '' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<any>(null);

  const cargar = () => fetch(`/api/crm/onboarding/cuenta?company_id=${companyId}`).then(r => r.json()).then(setSt).catch(() => {});
  useEffect(() => { cargar(); }, [companyId]);

  if (!st || st.error) return null;
  const pruebaViva = (st.pruebas || []).some((p: any) => p.prueba_estado && p.prueba_estado !== 'convertida');
  // Trámite cerrado: cuenta ligada y ninguna prueba por convertir.
  if (st.cuenta && !pruebaViva && !listo) return null;

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
    </div>
  );
}
