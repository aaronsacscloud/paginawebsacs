// TRABAJO INTELIGENTE · F3 — EL REGISTRO DE CAMPOS y las DEUDAS DE DATO.
//
// Principio aprobado: el dato se captura donde nace; al humano se le pide EL
// CAMPO exacto, nunca «abre la ficha y llena». Cada campo vigilado declara
// dónde vive, cómo se captura y cuándo «se debe» — agregar un campo es
// agregar un renglón aquí, nunca tocar el motor.
//
// La escritura es por ALLOW-LIST: solo puede escribirse lo que este registro
// declara, en la tabla y columna que declara. Nada de updates arbitrarios.
import { supabase } from '../../supabase';

type Captura =
  | { tipo: 'texto'; placeholder: string }
  | { tipo: 'numero'; placeholder: string }
  | { tipo: 'opciones'; opciones: Record<string, string> };

export type CampoDef = {
  etiqueta: string;
  /** bloqueante (impide una acción) · comercial (con reloj) · higiene (lote) */
  clase: 'bloqueante' | 'comercial' | 'higiene';
  tabla: 'contacts' | 'companies' | 'bookings';
  columna: string;
  captura: Captura;
  nota: string;
};

export const CAMPOS: Record<string, CampoDef> = {
  reunion_resultado: {
    etiqueta: 'Resultado de la reunión', clase: 'comercial',
    tabla: 'bookings', columna: 'estado',
    captura: { tipo: 'opciones', opciones: { asistio: 'Se hizo — asistió', no_asistio: 'No llegó' } },
    nota: 'Pasaron 24 h de la reunión y nadie registró qué pasó.',
  },
  rfc: {
    etiqueta: 'RFC', clase: 'higiene',
    tabla: 'companies', columna: 'rfc',
    captura: { tipo: 'texto', placeholder: 'RFC…' },
    nota: 'Cliente activo sin RFC: el día que pida factura, esto lo bloquea.',
  },
  razon_social: {
    etiqueta: 'Razón social', clase: 'higiene',
    tabla: 'companies', columna: 'razon_social',
    captura: { tipo: 'texto', placeholder: 'Razón social…' },
    nota: 'Va de la mano del RFC para poder facturar.',
  },
  sacs_account: {
    etiqueta: 'Cuenta SACS', clase: 'comercial',
    tabla: 'companies', columna: 'sacs_account',
    captura: { tipo: 'texto', placeholder: 'nombre de la cuenta…' },
    nota: 'Sin ligarla no hay señales de uso ni salud — el churn se vuelve invisible.',
  },
  giro: {
    etiqueta: 'Giro del negocio', clase: 'higiene',
    tabla: 'contacts', columna: 'giro',
    captura: { tipo: 'opciones', opciones: {
      'Ropa y moda': 'Ropa y moda', 'Zapatería': 'Zapatería', 'Papelería': 'Papelería',
      'Joyería': 'Joyería', 'Abarrotes': 'Abarrotes', 'Ferretería': 'Ferretería',
      'Regalos': 'Regalos', 'Otro': 'Otro',
    } },
    nota: 'Con el giro, sus mensajes de cadencia usan casos de SU ramo.',
  },
  sucursales_interes: {
    etiqueta: 'Sucursales', clase: 'higiene',
    tabla: 'contacts', columna: 'sucursales_interes',
    captura: { tipo: 'numero', placeholder: '¿cuántas sucursales?' },
    nota: 'El tamaño decide el score de valor y la cadencia premium.',
  },
};

/** Escribir un dato CONFIRMADO — solo por el registro, solo a su destino. */
export async function escribirDato(clave: string, sujetoId: string, valor: any) {
  const def = CAMPOS[clave];
  if (!def) return { error: `Campo desconocido: ${clave}` };
  if (valor == null || valor === '') return { error: 'Falta el valor' };
  if (def.captura.tipo === 'opciones' && !def.captura.opciones[String(valor)]) {
    return { error: `Valor fuera del catálogo de ${def.etiqueta}` };
  }
  const v = def.captura.tipo === 'numero' ? Number(valor) : String(valor).trim();
  if (def.captura.tipo === 'numero' && !Number.isFinite(v as number)) return { error: 'Debe ser un número' };
  const { error } = await supabase.from(def.tabla).update({ [def.columna]: v }).eq('id', sujetoId);
  return error ? { error: error.message } : { ok: true };
}

/** ¿Ya se pidió este campo para este sujeto hace poco? (no se pregunta dos
 *  veces la misma cosa el mismo mes, aunque siga vacío). */
async function yaPedido(clave: string, sujeto: string) {
  const { data } = await supabase.from('ti_tareas').select('id')
    .filter('payload->>campo_clave', 'eq', clave)
    .filter('payload->>sujeto', 'eq', sujeto)
    .gt('created_at', new Date(Date.now() - 30 * 86400e3).toISOString())
    .limit(1);
  return !!(data || []).length;
}

const P_CLASE = { bloqueante: 3, comercial: 4, higiene: 5 } as const;

async function crearDeuda(clave: string, sujeto: string, extra: {
  contact_id?: string | null; company_id?: string | null; owner_id?: string | null;
  quien: string; instruccion?: string; porque?: string; valor_sugerido?: string; fuente?: string;
}) {
  const def = CAMPOS[clave];
  const cap: any = def.captura;
  await supabase.from('ti_tareas').insert({
    contact_id: extra.contact_id || null, company_id: extra.company_id || null, owner_id: extra.owner_id || null,
    familia: 'higiene', tipo: 'dato', prioridad: P_CLASE[def.clase],
    vence_at: new Date().toISOString(), origen: 'deuda', lote_tipo: def.clase,
    payload: {
      campo_clave: clave, sujeto,
      instruccion: extra.instruccion || `${extra.quien} — ${def.etiqueta}`,
      porque: extra.porque || def.nota,
      campo: def.etiqueta,
      // la forma que el panel ya pinta:
      ...(cap.tipo === 'opciones' ? { opciones: Object.keys(cap.opciones), opciones_l: cap.opciones } : { input: cap.placeholder }),
      ...(extra.valor_sugerido ? { valor: extra.valor_sugerido, fuente: extra.fuente || 'sugerido' } : {}),
    },
  });
}

/** EL DETECTOR — corre dentro de generarPlan. Idempotente y con tope por
 *  corrida: un backlog de 57 RFC entra al lote de a poquitos, no en tsunami. */
export async function detectarDeudas() {
  const res: any = { deuda_reuniones: 0, deuda_facturacion: 0, deuda_sacs: 0, deuda_lead: 0 };

  // 1) Reunión pasada sin resultado (24 h) — el ejemplo original del dueño.
  const { data: reus } = await supabase.from('bookings')
    .select('id, fecha, invitee_nombre, contact_id, contacts(id, nombre, owner_id, company_id)')
    .eq('estado', 'confirmada').not('contact_id', 'is', null)
    // «24 h después»: la reunión de AYER cuenta hoy — el corte es el día CDMX.
    .lt('fecha', new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10)).limit(10);
  for (const r of reus || []) {
    if (await yaPedido('reunion_resultado', String(r.id))) continue;
    const c: any = (r as any).contacts || {};
    await crearDeuda('reunion_resultado', String(r.id), {
      contact_id: r.contact_id, company_id: c.company_id, owner_id: c.owner_id,
      quien: c.nombre || r.invitee_nombre || 'la reunión',
      instruccion: `¿Se hizo la reunión con ${(c.nombre || r.invitee_nombre || '').split(/\s+/)[0] || 'el lead'}?`,
      porque: `Era el ${r.fecha} y nadie registró qué pasó — sin esto el seguimiento no sabe qué sigue.`,
    });
    res.deuda_reuniones++;
  }

  // 2) Cliente activo sin RFC / razón social (facturación) y sin cuenta SACS.
  const { data: emps } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, rfc, razon_social, sacs_account, subscriptions!inner(id, estado)')
    .eq('subscriptions.estado', 'activa').limit(200);
  let cupoFact = 15;
  for (const e of emps || []) {
    const quien = e.nombre_comercial || e.nombre || 'Cliente';
    if (!e.sacs_account && !(await yaPedido('sacs_account', String(e.id)))) {
      await crearDeuda('sacs_account', String(e.id), { company_id: e.id, quien });
      res.deuda_sacs++;
    }
    if (cupoFact > 0 && !e.rfc && !(await yaPedido('rfc', String(e.id)))) {
      await crearDeuda('rfc', String(e.id), { company_id: e.id, quien });
      res.deuda_facturacion++; cupoFact--;
    }
  }

  // 3) Leads del universo TI sin giro / sin sucursales.
  const { data: leads } = await supabase.from('contacts')
    .select('id, nombre, giro, sucursales_interes, owner_id, company_id, propiedades, ti_cadencias!inner(estado)')
    .neq('ti_cadencias.estado', 'terminada').limit(100);
  let cupoLead = 15;
  for (const k of leads || []) {
    if ((k.propiedades as any)?.demo_ti) continue;
    if (cupoLead <= 0) break;
    const quien = k.nombre || 'Lead';
    if (k.giro == null && !(await yaPedido('giro', String(k.id)))) {
      await crearDeuda('giro', String(k.id), { contact_id: k.id, company_id: k.company_id, owner_id: k.owner_id, quien });
      res.deuda_lead++; cupoLead--;
    } else if (k.sucursales_interes == null && !(await yaPedido('sucursales_interes', String(k.id)))) {
      await crearDeuda('sucursales_interes', String(k.id), { contact_id: k.id, company_id: k.company_id, owner_id: k.owner_id, quien });
      res.deuda_lead++; cupoLead--;
    }
  }

  return res;
}
