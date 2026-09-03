// Unifica datos de un Partner (asesor) para usar como branding en cotizaciones.
// Fuente primaria: team_members (id, nombre, email, rol)
// Fuente secundaria: partner_invitations (empresa, ciudad, whatsapp, slug_landing)

import { supabase } from '../supabase';

export interface PartnerProfile {
  id: string;
  nombre: string;
  email: string | null;
  whatsapp: string | null;
  empresa: string | null;
  ciudad: string | null;
  pais: string | null;
  slug_landing: string | null;
  tipo: string | null;
  logo_url: string | null;
}

export async function getPartnerProfile(partnerId: string | null | undefined): Promise<PartnerProfile | null> {
  if (!partnerId) return null;

  const { data: tm } = await supabase
    .from('team_members')
    .select('id, nombre, email, rol, logo_url')
    .eq('id', partnerId)
    .maybeSingle();

  if (!tm) return null;

  // Solo partners pueden ser branding en cotizaciones (no founders)
  if (((tm as any).rol || 'partner') !== 'partner') {
    // Aún así devolvemos lo básico — útil si queremos mostrar "Tu asesor SACS" interno.
    return {
      id: (tm as any).id,
      nombre: (tm as any).nombre || 'SACS',
      email: (tm as any).email || null,
      whatsapp: null,
      empresa: null,
      ciudad: null,
      pais: null,
      slug_landing: null,
      tipo: null,
      logo_url: (tm as any).logo_url || null,
    };
  }

  // Enrich con datos comerciales de la última invitación firmada (estado: accepted/submitted_for_review).
  let invitation: any = null;
  if ((tm as any).email) {
    const { data: inv } = await supabase
      .from('partner_invitations')
      /* `signed_at` no existe: la fecha de la firma es `aceptado_fecha`. Con el
         nombre viejo el select moría entero y el perfil del partner se quedaba
         SIN sus datos comerciales —empresa, ciudad, país, WhatsApp, landing—
         como si nunca hubiera firmado. */
      .select('empresa, ciudad, pais, whatsapp, slug_landing, tipo, estado, aceptado_fecha, created_at')
      .eq('email', (tm as any).email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    invitation = inv ? { ...inv, signed_at: (inv as any).aceptado_fecha } : null;   // el resto del código lo llama signed_at
  }

  return {
    id: (tm as any).id,
    nombre: (tm as any).nombre || invitation?.nombre || 'Asesor',
    email: (tm as any).email || null,
    whatsapp: invitation?.whatsapp || null,
    empresa: invitation?.empresa || null,
    ciudad: invitation?.ciudad || null,
    pais: invitation?.pais || null,
    slug_landing: invitation?.slug_landing || null,
    tipo: invitation?.tipo || null,
    logo_url: (tm as any).logo_url || null,
  };
}
