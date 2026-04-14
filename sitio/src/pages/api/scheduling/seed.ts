import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (key !== 'sacs-seed-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // 1. Get admin team member (first one)
  const { data: teamMembers, error: tmErr } = await supabase
    .from('team_members')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1);

  if (tmErr || !teamMembers || teamMembers.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No team members found. Create a team member first.' }),
      { status: 400 },
    );
  }

  const adminId = teamMembers[0].id;

  // 2. Create availability schedule (Mon-Fri 9-13, 14-18 Mexico City)
  const weeklyHours: Record<string, { enabled: boolean; ranges: { start: string; end: string }[] }> = {
    '0': { enabled: false, ranges: [] }, // Sunday
    '1': { enabled: true, ranges: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] },
    '2': { enabled: true, ranges: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] },
    '3': { enabled: true, ranges: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] },
    '4': { enabled: true, ranges: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] },
    '5': { enabled: true, ranges: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] },
    '6': { enabled: false, ranges: [] }, // Saturday
  };

  const { data: schedule, error: schedErr } = await supabase
    .from('scheduling_availability')
    .insert({
      team_member_id: adminId,
      weekly_hours: weeklyHours,
      timezone: 'America/Mexico_City',
      es_default: true,
      activo: true,
    })
    .select()
    .single();

  if (schedErr) {
    return new Response(JSON.stringify({ error: `Schedule: ${schedErr.message}` }), { status: 500 });
  }

  // 3. Create event types
  const eventTypesData = [
    {
      nombre: 'Demo personalizada',
      slug: 'demo',
      descripcion: 'Conoce SACS en una demo personalizada de 30 minutos. Te mostramos cómo funciona con tu negocio.',
      duracion_minutos: 30,
      buffer_antes: 0,
      buffer_despues: 10,
      aviso_minimo_horas: 2,
      max_reservas_dia: null,
      max_dias_adelanto: 30,
      tipo_reunion: 'one_on_one',
      ubicacion_tipo: 'google_meet',
      color: '#4B7BE5',
      owner_id: adminId,
      activo: true,
    },
    {
      nombre: 'Sesión de configuración',
      slug: 'configuracion',
      descripcion: 'Sesión de 45 minutos para configurar SACS en tu negocio. Ideal después de contratar.',
      duracion_minutos: 45,
      buffer_antes: 0,
      buffer_despues: 15,
      aviso_minimo_horas: 4,
      max_reservas_dia: null,
      max_dias_adelanto: 30,
      tipo_reunion: 'one_on_one',
      ubicacion_tipo: 'google_meet',
      color: '#2AB5A0',
      owner_id: adminId,
      activo: true,
    },
    {
      nombre: 'Reunión de seguimiento',
      slug: 'seguimiento',
      descripcion: 'Revisión rápida de 15 minutos para resolver dudas o revisar avances.',
      duracion_minutos: 15,
      buffer_antes: 0,
      buffer_despues: 5,
      aviso_minimo_horas: 1,
      max_reservas_dia: null,
      max_dias_adelanto: 30,
      tipo_reunion: 'one_on_one',
      ubicacion_tipo: 'google_meet',
      color: '#6C5CE7',
      owner_id: adminId,
      activo: true,
    },
  ];

  const { data: eventTypes, error: etErr } = await supabase
    .from('scheduling_event_types')
    .insert(eventTypesData)
    .select();

  if (etErr) {
    return new Response(JSON.stringify({ error: `Event types: ${etErr.message}` }), { status: 500 });
  }

  // 4. Create booking questions for "Demo personalizada"
  const demoEventType = eventTypes?.find((et) => et.slug === 'demo');
  let questions: unknown[] = [];

  if (demoEventType) {
    const questionsData = [
      {
        event_type_id: demoEventType.id,
        pregunta: '¿Qué sistema usas actualmente?',
        tipo: 'select',
        opciones: ['Excel', 'Otro software', 'Ninguno'],
        requerida: true,
        orden: 1,
      },
      {
        event_type_id: demoEventType.id,
        pregunta: '¿Qué es lo que más te interesa resolver?',
        tipo: 'textarea',
        opciones: null,
        requerida: false,
        orden: 2,
      },
    ];

    const { data: qData, error: qErr } = await supabase
      .from('scheduling_booking_questions')
      .insert(questionsData)
      .select();

    if (qErr) {
      return new Response(JSON.stringify({ error: `Questions: ${qErr.message}` }), { status: 500 });
    }

    questions = qData || [];
  }

  return new Response(
    JSON.stringify({
      admin_id: adminId,
      schedule,
      event_types: eventTypes,
      questions,
    }),
    { status: 201 },
  );
};
