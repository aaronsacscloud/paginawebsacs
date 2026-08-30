/**
 * La cuenta de SACS del cliente: cómo está y cómo apagarla o reabrirla.
 *
 * UNO SOLO para la ficha del lead y para el inbox. Son las dos pantallas donde
 * de verdad se decide —quien cobra tiene el hilo de WhatsApp abierto delante y
 * la ficha al lado— y tenerlo dos veces garantizaba que un día dijeran cosas
 * distintas sobre la misma cuenta.
 *
 * El estado se LEE de SACS al montar, no se recuerda: basta con que alguien la
 * reabra desde sacs3 para que el CRM enseñe un candado que ya no existe, y de
 * las dos pantallas la que miente siempre es la que recuerda.
 *
 * Sin cuenta ligada no se pinta nada. Un lead que todavía no prueba nada no
 * necesita un renglón que le diga que no tiene cuenta.
 */
import { useEffect, useState } from 'react';

const MOTIVOS = [
  { id: 'pago', label: 'Falta de pago', pide_monto: true, ayuda: 'Ve el adeudo y los datos para depositar.' },
  { id: 'prueba', label: 'Se acabó la prueba', pide_monto: false, ayuda: 'Ve la invitación a contratar, con WhatsApp.' },
  { id: 'terminos', label: 'Violación de términos', pide_monto: false, ayuda: 'Ve el aviso legal, sin datos de pago.' },
] as const;

const ETIQUETA: Record<string, string> = { pago: 'falta de pago', prueba: 'fin de prueba', terminos: 'violación de términos' };

export default function CuentaSacs({ contactId, companyId, compacto, alCambiar }: {
  contactId?: string | null; companyId?: string | null; compacto?: boolean; alCambiar?: () => void;
}) {
  const [est, setEst] = useState<any>(null);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<string>('pago');
  const [adeudo, setAdeudo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = () => {
    const qs = new URLSearchParams();
    if (contactId) qs.set('contact_id', contactId);
    if (companyId) qs.set('company_id', companyId);
    if (![...qs.keys()].length) return;
    fetch(`/api/crm/sacs-bloqueo?${qs}`).then(r => r.json()).then(setEst).catch(() => setEst({ cuenta: null }));
  };
  useEffect(cargar, [contactId, companyId]);

  if (!est || !est.cuenta) return null;

  const mandar = async (accion: 'bloquear' | 'desbloquear') => {
    setOcupado(true); setErr(null);
    const r = await fetch('/api/crm/sacs-bloqueo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, company_id: companyId, accion, motivo, adeudo }),
    }).then(x => x.json()).catch(() => ({ error: 'Sin conexión' }));
    setOcupado(false);
    if (r.error) { setErr(r.error); return; }
    setAbierto(false); setAdeudo(''); cargar(); alCambiar?.();
  };

  /* Si la lectura falló NO se dice «activa»: se dice que no se sabe.
     Pintar «activa» porque la consulta tronó es la peor mentira posible aquí —
     alguien vería una cuenta que en realidad está apagada y cerraría el caso. */
  const sinDato = !!est.error;
  const bloqueada = est.bloqueada === true;
  const pideMonto = MOTIVOS.find(m => m.id === motivo)?.pide_monto;

  const marco: React.CSSProperties = {
    background: '#fff', border: `1.5px solid ${bloqueada ? '#f7c9c5' : '#e7e4f2'}`,
    borderRadius: 12, padding: compacto ? '12px 13px' : '15px 16px', marginBottom: compacto ? 10 : 14,
  };
  const btnRojo: React.CSSProperties = { border: 'none', borderRadius: 9, padding: '8px 13px', background: '#C0554E', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 };
  const btnVerde: React.CSSProperties = { border: 'none', borderRadius: 9, padding: '8px 13px', background: '#1E8A63', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 };
  const btnGris: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 9, padding: '8px 13px', background: '#fff', fontSize: '0.75rem', fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 };
  const campo: React.CSSProperties = { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 10px', fontSize: '0.78rem', background: '#fdfcff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={marco}>
      <div style={{ fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.9px', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 8 }}>
        Cuenta de SACS
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', borderRadius: 20, padding: '3px 10px', background: sinDato ? '#F1F0F4' : bloqueada ? '#FBECEA' : '#EAF8F2', color: sinDato ? '#6b6b74' : bloqueada ? '#C0554E' : '#1E8A63' }}>
          {sinDato ? 'no se pudo consultar' : bloqueada ? `revocada · ${ETIQUETA[est.motivo] || est.motivo || 'sin motivo'}` : 'activa'}
        </span>
      </div>

      <div style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{est.cuenta}</div>
      <div style={{ fontSize: '0.74rem', color: bloqueada ? '#C0554E' : '#6b6b74', marginTop: 4, lineHeight: 1.55 }}>
        {sinDato
          ? <>SACS no contestó, así que <b>no se sabe</b> si está abierta o revocada: <span style={{ color: '#a5a2af' }}>{est.error}</span></>
          : bloqueada
            ? 'Al entrar ve el aviso a pantalla completa y no puede operar. Lo único que puede hacer es cerrar sesión.'
            : 'Entra y opera con normalidad.'}
      </div>

      {/* El hueco que nadie ve hasta que muerde: el aviso es de la web. */}
      {bloqueada && (
        <div style={{ marginTop: 9, background: '#FFF8E9', border: '1px solid #f2e0b5', borderRadius: 9, padding: '8px 11px', fontSize: '0.72rem', color: '#7a5a12', lineHeight: 1.5 }}>
          El candado es de <b>sacs3 en el navegador</b>. La app móvil y la API no lo validan todavía: quien tenga la APK abierta puede seguir operando.
        </div>
      )}

      {err && <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#C0554E', lineHeight: 1.5 }}>{err}</div>}

      {abierto ? (
        <div style={{ marginTop: 11 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Por qué se revoca</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {MOTIVOS.map(m => (
              <button key={m.id} onClick={() => setMotivo(m.id)}
                style={{ border: '1.5px solid', borderColor: motivo === m.id ? '#c9bcf7' : '#e4e2ea', background: motivo === m.id ? '#F3F0FF' : '#fff', color: motivo === m.id ? '#5B4BD6' : '#6b6b74', borderRadius: 999, padding: '7px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 38 }}>
                {m.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 6, lineHeight: 1.5 }}>
            {MOTIVOS.find(m => m.id === motivo)?.ayuda} El texto exacto sale de la configuración de SACS, no de aquí.
          </div>
          {pideMonto && (
            <div style={{ marginTop: 9 }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Cuánto debe</div>
              <input value={adeudo} onChange={e => setAdeudo(e.target.value)} placeholder="12,400" style={campo} />
              <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 4 }}>Sale en el aviso. Un «no especificado» le quita toda la fuerza al mensaje.</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
            <button style={{ ...btnRojo, opacity: ocupado || (pideMonto && !adeudo.trim()) ? .5 : 1 }}
              disabled={ocupado || (!!pideMonto && !adeudo.trim())} onClick={() => mandar('bloquear')}>
              {ocupado ? 'Revocando…' : 'Revocar la cuenta'}
            </button>
            <button style={btnGris} onClick={() => { setAbierto(false); setErr(null); }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
          {/* Con el estado desconocido no se ofrece ni revocar ni reabrir:
              apretar a ciegas puede reabrirle la cuenta a quien la tenía
              apagada por términos. Primero hay que poder leerla. */}
          {sinDato ? <button style={btnGris} onClick={cargar}>Reintentar</button>
            : bloqueada
              ? <button style={btnVerde} disabled={ocupado} onClick={() => mandar('desbloquear')}>{ocupado ? 'Reabriendo…' : 'Reabrir la cuenta'}</button>
              : <button style={btnGris} onClick={() => setAbierto(true)}>Revocar acceso…</button>}
        </div>
      )}
    </div>
  );
}
