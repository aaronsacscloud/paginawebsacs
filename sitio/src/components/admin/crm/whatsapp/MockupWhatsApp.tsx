// WHATSAPP · Preview de plantilla estilo teléfono (portado de sacs_inbox/
// WhatsAppPhoneMockup): marco con notch, barra #075E54, fondo #ECE5DD,
// burbuja BLANCA con cola (entrante, así lo ve el cliente), {{n}} como chips,
// botones como cards blancas con texto azul.
import { C } from './estilo';

export default function MockupWhatsApp({ header, cuerpo, footer, botones = [], nombreNegocio = 'Sacscloud' }: {
  header?: string | null; cuerpo: string; footer?: string | null; botones?: { texto: string }[]; nombreNegocio?: string;
}) {
  const partes = cuerpo.split(/(\{\{[^}]+\}\})/g);
  return (
    <div style={{ width: 280, margin: '0 auto', border: '3px solid #1F2937', borderRadius: 32, overflow: 'hidden', background: '#ECE5DD', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,.18)' }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 110, height: 18, background: '#1F2937', borderRadius: '0 0 14px 14px', zIndex: 2 }} />
      <div style={{ background: '#075E54', color: '#fff', padding: '26px 12px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 999, background: '#128C7E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>S</span>
        <span><b style={{ fontSize: 12, display: 'block' }}>{nombreNegocio}</b><span style={{ fontSize: 9, opacity: .8 }}>en línea</span></span>
      </div>
      <div style={{ padding: '14px 10px', minHeight: 220 }}>
        {!cuerpo.trim() ? (
          <p style={{ fontSize: 10, color: C.g500, textAlign: 'center', marginTop: 70 }}>Escribe el cuerpo para ver la vista previa</p>
        ) : (
          <div style={{ position: 'relative', background: '#fff', borderRadius: 8, padding: '7px 9px', maxWidth: '88%', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
            <span style={{ position: 'absolute', left: -6, top: 8, width: 12, height: 12, background: '#fff', transform: 'rotate(45deg)' }} />
            {header && <b style={{ fontSize: 12, display: 'block', marginBottom: 3 }}>{header}</b>}
            <span style={{ fontSize: 12, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {partes.map((p, i) => /^\{\{[^}]+\}\}$/.test(p)
                ? <span key={i} style={{ background: C.emerald100, color: C.emerald700, borderRadius: 4, padding: '0 4px', fontSize: 10, fontWeight: 700 }}>{p}</span>
                : <span key={i}>{p}</span>)}
            </span>
            {footer && <span style={{ fontSize: 10, color: C.g400, display: 'block', marginTop: 4 }}>{footer}</span>}
            <span style={{ fontSize: 9, color: C.g400, display: 'flex', justifyContent: 'flex-end', gap: 3, marginTop: 3 }}>12:00 p.m. <span style={{ color: '#53BDEB' }}>✓✓</span></span>
          </div>
        )}
        {cuerpo.trim() && botones.filter(b => b.texto).map((b, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 8, padding: 8, marginTop: 4, maxWidth: '88%', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#027EB5', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>{b.texto}</div>
        ))}
      </div>
      <div style={{ background: '#F0F0F0', padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ flex: 1, height: 26, borderRadius: 999, background: '#fff', fontSize: 10, color: C.g400, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>Mensaje</span>
        <span style={{ width: 26, height: 26, borderRadius: 999, background: '#128C7E' }} />
      </div>
    </div>
  );
}
