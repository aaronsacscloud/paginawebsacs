# Plan de Tests — CRM SACS con Agentes IA

Todo lo que puedes probar para validar el sistema end-to-end. Todo lo listado está **deployado en prod** (`https://www.sacscloud.com`).

## Qué hay construido (Fases 1-5 completas)

**Infra deployada:**
- 8 tablas DB nuevas (agent_runs partitioned, agent_configs, agent_tool_log, agent_policies, kb_chunks HNSW, agent_metrics, partner_commissions, product_events) + columna `team_members.default_commission_pct`
- Stack: Vercel AI SDK 6 + Anthropic SDK 0.90 + Inngest 4.2 + zod 4 + pgvector HNSW
- PII redactor (27/27 tests) + tool registry con FORBIDDEN (17/17 tests)
- Partner scope helpers + commissions calculate/settle con triggers en quote flow
- 3 agentes codeados: `hello_agent`, `meeting_prep`, `quote_drafter`
- Catálogo SACS v1 (3 planes + 6 servicios + defaults por vertical)

**Endpoints:**
- `/api/agents/{runs,approve,reject,trigger,draft-from-transcript}`
- `/api/partners/{commissions,dashboard,onboarding}`
- `/api/catalog/recommend-services`
- `/api/cron/agents-reaper` (cada 10 min, mata zombies)
- `/api/inngest` (webhook Inngest)

**UI:**
- `/admin/agents` — dashboard con 4 configs + lista runs + kill switches
- `/admin/agents/[runId]` — detail con input/output/reasoning/tool-calls + **approve/reject UI con inline edit**
- `/app/inbox?user_id=X` — partner-facing con awaiting runs + commission summary
- `/app/dashboard?user_id=X` — **Mi desempeño**: MRR mes/YTD + pipeline + comisiones + leaderboard
- `/cotizacion/[id]` — ahora muestra "Tu asesor SACS" si deal tiene partner asignado

## Pre-requisitos para activar agentes IA reales

Para que `hello_agent`, `meeting_prep`, `quote_drafter` corran con Claude real, falta:

```bash
cd sitio
vercel env add ANTHROPIC_API_KEY production
# pega tu key
vercel --prod
```

**Opcionalmente** para durabilidad real en prod (sino v1 usa inline triggers):
```bash
vercel env add INNGEST_EVENT_KEY production
vercel env add INNGEST_SIGNING_KEY production
```

## Tests que YA funcionan sin ninguna key adicional

### 1. Dashboard de agentes admin
```
https://www.sacscloud.com/admin/agents
```
- Ver 4 configs (hello_agent, meeting_prep, quote_drafter, service_recommender) todos ON
- 3 KPIs: agentes activos, esperando aprobación, fallas 24h

### 2. Partner inbox
```
https://www.sacscloud.com/app/inbox?user_id=<team_members.id>
```
- Saludo con nombre + rol
- Si eres partner: 3 KPI cards de comisiones
- "Para aprobar (N)" con runs pendientes + link "Revisar →"

### 3. Partner dashboard
```
https://www.sacscloud.com/app/dashboard?user_id=<team_members.id>
```
- 4 KPIs: MRR mes actual, MRR YTD, Pipeline abierto, Comisiones pendientes
- Comisiones breakdown (pending / earned / paid)
- **Leaderboard partner rank** (solo si rol=partner): tu posición anonimizada vs pares
- Pipeline por stage

### 4. Catálogo recommend services
```bash
curl "https://www.sacscloud.com/api/catalog/recommend-services?vertical=farmacia&sucursales=3"
```
- Devuelve servicios recomendados para el vertical + precio computed
- Razón: "Se cotiza en X% de deals de este vertical"

### 5. API partner dashboard
```bash
curl -H "x-user-id: <id>" https://www.sacscloud.com/api/partners/dashboard
```
- `{user, commissions, mrr, pipeline, leaderboard, partners_breakdown}`

### 6. API partner commissions
```bash
curl -H "x-user-id: <id>" https://www.sacscloud.com/api/partners/commissions
```
- Partner: solo las suyas. Founder: todas.

### 7. Zombies reaper (dry run)
```bash
curl "https://www.sacscloud.com/api/cron/agents-reaper?dry=1"
```
- `{reaped: 0, runs: []}`

### 8. Approval + rejection E2E (seed un run awaiting)
```sql
-- En Supabase SQL editor:
INSERT INTO agent_runs (agent_name, trigger_type, status, assigned_to, owner_id, input, output, reasoning, model)
VALUES ('quote_drafter', 'manual', 'awaiting_approval',
  '<tu_id>', '<tu_id>',
  '{"transcript":"test"}'::jsonb,
  '{"draft":{"plan_id":"fideliza","total":98000}}'::jsonb,
  'Test approval flow', 'claude-sonnet-4-7')
RETURNING id;
```
- Abre `/admin/agents/<id>?user_id=<tu_id>` → verás banner naranja + botones Aprobar/Rechazar
- Botón "Aprobar" → status → `approved` + `agent_metrics` con `approved`
- Si editas el output JSON antes de aprobar → diff guardado en `agent_metrics.edited_before_send`
- Botón "Rechazar" → modal con 6 categorías (wrong_price, wrong_tone, etc.) + detalle → status → `rejected` + metric

### 9. Quote pública con voice del partner
- Crea un deal con `owner_id` = partner (team_members con rol='partner')
- Crea una quote vinculada al deal
- Abre quote pública `/cotizacion/<id>`
- **Espera:** ver sección "Tu asesor SACS" con nombre + email del partner

### 10. Flujo quote → deal → commission
1. Crear quote en admin (con items: plan + servicios)
2. Asignar `owner_id` a un partner (para que haya commission tracking)
3. Guardar → `sent`
4. Aceptar manualmente (firma o menú ⋮)
5. **Espera automático:**
   - Deal creado con stage `cerrada_ganada`
   - `partner_commissions` row status `pending` con 20% del total
6. Marca como `paid` o recibe pago Stripe
7. **Espera:** commission.status → `earned`

## Tests después de agregar ANTHROPIC_API_KEY

### 11. hello_agent inline
```bash
curl -X POST https://www.sacscloud.com/api/agents/trigger \
  -H "Content-Type: application/json" \
  -d '{"agent":"hello","data":{"message":"Hola prueba"}}'
```
- Response con `{run_id, response, cost_usd, latency_ms}`
- Ver run en `/admin/agents`

### 12. hello_agent con tool call real
```bash
curl -X POST https://www.sacscloud.com/api/agents/trigger \
  -H "Content-Type: application/json" \
  -d '{"agent":"hello","data":{"contact_id":"<uuid_real>"}}'
```
- LLM llama `crm.get_contact`, ve el nombre, lo menciona en response
- Detail view muestra 1 tool call con args + result + latency

### 13. quote_drafter desde transcripción
```bash
curl -X POST https://www.sacscloud.com/api/agents/draft-from-transcript \
  -H "Content-Type: application/json" \
  -H "x-user-id: <tu_id>" \
  -d '{"transcript":"Cliente con 2 tiendas de ropa en Guadalajara. Quiere sistema con inventario + tienda en linea. Urgencia: 2 semanas. Objetó el precio diciendo que usa Shopify POS.","contact_id":"<opcional>"}'
```
- **Espera:**
  - Response con `{run_id, status:'awaiting_approval', draft, quote_payload}`
  - draft.plan_id = 'fideliza' o 'automatiza' (necesita e-commerce)
  - draft.vertical_detectado = 'moda'
  - draft.sucursales = 2
  - draft.servicios_unicos incluye 'setup_tienda_online'
  - draft.descuento_pct_sugerido > 0 (porque objetó precio)
- Detail view muestra 3 tool calls (get_contact si había, get_plans, get_services)
- Editable output → rep puede ajustar antes de aprobar

### 14. meeting_prep via Inngest (requiere Inngest cloud o dev server)

Sin Inngest configured, el evento queda pendiente.

Con `npx inngest-cli@latest dev -u http://localhost:4321/api/inngest`:
```bash
curl -X POST https://www.sacscloud.com/api/agents/trigger \
  -H "Content-Type: application/json" \
  -d '{"agent":"meeting_prep","data":{"meeting_id":"m1","contact_id":"<uuid>","owner_id":"<partner_uuid>","scheduled_at":"2026-04-20T10:00:00Z"}}'
```
- En Inngest dashboard (localhost:8288) verás el run ejecutándose step-by-step
- 4 tool calls: get_contact, get_timeline, recommend_services, get_plans
- Email al owner con brief

## CI tests (bloqueantes)

### 15. PII redactor
```bash
cd sitio && bun src/lib/ai/redact.test.ts
```
- **Espera:** 27/27 pass

### 16. FORBIDDEN tools
```bash
cd sitio && bun src/lib/agent-tools/registry.test.ts
```
- **Espera:** 17/17 pass

## Seed data útil para testing

```sql
-- Crear un partner de prueba
INSERT INTO team_members (nombre, email, rol, default_commission_pct)
VALUES ('Partner Prueba', 'partner-test@sacs.com', 'partner', 25)
RETURNING id;

-- Crear un deal ganado para ver commissions
INSERT INTO deals (nombre, contact_id, stage, valor_total, valor_mensual, owner_id, closed_at, probabilidad)
VALUES ('Deal test', '<contact_id>', 'cerrada_ganada', 50000, 2400, '<partner_id>', now(), 100)
RETURNING id;
-- ↑ Auto-creará row en partner_commissions con 25% = $12,500 pending
```

## Docs

- `docs/agents/01-add-a-tool.md` — cookbook para tools nuevos
- `docs/agents/02-add-an-agent.md` — template completo para agentes
- `docs/agents/03-golden-datasets.md` — eval strategy + baseline

## Resumen final

**Todo lo que necesita tu confianza para ir a prod:**
- ✅ Infra agents (8 tablas + tool registry + policy middleware + zombies reaper cron)
- ✅ Partner permissions (scope.ts + applyPartnerScope) + commissions tracking (pending→earned→paid triggers automáticos)
- ✅ Agentes escritos (hello, meeting_prep, quote_drafter) con PII redactor + catálogo validated pricing
- ✅ Approval UI con inline edit + rejection enum + diff tracking
- ✅ Partner dashboard + leaderboard anonimizado
- ✅ Voice per partner en quotes públicas
- ✅ Tests CI 27+17 = 44/44 verdes
- ✅ Docs cookbook para que cualquier dev agregue tools/agentes

**Falta para agentes corriendo real en prod:**
- ⚠️ `ANTHROPIC_API_KEY` en Vercel env
- ⚠️ (opcional) Inngest cloud keys para durable runs

**Fuera de scope v1 (v2+):**
- churn_watchdog, lead_distributor, follow_up_pacer, expansion_hunter, collections_agent
- Langfuse self-host
- Eval suite runner implementado
- PLG events ingestion real
- Multi-tenancy completa
