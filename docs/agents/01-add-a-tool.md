# Cookbook: Agregar un tool nuevo

Los tools son lo que los agentes pueden hacer. Son las únicas formas en que un agente toca el mundo (read DB, send email, write a record, etc.). Toda tool debe registrarse con `defineTool` y pasar el test de FORBIDDEN.

## 1. Estructura

Cada tool vive en un archivo propio en `src/lib/agent-tools/<domain>/<tool-name>.ts`:

```ts
// src/lib/agent-tools/crm/get-contact.ts
import { z } from 'zod';
import { defineTool } from '../define';
import { supabase } from '../../supabase';

export const getContact = defineTool({
  name: 'crm.get_contact',                    // dot-namespaced, enum-style
  description: 'Retrieve a contact by id or email.',   // el LLM usa esto para decidir cuándo llamar
  readonly: true,
  action_type: 'read_contact',                 // matches agent_policies.action_type
  schema: z.object({
    id: z.string().uuid().optional(),
    email: z.string().email().optional(),
  }),
  handler: async (input, ctx) => {
    // ctx: { run_id, agent_name, owner_id, approved, deal_id, ... }
    let query = supabase.from('contacts').select('*');
    if (input.id) query = query.eq('id', input.id);
    else if (input.email) query = query.eq('email', input.email);
    else throw new Error('Must provide id or email');

    // Partner scope
    if (ctx.owner_id) query = query.eq('owner_id', ctx.owner_id);

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
});
```

## 2. Importar en el registry

```ts
// src/lib/agent-tools/index.ts
import './crm/get-contact';  // auto-registers via defineTool
```

## 3. Reglas

### Reglas críticas (CI test enforced)
1. **FORBIDDEN**: el nombre del tool NO puede contener `stripe-webhook`, `cancel`, `mark-paid`, `delete`, `drop`, `purge`, `webhook`, `create-payment-link`.
2. **Zod schema obligatorio**: entrada tipada + validada. Si falla, el middleware captura y devuelve error legible al LLM.
3. **Partner scope**: si el tool lee/escribe data de CRM, respeta `ctx.owner_id` para filtrar.
4. **No trust LLM**: precios, montos, email de destino — siempre vienen de DB o validados contra catálogo, no del argumento del LLM.
5. **Side effects requieren policy**: si el tool hace `email.send`, `deal.close`, etc., define `action_type` y crea row en `agent_policies` con `requires_approval=true`.

### Test de registry
Antes de commit:
```bash
bun src/lib/agent-tools/registry.test.ts
```
Debe pasar 17/17 (incluye tu tool nuevo).

## 4. Probar el tool aislado

```bash
# Lanza el tool contra dev DB con un runContext dummy
bun --eval '
import { executeTool } from "./src/lib/agent-tools/middleware";
import "./src/lib/agent-tools";
const r = await executeTool("crm.get_contact", { email: "test@sacs.com" }, {
  run_id: "test", agent_name: "test", owner_id: null
});
console.log(JSON.stringify(r, null, 2));
'
```

## 5. Agregar política si hace side effects

```sql
INSERT INTO agent_policies (agent_name, action_type, requires_approval, daily_limit)
VALUES ('quote_drafter', 'send_to_client', true, 50)
ON CONFLICT (agent_name, action_type) DO NOTHING;
```

Sin policy → middleware lo deja pasar sin approval (solo para tools read-only).

## 6. Tools prohibidos / FORBIDDEN

Si tu tool name contiene algo de esto, el `defineTool` tira error al cargar:
- `stripe-webhook`, `cancel-subscription`, `mark-paid`, `mark-accepted`, `mark-rejected`
- `delete`, `drop`, `purge`
- `create-payment-link`, `webhook`

Razón: estos cambios son decisiones humanas (cancelación, pagos, firmas). Nunca los delegamos al agente.

Si necesitas uno de estos, **no hagas un tool**. Haz un endpoint que el partner/founder opere manualmente desde UI.
