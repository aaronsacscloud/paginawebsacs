-- Referee v2: cada página competidora se puntúa (respuesta, profundidad,
-- prueba, frescura 0-5) y se marca si alguna IA la cita en nuestras muestras.
alter table de_paginas_similares
  add column if not exists puntajes jsonb,
  add column if not exists citada_por_ia boolean default false,
  add column if not exists fecha_visible text;
