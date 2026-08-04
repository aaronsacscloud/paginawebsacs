-- Regla confirmada (4-ago-2026): ver el detalle del cliente y su información NO
-- está separado por plan — lo tienen todos. Deja de ser "módulo fuera de plan"
-- (era el que más disparaba: 6 de 10 alertas, todas falsas) y pasa a leerse por
-- INTENSIDAD: tener muchos clientes capturados no es un abuso, es la señal de
-- que la base ya existe y el programa de lealtad (Fideliza) tiene con qué operar.
update crm_plan_modulos
   set incluido = true,
       origen = 'Disponible en todos los planes — el directorio de clientes no se separa por plan',
       confirmado = true
 where modulo = 'Catálogo de clientes';
