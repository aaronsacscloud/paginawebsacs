# Cookbook: Golden datasets + evals

Sin evals, no puedes saber si tu agente mejoró o empeoró cuando cambias el prompt. Esta es la guía.

## Estructura

```
src/lib/ai/eval-golden/
  hello-agent.jsonl
  meeting-prep.jsonl
  quote-drafter.jsonl
  service-recommender.jsonl
```

Un caso por línea. JSONL:

```json
{"id":"case-001","input":{...},"expected":{...},"notes":"..."}
```

## Ejemplo: quote_drafter.jsonl

```jsonl
{"id":"moda-2suc-anual","input":{"transcript":"Cliente con 2 tiendas de ropa en GDL quiere sistema unificado con tienda en linea. Presupuesto OK. Urgencia 2 semanas.","contact_id":null},"expected":{"plan_id":"fideliza","sucursales":2,"periodo":"anual","vertical_detectado":"moda","servicios_unicos_contiene":["implementacion_basica","setup_tienda_online"]},"notes":"Caso típico moda fideliza anual"}
{"id":"farmacia-5suc-objecion","input":{"transcript":"5 farmacias, objeto precio por ser el doble de Alegra. Necesita facturacion SAT.","contact_id":null},"expected":{"plan_id":"automatiza","sucursales":5,"vertical_detectado":"farmacia","descuento_pct_sugerido_gte":10,"servicios_unicos_contiene":["migracion_datos"]},"notes":"Con objeción precio debe sugerir descuento ≥10%"}
```

## Cómo correr evals

```bash
# TODO — implementar src/lib/ai/eval.ts en Fase 5b
bun src/lib/ai/eval.ts quote_drafter
```

Output esperado:
```
━━━ Evals: quote_drafter (15 cases) ━━━
✓ moda-2suc-anual (plan match, servicios 2/2)
✗ farmacia-5suc-objecion (descuento=5, esperaba ≥10)
...
Pass rate: 12/15 (80%)
Regression from baseline: -1 case
```

## Reglas

1. **Crea el eval ANTES de shippear el agente a auto-approve**: no movemos a auto si <95% pass rate sostenido 2 semanas.
2. **Agrega cases cada vez que un rep rechace un draft**: cada rejection en `agent_metrics` con `category: 'wrong_*'` es candidate para golden case. Cuando tengas 10 rejections similares, ese patrón debe estar en golden dataset.
3. **Expected puede ser parcial**: no hace falta match exacto. Ejemplo: `servicios_unicos_contiene: [...]` solo verifica presencia, no orden ni completitud.
4. **LLM-as-judge para outputs abiertos** (como el brief de meeting_prep): `src/lib/ai/eval.ts` usa Sonnet como juez con prompt tipo "¿este brief sería útil para un rep? Rate 1-5".
5. **CI gate**: cuando llegas a Fase 3+, configura GitHub Action que corra subset <100 casos en cada PR que toque `src/inngest/agents/*`. Si baja pass rate vs main → bloquea merge.

## Anotaciones desde rejections

Cuando un partner/founder hace `/api/agents/reject`, guardamos en `agent_metrics`:
```json
{
  "metric_name": "rejected",
  "metric_payload": {
    "category": "wrong_price",
    "detail": "El precio de implementacion fue $12k, debe ser $8k para moda"
  }
}
```

Periódicamente (cron semanal, futuro):
1. Query `agent_metrics WHERE metric_name='rejected' LIMIT 50`
2. Agrupa por `category`
3. Para cada grupo, sugerencia de agregar case al golden dataset
4. Founder revisa y decide qué agregar

## Re-entrenamiento / prompt iteration

Cuando iteres el system prompt de un agente:

1. Corre evals contra baseline (main branch current)
2. Corre evals contra tu nuevo prompt
3. Compara pass rate + ejemplos fallados
4. Si nuevo prompt es mejor en ≥80% + no rompe ningún "core case" (marcado con `critical: true` en JSONL) → merge
5. Si rompe cases críticos → iterate más

## Baseline actual (placeholder — llenar cuando tengas datos reales)

| Agente | Cases | Pass rate | Modelo | Última actualización |
|---|---|---|---|---|
| hello_agent | N/A | — | haiku | — |
| meeting_prep | 0 | — | sonnet | — |
| quote_drafter | 0 | — | sonnet | — |
| service_recommender | N/A (deterministic) | 100% | haiku | 2026-04-19 |

Crea tus primeros 10 casos por agente antes de siguiente PR a `src/inngest/agents/*`.
