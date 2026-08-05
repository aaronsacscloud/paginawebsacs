import { useEffect, useState } from 'react';
import { S } from './SubscriptionsTab';
import VincularMercadoPago from './VincularMercadoPago';
import CobrosSinIdentificar from './CobrosSinIdentificar';

/* ═══ Conectar Mercado Pago ═══
 * La cuenta PROPIA que recibe el dinero — no el OAuth de marketplace que usa
 * sacs_api para que cada comercio cobre a sus compradores. */

const card = { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 18, marginBottom: 14 } as const;
const lbl = { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 4, display: 'block' } as const;
const inp = { padding: '9px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.83rem', width: '100%', height: 44, boxSizing: 'border-box' as const };

export default function PasarelaMercadoPago() {
  const [e, setE] = useState<any>(null);
  const [modo, setModo] = useState<'prueba' | 'produccion'>('prueba');
  const [token, setToken] = useState('');
  const [secreto, setSecreto] = useState('');
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; x: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function cargar() {
    const j = await fetch('/api/crm/arr/pasarela').then(r => r.json()).catch(() => null);
    setE(j); if (j?.modo) setModo(j.modo);
  }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!token.trim()) { setMsg({ t: 'err', x: 'Pega el access token.' }); return; }
    setBusy(true); setMsg(null);
    const body: any = { modo, webhook_secret: secreto.trim() || undefined };
    body[modo === 'produccion' ? 'token_produccion' : 'token_prueba'] = token.trim();
    const j = await fetch('/api/crm/arr/pasarela', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json()).catch(() => ({ error: 'No se pudo guardar' }));
    setBusy(false);
    if (j?.error) { setMsg({ t: 'err', x: j.error }); return; }
    setMsg({ t: 'ok', x: `Conectado a la cuenta ${j.cuenta}${j.correo ? ' (' + j.correo + ')' : ''} en modo ${j.modo}.` });
    setToken(''); setSecreto(''); cargar();
  }

  async function cambiarModo(m: 'prueba' | 'produccion') {
    setBusy(true); setMsg(null);
    const j = await fetch('/api/crm/arr/pasarela', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modo: m }) })
      .then(r => r.json()).catch(() => ({ error: 'No se pudo cambiar' }));
    setBusy(false);
    if (j?.error) setMsg({ t: 'err', x: j.error }); else { setModo(m); cargar(); }
  }

  const urlWebhook = typeof window !== 'undefined' ? window.location.origin + '/api/revenue/mercadopago-webhook' : '';
  const enProd = e?.modo === 'produccion';

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>Cobro con Mercado Pago</div>
        <div style={{ fontSize: '0.8rem', color: '#8a8f98' }}>
          Tu cuenta, la que recibe el dinero de las suscripciones. No es la conexión de las tiendas
          de tus clientes — esa vive en SACS y es al revés.
        </div>
      </div>

      {/* Estado */}
      <div style={{ ...card, borderLeft: '4px solid ' + (e?.conectada ? (enProd ? '#1A8F7A' : '#a06600') : '#ddd') }}>
        {!e?.conectada ? (
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Todavía no hay ninguna cuenta conectada.</div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={lbl}>Cuenta conectada</div>
              <div style={{ fontWeight: 800 }}>{e.mp_nickname || e.mp_user_id}</div>
              {e.mp_email && <div style={{ fontSize: '0.74rem', color: '#999' }}>{e.mp_email}</div>}
            </div>
            <div>
              <div style={lbl}>Modo</div>
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 800,
                background: enProd ? 'rgba(42,181,160,.15)' : 'rgba(232,168,56,.18)', color: enProd ? '#1A8F7A' : '#a06600' }}>
                {enProd ? 'PRODUCCIÓN · cobra de verdad' : 'PRUEBA · no mueve dinero'}
              </span>
            </div>
            <div>
              <div style={lbl}>Token activo</div>
              <code style={{ fontSize: '0.76rem' }}>{e.token_visible}</code>
            </div>
            <div>
              <div style={lbl}>Firma del webhook</div>
              <span style={{ fontSize: '0.8rem', color: e.tiene_webhook_secret && !e.secreto_heredado ? '#1A8F7A' : '#E54B4B', fontWeight: 700 }}>
                {!e.tiene_webhook_secret ? 'FALTA' : e.secreto_heredado ? 'la del otro modo' : 'configurada'}
              </span>
              {e.webhook && (
                <div style={{ fontSize: '0.72rem', color: e.webhook.rechazados_7d ? '#E54B4B' : '#8C8C8C', marginTop: 2 }}>
                  {e.webhook.recibidos_7d} avisos en 7 días
                  {e.webhook.rechazados_7d ? ` · ${e.webhook.rechazados_7d} RECHAZADOS` : ''}
                </div>
              )}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button style={{ ...S.btnSmall, minHeight: 38 }} disabled={busy || !e.tiene_prueba} onClick={() => cambiarModo('prueba')}>Usar prueba</button>
              <button style={{ ...S.btnSmall, minHeight: 38 }} disabled={busy || !e.tiene_produccion} onClick={() => cambiarModo('produccion')}>Usar producción</button>
            </div>
          </div>
        )}
      </div>

      {/* La falla más cara de toda la integración: la clave de firma es POR
          ENTORNO, así que al pasar a producción con la de prueba Mercado Pago
          sigue avisando y el CRM rechaza cada aviso con 401. Se ve idéntico a
          "el cliente no ha pagado" — se le reclama a quien ya pagó y no se cobra
          el mes de quien sí debe. Por eso grita en vez de quedarse callado. */}
      {e?.conectada && e?.webhook?.rechazados_7d > 0 && (
        <div style={{ ...card, background: '#fdecea', borderColor: '#f0c4bd' }}>
          <div style={{ fontWeight: 800, color: '#E54B4B', fontSize: '0.85rem' }}>
            Mercado Pago está avisando y el CRM está rechazando sus avisos ({e.webhook.rechazados_7d} en 7 días)
          </div>
          <div style={{ fontSize: '0.8rem', color: '#7a3a33', marginTop: 4 }}>
            {e.webhook.ultimo_rechazo?.motivo || 'firma inválida'}. Esos pagos NO se están registrando: los
            clientes aparecen como que no pagaron aunque sí. Casi siempre es que la clave secreta guardada es
            la del otro modo — en Mercado Pago cada entorno tiene la suya. Copia la de <b>{e.modo}</b> y
            vuelve a guardar la conexión abajo.
          </div>
        </div>
      )}

      {e?.conectada && e?.secreto_heredado && !e?.webhook?.rechazados_7d && (
        <div style={{ ...card, background: '#fff7e8', borderColor: '#f0dcb8' }}>
          <div style={{ fontWeight: 800, color: '#a06600', fontSize: '0.85rem' }}>
            La clave del webhook de {e.modo} nunca se capturó
          </div>
          <div style={{ fontSize: '0.8rem', color: '#7a5a1a', marginTop: 4 }}>
            Se está usando la que guardaste antes. Si es de otro entorno, Mercado Pago va a avisar de cada
            pago y el CRM lo va a rechazar sin registrarlo. Captura la clave de <b>{e.modo}</b> abajo.
          </div>
        </div>
      )}

      {!e?.tiene_webhook_secret && e?.conectada && (
        <div style={{ ...card, background: '#fdecea', borderColor: '#f0c4bd' }}>
          <div style={{ fontWeight: 800, color: '#b93333', fontSize: '0.85rem' }}>Falta la clave secreta del webhook</div>
          <div style={{ fontSize: '0.8rem', color: '#7a3a33', marginTop: 4 }}>
            Sin ella no se puede verificar que el aviso venga de Mercado Pago, y cualquiera que
            adivine la URL podría marcar suscripciones como pagadas. Se genera en la sección
            <b> Webhooks</b> de tu aplicación en Mercado Pago.
          </div>
        </div>
      )}

      {/* Alta de credenciales */}
      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Conectar o actualizar credenciales</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['prueba', 'produccion'] as const).map(m => (
            <button key={m} onClick={() => setModo(m)}
              style={{ ...S.btnSmall, minHeight: 38, fontWeight: modo === m ? 800 : 600,
                background: modo === m ? '#1a1a1a' : '#fff', color: modo === m ? '#fff' : '#333', border: modo === m ? 'none' : '1px solid #ddd' }}>
              {m === 'prueba' ? 'Token de prueba' : 'Token de producción'}
            </button>
          ))}
        </div>
        <label style={lbl}>Access token {modo === 'prueba' ? '(empieza con TEST-)' : '(empieza con APP_USR-)'}</label>
        <input value={token} onChange={ev => setToken(ev.target.value)} placeholder={modo === 'prueba' ? 'TEST-…' : 'APP_USR-…'} style={inp} />
        <label style={{ ...lbl, marginTop: 10 }}>Clave secreta del webhook (opcional aquí, obligatoria para cobrar)</label>
        <input value={secreto} onChange={ev => setSecreto(ev.target.value)} placeholder="la de la sección Webhooks de tu aplicación" style={inp} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={guardar} disabled={busy}
            style={{ ...S.btn, minHeight: 44, padding: '0 18px', background: '#1a1a1a', color: '#fff', border: 'none', fontWeight: 700 }}>
            {busy ? 'Verificando…' : 'Verificar y guardar'}
          </button>
          <span style={{ fontSize: '0.76rem', color: '#8a8f98' }}>
            Se le pregunta a Mercado Pago de quién es el token antes de guardarlo.
          </span>
        </div>
        {msg && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
            background: msg.t === 'ok' ? '#e8f5e9' : '#fdecea', color: msg.t === 'ok' ? '#1b5e20' : '#b93333' }}>{msg.x}</div>
        )}
      </div>

      {e?.conectada && <VincularMercadoPago />}
      {e?.conectada && <CobrosSinIdentificar />}

      {/* Lo que hay que pegar en Mercado Pago */}
      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Configura esto en Mercado Pago</div>
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>
          En tu aplicación → <b>Webhooks</b>, pega esta URL y activa <b>Pagos</b> y <b>Suscripciones</b>:
        </div>
        <code style={{ display: 'block', padding: '10px 12px', background: '#f6f8fa', borderRadius: 8, fontSize: '0.78rem', wordBreak: 'break-all' }}>{urlWebhook}</code>
        <div style={{ fontSize: '0.76rem', color: '#a06600', marginTop: 8, background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 8, padding: '8px 10px' }}>
          Usa la sección <b>Webhooks</b>, no <b>IPN</b>. El IPN es el formato viejo de Mercado Pago y
          la protección contra falsificación del CRM lo rechaza antes de procesarlo — los avisos se
          perderían sin dejar rastro.
        </div>
        <div style={{ fontSize: '0.76rem', color: '#666', marginTop: 8, background: '#f6f8fa', border: '1px solid #e9eaee', borderRadius: 8, padding: '8px 10px' }}>
          <b>La aplicación va creada como “Suscripciones”</b>, no como Checkout Pro: Checkout Pro solo
          hace cobros únicos. El token sirve para las dos APIs, pero el producto define qué eventos
          te deja activar aquí. Si no te aparece <b>Suscripciones</b> en la lista de eventos, la
          aplicación quedó mal y hay que rehacerla.
          <div style={{ marginTop: 6 }}>
            Y ojo: las suscripciones domiciliadas de Mercado Pago <b>solo funcionan con tarjeta</b>.
            Quien pague por OXXO o transferencia va por link de pago — por eso el CRM maneja los dos.
          </div>
        </div>
      </div>
    </div>
  );
}
