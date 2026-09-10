// ══ «Cuenta de Sacs»: la identidad de la cuenta, dentro de Info general ═════
//
// Vivía en Actividad. No era su sitio: qué cuenta de Sacs opera este cliente y
// con qué datos se le factura es información DEL CLIENTE, igual que su razón
// social o su ciudad. Actividad se queda con lo que sí es actividad —pagos,
// notas, línea de tiempo—.
//
// La tarjeta enseña dos cosas y en este orden:
//   1. la cuenta   — cuál es, desde cuándo, y si el alta dejó algo pendiente
//                    (activar la prueba, ligarla, o crearla);
//   2. lo fiscal   — razón social, RFC, C.P., régimen y constancia.
//
// Y es el ÚNICO lugar donde se capturan esos cinco. Info general los tenía
// también, en dos cajas sueltas que escribían las mismas columnas por otro
// camino —uno que no valida el RFC—, así que un RFC imposible entraba sin
// revisar y el alta lo daba por bueno. Aquí se leen escritos y se editan con
// el formulario que sí valida.
import { useEffect, useState } from 'react';
import DatosFiscales from './DatosFiscales';
import { faltanFiscales, textoFaltantes } from '../../../lib/crm/fiscal.ts';

const btn = (primario = false) => ({
  border: '1px solid', borderColor: primario ? '#5B4BD6' : '#ddd6fb',
  background: primario ? '#5B4BD6' : '#fff', color: primario ? '#fff' : '#5B4BD6',
  borderRadius: 9, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit' as const,
});
const inp = { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', background: '#fdfcff', fontFamily: 'inherit' as const, outline: 'none', width: '100%', boxSizing: 'border-box' as const };
const chip = (bg: string, fg: string) => ({ display: 'inline-block', fontSize: '0.66rem', fontWeight: 700, borderRadius: 20, padding: '3px 10px', background: bg, color: fg, whiteSpace: 'nowrap' as const });
const lbl = { fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#a5a2af' };

const fechaCorta = (d?: string | null) => d
  ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  : null;

/** Un dato escrito, no una caja. Vacío se dice, no se pinta un guion. */
function Leido({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <div style={lbl}>{k}</div>
      <div style={{ fontSize: '0.88rem', fontWeight: v ? 700 : 500, marginTop: 3, color: v ? '#241d43' : '#a5a2af', wordBreak: 'break-word' }}>
        {v || 'sin capturar'}
      </div>
    </div>
  );
}

export default function CuentaCliente({ companyId, alCambiar }: { companyId: string; alCambiar?: () => void }) {
  const [st, setSt] = useState<any>(null);
  const [modo, setModo] = useState<'' | 'crear' | 'ligar'>('');
  const [f, setF] = useState<any>({ cuenta: '', email: '', whatsapp: '' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<any>(null);
  /* Los fiscales se LEEN por defecto y se editan al pedirlo, como el resto de
     Info general. Si faltan, el formulario se abre solo: el alta no se cierra
     sin ellos y esconderlo detrás de un botón es como no pedirlos. */
  const [editFisc, setEditFisc] = useState(false);

  const cargar = () => fetch(`/api/crm/onboarding/cuenta?company_id=${companyId}`)
    .then(r => r.json()).then(setSt).catch(() => {});
  /* Un solo viaje: el GET ya devuelve los fiscales. La segunda llamada con
     `&fiscales=1` pedía lo mismo dos veces —el parámetro nunca existió—. */
  useEffect(() => { setSt(null); setListo(null); setModo(''); setEditFisc(false); cargar(); /* eslint-disable-next-line */ }, [companyId]);

  if (!st || st.error) return null;
  /* El CAMINO lo calcula el servidor, que sí compara la prueba contra la
     cuenta LIGADA. Mirar «alguna prueba sin convertir» de la empresa hacía
     que, con una prueba de otra cuenta, el panel afirmara que la cuenta
     ligada era de prueba: cada clic llamaba a SACS sobre una cuenta que nunca
     lo fue, 502 permanente, y el recuadro no se cerraba nunca. */
  const pruebaViva = st.camino === 'activar' && !!st.cuenta;
  const sinCuenta = !st.cuenta;
  const fisc = st.fiscales || {};
  const faltan = faltanFiscales(fisc);

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
    <div style={{ background: '#fff', border: '1.5px solid #ddd6fb', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        Cuenta de Sacs
        {(sinCuenta || pruebaViva || faltan) && (
          <span style={{ ...chip('#FFF4E5', '#9a6a10'), marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
            Alta sin cerrar
          </span>
        )}
      </div>

      {/* ── 1 · La cuenta ────────────────────────────────────────────────── */}
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
      ) : sinCuenta ? (
        <div>
          <div style={{ background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 10, padding: '10px 13px', fontSize: '0.79rem', color: '#7a5a10', marginBottom: 10, lineHeight: 1.5 }}>
            <b>Este cliente todavía no tiene cuenta de Sacs.</b> Sin cuenta no hay sistema que usar ni onboarding que medir.
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
      ) : (
        /* ── Hay cuenta ──
           Este caso NO existía: el recuadro solo distinguía «¿prueba viva?», y
           si no lo era caía en el texto de «no tiene cuenta ligada» aunque la
           tuviera. Como el recuadro se queda abierto mientras falten los
           fiscales, 142 clientes CON cuenta estaban leyendo que no la tienen y
           viendo un botón para crearles otra. */
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#241d43', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{st.cuenta}</span>
            {pruebaViva
              ? <span style={chip('#FFF4E5', '#9a6a10')}>Prueba</span>
              : <span style={chip('#EAF8F2', '#1E8A63')}>Activa</span>}
          </div>
          {st.ligada_at && (
            <div style={{ fontSize: '0.75rem', color: '#8a8590', marginTop: 3 }}>
              Ligada desde el {fechaCorta(st.ligada_at)}
            </div>
          )}
          {pruebaViva && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '0.79rem', color: '#7a5a10', background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 10, padding: '10px 13px', marginBottom: 8, lineHeight: 1.5 }}>
                Sigue marcada como <b>prueba</b> y su vencimiento corre aunque ya sea cliente.
              </div>
              <button disabled={ocupado} onClick={() => manda({ accion: 'activar' })} style={btn(true)}>
                {ocupado ? 'Activando…' : 'Activar: volverla indefinida'}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: '0.76rem', color: '#C0554E', marginTop: 8 }}>{error}</div>}

      {/* ── 2 · Los datos fiscales: la otra mitad del alta ────────────────
          Medido al construirlo: los 82 clientes activos, TODOS sin RFC ni
          razón social — los campos existían en la ficha y nadie los llenaba,
          porque llenar «cuando haya tiempo» es nunca. Aquí son parte del
          trámite y el alta no se cierra sin ellos.
          El formulario es el MISMO que pide el alta de pago (DatosFiscales):
          dos copias significan que en un mes un lado acepta un RFC que el otro
          rechaza, y el cliente se entera pidiendo su factura. */}
      <div style={{ borderTop: '1px solid #f4f3f7', marginTop: 14, paddingTop: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
          <span style={{ ...lbl, fontSize: '0.62rem' }}>Datos fiscales</span>
          {/* Sin sello aquí: el encabezado de la tarjeta ya dice «Alta sin
              cerrar», y dos avisos del mismo pendiente a diez píxeles uno del
              otro se leen como dos pendientes. */}
          {!faltan && !editFisc && (
            <button onClick={() => setEditFisc(true)} style={{ ...btn(), marginLeft: 'auto', padding: '5px 11px', fontSize: '0.74rem' }}>Editar</button>
          )}
        </div>

        {(faltan || editFisc) ? (
          <div style={{ maxWidth: 430 }}>
            {faltan && (
              <div style={{ background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 10, padding: '10px 13px', fontSize: '0.79rem', color: '#7a5a10', marginBottom: 10, lineHeight: 1.5 }}>
                <b>{textoFaltantes(fisc)}.</b> Sin esto no se le puede facturar cuando lo pida.
              </div>
            )}
            <DatosFiscales companyId={companyId} fisc={fisc} sinIntro
              onCancelar={editFisc && !faltan ? () => setEditFisc(false) : undefined}
              onGuardado={d => {
                setSt({ ...st, fiscales: { ...fisc, ...d } });
                setEditFisc(false); alCambiar?.();
              }} />
          </div>
        ) : (
          /* Leídos, no en cajas. Son los MISMOS campos que antes se tecleaban
             sueltos en Info general; ahí quedaron solo de lectura. */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px 16px' }}>
            <Leido k="Razón social" v={fisc.razon_social} />
            <Leido k="RFC" v={fisc.rfc} />
            <Leido k="C.P. fiscal" v={fisc.cp_fiscal} />
            <Leido k="Régimen fiscal" v={fisc.regimen_fiscal} />
            <div>
              <div style={lbl}>Constancia</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, marginTop: 3 }}>
                {fisc.constancia_fiscal_url
                  ? <a href={fisc.constancia_fiscal_url} target="_blank" rel="noopener" style={{ color: '#5B4BD6', textDecoration: 'none', wordBreak: 'break-word' }}>
                      {fisc.constancia_fiscal_nombre || 'Ver la constancia'}
                    </a>
                  : <span style={{ fontWeight: 500, color: '#a5a2af' }}>sin adjuntar</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
