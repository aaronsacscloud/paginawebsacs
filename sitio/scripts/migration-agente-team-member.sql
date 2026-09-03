-- «Agente IA» como miembro asignable del inbox: cuando la conversación está en piloto automático, Asignar dice
-- «Agente IA» (morado). Si un asesor escribe, la asignación pasa a él y el agente se apaga en ese hilo; volver a
-- elegir «Agente IA» lo reactiva.
insert into team_members (nombre, email, rol, activo)
select 'Agente IA', 'agente-ia@sacscloud.com', 'soporte', true
where not exists (select 1 from team_members where email='agente-ia@sacscloud.com');
