import { useEffect, useState } from 'react';
import { isDemoMode, apiGet } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import { demoProfile } from '../../../data/partner-portal-demo';

// Tab dedicada a la cuenta SACS del partner (Plan Fideliza gratuito)

export default function SacsAccountTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/partner-portal/profile', isDemoMode() ? demoProfile : undefined).then(p => {
      setProfile(p); setLoading(false);
    });
  }, []);

  if (loading) return <div style={SS.loading}>Cargando…</div>;

  // En real: leer flag de cuenta activada desde profile.invitation.notas.meta.cuenta_sacs_activated
  const isActive = isDemoMode() || !!profile?.invitation;

  return (
    <div>
      <h1 style={SS.h1Small}>Cuenta SACS</h1>
      <p style={SS.leadSm}>Tu cuenta gratuita Plan Fideliza para que opera tu propio retail con la misma plataforma que vendes.</p>

      {/* Hero card */}
      <div style={{
        background: isActive ? '#4B7BE5' : C.card,
        color: isActive ? '#fff' : C.text,
        border: isActive ? 'none' : `1px solid ${C.border}`,
        borderRadius: 18,
        padding: '40px 44px',
        boxShadow: isActive ? '0 12px 32px -16px rgba(75,123,229,0.35)' : '0 1px 2px rgba(0,0,0,0.02)',
        marginBottom: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <span style={{
              fontSize: 11,
              color: isActive ? 'rgba(255,255,255,0.78)' : C.muted,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              marginBottom: 14,
              display: 'inline-block',
            }}>
              {isActive ? 'Activa' : 'Pendiente'}
            </span>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 38,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.028em',
              color: 'inherit',
              marginBottom: 12,
            }}>
              Plan Fideliza
            </div>
            <p style={{
              fontSize: 15,
              color: isActive ? 'rgba(255,255,255,0.78)' : C.textSoft,
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 460,
            }}>
              {isActive
                ? 'Tu cuenta SACS está activa y al corriente. Úsala para operar tu propio negocio y mostrarlo a tus prospectos en demos reales.'
                : 'Te estamos preparando tu cuenta SACS Plan Fideliza. Estará lista en las próximas 48h hábiles.'}
            </p>
          </div>
          {isActive && (
            <a href="https://app.sacscloud.com" target="_blank" rel="noopener"
              style={{
                padding: '14px 24px',
                background: '#fff',
                color: '#4B7BE5',
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap' as const,
              }}>
              Entrar a SACS <Icon.ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Lo que incluye */}
      <h2 style={SS.h2}>Lo que incluye tu Plan Fideliza</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <IncludeCard title="POS multi-sucursal" desc="Punto de venta en navegador, iPad o terminal SmartPOS — sincronizado con tu inventario en vivo." />
        <IncludeCard title="Inventario y catálogo" desc="Productos con variantes, alta masiva por Excel, control por sucursal, alertas de stock bajo." />
        <IncludeCard title="E-commerce + redes" desc="Tienda en línea con dominio propio, conectada a TikTok Shop, Meta y WhatsApp para venta directa." />
        <IncludeCard title="CRM + Programa lealtad" desc="Perfiles de cliente, historial de compras, puntos canjeables, segmentos automáticos." />
        <IncludeCard title="Marketing por email + WA" desc="Campañas masivas con plantillas, automatizaciones por evento, métricas de entrega y clicks." />
        <IncludeCard title="Reportes y analítica" desc="Ventas por sucursal, mix de productos, ABC de clientes, dashboards en vivo." />
      </div>

      {/* Academia SACS */}
      <h2 style={SS.h2}>Academia SACS</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>Aprende todo de SACS directamente desde tu cuenta. Videos paso a paso, plantillas, casos prácticos.</p>

      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
        overflow: 'hidden' as const, marginBottom: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}>
        {/* Image hero */}
        <div style={{
          position: 'relative' as const,
          aspectRatio: '16 / 7',
          background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
          overflow: 'hidden' as const,
        }}>
          <img
            src="/images/screen-ecommerce.webp"
            alt="Academia SACS · tutoriales y cursos"
            loading="lazy"
            style={{
              position: 'absolute' as const, inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover' as const,
              opacity: 0.55,
              mixBlendMode: 'luminosity' as any,
            }}
          />
          <div style={{
            position: 'absolute' as const, inset: 0,
            background: `linear-gradient(135deg, rgba(75,123,229,0.78) 0%, rgba(55,100,196,0.85) 100%)`,
          }} />
          <div style={{ position: 'absolute' as const, inset: 0, padding: '32px 36px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'flex-end', color: '#fff' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(255,255,255,0.20)', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, alignSelf: 'flex-start' as const, marginBottom: 12, backdropFilter: 'blur(6px)' }}>
              <Icon.Book size={12} /> Academia
            </span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.022em', lineHeight: 1.2, marginBottom: 6, maxWidth: 560 }}>
              Aprende SACS a tu ritmo, dentro de tu cuenta.
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55, maxWidth: 580 }}>
              Configurar productos, activar POS, crear tienda en línea, inventario multi-sucursal, reportes y mucho más.
            </div>
          </div>
        </div>

        {/* Course list */}
        <div style={{ padding: '24px 28px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <CourseRow num="1" title="Configurar tu cuenta" desc="Setup inicial, datos del negocio, equipo." />
            <CourseRow num="2" title="Configurar tus productos" desc="Categorías, variantes, precios, impuestos." />
            <CourseRow num="3" title="Activar tu punto de venta" desc="POS en navegador, iPad o SmartPOS." />
            <CourseRow num="4" title="Crear tu tienda en línea" desc="Dominio, layout, métodos de pago, envíos." />
            <CourseRow num="5" title="Inventario y multi-sucursal" desc="Transferencias, alertas de stock, conteos." />
            <CourseRow num="6" title="CRM y programa de lealtad" desc="Segmentos, puntos canjeables, campañas." />
          </div>

          <a href="https://app.sacscloud.com/academia" target="_blank" rel="noopener"
            style={{ ...SS.btn, display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20, textDecoration: 'none' }}>
            Entrar a Academia <Icon.ArrowRight size={14} />
          </a>
        </div>
      </div>

      <div style={{ ...SS.note, fontSize: 13, marginBottom: 32 }}>
        <strong>Acceso desde tu cuenta SACS.</strong> Cuando entres a app.sacscloud.com, encuentras "Academia" en el menú lateral. Todos los cursos son gratuitos para partners y se actualizan cada mes con nuevas lecciones.
      </div>

      {/* Acceso info */}
      <h2 style={SS.h2}>Tu acceso</h2>
      <div style={SS.card}>
        <AccessRow label="Email de la cuenta" value={user.email} />
        <AccessRow label="URL" value="app.sacscloud.com" />
        <AccessRow label="Estado del plan" value={isActive ? 'Plan Fideliza · activo' : 'En activación'} />
        <AccessRow label="Cargo mensual" value="$0 (cortesía partner)" highlight />
        <AccessRow label="Vigencia" value="Mientras tu programa partner siga activo" />
      </div>

      <div style={{ ...SS.note, marginTop: 24 }}>
        <strong>Úsalo para operar tu propio negocio.</strong> Mientras más uses SACS, mejor podrás venderlo. Conoces las features, generas screenshots reales, y tus demos se vuelven casos de uso vivos.
      </div>
    </div>
  );
}

function CourseRow({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0' }}>
      <span style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
        background: C.brandSoft, color: C.brand,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
      }}>{num}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function IncludeCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={SS.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(42,181,160,0.12)', color: C.greenDark,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
        }}>
          <Icon.Check size={14} strokeWidth={2.4} />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{desc}</div>
        </div>
      </div>
    </div>
  );
}

function AccessRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.borderSoft}`, gap: 16, flexWrap: 'wrap' as const }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 14, color: highlight ? C.greenDark : C.text, fontWeight: highlight ? 600 : 500 }}>{value}</span>
    </div>
  );
}
