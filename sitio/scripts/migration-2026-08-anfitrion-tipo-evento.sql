-- ═══ Quién aparece en la página de agendar ════════════════════════════════
--
-- El nombre que ve el cliente salía SIEMPRE de `team_members.nombre` del
-- dueño del tipo de evento. Andrea tiene su calendario conectado y la página
-- decía el nombre de Aaron: quien es dueño del registro no siempre es quien
-- da la cara, y no había forma de separarlos sin cambiar el dueño (que sí
-- decide de qué calendario salen los horarios).
--
-- Ahora cada tipo de evento puede decir con qué nombre y con qué foto se
-- presenta. Vacío = se usa el del dueño, como antes.

begin;

alter table event_types
  add column if not exists anfitrion_nombre text,
  add column if not exists anfitrion_foto text;

comment on column event_types.anfitrion_nombre is
  'Nombre que ve el cliente en /agendar. Vacío = el del dueño (team_members.nombre).';
comment on column event_types.anfitrion_foto is
  'URL pública de la foto que ve el cliente. Vacío = iniciales del nombre.';

update event_types set anfitrion_nombre = 'Andrea Araujo', updated_at = now()
where archived_at is null and coalesce(anfitrion_nombre, '') = '';

select nombre, anfitrion_nombre, coalesce(anfitrion_foto, '(sin foto)') foto
from event_types where archived_at is null order by nombre;

commit;
