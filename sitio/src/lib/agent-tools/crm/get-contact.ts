import { z } from 'zod';
import { defineTool } from '../define';
import { supabase } from '../../supabase';

export const getContact = defineTool({
  name: 'crm.get_contact',
  description: 'Retrieve a contact by id, email, or whatsapp. Returns nombre, email, whatsapp, lifecycle_stage, company_id, owner_id.',
  readonly: true,
  action_type: 'read_contact',
  schema: z.object({
    id: z.string().uuid().optional(),
    email: z.string().email().optional(),
    whatsapp: z.string().optional(),
  }),
  handler: async ({ id, email, whatsapp }, ctx) => {
    let query = supabase.from('contacts').select('id, nombre, email, whatsapp, lifecycle_stage, company_id, owner_id, giro, plan_interes, fuente, lead_score, last_contact_at');
    if (id) query = query.eq('id', id);
    else if (email) query = query.eq('email', email);
    else if (whatsapp) query = query.eq('whatsapp', whatsapp);
    else throw new Error('Must provide id, email, or whatsapp');

    // Partner scope: if owner_id in context, only return their contacts
    if (ctx.owner_id) query = query.eq('owner_id', ctx.owner_id);

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
});
