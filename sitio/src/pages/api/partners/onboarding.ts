// POST /api/partners/onboarding — crea un partner nuevo + tareas iniciales + ambiente demo.
// Solo founder puede llamarlo.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

const ONBOARDING_TASKS = [
  { tipo: 'tarea', titulo: 'Training 1: SACS producto (video + walkthrough)', metadata: { task: true, category: 'onboarding', step: 1, due_in_hours: 24, resource_url: 'https://www.sacscloud.com/casos-de-exito' } },
  { tipo: 'tarea', titulo: 'Training 2: Demo playbook por vertical', metadata: { task: true, category: 'onboarding', step: 2, due_in_hours: 48, resource_url: 'https://docs.sacscloud.com/playbook' } },
  { tipo: 'tarea', titulo: 'Training 3: Comisiones + proceso de cobro', metadata: { task: true, category: 'onboarding', step: 3, due_in_hours: 72 } },
  { tipo: 'tarea', titulo: 'Practice demo con ambiente SACS interno', metadata: { task: true, category: 'onboarding', step: 4, due_in_hours: 96 } },
  { tipo: 'tarea', titulo: 'Primera demo real con lead asignado', metadata: { task: true, category: 'onboarding', step: 5, due_in_hours: 168 } },
];

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
  if (user.role !== 'founder') return new Response(JSON.stringify({ error: 'only founder can onboard partners' }), { status: 403 });

  try {
    const body = await request.json();
    const { nombre, email, default_commission_pct, create_new, existing_member_id } = body || {};

    let partner_id: string;

    if (existing_member_id) {
      // Upgrade existing team_member to partner role
      const { data: upgraded, error } = await supabase
        .from('team_members')
        .update({ rol: 'partner', default_commission_pct: default_commission_pct || 20 })
        .eq('id', existing_member_id)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      partner_id = upgraded.id;
    } else {
      if (!nombre || !email) return new Response(JSON.stringify({ error: 'nombre and email required' }), { status: 400 });
      // Create new partner
      const { data: created, error } = await supabase
        .from('team_members')
        .insert({
          nombre, email,
          rol: 'partner',
          default_commission_pct: default_commission_pct || 20,
          activo: true,
        })
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      partner_id = created.id;
    }

    // Create onboarding tasks as activities
    const tasksCreated: any[] = [];
    for (const task of ONBOARDING_TASKS) {
      const { data: act } = await supabase
        .from('activities')
        .insert({
          tipo: task.tipo,
          titulo: task.titulo,
          metadata: { ...task.metadata, partner_id, onboarding: true },
          automatico: true,
        })
        .select('id, titulo')
        .single();
      if (act) tasksCreated.push(act);
    }

    // Log partner created activity
    await supabase.from('activities').insert({
      tipo: 'sistema',
      titulo: `Partner onboarding iniciado: ${nombre || email}`,
      metadata: { partner_id, onboarded_by: user.id, tasks_count: tasksCreated.length },
      automatico: true,
    });

    return new Response(JSON.stringify({
      ok: true,
      partner_id,
      tasks_created: tasksCreated,
      next_steps: [
        `Envía credenciales al partner: /app/dashboard?user_id=${partner_id}`,
        `Revisa tareas de onboarding en Activities`,
        `Asigna primeros leads desde CRM Kanban`,
      ],
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500 });
  }
};

// GET — list active partners with their onboarding progress
export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
  if (user.role !== 'founder') return new Response(JSON.stringify({ error: 'only founder' }), { status: 403 });

  const { data: partners } = await supabase
    .from('team_members')
    .select('id, nombre, email, default_commission_pct, activo, created_at')
    .eq('rol', 'partner')
    .order('created_at', { ascending: false });

  return new Response(JSON.stringify({ partners: partners || [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
