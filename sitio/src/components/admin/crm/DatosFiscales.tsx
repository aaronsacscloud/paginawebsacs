// Los datos fiscales de una cuenta: UN bloque, dos pantallas.
//
// Lo usan el alta de cuenta (onboarding) y el paso 2 del alta de pago. Antes
// vivía suelto dentro de CuentaCliente y al pedirlo también en el cobro la
// copia era inevitable — y copiado significa que en un mes un lado acepta un
// RFC que el otro rechaza, y el cliente se entera pidiendo su factura.
//
// Dos modos, porque los dos casos son distintos de verdad:
//  · 'guardar'  — la cuenta ya existe: valida, guarda y avisa.
//  · 'entregar' — la cuenta TODAVÍA no existe (cliente nuevo en el alta de
//                 pago): valida y devuelve los datos para que quien llama los
//                 guarde cuando ya tenga el company_id.
import { useEffect, useState } from 'react';
import { REGIMENES, validarFiscales, textoFaltantes, type Fiscales } from '../../../lib/crm/fiscal.ts';

const inp = {
  border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem',
  background: '#fdfcff', fontFamily: 'inherit' as const, outline: 'none', width: '100%',
  boxSizing: 'border-box' as const,
};

export default function DatosFiscales({
  companyId, fisc, modo = 'guardar', textoBoton = 'Guardar datos fiscales', ocupadoFuera = false,
  onGuardado, onCancelar,
}: {
  companyId?: string | null;
  fisc?: Fiscales | null;
  modo?: 'guardar' | 'entregar';
  textoBoton?: string;
  ocupadoFuera?: boolean;
  onGuardado: (datos: Fiscales & { constancia_url?: string; constancia_nombre?: string }) => void | Promise<void>;
  onCancelar?: () => void;
}) {
  /* `null` = «el usuario no ha escrito»; '' = «lo borró a propósito». Con `||`
     un campo vaciado volvía a pintar el valor guardado y ESE se mandaba: un RFC
     mal capturado no se podía corregir borrándolo, solo escribiendo encima. */
  const [form, setForm] = useState<any>({ rfc: null, razon_social: null, cp_fiscal: null, regimen_fiscal: null });
  const val = (k: string) => (form[k] ?? (fisc as any)?.[k] ?? '');
  const [constancia, setConstancia] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setForm({ rfc: null, razon_social: null, cp_fiscal: null, regimen_fiscal: null }); setConstancia(null); setError(''); }, [companyId]);

  const falta = textoFaltantes(fisc);

  async function continuar() {
    const v = validarFiscales({ rfc: val('rfc'), razon_social: val('razon_social'), cp_fiscal: val('cp_fiscal'), regimen_fiscal: val('regimen_fiscal') });
    if (!v.ok) { setError(v.error); return; }
    const extra = constancia ? { constancia_url: constancia.url, constancia_nombre: constancia.nombre } : {};
    setError(''); setOcupado(true);
    try {
      if (modo === 'guardar') {
        if (!companyId) { setError('No sé a qué cuenta pertenecen estos datos.'); setOcupado(false); return; }
        const r = await fetch('/api/crm/onboarding/cuenta', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, accion: 'fiscales', ...v.datos, ...extra }),
        }).then(x => x.json()).catch(err => ({ error: String(err) }));
        if (r?.error) { setError(r.error); setOcupado(false); return; }
      }
      await onGuardado({ ...v.datos, ...extra });
    } catch (e: any) { setError(e?.message || String(e)); }
    setOcupado(false);
  }

  const trabajando = ocupado || subiendo || ocupadoFuera;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: '0.8rem', color: '#4a4a52' }}>
        {falta ? <><b>{falta}</b>. Sin esto no se le puede facturar cuando lo pida.</>
               : <>Confirma sus <b>datos fiscales</b> antes de cerrar el cobro.</>}
      </div>

      <input value={val('razon_social')} onChange={e => setForm({ ...form, razon_social: e.target.value })}
        placeholder="Razón social (como en su constancia)" style={inp} autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
        <input value={val('rfc')} onChange={e => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
          placeholder="RFC" style={{ ...inp, textTransform: 'uppercase' as const }} />
        <input value={val('cp_fiscal')} onChange={e => setForm({ ...form, cp_fiscal: e.target.value.replace(/\D/g, '').slice(0, 5) })}
          placeholder="C.P. fiscal" style={inp} inputMode="numeric" />
      </div>
      <select value={val('regimen_fiscal')} onChange={e => setForm({ ...form, regimen_fiscal: e.target.value })} style={inp as any}>
        <option value="">Régimen fiscal…</option>
        {REGIMENES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* La constancia es OPCIONAL y lo dice. Muchos negocios no la traen a la
          mano, y exigirla frenaría un cobro que ya está hecho. Los cuatro
          campos de arriba bastan para facturar. */}
      <label style={{
        border: '1.5px dashed #cfc6f2', borderRadius: 10, padding: '11px 13px', fontSize: '0.76rem',
        color: constancia ? '#1E8A63' : '#6b5fa8', background: '#fff', cursor: 'pointer', textAlign: 'center' as const,
      }}>
        {subiendo ? 'Subiendo la constancia…'
          : constancia ? `Constancia adjunta: ${constancia.nombre}`
          : (fisc?.constancia_fiscal_nombre ? `Ya tiene constancia: ${fisc.constancia_fiscal_nombre} · reemplazar`
            : 'Adjuntar su constancia de situación fiscal (opcional)')}
        <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          setSubiendo(true); setError('');
          const fd = new FormData(); fd.append('file', file);
          const r = await fetch('/api/crm/notas/upload', { method: 'POST', body: fd }).then(x => x.json()).catch(err => ({ error: String(err) }));
          setSubiendo(false);
          if (r.error) { setError(`La constancia no subió: ${r.error}`); return; }
          setConstancia({ url: r.url, nombre: file.name });
        }} />
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        {onCancelar && <button onClick={onCancelar} disabled={trabajando}
          style={{ border: '1px solid #e4dffb', background: '#fff', borderRadius: 9, padding: '9px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Atrás</button>}
        <button onClick={continuar} disabled={trabajando}
          style={{ flex: 1, border: 'none', background: '#1E8A63', color: '#fff', borderRadius: 9, padding: '10px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: trabajando ? 'default' : 'pointer', opacity: trabajando ? 0.6 : 1, fontFamily: 'inherit' }}>
          {ocupado ? 'Guardando…' : textoBoton}
        </button>
      </div>
      {error && <div style={{ fontSize: '0.76rem', color: '#C0554E' }}>{error}</div>}
    </div>
  );
}
