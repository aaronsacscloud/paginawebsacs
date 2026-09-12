-- ═══════════════════════════════════════════════════════════════════════════
-- El Taller — trabajo conjunto entre consultoría y desarrollo/soporte
-- 2026-09-12
--
-- Dos cosas en una migración porque son la misma historia:
--   1. `mejoras` aprende QUÉ es cada renglón (falla o mejora) y CÓMO se cubrió
--      (cortesía o pagada). Hoy 19 de las 66 entregadas traen el tipo escrito a
--      mano en el título ("Bug –", "Mejora l") y 22 no dicen si se cobraron:
--      cuando la gente teclea el dato dentro del título, es que falta el campo.
--   2. Nace el taller: la orden de trabajo, su bitácora, las revisiones y los
--      comentarios. La orden es 1↔N con `mejoras` a propósito — la misma falla
--      la sufren tres cuentas y se arregla UNA vez.
--
-- La ficha del cliente y el taller son dos vistas del mismo hecho: `mejoras` es
-- lo que el cliente ve, `taller_ordenes` es cómo se trabaja. Por eso lo interno
-- (fechas prometidas, rebotes, SLA, quién tardó) vive aquí y NO allá.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La ficha del cliente aprende el tipo y el cobro ──────────────────────
alter table mejoras add column if not exists tipo text;
alter table mejoras add column if not exists cobro text;
alter table mejoras add column if not exists valor_lista numeric;

comment on column mejoras.tipo is 'falla | mejora | capacitacion | pendiente — QUÉ es, separado del estado, que es el momento';
comment on column mejoras.cobro is 'cortesia | pagada — cómo se cubrió la entrega. NULL = todavía no se dice';
comment on column mejoras.valor_lista is 'Lo que habría costado si no fuera cortesía. Nunca suma a cobrado; sí a "invertido en la cuenta"';

-- Backfill conservador: no se adivina por palabras clave más allá del prefijo
-- que la gente ya escribió a mano.
update mejoras set tipo = 'capacitacion' where tipo is null and categoria = 'capacitacion';
update mejoras set tipo = 'pendiente'    where tipo is null and categoria = 'pendiente';
update mejoras set tipo = 'falla'        where tipo is null and titulo ~* '^\s*bug';
update mejoras set tipo = 'mejora'       where tipo is null;

-- El cobro solo se llena donde YA se sabe; los 22 mudos se quedan mudos y
-- salen en la pantalla pidiendo que alguien los conteste.
update mejoras set cobro = 'cortesia' where cobro is null and cortesia is true;
update mejoras set cobro = 'pagada'   where cobro is null and (quote_id is not null or coalesce(valor,0) > 0);

-- ── 2. La orden de trabajo ──────────────────────────────────────────────────
create sequence if not exists taller_folio_seq start 1;

create table if not exists taller_ordenes (
  id uuid primary key default gen_random_uuid(),
  folio text unique not null default ('OT-' || lpad(nextval('taller_folio_seq')::text, 4, '0')),
  company_id uuid references companies(id) on delete set null,
  tipo text not null default 'mejora',              -- falla | mejora
  titulo text not null,
  -- El caso. En una falla los tres primeros son obligatorios desde la pantalla.
  problema text,           -- qué pasa hoy
  esperado text,           -- qué debería pasar
  pasos text,              -- cómo reproducirlo
  criterios text,          -- criterios de aceptación (se exigen al pasar a desarrollo)
  modulo text,
  prioridad text not null default 'media',          -- alta (bloquea la operación) | media | baja
  -- Los dos videos: el del problema (lo sube quien pide) y el de la entrega
  -- (lo sube quien entrega). En un arreglo de servidor, `verificacion` sustituye
  -- al video de entrega: sin uno de los dos no se puede marcar lista.
  evidencia_url text,
  video_url text,
  verificacion text,
  -- Lo técnico NO se pide al capturar: se completa después.
  entorno text, sucursal text, usuario_caso text, dato_caso text,
  etapa text not null default 'recibida',
    -- recibida | analisis | desarrollo | pruebas | lista | entregada | devuelta | espera | trabada
  asignado_id uuid references team_members(id) on delete set null,
  solicitante_id uuid references team_members(id) on delete set null,
  -- La fecha la pone DESARROLLO. `fecha_prometida_1` es la primera y no se
  -- vuelve a tocar: medir contra la reagendada siempre da 100%.
  fecha_prometida date,
  fecha_prometida_1 date,
  -- La ventana de revisión la pide quien entrega. Se mide igual que la de ellos.
  dias_revision int not null default 3,
  lista_at timestamptz,
  revision_vence date,
  entregada_at timestamptz,
  rebotes int not null default 0,
  -- Con un dato pendiente el reloj NO corre: ni les reclamas un SLA que empezó
  -- sin poder trabajar, ni se quedan colgados de algo que nunca llegó.
  falta_dato text,
  falta_dato_at timestamptz,
  espera_cliente text,
  espera_desde timestamptz,
  cobro text,                                        -- se hereda a la mejora al aprobar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on table taller_ordenes is 'Orden de trabajo del Taller. Interna: el cliente nunca ve fechas, rebotes ni SLA';
comment on column taller_ordenes.fecha_prometida_1 is 'La PRIMERA fecha que puso desarrollo. Es contra esta que se mide el cumplimiento';
comment on column taller_ordenes.dias_revision is 'Días que pide desarrollo para que el dueño apruebe. Su incumplimiento también se mide';

create index if not exists taller_ordenes_etapa_idx    on taller_ordenes (etapa) where archived_at is null;
create index if not exists taller_ordenes_company_idx  on taller_ordenes (company_id) where archived_at is null;
create index if not exists taller_ordenes_asignado_idx on taller_ordenes (asignado_id) where archived_at is null;

-- Una orden, N renglones del cliente: el mismo bug en tres cuentas se arregla
-- una vez y se cierra en las tres, con el mismo video.
create table if not exists taller_orden_mejoras (
  orden_id  uuid not null references taller_ordenes(id) on delete cascade,
  mejora_id uuid not null references mejoras(id) on delete cascade,
  primary key (orden_id, mejora_id)
);
create unique index if not exists taller_orden_mejoras_mejora_idx on taller_orden_mejoras (mejora_id);

-- ── 3. La bitácora: de aquí salen TODAS las métricas ────────────────────────
-- Mismo patrón que `proyecto_bitacora`, que ya existe. No se le pide nada extra
-- a nadie para medir: se mide lo que ya pasó.
create table if not exists taller_bitacora (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references taller_ordenes(id) on delete cascade,
  actor text,
  de text,
  a text,
  nota text,
  at timestamptz not null default now()
);
create index if not exists taller_bitacora_orden_idx on taller_bitacora (orden_id, at desc);

-- ── 4. Las revisiones del dueño ─────────────────────────────────────────────
-- Un rebote es un renglón con veredicto 'cambios'. El motivo es de lista
-- cerrada: en texto libre no se puede contar cuál se repite.
create table if not exists taller_revisiones (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references taller_ordenes(id) on delete cascade,
  revisor text,
  veredicto text not null,       -- aprobada | cambios
  motivo text,                   -- no_resuelve | rompe_otra | falta_video | incompleta | mal_entendida
  nota text,
  dias_tardaste numeric,         -- contra la ventana que pidió desarrollo
  at timestamptz not null default now()
);
create index if not exists taller_revisiones_orden_idx on taller_revisiones (orden_id, at desc);

-- ── 5. La conversación técnica, en la orden ─────────────────────────────────
-- Si no vive aquí, se va a WhatsApp y se pierde el registro.
create table if not exists taller_comentarios (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references taller_ordenes(id) on delete cascade,
  autor text,
  texto text not null,
  at timestamptz not null default now()
);
create index if not exists taller_comentarios_orden_idx on taller_comentarios (orden_id, at);
