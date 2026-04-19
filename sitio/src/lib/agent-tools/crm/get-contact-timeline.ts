import { z } from 'zod';
import { defineTool } from '../define';
import { supabase } from '../../supabase';

export const getContactTimeline = defineTool({
  name: 'crm.get_contact_timeline',
  description: 'Retrieve recent activities (timeline) for a contact: notes, calls, emails, WhatsApp, demos, quotes, payments.',
  readonly: true,
  action_type: 'read_activities',
  schema: z.object({
    contact_id: z.string().uuid(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  handler: async ({ contact_id, limit = 50 }, ctx) => {
    // Partner scope: verify contact belongs to partner before returning timeline
    if (ctx.owner_id) {
      const { data: contact } = await supabase.from('contacts').select('owner_id').eq('id', contact_id).maybeSingle();
      if (contact && contact.owner_id !== ctx.owner_id) throw new Error('Access denied: contact not owned by current user');
    }

    const { data, error } = await supabase
      .from('activities')
      .select('id, created_at, tipo, titulo, descripcion, metadata, automatico')
      .eq('contact_id', contact_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  },
});
