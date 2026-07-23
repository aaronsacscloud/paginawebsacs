-- Cuenta de ADMINISTRADOR (founder) para el CRM /admin/*.
-- Email: mccpubliherz@gmail.com · contraseña temporal: Iphone99!
--   (hash bcrypt cost 10 — el mismo esquema de lib/auth/password.ts;
--    el usuario la cambia desde /admin/cambiar-password tras entrar).
--
-- Idempotente: si el email ya existe se PROMUEVE a founder + activo y se le
-- (re)pone la contraseña; si no, se crea. Re-aplicar la migración es seguro.
--
-- ⚠️ APLICAR desde una sesión con el MCP de Supabase (este server no lo tiene):
--   mcp__supabase__apply_migration con este SQL.

do $$
declare
  v_email text := 'mccpubliherz@gmail.com';
  v_hash  text := '$2b$10$dvEp74YU1JfUytIvfwH5PuTu8W8aDSEpLT2Yp6zrMgJu0b2YLihcW';
begin
  if exists (select 1 from team_members where lower(email) = v_email) then
    update team_members
       set rol = 'founder', activo = true, password_hash = v_hash
     where lower(email) = v_email;
  else
    insert into team_members (nombre, email, rol, activo, password_hash, default_commission_pct)
    values ('Administrador SACS', v_email, 'founder', true, v_hash, 0);
  end if;
end $$;

-- Verificar:  select id, email, rol, activo from team_members where email = 'mccpubliherz@gmail.com';
