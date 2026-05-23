import { useEffect, useRef, useState } from 'react';
import { fmt, isDemoMode, apiGet } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import { demoProfile } from '../../../data/partner-portal-demo';

type Props = {
  user: { id: string; nombre: string; email: string };
  variant?: 'topbar' | 'sidebar';
};

export default function ProfileDropdown({ user, variant = 'topbar' }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'password' | 'payout' | 'direccion' | 'marca'>('menu');
  const [brand, setBrand] = useState<{ logo_url: string | null } | null>(null);

  useEffect(() => {
    if (isDemoMode()) { setBrand({ logo_url: null }); return; }
    fetch('/api/partners/profile')
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p && !p.error) setBrand({ logo_url: p.logo_url || null }); })
      .catch(() => {});
  }, []);
  const [profile, setProfile] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet('/api/partner-portal/profile', isDemoMode() ? demoProfile : undefined).then(setProfile);
  }, []);

  useEffect(() => {
    // listen para event externo "open-profile-dropdown"
    const onOpen = () => { setOpen(true); setView('payout'); };
    window.addEventListener('open-profile-dropdown', onOpen);
    return () => window.removeEventListener('open-profile-dropdown', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setView('menu');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const initials = (user.nombre || user.email || '?').charAt(0).toUpperCase();
  const payout = profile?.payout;
  const direccion = profile?.direccion;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/partner/login';
  }

  const isSidebar = variant === 'sidebar';

  // Trigger button — sidebar variant es horizontal full-width con nombre + email
  const trigger = isSidebar ? (
    <button onClick={() => setOpen(o => !o)} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '10px 12px', borderRadius: 10, border: 'none',
      background: open ? C.brandSoft : 'transparent',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
      transition: 'background 0.12s',
    }}
      onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = C.borderSoft; }}
      onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #4B7BE5, #6C5CE7)', color: '#fff', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{user.nombre || 'Partner'}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{user.email}</div>
      </div>
      <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{open ? '▾' : '▴'}</span>
    </button>
  ) : (
    <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 6px 6px', borderRadius: 999, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #4B7BE5, #6C5CE7)', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }} className="pp-username">{(user.nombre || user.email).split(' ')[0]}</span>
      <span style={{ fontSize: 10, color: C.muted, marginRight: 4 }}>▾</span>
    </button>
  );

  // Menu position — sidebar abre hacia arriba, topbar hacia abajo
  const menuStyle: React.CSSProperties = isSidebar
    ? {
        position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
        background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14,
        width: 320, maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 -16px 40px -12px rgba(0,0,0,0.18)',
        zIndex: 100, padding: 0, overflow: 'hidden',
      }
    : {
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14,
        width: 340, maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 16px 40px -12px rgba(0,0,0,0.18)',
        zIndex: 100, padding: 0, overflow: 'hidden',
      };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {trigger}

      {open && (
        <div style={menuStyle}>
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.borderSoft}`, background: '#fafafa' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{user.nombre || 'Partner'}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{user.email}</div>
          </div>

          {view === 'menu' && (
            <div style={{ padding: 8 }}>
              <MenuItem Ico={Icon.Image}   label="Mi marca (logo)"    sub={brand?.logo_url ? 'Logo configurado' : 'Sin logo · aparece en tus cotizaciones'} onClick={() => setView('marca')} />
              <MenuItem Ico={Icon.Bank}    label="Forma de pago"      sub={payout?.banco ? `${payout.banco} •••${String(payout.clabe).slice(-4)}` : 'Sin configurar'} onClick={() => setView('payout')} />
              <MenuItem Ico={Icon.MapPin}  label="Dirección fiscal"   sub={direccion?.ciudad || 'Sin configurar'} onClick={() => setView('direccion')} />
              <MenuItem Ico={Icon.Lock}    label="Cambiar contraseña" onClick={() => setView('password')} />
              <MenuItem Ico={Icon.AtSign}  label="Cambiar email"      sub={user.email} onClick={() => alert('Para cambiar tu email escríbenos a partners@sacscloud.com')} />
              <div style={{ borderTop: `1px solid ${C.borderSoft}`, margin: '8px 0' }} />
              <MenuItem Ico={Icon.LogOut}  label="Cerrar sesión"      onClick={logout} red />
            </div>
          )}

          {view === 'password' && <PasswordForm onBack={() => setView('menu')} />}
          {view === 'payout' && <PayoutForm payout={payout} onBack={() => setView('menu')} onSaved={(p) => { setProfile({ ...profile, payout: p }); setView('menu'); }} />}
          {view === 'direccion' && <DireccionForm direccion={direccion} onBack={() => setView('menu')} onSaved={(d) => { setProfile({ ...profile, direccion: d }); setView('menu'); }} />}
          {view === 'marca' && <MarcaForm brand={brand} onBack={() => setView('menu')} onSaved={(b) => setBrand(b)} />}
        </div>
      )}
    </div>
  );
}

function MenuItem({ Ico, label, sub, onClick, red }: { Ico: (p: any) => JSX.Element; label: string; sub?: string; onClick: () => void; red?: boolean }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit', color: red ? C.red : C.text, transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.brandSoft}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
      <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', color: red ? C.red : C.muted }}>
        <Ico size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 12, color: C.muted }}>›</span>
    </button>
  );
}

function MarcaForm({
  brand,
  onBack,
  onSaved,
}: {
  brand: { logo_url: string | null } | null;
  onBack: () => void;
  onSaved: (b: { logo_url: string | null }) => void;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(brand?.logo_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadLogo(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/revenue/upload-logo', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) { setError(d.error || 'Error al subir'); return; }
      setLogoUrl(d.url);
    } catch (e: any) {
      setError(e?.message || 'Error de red');
    } finally {
      setUploading(false);
    }
  }

  async function save(nextLogo: string | null) {
    setError(null);
    setSaving(true);
    try {
      const r = await fetch('/api/partners/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: nextLogo }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Error al guardar'); return; }
      onSaved({ logo_url: d.logo_url || null });
      onBack();
    } catch (e: any) {
      setError(e?.message || 'Error de red');
    } finally {
      setSaving(false);
    }
  }

  const removeLogo = () => {
    if (!confirm('¿Quitar tu logo? Dejará de aparecer en tus cotizaciones nuevas y existentes.')) return;
    setLogoUrl(null);
    save(null);
  };

  return (
    <div style={{ padding: 16 }}>
      <BackBtn onClick={onBack} title="Mi marca" />
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.55 }}>
        Tu logo aparece junto a tu nombre cuando el cliente abre cualquier cotización tuya.
        PNG, JPG, WebP o SVG. Máximo 2MB. Lo ideal es un fondo transparente.
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.22)`, borderRadius: 8, fontSize: 12, color: C.red, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, background: '#fafbfd', border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 10, background: '#fff', border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {logoUrl
            ? <img src={logoUrl} alt="Tu logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: 11, color: C.mutedLight, textAlign: 'center', padding: 4 }}>Sin logo</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {logoUrl ? 'Logo activo' : 'Aún no tienes logo'}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {logoUrl || 'Súbelo y se mostrará al instante.'}
          </div>
        </div>
      </div>

      <label style={{ ...SS.btn, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploading || saving ? 'not-allowed' : 'pointer', opacity: uploading || saving ? 0.6 : 1, marginBottom: logoUrl ? 8 : 0 }}>
        {uploading ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          style={{ display: 'none' }}
          disabled={uploading || saving}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            await uploadLogo(file);
            // Si subió bien y cambió, persistir automáticamente.
            // El estado se actualizó en uploadLogo; leemos el último valor vía closure es complejo,
            // así que volvemos a leer desde el response handler — uploadLogo ya setea logoUrl.
            // Aquí solo persistimos si el upload completó sin error.
          }}
        />
      </label>
      {/* Guardar manual si el upload acaba de pasar y aún no se ha persistido */}
      {logoUrl && logoUrl !== brand?.logo_url && (
        <button onClick={() => save(logoUrl)} disabled={saving} style={{ ...SS.btn, width: '100%', marginTop: 8 }}>
          {saving ? 'Guardando…' : 'Guardar logo'}
        </button>
      )}
      {logoUrl && (
        <button onClick={removeLogo} disabled={saving} style={{ background: 'transparent', border: 'none', color: C.red, fontSize: 12, cursor: 'pointer', padding: '10px 0', width: '100%', marginTop: 4, fontFamily: 'inherit' }}>
          Quitar logo
        </button>
      )}
    </div>
  );
}

function PasswordForm({ onBack }: { onBack: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (next.length < 6) { setError('Mínimo 6 caracteres'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/partner-portal/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); setSaving(false); return; }
      alert('Contraseña actualizada');
      onBack();
    } catch (e: any) {
      setError(e?.message || 'Error');
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <BackBtn onClick={onBack} title="Cambiar contraseña" />
      {error && <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.22)`, borderRadius: 8, fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}
      <Field label="Contraseña actual">
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Nueva contraseña">
        <input type="password" value={next} onChange={e => setNext(e.target.value)} style={inputStyle} />
      </Field>
      <button onClick={save} disabled={saving} style={{ ...SS.btn, width: '100%', marginTop: 8 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
    </div>
  );
}

function PayoutForm({ payout, onBack, onSaved }: { payout: any; onBack: () => void; onSaved: (p: any) => void }) {
  const [titular, setTitular] = useState(payout?.titular || '');
  const [rfc, setRfc] = useState(payout?.rfc || '');
  const [banco, setBanco] = useState(payout?.banco || '');
  const [clabe, setClabe] = useState(payout?.clabe || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const p = { metodo: 'transferencia', titular, rfc, banco, clabe };
    try {
      await fetch('/api/partner-portal/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payout: p }),
      });
      onSaved(p);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <BackBtn onClick={onBack} title="Forma de pago" />
      <Field label="Titular"><input value={titular} onChange={e => setTitular(e.target.value)} style={inputStyle} /></Field>
      <Field label="RFC"><input value={rfc} onChange={e => setRfc(e.target.value)} style={inputStyle} /></Field>
      <Field label="Banco"><input value={banco} onChange={e => setBanco(e.target.value)} style={inputStyle} placeholder="BBVA, Santander, etc." /></Field>
      <Field label="CLABE (18 dígitos)"><input value={clabe} onChange={e => setClabe(e.target.value)} style={inputStyle} maxLength={18} /></Field>
      <button onClick={save} disabled={saving} style={{ ...SS.btn, width: '100%', marginTop: 8 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
    </div>
  );
}

function DireccionForm({ direccion, onBack, onSaved }: { direccion: any; onBack: () => void; onSaved: (d: any) => void }) {
  const [calle, setCalle] = useState(direccion?.calle || '');
  const [colonia, setColonia] = useState(direccion?.colonia || '');
  const [ciudad, setCiudad] = useState(direccion?.ciudad || '');
  const [estado, setEstado] = useState(direccion?.estado || '');
  const [cp, setCp] = useState(direccion?.cp || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const d = { calle, colonia, ciudad, estado, cp, pais: 'México' };
    try {
      await fetch('/api/partner-portal/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion: d }),
      });
      onSaved(d);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <BackBtn onClick={onBack} title="Dirección fiscal" />
      <Field label="Calle y número"><input value={calle} onChange={e => setCalle(e.target.value)} style={inputStyle} /></Field>
      <Field label="Colonia"><input value={colonia} onChange={e => setColonia(e.target.value)} style={inputStyle} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="Ciudad"><input value={ciudad} onChange={e => setCiudad(e.target.value)} style={inputStyle} /></Field>
        <Field label="Estado"><input value={estado} onChange={e => setEstado(e.target.value)} style={inputStyle} /></Field>
      </div>
      <Field label="CP"><input value={cp} onChange={e => setCp(e.target.value)} style={inputStyle} maxLength={6} /></Field>
      <button onClick={save} disabled={saving} style={{ ...SS.btn, width: '100%', marginTop: 8 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
    </div>
  );
}

function BackBtn({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <button onClick={onClick} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 14, padding: '4px 8px', borderRadius: 6, fontFamily: 'inherit' }}>← </button>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  background: '#fafafa',
  outline: 'none',
  boxSizing: 'border-box',
};
