// CotizacionesTab — Partners crean y gestionan sus propias cotizaciones.
// Reusa la tabla `quotes` del CRM. POST/PUT/GET via /api/revenue/quotes.
//
// Reglas (validadas en backend, también clamped aquí):
// - Descuento global ≤ 15%
// - Extras solo del catálogo SACS (planes + servicios whitelisted)
// - No editar quotes 'accepted'/'paid'/'rejected'

import { useEffect, useMemo, useState } from 'react';
import { SS, C, stagePillStyle } from './styles';
import { Icon } from './icons';
import { fmt, fmtDate, isDemoMode, apiGet, copyToClipboard } from './utils';
import { demoQuotes } from '../../../data/partner-portal-demo';
import { PLAN_PRICES, PLANS } from '../../../lib/quotes/constants';
import { calcQuoteTotals } from '../../../lib/quotes/totals';
import { PARTNER_EXTRAS_CATALOG } from '../../../lib/quotes/partner-catalog';
import { PARTNER_MAX_DISCOUNT_PCT } from '../../../lib/quotes/permissions';

type Estado = 'draft' | 'sent' | 'accepted' | 'paid' | 'rejected' | 'expired';

interface Quote {
  id: string;
  numero: string;
  created_at: string;
  updated_at?: string;
  empresa: string;
  contacto: string;
  email: string;
  whatsapp: string;
  items: any[];
  estado: Estado;
  subtotal: number;
  iva_monto?: number;
  total: number;
  moneda: string;
  vigencia: string;
  partner_id?: string | null;
  descuento_global?: number;
  descuento_tipo?: 'pct' | 'monto';
  iva_incluido?: boolean;
  condiciones?: string;
  notas?: string;
  aceptado_por?: string;
  aceptado_fecha?: string;
}

const ESTADO_LABELS: Record<Estado, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  paid: 'Pagada',
  rejected: 'Rechazada',
  expired: 'Vencida',
};

const ESTADO_COLORS: Record<Estado, string> = {
  draft: C.muted,
  sent: C.brand,
  accepted: C.green,
  paid: C.greenDark,
  rejected: C.red,
  expired: C.mutedLight,
};

const PLAN_LABELS_ES: Record<string, string> = {
  vende: 'Vende',
  controla: 'Controla',
  fideliza: 'Fideliza',
  automatiza: 'Automatiza',
};

const isLocked = (estado: string) => ['accepted', 'paid', 'rejected'].includes(estado);

export default function CotizacionesTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todas' | 'activas' | 'aceptadas' | 'cerradas'>('todas');
  const [selected, setSelected] = useState<Quote | null>(null);
  const [editing, setEditing] = useState<Partial<Quote> | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await apiGet<Quote[]>('/api/revenue/quotes', isDemoMode() ? (demoQuotes as any) : undefined);
    setQuotes(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    if (!quotes) return [];
    return quotes.filter((q) => {
      if (filter === 'todas') return true;
      if (filter === 'activas') return ['draft', 'sent'].includes(q.estado);
      if (filter === 'aceptadas') return ['accepted', 'paid'].includes(q.estado);
      if (filter === 'cerradas') return ['rejected', 'expired'].includes(q.estado);
      return true;
    });
  }, [quotes, filter]);

  const stats = useMemo(() => {
    if (!quotes) return { total: 0, enviadas: 0, aceptadas: 0, valorPipeline: 0 };
    return {
      total: quotes.length,
      enviadas: quotes.filter((q) => q.estado === 'sent').length,
      aceptadas: quotes.filter((q) => ['accepted', 'paid'].includes(q.estado)).length,
      valorPipeline: quotes
        .filter((q) => ['sent', 'draft'].includes(q.estado))
        .reduce((s, q) => s + (q.total || 0), 0),
    };
  }, [quotes]);

  if (loading) return <div style={SS.loading}>Cargando cotizaciones…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
        <div>
          <h1 style={SS.h1Small}>Cotizaciones</h1>
          <p style={SS.leadSm}>
            Crea y envía cotizaciones a tus prospectos. Aparecen con tu nombre como asesor y el cobro lo procesa SACS.
          </p>
        </div>
        <button
          onClick={() => setEditing({
            empresa: '', contacto: '', email: '', whatsapp: '',
            items: [],
            moneda: 'MXN',
            descuento_global: 0,
            descuento_tipo: 'pct',
            iva_incluido: true,
            vigencia: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
            condiciones: '',
            estado: 'draft',
          })}
          style={SS.btn}
        >
          + Nueva cotización
        </button>
      </div>

      {/* Stats */}
      <div style={SS.statGrid}>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Total</div>
          <div style={SS.statValueSm}>{stats.total}</div>
          <div style={SS.statHint}>cotizaciones creadas</div>
        </div>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Enviadas activas</div>
          <div style={SS.statValueSm}>{stats.enviadas}</div>
          <div style={SS.statHint}>esperando respuesta</div>
        </div>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Aceptadas</div>
          <div style={SS.statValueSm}>{stats.aceptadas}</div>
          <div style={SS.statHint}>convertidas en clientes</div>
        </div>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Pipeline</div>
          <div style={SS.statValueSm}>{fmt(stats.valorPipeline)}</div>
          <div style={SS.statHint}>valor cotizado en activas</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {([
          ['todas', 'Todas'],
          ['activas', 'Activas'],
          ['aceptadas', 'Aceptadas'],
          ['cerradas', 'Cerradas'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              ...SS.pill,
              padding: '7px 14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: 'none',
              background: filter === key ? C.brand : C.borderSoft,
              color: filter === key ? '#fff' : C.text,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div style={SS.empty}>
          {filter === 'todas'
            ? 'Aún no has creado cotizaciones. Crea la primera con el botón de arriba.'
            : 'No hay cotizaciones en este estado.'}
        </div>
      ) : (
        <div style={SS.tableWrap}>
          <table style={SS.table}>
            <thead>
              <tr>
                <th style={SS.th}>Folio</th>
                <th style={SS.th}>Empresa</th>
                <th style={SS.th}>Total</th>
                <th style={SS.th}>Estado</th>
                <th style={SS.th}>Vigencia</th>
                <th style={SS.th}>Creada</th>
                <th style={SS.th}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setSelected(q)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.borderSoft)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={SS.td}><strong>{q.numero || '—'}</strong></td>
                  <td style={SS.td}>
                    <div style={{ fontWeight: 600 }}>{q.empresa || '—'}</div>
                    <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{q.contacto || ''}</div>
                  </td>
                  <td style={SS.td}>
                    <strong>{fmt(q.total)}</strong> <span style={{ color: C.muted, fontSize: 12 }}>{q.moneda || 'MXN'}</span>
                  </td>
                  <td style={SS.td}>
                    <span style={stagePillStyle(ESTADO_COLORS[q.estado] || C.muted)}>
                      {ESTADO_LABELS[q.estado] || q.estado}
                    </span>
                  </td>
                  <td style={SS.td}>{fmtDate(q.vigencia)}</td>
                  <td style={SS.td}>{fmtDate(q.created_at)}</td>
                  <td style={SS.td}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(q);
                      }}
                      style={{ ...SS.btnGhost, padding: '6px 12px', fontSize: 12 }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer detalle */}
      {selected && (
        <QuoteDetail
          quote={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onReload={load}
        />
      )}

      {/* Drawer editor */}
      {editing && (
        <QuoteEditor
          initial={editing}
          user={user}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────

function QuoteDetail({
  quote,
  onClose,
  onEdit,
  onReload,
}: {
  quote: Quote;
  onClose: () => void;
  onEdit: () => void;
  onReload: () => void;
}) {
  const locked = isLocked(quote.estado);
  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/cotizacion/${quote.id}`
    : `/cotizacion/${quote.id}`;
  const [copied, setCopied] = useState(false);

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              {quote.numero || 'Sin folio'}
            </div>
            <h2 style={{ ...SS.h3, margin: 0 }}>{quote.empresa || '—'}</h2>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{quote.contacto || ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 22 }}>
            ×
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <span style={stagePillStyle(ESTADO_COLORS[quote.estado] || C.muted)}>
            {ESTADO_LABELS[quote.estado] || quote.estado}
          </span>
        </div>

        <div style={{ background: C.borderSoft, padding: '18px 20px', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: C.muted }}>Total</span>
            <strong style={{ fontSize: 18 }}>{fmt(quote.total)} {quote.moneda || 'MXN'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted }}>
            <span>Vigencia</span>
            <span>{fmtDate(quote.vigencia)}</span>
          </div>
        </div>

        <h3 style={{ ...SS.h3, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Conceptos</h3>
        <div style={{ marginBottom: 24 }}>
          {(quote.items || []).map((it: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.borderSoft}`, fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{it.descripcion || it.nombre || 'Item'}</div>
                <div style={{ color: C.mutedLight, fontSize: 11, marginTop: 2 }}>
                  {it.tipo === 'plan' ? 'Plan recurrente' : it.recurrente ? `Recurrente · ${it.periodo_extra || 'mensual'}` : 'Único'}
                </div>
              </div>
              <strong>{fmt(it.subtotal || it.monto || 0)}</strong>
            </div>
          ))}
        </div>

        <h3 style={{ ...SS.h3, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Cliente</h3>
        <div style={{ fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
          <div><strong>Email:</strong> {quote.email || '—'}</div>
          <div><strong>WhatsApp:</strong> {quote.whatsapp || '—'}</div>
          {quote.aceptado_por && (
            <div style={{ marginTop: 8, color: C.green }}>
              <strong>Aceptada por:</strong> {quote.aceptado_por} ({fmtDate(quote.aceptado_fecha)})
            </div>
          )}
        </div>

        <h3 style={{ ...SS.h3, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Link público</h3>
        <div style={{ background: C.brandSoft, padding: 14, borderRadius: 10, marginBottom: 24 }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 11, wordBreak: 'break-all', color: C.brandDark, marginBottom: 10 }}>
            {publicUrl}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                await copyToClipboard(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              style={{ ...SS.btnSm, background: C.brand }}
            >
              {copied ? '✓ Copiado' : 'Copiar link'}
            </button>
            {quote.whatsapp && (
              <a
                href={`https://wa.me/${quote.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${quote.contacto || ''}, te comparto la cotización: ${publicUrl}`)}`}
                target="_blank"
                rel="noopener"
                style={{ ...SS.btnSm, background: '#25D366', textDecoration: 'none', display: 'inline-block' }}
              >
                Enviar por WhatsApp
              </a>
            )}
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener"
              style={{ ...SS.btnGhost, padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}
            >
              Abrir vista cliente
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!locked && (
            <button onClick={onEdit} style={SS.btn}>
              Editar cotización
            </button>
          )}
          {!locked && quote.estado !== 'rejected' && (
            <button
              onClick={async () => {
                if (isDemoMode()) {
                  alert('En modo demo no se modifican cotizaciones.');
                  return;
                }
                const motivo = prompt('Motivo de rechazo (precio / timing / competidor / no_fit / otro)', 'otro');
                if (!motivo) return;
                const detalle = prompt('Detalle (opcional)', '');
                const res = await fetch('/api/revenue/mark-rejected', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ quoteId: quote.id, motivo, detalle, from: 'partner' }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  alert('Error: ' + (err.error || res.statusText));
                  return;
                }
                onReload();
                onClose();
              }}
              style={SS.btnGhost}
            >
              Marcar rechazada
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Editor drawer ─────────────────────────────────────────────────────────

function QuoteEditor({
  initial,
  user: _user,
  onClose,
  onSaved,
}: {
  initial: Partial<Quote>;
  user: { id: string; nombre: string; email: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Quote>>(() => ({
    moneda: 'MXN',
    descuento_global: 0,
    descuento_tipo: 'pct',
    iva_incluido: true,
    items: [],
    ...initial,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial?.id;

  const items: any[] = Array.isArray(form.items) ? form.items : [];

  const updateItem = (idx: number, patch: any) => {
    const arr = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    // Recalc subtotal del item si cambió cantidad/precio
    arr[idx].subtotal = computeItemSubtotal(arr[idx]);
    arr[idx].monto = arr[idx].subtotal;
    setForm({ ...form, items: arr });
  };

  const removeItem = (idx: number) => {
    setForm({ ...form, items: items.filter((_, i) => i !== idx) });
  };

  const addPlan = () => {
    const nombre = 'controla';
    const it = {
      tipo: 'plan',
      nombre,
      precio_unitario: PLAN_PRICES[nombre],
      periodo: 'mensual',
      sucursales: 1,
      descuento_pct: 0,
      subtotal: PLAN_PRICES[nombre],
      monto: PLAN_PRICES[nombre],
      recurrente: true,
      periodo_extra: 'mensual',
      descripcion: `Plan ${PLAN_LABELS_ES[nombre]} · 1 sucursal`,
    };
    setForm({ ...form, items: [...items, it] });
  };

  const addExtra = (nombre: string) => {
    const def = PARTNER_EXTRAS_CATALOG.find((e) => e.nombre === nombre);
    if (!def) return;
    const it = {
      tipo: 'extra',
      nombre: def.nombre,
      precio_unitario: def.precio_default,
      monto: def.precio_default,
      subtotal: def.precio_default,
      recurrente: def.recurrente,
      periodo_extra: def.periodo_extra,
      descripcion: def.descripcion || def.nombre,
    };
    setForm({ ...form, items: [...items, it] });
  };

  const ivaMode: 'sin' | 'suma' | 'incluido' = form.iva_incluido ? 'suma' : 'sin';
  const totals = calcQuoteTotals({
    items,
    descuento_global: form.descuento_global,
    descuento_tipo: form.descuento_tipo,
    iva_mode: ivaMode,
  });

  const save = async (estado: Estado = 'sent') => {
    setError(null);

    if (!form.empresa?.trim() || !form.email?.trim() || !form.whatsapp?.trim()) {
      setError('Empresa, email y WhatsApp son obligatorios');
      return;
    }
    if (items.length === 0) {
      setError('Agrega al menos un plan o extra');
      return;
    }
    const descPct = Number(form.descuento_global) || 0;
    if (form.descuento_tipo === 'pct' && descPct > PARTNER_MAX_DISCOUNT_PCT) {
      setError(`Descuento máximo permitido: ${PARTNER_MAX_DISCOUNT_PCT}%`);
      return;
    }

    if (isDemoMode()) {
      alert('En modo demo no se guardan cotizaciones. Sal del modo demo para crear cotizaciones reales.');
      onClose();
      return;
    }

    setSaving(true);
    const body = {
      ...form,
      estado,
      subtotal: totals.itemsSubtotal,
      iva_monto: Math.round(totals.ivaMonto),
      total: Math.round(totals.grandTotal),
    };

    try {
      const res = await fetch('/api/revenue/quotes', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || `Error ${res.status}`);
        setSaving(false);
        return;
      }
      onSaved();
    } catch (err: any) {
      setError(String(err?.message || err));
      setSaving(false);
    }
  };

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={() => !saving && onClose()} />
      <div style={SS.drawer} className="cq-drawer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <h2 style={{ ...SS.h3, margin: 0 }}>
            {isEdit ? 'Editar cotización' : 'Nueva cotización'}
          </h2>
          <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 28, padding: '0 4px', lineHeight: 1 }}>
            ×
          </button>
        </div>

        {error && (
          <div style={{ background: '#fde8e8', color: C.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Cliente */}
        <Field label="Empresa *">
          <input value={form.empresa || ''} onChange={(e) => setForm({ ...form, empresa: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Contacto">
          <input value={form.contacto || ''} onChange={(e) => setForm({ ...form, contacto: e.target.value })} style={inputStyle} />
        </Field>
        <div className="cq-row-2">
          <Field label="Email *">
            <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="WhatsApp *">
            <input value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} style={inputStyle} placeholder="+52 442 555 0101" />
          </Field>
        </div>

        {/* Items */}
        <h3 style={{ ...SS.h3, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '24px 0 10px' }}>Conceptos</h3>
        {items.map((it, idx) => (
          <div key={idx} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 10, background: C.borderSoft }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>
                {it.tipo === 'plan' ? `Plan ${PLAN_LABELS_ES[it.nombre] || it.nombre}` : it.nombre}
              </strong>
              <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>
                Quitar
              </button>
            </div>
            {it.tipo === 'plan' ? (
              <div className="cq-row-3">
                <Field label="Plan" small>
                  <select
                    value={it.nombre}
                    onChange={(e) => {
                      const newName = e.target.value;
                      updateItem(idx, {
                        nombre: newName,
                        precio_unitario: PLAN_PRICES[newName],
                        descripcion: `Plan ${PLAN_LABELS_ES[newName]} · ${it.sucursales || 1} sucursal${(it.sucursales || 1) > 1 ? 'es' : ''}`,
                      });
                    }}
                    style={inputStyle}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>{PLAN_LABELS_ES[p]} (${PLAN_PRICES[p]}/mes)</option>
                    ))}
                  </select>
                </Field>
                <Field label="Sucursales" small>
                  <input
                    type="number"
                    min={1}
                    value={it.sucursales || 1}
                    onChange={(e) => {
                      const suc = Math.max(1, Number(e.target.value) || 1);
                      updateItem(idx, {
                        sucursales: suc,
                        descripcion: `Plan ${PLAN_LABELS_ES[it.nombre]} · ${suc} sucursal${suc > 1 ? 'es' : ''}`,
                      });
                    }}
                    style={inputStyle}
                  />
                </Field>
                <Field label={`Descuento (máx ${PARTNER_MAX_DISCOUNT_PCT}%)`} small>
                  <input
                    type="number"
                    min={0}
                    max={PARTNER_MAX_DISCOUNT_PCT}
                    value={it.descuento_pct || 0}
                    onChange={(e) => {
                      const d = Math.min(PARTNER_MAX_DISCOUNT_PCT, Math.max(0, Number(e.target.value) || 0));
                      updateItem(idx, { descuento_pct: d });
                    }}
                    style={inputStyle}
                  />
                </Field>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.muted }}>{it.descripcion}</div>
            )}
            <div style={{ marginTop: 8, fontSize: 13, textAlign: 'right' }}>
              <span style={{ color: C.muted, marginRight: 8 }}>Subtotal:</span>
              <strong>{fmt(it.subtotal)}</strong>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <button onClick={addPlan} style={{ ...SS.btnGhost, fontSize: 12 }}>+ Agregar plan</button>
          {PARTNER_EXTRAS_CATALOG.map((e) => (
            <button key={e.nombre} onClick={() => addExtra(e.nombre)} style={{ ...SS.btnGhost, fontSize: 12 }}>
              + {e.nombre}
            </button>
          ))}
        </div>

        {/* Descuento global */}
        <div className="cq-row-2">
          <Field label={`Descuento global (% max ${PARTNER_MAX_DISCOUNT_PCT})`}>
            <input
              type="number"
              min={0}
              max={PARTNER_MAX_DISCOUNT_PCT}
              value={form.descuento_global || 0}
              onChange={(e) => {
                const d = Math.min(PARTNER_MAX_DISCOUNT_PCT, Math.max(0, Number(e.target.value) || 0));
                setForm({ ...form, descuento_global: d, descuento_tipo: 'pct' });
              }}
              style={inputStyle}
            />
          </Field>
          <Field label="Vigencia">
            <input
              type="date"
              value={form.vigencia || ''}
              onChange={(e) => setForm({ ...form, vigencia: e.target.value })}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="IVA">
          <select
            value={form.iva_incluido ? 'suma' : 'sin'}
            onChange={(e) => setForm({ ...form, iva_incluido: e.target.value === 'suma' })}
            style={inputStyle}
          >
            <option value="suma">Suma 16% al total</option>
            <option value="sin">Sin IVA</option>
          </select>
        </Field>

        <Field label="Condiciones / notas (opcional)">
          <textarea
            value={form.condiciones || ''}
            onChange={(e) => setForm({ ...form, condiciones: e.target.value })}
            rows={3}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </Field>

        {/* Totales */}
        <div style={{ background: C.brandSoft, padding: 16, borderRadius: 12, marginTop: 18 }}>
          <Row label="Subtotal" value={fmt(totals.itemsSubtotal)} muted />
          {totals.globalDisc > 0 && <Row label="Descuento" value={`-${fmt(totals.globalDisc)}`} muted />}
          {ivaMode === 'suma' && <Row label="IVA (16%)" value={fmt(totals.ivaMonto)} muted />}
          <div style={{ borderTop: `1px solid ${C.brandTint}`, marginTop: 8, paddingTop: 8 }}>
            <Row label="Total" value={`${fmt(totals.grandTotal)} ${form.moneda || 'MXN'}`} bold />
          </div>
        </div>

        {/* Actions */}
        <div className="cq-actions" style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          <button onClick={() => save('sent')} disabled={saving} style={SS.btn}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear y enviar'}
          </button>
          <button onClick={() => save('draft')} disabled={saving} style={SS.btnGhost}>
            Guardar como borrador
          </button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: COTIZADOR_MOBILE_CSS }} />
    </>
  );
}

// CSS responsive del editor (drawer mobile-friendly)
const COTIZADOR_MOBILE_CSS = `
  .cq-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cq-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  @media (max-width: 640px) {
    .cq-drawer { padding: 20px 18px 96px !important; width: 100vw !important; max-width: 100vw !important; }
    .cq-row-2 { grid-template-columns: 1fr; gap: 0; }
    .cq-row-3 { grid-template-columns: 1fr; gap: 0; }
    .cq-actions { position: sticky; bottom: 0; background: linear-gradient(180deg, transparent, #fff 24%); padding-top: 24px; padding-bottom: 12px; margin-left: -18px; margin-right: -18px; padding-left: 18px; padding-right: 18px; }
    .cq-actions > button { width: 100%; padding: 14px 20px; font-size: 14px; }
  }
`;

// ─── helpers ───────────────────────────────────────────────────────────────

function computeItemSubtotal(it: any): number {
  if (it.tipo === 'plan') {
    const base = (PLAN_PRICES[it.nombre] || 0) * (it.sucursales || 1);
    const disc = (Number(it.descuento_pct) || 0) / 100;
    return Math.round(base * (1 - disc));
  }
  return Number(it.precio_unitario) || Number(it.monto) || 0;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#fff',
};

function Field({ label, children, small }: { label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div style={{ marginBottom: small ? 0 : 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: muted ? C.muted : C.text, marginBottom: 4 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
