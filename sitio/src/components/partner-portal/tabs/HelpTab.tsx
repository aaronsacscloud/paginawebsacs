// Ayuda — FAQ + contacto directo por WhatsApp + recursos.

import { useState } from 'react';
import { SS, C } from './styles';
import { Icon } from './icons';

const SUPPORT_WHATSAPP = '+525540621003';
const SUPPORT_EMAIL = 'partners@sacscloud.com';

const FAQS: { q: string; a: string }[] = [
  {
    q: '¿Cuándo recibo mi primera comisión?',
    a: 'Cuando un cliente que vino vía tu link paga su primer mes de plan, se genera automáticamente tu comisión del 50% sobre el cierre. SACS valida 24-48h, luego pasa a "Confirmado" y se deposita el día 1 del mes siguiente.',
  },
  {
    q: '¿Qué pasa si el cliente cancela su plan?',
    a: 'Mientras el cliente esté pagando, sigues generando comisión recurrente. Si cancela, dejas de cobrar a partir del siguiente ciclo — pero los meses ya cobrados son tuyos.',
  },
  {
    q: '¿Necesito facturar a SACS?',
    a: 'Sí. SACS te pide CFDI por el monto del payout antes del día 1. Te enviamos el detalle con concepto, RFC fiscal de SACS y monto a facturar. Si no facturas, el pago no se libera.',
  },
  {
    q: '¿Qué pasa si no alcanzo los 100 puntos del mes?',
    a: 'Tienes 3 strikes consecutivos antes de la suspensión automática. Si fallas 1 mes, recibes warning. Si fallas 2 meses, alerta final. Si fallas 3 meses consecutivos, se suspende tu programa automáticamente.',
  },
  {
    q: '¿Cómo subo de nivel?',
    a: 'Lvl 1 → Lvl 2: completa 1 certificación oficial. Lvl 2 → Lvl 3 (Master Partner): cierra 5 sucursales activas en tu cartera. Lvl 3 → Lvl 4 (Founder Circle): sostén Master Partner Nv 4 por 12 meses consecutivos. Las activaciones son automáticas.',
  },
  {
    q: '¿Cómo agrego otra cuenta de email?',
    a: 'Por seguridad, agregar cuentas adicionales requiere verificación humana. Escríbenos a partners@sacscloud.com o por WhatsApp con el nuevo email y validamos en 24-48h.',
  },
  {
    q: '¿Qué incluye mi cuenta SACS Plan Fideliza gratuita?',
    a: 'POS multi-sucursal, inventario y catálogo, e-commerce + redes (TikTok Shop, Meta, WhatsApp), CRM con programa de lealtad, marketing por email + WhatsApp, reportes y analítica. Sin cargo mensual mientras tu programa partner esté activo.',
  },
  {
    q: '¿Puedo combinar mi rol de partner con un negocio propio?',
    a: 'Sí — de hecho lo recomendamos. Usa tu cuenta Plan Fideliza para operar tu propio retail y conviértete en caso de éxito. Conoces SACS de primera mano y tus demos se vuelven testimonios reales.',
  },
  {
    q: '¿Qué pasa con mis leads si me suspenden?',
    a: 'Los leads que ya cerraron como clientes siguen generando comisión recurrente para ti (no perdemos esa atribución). Lo que pausa son los nuevos leads — tu link se desactiva temporalmente hasta que reactives.',
  },
  {
    q: '¿Cómo funciona el override del 10% en Master Partner?',
    a: 'Cuando seas Master Partner (Lvl 3+), por cada venta que cierre un partner de tu red ganas 10% adicional, mes con mes, mientras ese cliente siga pagando. Sin tope. El partner directo se queda con su 50% normal.',
  },
];

const RESOURCES = [
  { title: 'Guía rápida del partner', desc: 'PDF · 12 pp con todo lo esencial para arrancar', href: '/recursos/guia-partner.pdf' },
  { title: 'Plan de compensación completo', desc: 'Términos legales, tabuladores, cláusulas', href: '/recursos/plan-compensacion.pdf' },
  { title: 'Brand kit oficial', desc: 'Logos, fotos, plantillas Canva, paleta', href: '#brandkit', internal: true },
  { title: 'Catálogo de tareas', desc: '30+ tipos de actividad que suman puntos', href: '#nivel', internal: true },
];

export default function HelpTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const waMessage = encodeURIComponent(`Hola, soy ${user.nombre || 'partner'} (${user.email}). Necesito ayuda con:`);
  const waLink = `https://wa.me/${SUPPORT_WHATSAPP.replace(/[^\d]/g, '')}?text=${waMessage}`;

  return (
    <div>
      <h1 style={SS.h1Small}>Ayuda</h1>
      <p style={SS.leadSm}>Respuestas rápidas a las dudas más comunes. Si no encuentras lo que buscas, contáctanos directo por WhatsApp.</p>

      {/* CTA principal · WhatsApp soporte */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
        color: '#fff',
        borderRadius: 18,
        padding: '36px 40px',
        marginBottom: 36,
        boxShadow: '0 12px 32px -16px rgba(75,123,229,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap' as const,
      }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>
            Contacto directo
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: '#fff', margin: '12px 0 10px', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            ¿Necesitas ayuda? Escríbenos por WhatsApp
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.6, margin: 0 }}>
            Respondemos en menos de 2 horas hábiles (lun-vie 9:00-19:00 CDMX). Tu mensaje llega directo a un humano del equipo de partners.
          </p>
        </div>
        <a href={waLink} target="_blank" rel="noopener"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 24px', background: '#fff', color: C.brand,
            borderRadius: 999, fontWeight: 600, fontSize: 14,
            textDecoration: 'none', whiteSpace: 'nowrap' as const,
          }}>
          <Icon.WhatsApp size={16} />
          Abrir WhatsApp
        </a>
      </div>

      {/* Canales de contacto */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 8 }}>
        <ChannelCard Ico={Icon.WhatsApp} title="WhatsApp" desc="Lun-vie 9–19h CDMX · Respuesta <2h" href={waLink} external />
        <ChannelCard Ico={Icon.Mail}     title="Email"    desc="Para temas largos o adjuntos · 24h"        href={`mailto:${SUPPORT_EMAIL}`} />
        <ChannelCard Ico={Icon.Calendar} title="Agenda"   desc="20 min con tu Partner Manager"             href="https://cal.com/sacs/partners" external />
      </div>

      {/* FAQ */}
      <h2 style={SS.h2}>Preguntas frecuentes</h2>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
        {FAQS.map((f, i) => {
          const isOpen = openFaq === i;
          return (
            <div key={i} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              overflow: 'hidden' as const,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}>
              <button onClick={() => setOpenFaq(isOpen ? null : i)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  width: '100%', padding: '18px 24px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'left' as const, fontFamily: 'inherit',
                }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{f.q}</span>
                <span style={{ flexShrink: 0, color: C.muted, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <Icon.ChevronDown size={18} />
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 24px 22px', fontSize: 14, color: C.textSoft, lineHeight: 1.65 }}>
                  {f.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recursos */}
      <h2 style={SS.h2}>Recursos</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {RESOURCES.map((r, i) => (
          <a key={i} href={r.href}
            target={r.internal ? undefined : '_blank'}
            rel={r.internal ? undefined : 'noopener'}
            onClick={r.internal ? (e) => {
              e.preventDefault();
              window.location.hash = r.href.replace('#', '');
            } : undefined}
            style={{
              ...SS.card,
              display: 'flex', alignItems: 'flex-start', gap: 14,
              textDecoration: 'none', color: 'inherit',
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 24px -14px rgba(0,0,0,0.15)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}>
            <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: C.brandSoft, color: C.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.Book size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{r.desc}</div>
              <div style={{ fontSize: 12, color: C.brand, fontWeight: 600, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {r.internal ? 'Abrir' : 'Descargar'} <Icon.ArrowRight size={12} />
              </div>
            </div>
          </a>
        ))}
      </div>

      <div style={{ ...SS.note, marginTop: 28 }}>
        <strong>¿No encontraste lo que buscabas?</strong>{' '}
        Escríbenos a <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: C.brand, fontWeight: 600 }}>{SUPPORT_EMAIL}</a>{' '}o
        directo por <a href={waLink} target="_blank" rel="noopener" style={{ color: C.brand, fontWeight: 600 }}>WhatsApp</a>. Estamos para apoyarte.
      </div>
    </div>
  );
}

function ChannelCard({ Ico, title, desc, href, external }: { Ico: (p: any) => JSX.Element; title: string; desc: string; href: string; external?: boolean }) {
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}
      style={{
        ...SS.card,
        textDecoration: 'none', color: 'inherit',
        display: 'flex', alignItems: 'center', gap: 16,
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 24px -14px rgba(0,0,0,0.15)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}>
      <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, background: C.brandSoft, color: C.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Ico size={18} />
      </span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>{desc}</div>
      </div>
    </a>
  );
}
