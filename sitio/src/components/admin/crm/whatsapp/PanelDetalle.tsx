// WHATSAPP · El panel derecho: quién es el que escribe — contacto, empresa,
// etapa editable, etiquetas y el salto a la ficha completa. Para números
// desconocidos, el alta mínima que liga la conversación al CRM.
import { useState } from 'react';
import { telefonoLegible } from '../../../../lib/telefono';
import { LIFECYCLE, lifecycleDe } from '../../../../lib/crm/lifecycle';
import Etiquetas from '../Etiquetas';
import ClienteDrawer360 from '../ClienteDrawer360';
import { Avatar } from './ListaConversaciones';
import { Corazones } from '../ui/Cargando';

const L: React.CSSProperties = { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 3 };
const V: React.CSSProperties = { fontSize: '0.8rem', color: '#1a1a1a', lineHeight: 1.5 };
const bloque: React.CSSProperties = { padding: '13px 16px', borderBottom: '1px solid #f5f4f8' };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fdfcff' };
const btnP: React.CSSProperties = { border: 'none', borderRadius: 9, padding: '8px 14px', background: '#9B8CFA', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnA: React.CSSProperties = { border: '1.5px solid #7DA6F5', borderRadius: 9, padding: '7px 12px', background: '#fff', fontSize: '0.73rem', fontWeight: 700, color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit' };

export default function PanelDetalle({ hilo, api }: { hilo: any; api: any }) {
  const conv = hilo.conversacion;
  const contacto = conv?.contacts || null;
  const empresa = conv?.companies || null;
  const [ficha, setFicha] = useState(false);
  const [alta, setAlta] = useState<{ empresa: string; contacto: string; email: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');

  const nombre = contacto ? `${contacto.nombre || ''} ${contacto.apellido || ''}`.trim() : null;
  const etapa = lifecycleDe(contacto?.lifecycle_stage);

  const crear = async () => {
    if (!alta?.empresa.trim()) { setMsg('El nombre de la empresa es obligatorio.'); return; }
    setOcupado(true); setMsg('');
    const r = await api.crearContacto({ empresa: alta.empresa.trim(), contacto: alta.contacto.trim(), email: alta.email.trim() || undefined });
    setOcupado(false);
    if (r?.error) { setMsg(r.error); return; }
    setAlta(null);
  };

  return (
    <div>
      {/* ── Identidad ── */}
      <div style={{ ...bloque, display: 'flex', gap: 11, alignItems: 'center' }}>
        <Avatar nombre={nombre} telefono={conv.telefono} size={46} />
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: '0.9rem', display: 'block' }}>{nombre || 'Número desconocido'}</b>
          <span style={{ fontSize: '0.72rem', color: '#8a8a92' }}>{telefonoLegible(conv.telefono)}</span>
          {etapa && (
            <span style={{ display: 'inline-block', marginLeft: 7, fontSize: '0.58rem', fontWeight: 800, background: etapa.bg, color: etapa.fg, borderRadius: 20, padding: '2px 8px' }}>{etapa.label}</span>
          )}
        </div>
      </div>

      {/* ── Desconocido: alta mínima ── */}
      {!contacto && (
        <div style={bloque}>
          {!alta ? (
            <>
              <p style={{ margin: '0 0 10px', fontSize: '0.74rem', color: '#8a8a92', lineHeight: 1.55 }}>
                Este número no está en el CRM. Créalo como lead para ligarle la conversación, el historial y el seguimiento.
              </p>
              <button style={btnP} onClick={() => setAlta({ empresa: '', contacto: '', email: '' })}>Crear contacto</button>
            </>
          ) : (
            <>
              <label style={L}>Empresa *</label>
              <input style={inp} value={alta.empresa} onChange={e => setAlta({ ...alta, empresa: e.target.value })} />
              <label style={{ ...L, marginTop: 9 }}>Nombre del contacto</label>
              <input style={inp} value={alta.contacto} onChange={e => setAlta({ ...alta, contacto: e.target.value })} />
              <label style={{ ...L, marginTop: 9 }}>Email</label>
              <input style={inp} value={alta.email} onChange={e => setAlta({ ...alta, email: e.target.value })} />
              {msg && <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#C0554E' }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                <button style={btnP} disabled={ocupado} onClick={crear}>{ocupado ? <Corazones size={9} color="#fff" /> : 'Crear y ligar'}</button>
                <button style={{ ...btnA, borderColor: '#e2e4e9', color: '#555' }} onClick={() => setAlta(null)}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Contacto ── */}
      {contacto && (
        <div style={bloque}>
          <label style={L}>Email</label>
          <div style={V}>{contacto.email || <span style={{ color: '#b3b1bb' }}>Sin email</span>}</div>
          <label style={{ ...L, marginTop: 11 }}>Etapa del ciclo de vida</label>
          <select value={contacto.lifecycle_stage || ''}
            onChange={e => api.guardarContacto(contacto.id, { lifecycle_stage: e.target.value || null })}
            style={{ ...inp, cursor: 'pointer' }}>
            <option value="">Sin etapa</option>
            {LIFECYCLE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}

      {/* ── Empresa ── */}
      {empresa && (
        <div style={bloque}>
          <label style={L}>Empresa</label>
          <div style={{ ...V, fontWeight: 700 }}>{empresa.nombre_comercial || empresa.nombre}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 12px', marginTop: 10 }}>
            <div><label style={L}>Plan</label><div style={V}>{empresa.plan || '—'}</div></div>
            <div><label style={L}>MRR</label><div style={{ ...V, color: '#1E8A63', fontWeight: 800 }}>{empresa.mrr ? `$${Number(empresa.mrr).toLocaleString('es-MX')}` : '—'}</div></div>
            <div><label style={L}>Sucursales</label><div style={V}>{empresa.sucursales ?? '—'}</div></div>
            <div><label style={L}>Giro</label><div style={V}>{empresa.giro || '—'}</div></div>
          </div>
        </div>
      )}

      {/* ── Etiquetas ── */}
      {(empresa || contacto) && (
        <div style={bloque}>
          <label style={L}>Etiquetas</label>
          <Etiquetas entidad={empresa ? 'company' : 'contact'} id={empresa?.id || contacto?.id} compacto />
        </div>
      )}

      {/* ── Acciones ── */}
      {(empresa || contacto) && (
        <div style={{ ...bloque, borderBottom: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {empresa && <button style={btnA} onClick={() => setFicha(true)}>Ficha completa</button>}
          {empresa && (
            <a href={`/admin/crm?tab=clientes`} style={{ ...btnA, textDecoration: 'none', display: 'inline-block' }}>Ver en Clientes</a>
          )}
        </div>
      )}

      {ficha && empresa && (
        <ClienteDrawer360 companyId={empresa.id} onClose={() => setFicha(false)} onChanged={() => {}} />
      )}
    </div>
  );
}
