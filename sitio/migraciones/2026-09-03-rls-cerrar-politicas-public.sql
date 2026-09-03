-- 2026-09-03 · Cerrar 21 políticas RLS abiertas a `public` (qual = true).
--
-- Se llamaban "Service role full access" pero estaban colgadas del rol
-- `public`, es decir, también de `anon`: con la llave anónima del proyecto se
-- leían y escribían contacts, companies, deals, payments, team_members
-- (password_hash incluido), calendar_connections y bank_accounts enteras.
--
-- No sirven para nada: service_role brinca RLS sin políticas, y ningún cliente
-- del sitio usa la llave anónima (verificado: el único createClient es el del
-- servidor con SUPABASE_SERVICE_KEY). Se quitan ANTES de exponer la llave
-- anónima al navegador para el Realtime de "Equipo".
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND roles::text ~ 'public'
      AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Verificación esperada: 0 filas.
-- select tablename, policyname from pg_policies where roles::text ~ 'public';
