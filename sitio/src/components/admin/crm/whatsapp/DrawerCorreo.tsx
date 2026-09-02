/**
 * EL CORREO, COMPLETO Y SIN SALIR DEL INBOX.
 *
 * Antes esto enseñaba el asunto, si lo abrió y las cuatro primeras líneas. Con
 * eso no se sabe lo que hace falta antes de contestar: QUÉ correo es, POR QUÉ
 * salió y cómo se ve entero. Ahora lo dice y lo enseña.
 */
import { useEffect, useState } from 'react';
import { C } from './estilo';
import Sheet from '../ui/Sheet';

const fecha = (s?: string | null) => s
  ? new Date(s).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  : '';

export default function DrawerCorreo({ correo, onCerrar, onVerSecuencia }: {
  correo: any | null; onCerrar: () => void;
  onVerSecuencia?: (o: { id?: string | null; nombre?: string | null }) => void;
}) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!correo?.id) { setD(null); return; }
    setD(null); setCargando(true);
    fetch(`/api/crm/email/envio?id=${encodeURIComponent(correo.id)}`)
      .then(r => r.json())
      .then(j => setD(j?.error ? null : j))
      .catch(() => setD(null))
      .finally(() => setCargando(false));
  }, [correo?.id]);

  /* Mientras carga el detalle se enseña lo que YA venía en el hilo. Un cajón
     en blanco durante dos segundos se siente roto. */
  const e = d?.envio || correo || {};
  const abierto = e.abierto_at;
  const rebotó = e.estado === 'bounced' || e.rebote_at;
  const p = d?.porque;

  return (
    <Sheet open={!!correo} onClose={onCerrar} title="Correo enviado" width={640}>
      {correo && (
        <div style={{ padding: '6px 2px 24px' }}>
          {/* ── QUÉ CORREO ES ── */}
          {p && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase',
                background: p.tipo === 'secuencia' ? C.moradoAgua : p.tipo === 'campana' ? C.azulAgua : C.g100,
                color: p.tipo === 'secuencia' ? C.moradoTinta : p.tipo === 'campana' ? C.azulTinta : C.g500,
                borderRadius: 999, padding: '3px 10px' }}>
                {p.tipo === 'secuencia' ? 'De una secuencia' : p.tipo === 'campana' ? 'De una campaña' : 'Del sistema'}
              </span>
              {d?.plantilla?.nombre && (
                <span style={{ fontSize: 11, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '3px 10px' }}>
                  {d.plantilla.nombre}
                </span>
              )}
            </div>
          )}

          <div style={{ fontSize: 17, fontWeight: 800, color: '#241d43', lineHeight: 1.35 }}>
            {e.asunto || 'Sin asunto registrado'}
          </div>
          <div style={{ fontSize: 12, color: C.g400, marginTop: 4 }}>
            {e.para ? <>Para <b style={{ color: C.g500 }}>{e.para}</b> · </> : null}
            Enviado {fecha(e.enviado_at)}
          </div>

          {/* ── POR QUÉ SALIÓ ── */}
          {p && p.tipo !== 'transaccional' && (
            <div style={{ marginTop: 12, padding: '11px 13px', borderRadius: 10, background: C.moradoSuave, border: `1px solid ${C.moradoAgua}` }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.moradoTinta }}>Por qué salió</div>
              <div style={{ fontSize: 13.5, color: '#2f2a4a', marginTop: 4, lineHeight: 1.5 }}>
                {p.tipo === 'secuencia'
                  ? <>Es el paso {p.paso ? <>del <b>día {p.paso.dia}</b> </> : null}de la secuencia <b>{p.nombre || 'sin nombre'}</b>.</>
                  : <>Salió en la campaña <b>{p.nombre || 'sin nombre'}</b>.</>}
              </div>
              {p.tipo === 'secuencia' && onVerSecuencia && (
                <span role="link" tabIndex={0}
                  onClick={() => onVerSecuencia({ id: p.secuencia_id, nombre: p.nombre })}
                  onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onVerSecuencia({ id: p.secuencia_id, nombre: p.nombre }); } }}
                  style={{ display: 'inline-block', marginTop: 7, fontSize: 12, fontWeight: 700, color: C.moradoTinta, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
                  Ver qué más manda y qué sigue
                </span>
              )}
            </div>
          )}

          {/* ── LO ABRIÓ O NO ── */}
          <div style={{ marginTop: 12, borderRadius: 10, padding: '11px 13px',
            background: rebotó ? C.ambar50 : abierto ? '#EAF8F2' : '#F6F6F9',
            border: `1px solid ${rebotó ? C.ambar200 : abierto ? '#BFE7D6' : '#e9e8ef'}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: rebotó ? C.ambar700 : abierto ? '#0F766E' : '#6b6875' }}>
              {rebotó ? 'Rebotó: no llegó a su bandeja'
                : abierto ? `Lo abrió${e.aperturas > 1 ? ` ${e.aperturas} veces` : ''}`
                : 'Todavía no lo abre'}
            </div>
            {rebotó && e.rebote_motivo && (
              <div style={{ fontSize: 12, color: '#6b5a2e', marginTop: 3 }}>{e.rebote_motivo}</div>
            )}
            {abierto && <div style={{ fontSize: 12, color: '#4b4956', marginTop: 3 }}>La primera vez, {fecha(abierto)}</div>}
            {e.clics > 0 && (
              <div style={{ fontSize: 12, color: '#4b4956', marginTop: 3 }}>
                Dio clic {e.clics === 1 ? 'una vez' : `${e.clics} veces`}
                {Array.isArray(e.links) && e.links.length ? `: ${e.links.slice(0, 3).join(', ')}` : ''}
              </div>
            )}
          </div>

          {/* ── EL CORREO, COMPLETO ── */}
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.g400, margin: '18px 0 6px' }}>
            Así se ve
          </div>
          {cargando && <div style={{ fontSize: 13, color: C.g400, padding: '10px 0' }}>Cargando el correo…</div>}
          {!cargando && d?.html && (
            <>
              {/* En un iframe AISLADO: el HTML de un correo trae sus propios
                  estilos y, suelto, se los impone al CRM. `sandbox` sin
                  allow-scripts porque aquí solo se mira. */}
              {/* Alto por viewport, no fijo: en el teléfono la hoja es de pantalla
                  completa y 420 px dejaban el correo asomándose por una ranura,
                  con casi toda la hoja vacía debajo. */}
              <iframe title="Vista previa del correo" srcDoc={d.html} sandbox=""
                style={{ width: '100%', height: 'min(60dvh, 480px)', minHeight: 300, border: `1px solid ${C.g200}`, borderRadius: 10, background: '#fff' }} />
              {/* Es la plantilla con los datos de este contacto, no una copia
                  byte a byte de lo que salió: eso no se guarda. Decirlo es más
                  barato que perder la confianza en el espejo. */}
              {!d.exacto && (
                <div style={{ fontSize: 11.5, color: C.g400, marginTop: 6, lineHeight: 1.5 }}>
                  Es la plantilla con los datos de {p?.tipo === 'campana' ? 'este contacto' : 'este contacto'}. El correo exacto que salió del servidor no se guarda, así que pueden variar detalles menores.
                </div>
              )}
            </>
          )}
          {!cargando && !d?.html && (
            e.extracto ? (
              <div style={{ fontSize: 13.5, color: '#4b4956', lineHeight: 1.65 }}>{e.extracto}…</div>
            ) : (
              <div style={{ fontSize: 12.5, color: C.g400, lineHeight: 1.55 }}>
                De este envío no se guardó el contenido — es anterior al cambio que empezó a registrarlo, o lo arma el sistema al vuelo (un recordatorio, un acuse). Los de plantilla sí se ven completos.
              </div>
            )
          )}
        </div>
      )}
    </Sheet>
  );
}
