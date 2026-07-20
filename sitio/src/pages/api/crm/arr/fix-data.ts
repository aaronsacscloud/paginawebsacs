// POST /api/crm/arr/fix-data?key=... — aplica correcciones de datos por lote.
// Body: { ops: [...] } con:
//  { op:'link_or_merge', company_id, sacs_account }
//     → si la cuenta está libre: liga. Si OTRA company ya la tiene: MERGE
//       (mueve subscriptions/payments/contacts/activities a la dueña y archiva
//       la vacía) — evita partir un cliente en dos.
//  { op:'contacto', company_id, nombre?, email?, whatsapp? }
//     → upsert de contacto (por email si hay; si no, por nombre+company),
//       lo liga a la company y a sus suscripciones sin contacto.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const KEY = import.meta.env.CRM_ADMIN_KEY || 'sacs-arr-2026';

export const POST: APIRoute = async ({ request, url }) => {
  if (url.searchParams.get('key') !== KEY) return new Response('Forbidden', { status: 403 });
  const body = await request.json().catch(() => null);
  const ops = Array.isArray(body?.ops) ? body.ops : [];
  if (!ops.length) return new Response(JSON.stringify({ error: 'ops vacío' }), { status: 400 });

  const res: any[] = [];
  for (const op of ops) {
    try {
      if (op.op === 'link_or_merge') {
        const cuenta = String(op.sacs_account || '').trim().toLowerCase();
        if (!op.company_id || !cuenta) throw new Error('company_id y sacs_account requeridos');
        const { data: dueña } = await supabase.from('companies').select('id, nombre').eq('sacs_account', cuenta).neq('id', op.company_id).maybeSingle();
        if (!dueña) {
          const { error } = await supabase.from('companies').update({ sacs_account: cuenta }).eq('id', op.company_id);
          if (error) throw new Error(error.message);
          await supabase.from('activities').insert({ tipo: 'sistema', titulo: `Cuenta SACS ligada: ${cuenta}`, company_id: op.company_id, automatico: true, metadata: { fix_data: true } }).select().maybeSingle();
          res.push({ op: 'link', cuenta, resultado: 'ligada' });
        } else {
          // MERGE: mover todo lo del company ciego a la dueña y archivar el ciego
          await supabase.from('subscriptions').update({ company_id: dueña.id }).eq('company_id', op.company_id);
          await supabase.from('payments').update({ company_id: dueña.id }).eq('company_id', op.company_id);
          await supabase.from('contacts').update({ company_id: dueña.id }).eq('company_id', op.company_id);
          await supabase.from('activities').update({ company_id: dueña.id }).eq('company_id', op.company_id);
          await supabase.from('companies').update({ archived_at: new Date().toISOString() }).eq('id', op.company_id);
          // recalcular agregados de la dueña
          const { data: subsCo } = await supabase.from('subscriptions').select('mrr, estado, proxima_factura').eq('company_id', dueña.id);
          const activas = (subsCo || []).filter(s => s.estado === 'activa');
          const mrr = activas.reduce((a, s) => a + Number(s.mrr || 0), 0);
          await supabase.from('companies').update({
            mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100,
            fecha_renovacion: activas.map(s => s.proxima_factura).filter(Boolean).sort()[0] || null,
          }).eq('id', dueña.id);
          await supabase.from('activities').insert({ tipo: 'sistema', titulo: `Cliente fusionado en ${dueña.nombre} (cuenta ${cuenta})`, company_id: dueña.id, automatico: true, metadata: { fix_data: true, merged_from: op.company_id } }).select().maybeSingle();
          res.push({ op: 'merge', cuenta, en: dueña.nombre, resultado: 'fusionada' });
        }
      } else if (op.op === 'contacto') {
        if (!op.company_id) throw new Error('company_id requerido');
        const email = String(op.email || '').trim().toLowerCase() || null;
        let contactId: string | null = null;
        if (email) {
          const { data: c } = await supabase.from('contacts').select('id, company_id, whatsapp').ilike('email', email).maybeSingle();
          if (c) {
            contactId = c.id;
            const upd: any = {};
            if (!c.company_id) upd.company_id = op.company_id;
            if (op.whatsapp && !c.whatsapp) upd.whatsapp = op.whatsapp;
            if (op.nombre) upd.nombre = op.nombre;
            if (Object.keys(upd).length) await supabase.from('contacts').update(upd).eq('id', c.id);
          }
        }
        if (!contactId) {
          const { data: nc, error } = await supabase.from('contacts').insert({
            nombre: op.nombre || email || 'Contacto', email, whatsapp: op.whatsapp || null,
            tipo: 'cliente', lifecycle_stage: 'cliente', company_id: op.company_id,
          }).select('id').single();
          if (error) throw new Error(error.message);
          contactId = nc.id;
        }
        // ligar a las suscripciones de la company que no tengan contacto
        await supabase.from('subscriptions').update({ contact_id: contactId }).eq('company_id', op.company_id).is('contact_id', null);
        await supabase.from('activities').insert({ tipo: 'sistema', titulo: `Contacto actualizado: ${op.nombre || email || op.whatsapp}`, company_id: op.company_id, contact_id: contactId, automatico: true, metadata: { fix_data: true } }).select().maybeSingle();
        res.push({ op: 'contacto', quien: op.nombre || email, resultado: 'ok' });
      } else if (op.op === 'set_plan') {
        // Plan base del cliente (catálogo real: vende|controla|fideliza|automatiza)
        const plan = ['vende', 'controla', 'fideliza', 'automatiza'].includes(op.plan) ? op.plan : null;
        if (!op.company_id || !plan) throw new Error('company_id y plan válido requeridos');
        const { error } = await supabase.from('companies').update({ plan }).eq('id', op.company_id);
        if (error) throw new Error(error.message);
        res.push({ op: 'set_plan', plan, resultado: 'ok' });
      } else {
        res.push({ op: op.op, resultado: 'op desconocida' });
      }
    } catch (e: any) {
      res.push({ op: op.op, error: e?.message || String(e), detalle: op });
    }
  }
  return new Response(JSON.stringify({ resultados: res }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
