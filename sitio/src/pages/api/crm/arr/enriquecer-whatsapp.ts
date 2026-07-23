// POST /api/crm/arr/enriquecer-whatsapp?key=sacs-arr-2026
// Cruza un CSV externo (export de respond.io / HubSpot con Name, Email, Phone,
// "Nombre de la empresa") contra el CRM y ENRIQUECE el WhatsApp de los contactos,
// normalizado al formato de WhatsApp de Meta (+52XXXXXXXXXX, sin el "1" de móvil,
// igual que lib/kapso.ts para poder mandar mensajes directo).
//
// Emparejamiento por prioridad:
//   1) EMAIL exacto  → actualiza el WhatsApp de ese contacto.
//   2) TELÉFONO ya presente en el CRM → 'ya_tiene' (no duplica).
//   3) EMPRESA (Nombre de la empresa == companies.nombre):
//        - email nuevo (no es de un contacto existente de esa empresa) → CREA
//          contacto adicional (un cliente puede tener varios contactos).
//        - nombre coincide con un contacto de la empresa → actualiza ese.
//   4) NOMBRE exacto y ÚNICO en todo el CRM → actualiza.
//   5) resto → 'no_encontrado' (se reporta para revisión manual).
//
// Body JSON: { csv, dry_run?: boolean, crear_faltantes?: boolean }
//   dry_run       = true (DEFAULT seguro): no escribe, devuelve el reporte de cruce.
//   crear_faltantes = true: en el caso (3) crea el contacto adicional; si false, lo
//                     reporta como 'empresa_nuevo' sin crearlo. (default true)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const KEY = 'sacs-arr-2026';

// ---- Formato WhatsApp Meta (idéntico a lib/kapso.ts normalizePhone) ----
function metaWhatsApp(phone: string): string {
  let c = String(phone == null ? '' : phone).replace(/[^\d+]/g, '');
  if (!c) return '';
  if (!c.startsWith('+')) c = c.startsWith('52') ? '+' + c : '+52' + c;
  // México: quita el "1" de móvil (+521XXXXXXXXXX -> +52XXXXXXXXXX).
  if (c.startsWith('+521') && c.length === 14) c = '+52' + c.slice(4);
  return c;
}
// Últimos 10 dígitos, para comparar números sin importar prefijos.
const last10 = (p: string) => (String(p || '').replace(/\D/g, '').slice(-10));

// ---- Parser CSV robusto (comillas, comas y saltos dentro de campos) ----
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => (c || '').trim() !== ''));
}

const norm = (s: any) => String(s == null ? '' : s).trim();
const lower = (s: any) => norm(s).toLowerCase();
// Normaliza para comparar nombres/empresas: minúsculas, sin acentos, sin signos.
const key = (s: any) =>
  lower(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export const POST: APIRoute = async ({ request, url }) => {
  if (url.searchParams.get('key') !== KEY) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  const body = await request.json().catch(() => ({} as any));
  const csv: string = body.csv || '';
  const dryRun: boolean = body.dry_run !== false;      // default TRUE
  const crearFaltantes: boolean = body.crear_faltantes !== false; // default TRUE
  if (!csv) return new Response(JSON.stringify({ error: 'csv required' }), { status: 400 });

  const rows = parseCSV(csv);
  if (rows.length < 2) return new Response(JSON.stringify({ error: 'CSV vacío.' }), { status: 400 });

  // Detección flexible de columnas por nombre de encabezado.
  const H = rows[0].map((h) => lower(h));
  const find = (...names: string[]) => { for (const n of names) { const i = H.indexOf(n); if (i >= 0) return i; } return -1; };
  const cName = find('name', 'nombre', 'nombre completo');
  const cEmail = find('email', 'correo', 'e-mail');
  const cPhone = find('phone', 'telefono', 'teléfono', 'whatsapp', 'celular', 'móvil', 'movil');
  const cEmpresa = find('nombre de la empresa', 'empresa', 'company', 'compañía', 'compania');
  if (cPhone < 0) return new Response(JSON.stringify({ error: 'No encontré la columna de teléfono/Phone en el CSV.' }), { status: 400 });

  // ---- Cargar TODO el CRM en memoria (hasta 10k) ----
  const { data: contactsRaw } = await supabase.from('contacts')
    .select('id, nombre, apellido, email, telefono, whatsapp, company_id').is('archived_at', null).range(0, 9999);
  const { data: companiesRaw } = await supabase.from('companies')
    .select('id, nombre, sacs_account').is('archived_at', null).range(0, 9999);
  const contacts = contactsRaw || [];
  const companies = companiesRaw || [];

  const byEmail = new Map<string, any>();
  const byPhone = new Map<string, any>();
  const byNameGlobal = new Map<string, any[]>();
  const contactsByCompany = new Map<string, any[]>();
  for (const c of contacts) {
    if (c.email) byEmail.set(lower(c.email), c);
    const p1 = last10(c.whatsapp), p2 = last10(c.telefono);
    if (p1) byPhone.set(p1, c);
    if (p2 && !byPhone.has(p2)) byPhone.set(p2, c);
    const nk = key([c.nombre, c.apellido].filter(Boolean).join(' '));
    if (nk) { const a = byNameGlobal.get(nk) || []; a.push(c); byNameGlobal.set(nk, a); }
    if (c.company_id) { const a = contactsByCompany.get(c.company_id) || []; a.push(c); contactsByCompany.set(c.company_id, a); }
  }
  const companyByName = new Map<string, any>();
  for (const co of companies) { const k = key(co.nombre); if (k && !companyByName.has(k)) companyByName.set(k, co); }

  // ---- Clasificar cada fila ----
  const cat: Record<string, number> = { email: 0, ya_tiene: 0, empresa_nuevo: 0, empresa_actualiza: 0, nombre: 0, no_encontrado: 0, sin_telefono: 0, conflicto: 0 };
  const acciones: any[] = [];     // lo que se aplicaría
  const noEncontrados: any[] = []; // para que el usuario revise/complete
  const conflictos: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const nombre = cName >= 0 ? norm(r[cName]) : '';
    const email = cEmail >= 0 ? lower(r[cEmail]) : '';
    const wa = metaWhatsApp(cPhone >= 0 ? r[cPhone] : '');
    const empresa = cEmpresa >= 0 ? norm(r[cEmpresa]) : '';
    if (!wa) { cat.sin_telefono++; continue; }
    const waKey = last10(wa);

    // (2) ¿ese teléfono ya existe en el CRM?
    const yaPhone = byPhone.get(waKey);

    // (1) email exacto
    let target = email ? byEmail.get(email) : null;
    let via = target ? 'email' : '';

    // (3) empresa
    let company: any = null, crearEn: string | null = null;
    if (!target && empresa) {
      company = companyByName.get(key(empresa)) || null;
      if (company) {
        const cs = contactsByCompany.get(company.id) || [];
        // ¿algún contacto de la empresa coincide por email o nombre?
        const porEmail = email ? cs.find((c: any) => lower(c.email) === email) : null;
        const porNombre = nombre ? cs.find((c: any) => key([c.nombre, c.apellido].filter(Boolean).join(' ')) === key(nombre)) : null;
        if (porEmail || porNombre) { target = porEmail || porNombre; via = porEmail ? 'empresa_email' : 'empresa_nombre'; }
        else { crearEn = company.id; via = 'empresa_nuevo'; }
      }
    }

    // (4) nombre exacto y único global
    if (!target && !crearEn && nombre) {
      const m = byNameGlobal.get(key(nombre));
      if (m && m.length === 1) { target = m[0]; via = 'nombre'; }
    }

    // Resolver acción
    if (target) {
      const actual = last10(target.whatsapp);
      if (actual && actual === waKey) { cat.ya_tiene++; continue; }
      if (target.whatsapp && actual !== waKey) {
        cat.conflicto++;
        conflictos.push({ contact_id: target.id, nombre_crm: [target.nombre, target.apellido].filter(Boolean).join(' '), tenia: target.whatsapp, nuevo: wa, csv_nombre: nombre, csv_email: email });
        continue; // NO se pisa un número distinto automáticamente
      }
      const grupo = via.startsWith('empresa') ? 'empresa_actualiza' : (via === 'nombre' ? 'nombre' : 'email');
      cat[grupo]++;
      acciones.push({ tipo: 'update', via, contact_id: target.id, whatsapp: wa, nombre_crm: [target.nombre, target.apellido].filter(Boolean).join(' '), email: target.email });
      continue;
    }
    if (crearEn) {
      if (yaPhone) { cat.ya_tiene++; continue; } // ese número ya está en otro contacto
      cat.empresa_nuevo++;
      acciones.push({ tipo: 'create', via, company_id: crearEn, empresa, nombre: nombre || 'Contacto', email: email || null, whatsapp: wa });
      continue;
    }
    if (yaPhone) { cat.ya_tiene++; continue; }
    cat.no_encontrado++;
    noEncontrados.push({ nombre, email, whatsapp: wa, empresa });
  }

  // ---- Aplicar (si no es dry-run) ----
  let aplicados = 0, creados = 0; const errores: string[] = [];
  if (!dryRun) {
    for (const a of acciones) {
      if (a.tipo === 'update') {
        const { error } = await supabase.from('contacts').update({ whatsapp: a.whatsapp }).eq('id', a.contact_id);
        if (error) errores.push(`${a.nombre_crm}: ${error.message}`); else aplicados++;
      } else if (a.tipo === 'create' && crearFaltantes) {
        const { error } = await supabase.from('contacts').insert({
          nombre: a.nombre, email: a.email, whatsapp: a.whatsapp, company_id: a.company_id,
          tipo: 'cliente', lifecycle_stage: 'cliente', fuente: 'respond-enriquecimiento',
        });
        if (error) errores.push(`${a.empresa}/${a.nombre}: ${error.message}`); else creados++;
      }
    }
  }

  return new Response(JSON.stringify({
    dry_run: dryRun,
    total_csv: rows.length - 1,
    resumen: cat,
    aplicables: { actualizar: acciones.filter((a) => a.tipo === 'update').length, crear_contacto: acciones.filter((a) => a.tipo === 'create').length },
    aplicados, creados, errores,
    conflictos,                       // números distintos: decides tú
    no_encontrados: noEncontrados,    // para completar a mano
    muestra_acciones: acciones.slice(0, 15),
  }), { headers: { 'Content-Type': 'application/json' } });
};
