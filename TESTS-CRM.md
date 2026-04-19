# Plan de Tests — CRM SACS con Agentes IA

Todo lo que puedes probar para validar el sistema end-to-end.

## Pre-requisitos

**Prod ya deployed:**
- ✅ DB schema aplicado (8 tablas nuevas + columnas en `team_members`)
- ✅ `/admin/agents` y `/app/inbox` responden 200
- ✅ Commissions triggers en sync-quote-deal + stripe-webhook
- ✅ Inngest instalado, client + 2 agents (hello, meeting_prep)

**Pendiente (tú agregas):**
- ⚠️ `ANTHROPIC_API_KEY` en Vercel env → habilita los agentes reales
- ⚠️ (opcional) `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` → habilita durabilidad real de meeting_prep
- ⚠️ (opcional) `CRON_SECRET` → protege `/api/cron/agents-reaper`

## Tests manuales — sin necesitar API keys

### 1. Dashboard de agentes admin
- Ve a `https://www.sacscloud.com/admin/agents`
- **Espera:** ver 4 configs (hello_agent, meeting_prep, quote_drafter, service_recommender), todos ON
- **Espera:** "Últimos runs" vacío ("Sin runs todavía")
- **Espera:** 3 KPIs arriba (Agentes activos 4/4, Esperando aprobación 0, Fallas 24h 0)

### 2. Partner inbox
- `https://www.sacscloud.com/app/inbox`
- **Espera:** warning naranja "Falta identificar usuario — agrega `?user_id=X`"
- Agrega `?user_id=<tu team_members.id>` al URL
- **Espera:** saludo con tu nombre, role visible, commission summary (pending/earned/paid), inbox "Para aprobar" probablemente vacío

### 3. Comisiones API (partner scope)
```bash
# Simula login como partner via header (dev only, prod usará cookies)
curl https://www.sacscloud.com/api/partners/commissions \
  -H "x-user-id: <tu team_members.id>"
```
- **Espera:** `{"rows":[], "summary":{"pending_amount":0,"earned_amount":0,"paid_amount":0,"total_deals":0}}`
- Si eres `role='partner'`: solo ves las tuyas
- Si eres `role='founder'`: ves todas (agrega `?partner_id=X` para filtrar)

### 4. Zombies reaper cron (dry run)
```bash
curl "https://www.sacscloud.com/api/cron/agents-reaper?dry=1"
```
- **Espera:** `{"reaped": 0, "runs": []}` (nada que limpiar)

## Tests end-to-end — flujo quote→deal→commission

### 5. Crear quote → aceptar → ver deal + commission
1. Admin CRM: `https://www.sacscloud.com/admin/crm?tab=cotizaciones`
2. "+ Nueva cotización" → crea una quote con:
   - Empresa, contacto, email
   - 1 plan (controla mensual) + 1 servicio extra
   - Asigna `owner_id` a un partner (si no tienes partners todavía, salta al test 6)
3. Guarda la quote → estado `sent`
4. Abre la quote pública, firma (o usa "Aceptar manual" en menú ⋮)
5. **Espera:**
   - Quote estado `accepted`
   - **Deal creado automáticamente** en pipeline con stage `cerrada_ganada`
   - **`partner_commissions` con rate_pct=20% del valor_total** (verifica en Supabase SQL editor)
6. Marca la quote como `paid` (botón en menú ⋮)
7. **Espera:**
   - `partner_commissions.status='earned'` (cuando Stripe webhook llegue)
   - Activity `pago_recibido` en el deal

### 6. Test del enum de rejection
1. Crea quote nueva → estado `sent`
2. En menú ⋮ → "Marcar rechazada"
3. Modal con 5 motivos (precio/timing/competidor/no_fit/otro) + detalle
4. Confirma
5. **Espera:**
   - Quote estado `rejected`
   - Deal stage `cerrada_perdida`
   - Activity con motivo + detalle en metadata

### 7. Partner scope (privacy entre partners)
**Setup**: necesitas 2 `team_members` con `role='partner'` para este test.

1. Como partner A, crea un contact/deal/quote
2. Como partner B:
   ```bash
   curl https://www.sacscloud.com/api/crm/contacts/<contact_de_A_id> \
     -H "x-user-id: <B_id>"
   ```
3. **Espera actual:** devuelve datos (los endpoints CRM todavía NO tienen `applyPartnerScope` aplicado — eso viene en Fase 3)
4. **Nota:** el scope está implementado en `/api/partners/commissions` + `/api/agents/runs`. Los otros endpoints CRM son legacy y se agregan progresivamente.

## Tests después de agregar ANTHROPIC_API_KEY

### 8. Disparar hello_agent manualmente (inline)
```bash
curl -X POST https://www.sacscloud.com/api/agents/trigger \
  -H "Content-Type: application/json" \
  -d '{"agent":"hello","data":{"message":"Hola, ¿estás vivo?"}}'
```
- **Espera:**
  ```json
  {
    "ok": true,
    "run_id": "uuid...",
    "response": "Sí, el sistema está funcionando...",
    "cost_usd": 0.0003,
    "latency_ms": 1500
  }
  ```
- Ve a `/admin/agents` → verás el run nuevo
- Click "Ver →" → ves input/output/reasoning/tool calls/costo

### 9. Disparar hello_agent con tool call real
```bash
curl -X POST https://www.sacscloud.com/api/agents/trigger \
  -H "Content-Type: application/json" \
  -d '{"agent":"hello","data":{"message":"Dime del cliente","contact_id":"<uuid_real>"}}'
```
- **Espera:**
  - Run creado con tool call a `crm.get_contact`
  - El detail view muestra 1 tool call con args + result
  - LLM response menciona al contacto

### 10. Disparar meeting_prep via Inngest (requiere Inngest cloud o dev server)
```bash
curl -X POST https://www.sacscloud.com/api/agents/trigger \
  -H "Content-Type: application/json" \
  -d '{"agent":"meeting_prep","data":{"meeting_id":"test-1","contact_id":"<uuid>","owner_id":"<partner_uuid>","scheduled_at":"2026-04-20T10:00:00Z"}}'
```
- **Sin Inngest configured:** evento dispatched pero no se procesa (queda en cola Inngest cloud)
- **Con Inngest dev server local** (`npx inngest-cli@latest dev`):
  - Agent corre: fetch contact → timeline → servicios por vertical → plans → Claude genera brief → email al owner
  - Ve run en `/admin/agents` con 4 tool calls + output

### 11. Approve/Reject en `/app/inbox`
1. Fuerza un run en `awaiting_approval` (seed en Supabase):
   ```sql
   INSERT INTO agent_runs (agent_name, trigger_type, status, input, output, reasoning, model, assigned_to)
   VALUES ('quote_drafter', 'manual', 'awaiting_approval',
     '{"transcript":"test"}', '{"draft_preview":"..."}',
     'Test draft for approval flow', 'claude-sonnet-4-7', '<tu_team_members_id>')
   RETURNING id;
   ```
2. Ve a `/app/inbox?user_id=<tu_id>`
3. **Espera:** 1 item en "Para aprobar"
4. Click "Revisar →" → detail view
5. `POST /api/agents/approve` con `run_id` → status → `approved`
6. `POST /api/agents/reject` con `{run_id, category:'wrong_price', detail:'...'}` → status → `rejected` + métrica

## Tests de comisiones avanzadas

### 12. Commission pending → earned → paid
```sql
-- Ver comisiones en prod
SELECT pc.id, pc.status, pc.commission_amount, pc.deal_id, d.nombre
FROM partner_commissions pc
JOIN deals d ON d.id = pc.deal_id
ORDER BY pc.created_at DESC LIMIT 10;
```
- Flujo:
  1. Deal cierra → `pending` (creado por sync-quote-deal.ts)
  2. Cliente paga → Stripe webhook → `earned` (sync con `markCommissionEarned`)
  3. SACS paga al partner → admin marca `paid`:
  ```bash
  curl -X POST https://www.sacscloud.com/api/partners/commissions \
    -H "x-user-id: <founder_id>" \
    -H "Content-Type: application/json" \
    -d '{"commission_id":"<id>","payment_reference":"Transferencia 2026-04-20"}'
  ```

## Testing FORBIDDEN + policy enforcement

### 13. FORBIDDEN token test (CI)
```bash
cd sitio && bun src/lib/agent-tools/registry.test.ts
```
- **Espera:** 17/17 pass (confirma que no hay tools con `cancel|mark-paid|delete|drop|stripe-webhook`)

### 14. PII redactor test (CI)
```bash
cd sitio && bun src/lib/ai/redact.test.ts
```
- **Espera:** 27/27 pass (RFC/CURP/email/phone MX/CC/CLABE)

## Qué falta para producción full

| Componente | Status | Para activar |
|---|---|---|
| Agentes stack | ✅ Deployed | Agregar `ANTHROPIC_API_KEY` |
| Inngest durability | ⚠️ Parcial | `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` en Vercel, o usar Inngest dev server local |
| meeting_prep end-to-end real | ⚠️ Código listo | Keys arriba + disparo desde scheduled_meetings cron |
| quote_drafter | ⏳ Pendiente F3 | Se construye en Fase 3 del plan |
| service_recommender | ⏳ Pendiente F3 | Se construye en Fase 3 |
| Langfuse observability | ⏳ Pendiente F2e+ | `docker-compose up -d` local o self-host Fly.io |
| Evals / golden datasets | ⏳ Pendiente F3a | Bloqueante para mover agentes a auto-approve |
| Partner scope en todos los endpoints CRM | ⚠️ Solo en algunos | Aplicar `applyPartnerScope` en todos los `/api/crm/*` |

## Cómo agregar ANTHROPIC_API_KEY

```bash
cd sitio
vercel env add ANTHROPIC_API_KEY production
# pega tu key cuando pregunte
vercel --prod    # redeploy
```

Después de eso, test 8 debería funcionar real y crear runs con respuestas de Claude.

## Cómo usar Inngest dev server local (opcional)

```bash
# Terminal 1: dev server de Astro
cd sitio && npm run dev

# Terminal 2: dev server de Inngest
npx inngest-cli@latest dev -u http://localhost:4321/api/inngest
```

Inngest se conectará, verás dashboard en `http://localhost:8288`. Dispara meeting_prep con curl, verás el run ejecutándose step-by-step en Inngest dashboard.

## Resumen ejecutivo

**Lo que funciona sin config adicional:**
- Dashboard admin + partner inbox rendering
- API endpoints de agents (list/approve/reject)
- API endpoints de commissions (list/mark-paid)
- Cron reaper (dry run)
- Flujo quote → deal → commission pending → earned (ya integrado al quote flow existente)

**Lo que necesita ANTHROPIC_API_KEY:**
- hello_agent real
- meeting_prep real

**Lo que necesita Inngest (cloud o dev server):**
- meeting_prep durable en prod
- Cron 30 min antes de cada scheduled_meeting (en v2)

Todo lo demás está listo para conectar cuando tengas las keys.
