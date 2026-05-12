// Mi perfil — sección personal del partner.
// Info completa, seguridad, sesiones, cuentas vinculadas.

import { useEffect, useState } from 'react';
import { fmt, fmtDate, fmtRel, isDemoMode, apiGet, copyToClipboard } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import { demoProfile } from '../../../data/partner-portal-demo';

type LoginEvent = {
  id: string;
  fecha: string;
  ubicacion: string;
  device: string;
  ip_short: string;
  current: boolean;
};

const DEMO_LOGINS: LoginEvent[] = [
  { id: 'l1', fecha: new Date(Date.now() - 5 * 60 * 1000).toISOString(),       ubicacion: 'Ciudad de México, MX',  device: 'Chrome · macOS',   ip_short: '189.203.•••', current: true },
  { id: 'l2', fecha: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),     ubicacion: 'Ciudad de México, MX',  device: 'Safari · iPhone',  ip_short: '189.203.•••', current: false },
  { id: 'l3', fecha: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),    ubicacion: 'Ciudad de México, MX',  device: 'Chrome · macOS',   ip_short: '189.203.•••', current: false },
  { id: 'l4', fecha: new Date(Date.now() - 3 * 86400000).toISOString(),        ubicacion: 'Querétaro, MX',         device: 'Safari · iPad',    ip_short: '187.156.•••', current: false },
  { id: 'l5', fecha: new Date(Date.now() - 7 * 86400000).toISOString(),        ubicacion: 'Ciudad de México, MX',  device: 'Chrome · macOS',   ip_short: '189.203.•••', current: false },
];

export default function MyAccountTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [allLogins, setAllLogins] = useState(false);

  useEffect(() => {
    apiGet('/api/partner-portal/profile', isDemoMode() ? demoProfile : undefined).then(p => {
      setProfile(p); setLoading(false);
    });
  }, []);

  if (loading) return <div style={SS.loading}>Cargando…</div>;

  const inv = profile?.invitation;
  const tipoLabels: Record<string, string> = {
    embajador: 'Embajador SACS',
    distribuidor: 'Distribuidor Autorizado',
    integrador: 'Integrador Certificado',
    reseller: 'Reseller',
    consultor: 'Consultor Partner',
  };
  const tipoLabel = inv?.tipo ? (tipoLabels[inv.tipo] || inv.tipo) : 'Partner SACS';
  const initials = (user.nombre || user.email || '?').charAt(0).toUpperCase();
  const direccion = profile?.direccion;
  const payout = profile?.payout;
  const signedAt = profile?.signed_at;
  const logins = isDemoMode() ? DEMO_LOGINS : [];
  const visibleLogins = allLogins ? logins : logins.slice(0, 3);

  return (
    <div>
      <h1 style={SS.h1Small}>Mi perfil</h1>
      <p style={SS.leadSm}>Toda tu información, tu certificación oficial, tu seguridad y tu actividad reciente.</p>

      {/* Hero · certificación de embajador */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
        color: '#fff',
        borderRadius: 18,
        padding: '40px 44px',
        marginBottom: 32,
        boxShadow: '0 12px 32px -16px rgba(75,123,229,0.35)',
        position: 'relative' as const,
        overflow: 'hidden' as const,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' as const }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            color: '#fff', fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            border: '3px solid rgba(255,255,255,0.35)',
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
              Certificación oficial
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              {user.nombre || 'Partner SACS'}
            </h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(255,255,255,0.18)', borderRadius: 999, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>
              <Icon.Certificate size={13} color="#fff" /> {tipoLabel}
            </div>
            {inv?.numero && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 12, fontFamily: 'SF Mono, Courier New, monospace' }}>
                {inv.numero}{signedAt ? ` · firmado ${fmtDate(signedAt)}` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Información personal */}
      <h2 style={SS.h2}>Tu información</h2>
      <div style={SS.card}>
        <InfoRow label="Nombre completo" value={user.nombre || '—'} />
        <InfoRow label="Email principal" value={user.email} action={{ label: 'Cambiar', onClick: () => setEmailOpen(true) }} />
        <InfoRow label="WhatsApp" value={inv?.whatsapp || '—'} />
        <InfoRow label="Empresa" value={inv?.empresa || '—'} />
        <InfoRow label="Tipo de partner" value={tipoLabel} />
        <InfoRow label="Programa firmado el" value={signedAt ? fmtDate(signedAt) : '—'} />
        <InfoRow label="Vigencia" value={inv?.vigencia || 'Renovación automática anual'} last />
      </div>

      {/* Dirección fiscal */}
      <h2 style={SS.h2}>Dirección fiscal</h2>
      <div style={SS.card}>
        {direccion ? (
          <>
            <InfoRow label="Calle y número" value={direccion.calle || '—'} />
            <InfoRow label="Colonia" value={direccion.colonia || '—'} />
            <InfoRow label="Ciudad" value={direccion.ciudad || '—'} />
            <InfoRow label="Estado" value={direccion.estado || '—'} />
            <InfoRow label="Código postal" value={direccion.cp || '—'} last />
          </>
        ) : (
          <div style={{ padding: 12, fontSize: 14, color: C.muted }}>
            Aún no registras tu dirección fiscal. La necesitamos para emitir tus pagos.
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-profile-dropdown'))}
              style={{ ...SS.btn, marginTop: 14, display: 'block' }}>
              Registrar dirección
            </button>
          </div>
        )}
      </div>

      {/* Forma de pago */}
      <h2 style={SS.h2}>Forma de pago</h2>
      <div style={SS.card}>
        {payout ? (
          <>
            <InfoRow label="Método" value={payout.metodo === 'transferencia' ? 'Transferencia SPEI' : payout.metodo} />
            <InfoRow label="Titular" value={payout.titular || '—'} />
            <InfoRow label="RFC" value={payout.rfc || '—'} />
            <InfoRow label="Banco" value={payout.banco || '—'} />
            <InfoRow label="CLABE" value={payout.clabe ? `•••${String(payout.clabe).slice(-6)}` : '—'} action={{ label: 'Actualizar', onClick: () => window.dispatchEvent(new CustomEvent('open-profile-dropdown')) }} last />
          </>
        ) : (
          <div style={{ padding: 12, fontSize: 14, color: C.muted }}>
            Aún no registras tu forma de pago.
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-profile-dropdown'))}
              style={{ ...SS.btn, marginTop: 14, display: 'block' }}>
              Registrar forma de pago
            </button>
          </div>
        )}
      </div>

      {/* Cuentas vinculadas */}
      <h2 style={SS.h2}>Cuentas vinculadas</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>Si manejas múltiples canales (empresa + personal), agrega cuentas adicionales bajo el mismo perfil de partner.</p>
      <div style={SS.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', gap: 16, flexWrap: 'wrap' as const }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
            <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: C.brandSoft, color: C.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.Mail size={16} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{user.email}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Cuenta principal · Activa</div>
            </div>
          </div>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: C.greenDark, background: 'rgba(42,181,160,0.12)', letterSpacing: '0.04em' }}>
            Principal
          </span>
        </div>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.borderSoft}` }}>
          <button onClick={() => alert('Para agregar otra cuenta escríbenos a partners@sacscloud.com. Verificamos identidad y la vinculamos a tu perfil de partner.')}
            style={{ ...SS.btnGhost, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon.Plus size={14} strokeWidth={2.2} /> Agregar otra cuenta
          </button>
        </div>
      </div>

      {/* Seguridad */}
      <h2 style={SS.h2}>Seguridad</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <SecurityCard
          Ico={Icon.Lock}
          title="Contraseña"
          desc="Última actualización hace 23 días"
          cta="Cambiar contraseña"
          onClick={() => setPwOpen(true)}
        />
        <SecurityCard
          Ico={Icon.AtSign}
          title="Email"
          desc="Para cambiar tu email te validamos identidad por WhatsApp"
          cta="Cambiar email"
          onClick={() => setEmailOpen(true)}
        />
      </div>

      <div style={{ ...SS.note, marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Icon.CheckCircle size={18} color={C.greenDark} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: C.text }}>Tu sesión está segura.</strong>{' '}
          Conexión HTTPS, contraseña hasheada, cookies HttpOnly. Si detectas algo extraño en tu actividad reciente, cierra sesión y notifícanos a <a href="mailto:partners@sacscloud.com" style={{ color: C.brand, fontWeight: 600 }}>partners@sacscloud.com</a>.
        </div>
      </div>

      {/* Login history */}
      <h2 style={SS.h2}>Actividad reciente</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>Las últimas veces que entraste a tu portal, con ubicación y dispositivo.</p>

      {logins.length === 0 ? (
        <div style={SS.empty}>Sin actividad registrada aún.</div>
      ) : (
        <div style={SS.tableWrap}>
          <table style={SS.table}>
            <thead>
              <tr>
                <th style={SS.th}>Cuándo</th>
                <th style={SS.th}>Ubicación</th>
                <th style={SS.th}>Dispositivo</th>
                <th style={SS.th}>IP</th>
                <th style={SS.th}>Sesión</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogins.map(l => (
                <tr key={l.id}>
                  <td style={SS.td}>
                    <div style={{ fontWeight: 500 }}>{fmtRel(l.fecha)}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{fmtDate(l.fecha)}</div>
                  </td>
                  <td style={SS.td}>{l.ubicacion}</td>
                  <td style={SS.td}>{l.device}</td>
                  <td style={{ ...SS.td, fontFamily: 'SF Mono, Courier New, monospace', fontSize: 12, color: C.muted }}>{l.ip_short}</td>
                  <td style={SS.td}>
                    {l.current ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.greenDark, fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenDark }} /> Activa
                      </span>
                    ) : (
                      <button onClick={() => alert('Sesión cerrada (demo)')}
                        style={{ background: 'transparent', border: 'none', color: C.brand, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                        Cerrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logins.length > 3 && !allLogins && (
        <button onClick={() => setAllLogins(true)} style={{ ...SS.btnGhost, marginTop: 14 }}>
          Ver historial completo ({logins.length})
        </button>
      )}

      {/* Modals (placeholder simples) */}
      {pwOpen && (
        <>
          <div style={SS.drawerBackdrop} onClick={() => setPwOpen(false)} />
          <div style={SS.drawer}>
            <button onClick={() => setPwOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
              <Icon.Close size={20} />
            </button>
            <h2 style={SS.h1Small}>Cambiar contraseña</h2>
            <p style={SS.leadSm}>Te validamos primero con tu contraseña actual.</p>
            <Field label="Contraseña actual"><input type="password" style={inputStyle} /></Field>
            <Field label="Nueva contraseña"><input type="password" style={inputStyle} /></Field>
            <Field label="Confirma nueva contraseña"><input type="password" style={inputStyle} /></Field>
            <button onClick={() => { alert('Contraseña actualizada (demo)'); setPwOpen(false); }} style={{ ...SS.btn, marginTop: 14 }}>
              Guardar contraseña
            </button>
          </div>
        </>
      )}

      {emailOpen && (
        <>
          <div style={SS.drawerBackdrop} onClick={() => setEmailOpen(false)} />
          <div style={SS.drawer}>
            <button onClick={() => setEmailOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
              <Icon.Close size={20} />
            </button>
            <h2 style={SS.h1Small}>Cambiar email</h2>
            <p style={SS.leadSm}>Por seguridad, cambiar tu email principal requiere validación humana. Escríbenos por WhatsApp con el nuevo email y validamos identidad en <strong>menos de 24h hábiles</strong>.</p>
            <Field label="Email actual"><input type="email" value={user.email} disabled style={{ ...inputStyle, opacity: 0.6 }} /></Field>
            <Field label="Nuevo email que quieres usar"><input type="email" style={inputStyle} placeholder="nuevo@email.mx" id="new-email-input" /></Field>
            <a href={`https://wa.me/5215536634392?text=${encodeURIComponent(`Hola, soy ${user.nombre || 'partner'} (${user.email}). Quiero cambiar mi email principal a otro. Te confirmo los detalles aquí.`)}`}
              target="_blank" rel="noopener"
              style={{ ...SS.btn, marginTop: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon.WhatsApp size={14} /> Pedir cambio por WhatsApp
            </a>
            <div style={{ ...SS.note, marginTop: 18, fontSize: 12 }}>
              Sin acceso a WhatsApp? Escríbenos a <a href="mailto:partners@sacscloud.com" style={{ color: C.brand, fontWeight: 600 }}>partners@sacscloud.com</a>.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value, action, last }: { label: string; value: string; action?: { label: string; onClick: () => void }; last?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 16, alignItems: 'center', padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${C.borderSoft}` }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{label}</span>
      <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{value}</span>
      {action ? (
        <button onClick={action.onClick}
          style={{ background: 'transparent', border: 'none', color: C.brand, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
          {action.label}
        </button>
      ) : <span />}
    </div>
  );
}

function SecurityCard({ Ico, title, desc, cta, onClick }: { Ico: (p: any) => JSX.Element; title: string; desc: string; cta: string; onClick: () => void }) {
  return (
    <div style={SS.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: C.brandSoft, color: C.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ico size={18} />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
        </div>
      </div>
      <button onClick={onClick} style={SS.btnGhost}>{cta}</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  background: '#fafafa',
  outline: 'none',
  boxSizing: 'border-box',
};
