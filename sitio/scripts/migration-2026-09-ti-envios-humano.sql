-- ti_envios: cuando el consultor contesta ANTES de que salga la sugerencia del
-- agente (o en sombra, cuando el humano contesta ese mismo turno), se guarda su
-- respuesta junto a la propuesta: el par es material de aprendizaje y de
-- revisión lado a lado.
alter table ti_envios add column if not exists humano_respuesta text;
alter table ti_envios add column if not exists humano_at timestamptz;
alter table ti_envios add column if not exists veredicto_par text;   -- humano_mejor | agente_mejor | empate (lo decide el dueño o el curador nocturno)
