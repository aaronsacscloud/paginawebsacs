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
    .from('availability_schedules')
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
      buffer_antes_minutos: 0,
      buffer_despues_minutos: 10,
      aviso_minimo_horas: 2,
      max_reservas_dia: null,
      max_dias_adelanto: 30,
      tipo_reunion: 'individual',
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
      buffer_antes_minutos: 0,
      buffer_despues_minutos: 15,
      aviso_minimo_horas: 4,
      max_reservas_dia: null,
      max_dias_adelanto: 30,
      tipo_reunion: 'individual',
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
      buffer_antes_minutos: 0,
      buffer_despues_minutos: 5,
      aviso_minimo_horas: 1,
      max_reservas_dia: null,
      max_dias_adelanto: 30,
      tipo_reunion: 'individual',
      ubicacion_tipo: 'google_meet',
      color: '#6C5CE7',
      owner_id: adminId,
      activo: true,
    },
  ];

  const { data: eventTypes, error: etErr } = await supabase
    .from('event_types')
    .insert(eventTypesData)
    .select();

  if (etErr) {
    return new Response(JSON.stringify({ error: `Event types: ${etErr.message}` }), { status: 500 });
  }

  // 4. Create default booking questions for ALL event types
  let questions: unknown[] = [];

  for (const et of (eventTypes || [])) {
    const defaultQuestions = [
      { event_type_id: et.id, label: 'Empresa', tipo: 'text', placeholder: 'Nombre de tu empresa', required: true, options: null, orden: 1 },
      { event_type_id: et.id, label: 'Giro', tipo: 'select', placeholder: 'Selecciona un giro', required: false, options: ['Moda y ropa', 'Calzado', 'Joyería', 'Novedades', 'Vinos y licores', 'Comestibles', 'Electrónica', 'Bicicletas', 'Supermercado', 'Franquicias', 'Otro'], orden: 2 },
      { event_type_id: et.id, label: 'Sucursales', tipo: 'select', placeholder: 'Selecciona', required: false, options: ['1', '2-3', '4-5', '6-10', '10+'], orden: 3 },
      { event_type_id: et.id, label: 'Notas', tipo: 'textarea', placeholder: 'Algo que debamos saber antes de la reunion?', required: false, options: null, orden: 10 },
    ];

    // Add custom questions only for demo
    if (et.slug === 'demo') {
      defaultQuestions.push(
        { event_type_id: et.id, label: '¿Qué sistema usas actualmente?', tipo: 'select', placeholder: 'Selecciona', required: true, options: ['Excel', 'Otro software', 'Ninguno'], orden: 4 },
        { event_type_id: et.id, label: '¿Qué es lo que más te interesa resolver?', tipo: 'textarea', placeholder: 'Cuéntanos...', required: false, options: null, orden: 5 },
      );
    }

    const { data: qData } = await supabase
      .from('booking_questions')
      .insert(defaultQuestions)
      .select();

    if (qData) questions.push(...qData);
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
