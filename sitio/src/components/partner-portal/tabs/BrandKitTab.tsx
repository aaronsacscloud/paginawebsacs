import { SS, C } from './styles';
import { Icon } from './icons';

export default function BrandKitTab() {
  return (
    <div>
      <h1 style={SS.h1Small}>Brand kit</h1>
      <p style={SS.leadSm}>Logos, fotos y plantillas oficiales de SACS para que tus posts y materiales se vean consistentes con la marca.</p>

      <h2 style={SS.h2}>Logos</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Asset
          name="Logo color · PNG"
          desc="Versión a color · fondo transparente"
          href="/brandkit/sacs-logo-color.png"
          preview={<LogoBox bg="#fff" textColor={C.text} />}
        />
        <Asset
          name="Logo color · SVG"
          desc="Vector escalable infinito"
          href="/brandkit/sacs-logo.svg"
          preview={<LogoBox bg="#fff" textColor={C.text} />}
        />
        <Asset
          name="Logo negro · PNG"
          desc="Para fondos claros"
          href="/brandkit/sacs-logo-black.png"
          preview={<LogoBox bg="#fafafa" textColor={C.text} />}
        />
        <Asset
          name="Logo blanco · PNG"
          desc="Para fondos oscuros"
          href="/brandkit/sacs-logo-white.png"
          preview={<LogoBox bg={C.text} textColor="#fff" />}
        />
      </div>

      <h2 style={SS.h2}>Fotos de producto</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <Photo name="Dashboard · laptop" desc="Vista principal de SACS en escritorio" src="/images/screen-ecommerce.webp" />
        <Photo name="POS · iPad" desc="Punto de venta en tablet" src="/images/hero-sacs-store.webp" />
        <Photo name="Catálogo · móvil" desc="Producto en celular" src="/images/case-liveshow.webp" />
        <Photo name="Reportes · escritorio" desc="Analítica y dashboards" src="/images/case-bella-pandita.webp" />
      </div>

      <h2 style={SS.h2}>Plantillas y materiales</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Asset name="Templates Canva" desc="Reels, historias y posts listos" href="https://www.canva.com/" external />
        <Asset name="Email signature banner" desc="600 × 150 px optimizado" href="/brandkit/sacs-email-banner.png" />
        <Asset name="Banner LinkedIn" desc="1584 × 396 px portada" href="/brandkit/sacs-linkedin-banner.png" />
        <Asset name="Guía de tono · PDF" desc="Cómo hablar de SACS" href="/brandkit/sacs-tone-guide.pdf" />
      </div>

      <h2 style={SS.h2}>Paleta de colores</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <ColorSwatch name="Azul SACS" hex="#4B7BE5" />
        <ColorSwatch name="Negro" hex="#1A1A1A" />
        <ColorSwatch name="Crema" hex="#FAFAFA" />
        <ColorSwatch name="Verde activo" hex="#2AB5A0" />
        <ColorSwatch name="Dorado partner" hex="#C8A55B" />
      </div>

      <div style={{ ...SS.note, marginTop: 32 }}>
        ¿Necesitas un asset específico o quieres que diseñemos algo para tu campaña? Escríbenos a <a href="mailto:partners@sacscloud.com" style={{ color: C.accent, fontWeight: 600 }}>partners@sacscloud.com</a>.
      </div>
    </div>
  );
}

function Asset({ name, desc, href, external, preview }: { name: string; desc: string; href: string; external?: boolean; preview?: React.ReactNode }) {
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}
      download={!external ? true : undefined}
      style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
        textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' as const,
        transition: 'transform 0.12s, box-shadow 0.12s', cursor: 'pointer', overflow: 'hidden' as const,
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 24px -14px rgba(0,0,0,0.15)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}>
      {preview && (
        <div style={{ aspectRatio: '5 / 3', overflow: 'hidden' as const, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${C.border}` }}>
          {preview}
        </div>
      )}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{name}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>{desc}</div>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {external ? 'Abrir' : 'Descargar'} <Icon.ArrowRight size={12} />
        </div>
      </div>
    </a>
  );
}

function Photo({ name, desc, src }: { name: string; desc: string; src: string }) {
  return (
    <a href={src} target="_blank" rel="noopener" download
      style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
        textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' as const,
        transition: 'transform 0.12s, box-shadow 0.12s', overflow: 'hidden' as const,
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 24px -14px rgba(0,0,0,0.15)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}>
      <div style={{ aspectRatio: '16 / 10', overflow: 'hidden' as const, background: '#f5f5f3' }}>
        <img src={src} alt={name} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }} />
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{name}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{desc}</div>
      </div>
    </a>
  );
}

function ColorSwatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
      <div style={{ aspectRatio: '2 / 1', background: hex }} />
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{name}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontFamily: 'SF Mono, Courier New, monospace' }}>{hex}</div>
      </div>
    </div>
  );
}

function LogoBox({ bg, textColor }: { bg: string; textColor: string }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: 'Clash Display, sans-serif',
        fontWeight: 700, fontSize: 28, color: textColor, letterSpacing: '-0.02em',
      }}>Sacs</span>
    </div>
  );
}
