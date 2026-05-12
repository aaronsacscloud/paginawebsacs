import { useEffect, useState } from 'react';
import { fmt, isDemoMode, apiGet } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';

type Cert = {
  id: string;
  nombre: string;
  shortName: string;
  precio: number;
  precioMostrar: string;
  duracion: string;
  nivel: string;
  cover: string;
  descripcion: string;
  paraQuien: string;
  temario: string[];
  beneficios: string[];
  serviceChargeMin: number;
  serviceChargeMax: number;
  serviceChargeMostrar: string;
  serviceModel: 'one-time' | 'monthly';
  serviceUnit: string;
  status?: 'paid' | 'pending' | 'none';
  unlocked?: boolean;
  paid_at?: string | null;
};

export default function CertificationsTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ certifications: Cert[] }>(
      '/api/partner-portal/certifications',
      isDemoMode() ? { certifications: DEMO_CERTS } : undefined,
    ).then(d => {
      setCerts(d?.certifications || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={SS.loading}>Cargando certificaciones…</div>;

  const owned = certs.filter(c => c.unlocked).length;
  const totalIngresosMin = certs.reduce((s, c) => s + (c.unlocked ? c.serviceChargeMin : 0), 0);
  const totalIngresosMax = certs.reduce((s, c) => s + (c.unlocked ? c.serviceChargeMax : 0), 0);

  async function buy(certId: string) {
    setPurchasing(certId);
    try {
      const r = await fetch('/api/partner-portal/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert_id: certId }),
      });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else alert(d.error || 'No se pudo iniciar la compra');
    } catch {
      alert('Error iniciando la compra');
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div>
      <h1 style={SS.h1Small}>Certificaciones</h1>
      <p style={SS.leadSm}>
        Cobra servicios profesionales a tus clientes — implementación, migración, consultoría con IA.
        Te quedas con <strong style={{ color: C.text, fontWeight: 600 }}>el 100%</strong> de lo que cobras.
      </p>

      {/* Hero stat · solo certificaciones activas con peso visual */}
      <div style={{
        background: owned > 0 ? 'linear-gradient(135deg, #1A8F7A 0%, #4B7BE5 100%)' : C.card,
        color: owned > 0 ? '#fff' : C.text,
        border: owned > 0 ? 'none' : `1px solid ${C.border}`,
        borderRadius: 18,
        padding: '40px 44px',
        boxShadow: owned > 0 ? '0 12px 32px -16px rgba(26,143,122,0.35)' : '0 1px 2px rgba(0,0,0,0.02)',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 32,
        flexWrap: 'wrap' as const,
      }}>
        <div>
          <div style={{
            fontSize: 11,
            color: owned > 0 ? 'rgba(255,255,255,0.72)' : C.muted,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase' as const,
            marginBottom: 12,
          }}>
            Certificaciones activas
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 72,
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            color: 'inherit',
          }}>
            {owned} <span style={{ color: owned > 0 ? 'rgba(255,255,255,0.45)' : C.mutedLight, fontWeight: 400 }}>/ {certs.length}</span>
          </div>
          <div style={{
            fontSize: 14,
            color: owned > 0 ? 'rgba(255,255,255,0.75)' : C.muted,
            marginTop: 14,
            lineHeight: 1.5,
            maxWidth: 420,
          }}>
            {owned === 0
              ? 'Sin certificación solo vendes vía link. Compra tu primera cert y empieza a cobrar servicios profesionales con el 100% para ti.'
              : owned === certs.length
                ? '¡Catálogo completo! Eres uno de los partners con todas las certs activas.'
                : `Sigue sumando — cada cert nueva te abre un nuevo tipo de proyecto que puedes cobrar.`}
          </div>
        </div>
        {owned === 0 ? (
          <div style={{
            fontSize: 12,
            color: owned > 0 ? 'rgba(255,255,255,0.7)' : C.muted,
            textAlign: 'right' as const,
            lineHeight: 1.5,
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: C.green, marginBottom: 4 }}>
              ↓ Elige una para empezar
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Puedes cobrar</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1 }}>
              {fmt(totalIngresosMin)} – {fmt(totalIngresosMax)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>por proyecto · 100% para ti</div>
          </div>
        )}
      </div>

      {/* Cómo funciona */}
      <h2 style={SS.h2}>Cómo funciona</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <HowCard num="1" title="Compras la cert" desc="Pago único vía Stripe. Aparece en tu portal como Activa." />
        <HowCard num="2" title="Te capacitamos" desc="Sesiones en vivo + materiales + casos prácticos." />
        <HowCard num="3" title="Cierras servicios" desc="Ofreces el servicio a tus clientes y a leads que SACS te canaliza." />
        <HowCard num="4" title="Cobras 100%" desc="El cliente te paga a ti directo. SACS no se queda con nada del servicio." />
      </div>

      {/* Listado completo de certificaciones */}
      <h2 style={SS.h2}>Catálogo completo</h2>

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 24 }}>
        {certs.map(c => (
          <CertCard
            key={c.id}
            cert={c}
            expanded={expanded === c.id}
            onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
            onBuy={() => buy(c.id)}
            purchasing={purchasing === c.id}
          />
        ))}
      </div>

      <div style={{ ...SS.note, marginTop: 32 }}>
        <strong>¿Dudas sobre cuál te conviene?</strong> Escríbenos a <a href="mailto:partners@sacscloud.com" style={{ color: C.accent, fontWeight: 600 }}>partners@sacscloud.com</a> y te recomendamos la ruta según tu mercado y tu meta de ingresos.
      </div>
    </div>
  );
}

function HowCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div style={SS.card}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: C.accent, letterSpacing: '-0.025em', marginBottom: 8 }}>{num}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}

function CertCard({ cert, expanded, onToggle, onBuy, purchasing }: {
  cert: Cert; expanded: boolean; onToggle: () => void; onBuy: () => void; purchasing: boolean;
}) {
  const isActive = cert.unlocked;

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 18, overflow: 'hidden' as const,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.18s',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px -16px rgba(0,0,0,0.18)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 320px) 1fr', gap: 0 }} className="cert-grid">
        {/* Cover */}
        <div style={{ position: 'relative' as const, aspectRatio: '4 / 3', background: '#1a1a1a', overflow: 'hidden' as const }}>
          <img
            src={cert.cover}
            alt={cert.shortName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }}
            loading="lazy"
          />
          <div style={{ position: 'absolute' as const, inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.65) 100%)', pointerEvents: 'none' as const }} />
          <div style={{ position: 'absolute' as const, top: 16, left: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, padding: '6px 12px', background: 'rgba(255,255,255,0.92)', color: C.text, borderRadius: 999 }}>
              {cert.nivel}
            </span>
          </div>
          {isActive && (
            <div style={{ position: 'absolute' as const, top: 16, right: 16, padding: '6px 12px', background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, borderRadius: 999 }}>
              ✓ Activa
            </div>
          )}
          <div style={{ position: 'absolute' as const, left: 20, right: 20, bottom: 18, color: '#fff', zIndex: 2 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.012em' }}>
              {cert.shortName}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px 24px', display: 'flex', flexDirection: 'column' as const }}>
          {/* Top row: price + duration */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' as const }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Cuesta una vez</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: C.text, letterSpacing: '-0.025em', lineHeight: 1 }}>{cert.precioMostrar}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{cert.duracion}</div>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Cobras al cliente</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: C.green, letterSpacing: '-0.02em', lineHeight: 1 }}>{cert.serviceChargeMostrar}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{cert.serviceUnit}</div>
            </div>
          </div>

          {/* Description */}
          <p style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.6, margin: '8px 0 0' }}>
            {cert.descripcion}
          </p>

          {/* Para quién */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Para quién</div>
            <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.55 }}>{cert.paraQuien}</div>
          </div>

          {/* Expand toggle */}
          {!expanded && (
            <button onClick={onToggle}
              style={{ marginTop: 18, padding: 0, background: 'transparent', border: 'none', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const, alignSelf: 'flex-start' }}>
              Ver temario y beneficios →
            </button>
          )}

          {expanded && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Temario</div>
                  <ul style={{ listStyle: 'none' as const, padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {cert.temario.map((t, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' as const, fontSize: 13, color: C.textSoft, lineHeight: 1.5 }}>
                        <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: C.accent, marginTop: 8 }} />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Beneficios</div>
                  <ul style={{ listStyle: 'none' as const, padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {cert.beneficios.map((b, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' as const, fontSize: 13, color: C.textSoft, lineHeight: 1.5 }}>
                        <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: 'rgba(42,181,160,0.12)', color: C.greenDark, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <button onClick={onToggle}
                style={{ marginTop: 18, padding: 0, background: 'transparent', border: 'none', color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const, alignSelf: 'flex-start' as const }}>
                ← Ocultar detalle
              </button>
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted }}>
              {cert.serviceModel === 'monthly' ? <Icon.Refresh size={13} /> : <Icon.Zap size={13} />}
              {cert.serviceModel === 'monthly' ? 'Ingreso recurrente mensual' : 'Proyecto puntual'}
            </div>
            {isActive ? (
              <span style={{ ...stagePill(C.greenDark), padding: '8px 16px', fontSize: 12 }}>
                Activa{cert.paid_at ? ` desde ${new Date(cert.paid_at).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}` : ''}
              </span>
            ) : (
              <button onClick={onBuy} disabled={purchasing}
                style={{ ...SS.btn, padding: '12px 22px', opacity: purchasing ? 0.6 : 1 }}>
                {purchasing ? 'Iniciando…' : `Comprar · ${cert.precioMostrar}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 720px) {
          .cert-grid { grid-template-columns: 1fr !important; }
          .cert-grid > div:first-child { aspect-ratio: 16 / 9 !important; }
        }
      ` }} />
    </div>
  );
}

function stagePill(color: string): React.CSSProperties {
  return { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: '#fff', background: color };
}

// Demo fixtures (matchea CERTIFICATIONS catálogo)
const DEMO_CERTS: Cert[] = [
  {
    id: 'impl_una_sucursal',
    nombre: 'Certificación · Implementación de una sucursal',
    shortName: 'Implementación · 1 sucursal',
    precio: 750000,
    precioMostrar: '$7,500',
    duracion: '4 horas en vivo + materiales',
    nivel: 'Principiante',
    cover: '/images/certificaciones/impl-una-sucursal.webp',
    descripcion: 'Domina el setup completo de SACS para un negocio de una sola sucursal: productos, inventario, POS, facturación electrónica y capacitación al equipo del cliente.',
    paraQuien: 'Partners que quieren empezar a cobrar implementaciones a pequeños negocios sin complejidad multi-sucursal.',
    temario: [
      'Configuración inicial de cuenta SACS y datos del negocio',
      'Alta de productos: variantes, categorías, precios e impuestos',
      'Configuración del POS, cajeros y métodos de pago',
      'Setup de facturación electrónica CFDI 4.0',
      'Importación masiva desde Excel',
      'Reportes esenciales y cierre de día',
      'Capacitación práctica al equipo del cliente',
    ],
    beneficios: [
      'Diploma digital descargable + badge "Implementación · 1 sucursal" en tu portal',
      'Plantilla de propuesta de servicios lista para enviar al cliente',
      'Acceso a comunidad privada de partners certificados',
    ],
    serviceChargeMin: 5000,
    serviceChargeMax: 12000,
    serviceChargeMostrar: '$5,000 – $12,000',
    serviceModel: 'one-time',
    serviceUnit: '/ implementación',
    status: 'none', unlocked: false, paid_at: null,
  },
  {
    id: 'impl_multisucursal',
    nombre: 'Certificación · Implementación multi-sucursal',
    shortName: 'Implementación · Multi-sucursal',
    precio: 1400000,
    precioMostrar: '$14,000',
    duracion: '10 horas en vivo + casos prácticos + mentoría',
    nivel: 'Intermedio / Avanzado',
    cover: '/images/certificaciones/impl-multisucursal.webp',
    descripcion: 'Especialízate en negocios con varias sucursales: arquitectura, consolidación, transferencias entre tiendas, control de acceso por rol, reportes HQ y operación a escala.',
    paraQuien: 'Partners que quieren cerrar cadenas medianas de 3 a 50+ sucursales y cobrar implementaciones más grandes.',
    temario: [
      'Arquitectura multi-sucursal: consolidación vs autonomía por tienda',
      'Inventario distribuido y transferencias entre sucursales',
      'Control de acceso por rol: cajero, gerente, regional, HQ',
      'Reportes consolidados con drill-down por sucursal',
      'Pricing dinámico y promociones segmentadas por región',
      'Onboarding de cadenas: plan a 30/60/90 días',
      'Casos prácticos: Liveshow (1,500), Bella Pandita (43)',
    ],
    beneficios: [
      'Diploma + badge "Multi-sucursal" en tu portal',
      'Plantilla de propuesta para cadenas',
      'Acceso a leads enterprise pre-calificados de SACS',
      'Mentoría 1:1 de 60 min con un Solutions Architect',
    ],
    serviceChargeMin: 20000,
    serviceChargeMax: 60000,
    serviceChargeMostrar: '$20,000 – $60,000',
    serviceModel: 'one-time',
    serviceUnit: '/ implementación',
    status: 'none', unlocked: false, paid_at: null,
  },
  {
    id: 'migracion_datos',
    nombre: 'Certificación · Migración de datos a SACS',
    shortName: 'Migración de datos',
    precio: 750000,
    precioMostrar: '$7,500',
    duracion: '6 horas en vivo + plantillas + ejercicios',
    nivel: 'Especialización',
    cover: '/images/certificaciones/migracion-datos.webp',
    descripcion: 'Especialización en migrar la información del cliente a SACS — productos, inventario, clientes, ventas históricas y catálogos — desde Excel, Aspel, Microsip u otros sistemas, sin perder un solo registro.',
    paraQuien: 'Partners que quieren cobrar el servicio crítico de migración como un proyecto independiente del setup.',
    temario: [
      'Modelo de datos de SACS: cómo encajan productos, variantes y SKUs',
      'Auditoría del sistema origen del cliente (Aspel, Microsip, Excel, etc.)',
      'Plantillas de importación masiva con validación previa',
      'Migración de clientes, deudas, ventas históricas y stock',
      'Estrategia de corte: día D, doble registro, validación post-migración',
      'Reconciliación contable y reporte de migración',
      'Casos prácticos: migración de 10K SKUs y 50K clientes',
    ],
    beneficios: [
      'Diploma + badge "Migración de datos" en tu portal',
      'Set de plantillas Excel validadas para migración',
      'Checklist y SLA modelo para ofrecer al cliente',
    ],
    serviceChargeMin: 8000,
    serviceChargeMax: 25000,
    serviceChargeMostrar: '$8,000 – $25,000',
    serviceModel: 'one-time',
    serviceUnit: '/ migración',
    status: 'none', unlocked: false, paid_at: null,
  },
  {
    id: 'ia_automatizacion',
    nombre: 'Certificación · Automatización con IA en SACS',
    shortName: 'Automatización con IA',
    precio: 1400000,
    precioMostrar: '$14,000',
    duracion: '12 horas en vivo + workshops + mentoría',
    nivel: 'Avanzado',
    cover: '/images/certificaciones/ia-automatizacion.webp',
    descripcion: 'Aprende a usar el módulo de IA de SACS (Axo Copiloto y orquestador de agentes) para automatizar procesos repetitivos del cliente: alta de productos, atención por WhatsApp, reposición de inventario, cobranza y reportes.',
    paraQuien: 'Partners que quieren ofrecer proyectos de automatización con IA — el servicio mejor pagado del catálogo.',
    temario: [
      'Identificar procesos automatizables en cada tipo de negocio',
      'Axo Copiloto IA: configuración por giro y por caso de uso',
      'Orquestador de agentes: flujos de varios pasos',
      'Automatización de WhatsApp: cotizar, agendar, cerrar venta',
      'Reposición inteligente de inventario por sucursal',
      'Cobranza y recordatorios automatizados',
      'Workshops: 4 automatizaciones reales construidas en clase',
    ],
    beneficios: [
      'Diploma + badge "Automatización con IA" en tu portal',
      'Plantillas de 8 automatizaciones listas para vender',
      'Mentoría 1:1 con el equipo de producto IA',
      'Acceso a Slack privado de partners certificados en IA',
    ],
    serviceChargeMin: 15000,
    serviceChargeMax: 45000,
    serviceChargeMostrar: '$15,000 – $45,000',
    serviceModel: 'one-time',
    serviceUnit: '/ proyecto',
    status: 'none', unlocked: false, paid_at: null,
  },
  {
    id: 'consultor_ia',
    nombre: 'Certificación · Consultor en IA y análisis de datos',
    shortName: 'Consultor en IA',
    precio: 2100000,
    precioMostrar: '$21,000',
    duracion: '14 horas en vivo + casos reales + mentoría continua',
    nivel: 'Senior',
    cover: '/images/certificaciones/consultor-ia.webp',
    descripcion: 'Aprende a leer los datos del cliente con IA, interpretarlos junto con él y entregar un reporte ejecutivo cada 30 días. Es un servicio recurrente — un retainer mensual con el cliente.',
    paraQuien: 'Partners que quieren ingresos recurrentes mensuales analizando los datos de cada cliente y traduciéndolos en decisiones de negocio.',
    temario: [
      'Marco de análisis: ventas, inventario, clientes, márgenes, mix',
      'IA para detectar patrones, anomalías y oportunidades',
      'Cómo correr una sesión mensual de revisión con el cliente',
      'Plantilla de reporte ejecutivo de 30 días',
      'Recomendaciones accionables: qué cambiar y por qué',
      'Cómo cobrar y mantener un retainer mensual',
      'Casos reales: 6 cuentas analizadas en clase',
    ],
    beneficios: [
      'Diploma + badge "Consultor IA" en tu portal',
      'Plantilla de reporte ejecutivo mensual',
      'Modelo de contrato de consultoría mensual',
      'Mentoría continua del equipo de Customer Success',
    ],
    serviceChargeMin: 5000,
    serviceChargeMax: 15000,
    serviceChargeMostrar: '$5,000 – $15,000',
    serviceModel: 'monthly',
    serviceUnit: '/ mes recurrente',
    status: 'none', unlocked: false, paid_at: null,
  },
];
