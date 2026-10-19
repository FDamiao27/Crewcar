-- CREW CAR — reforço de segurança (recomendações do Security Advisor do Supabase)

-- search_path fixo nas funções (evita resolução de objetos noutros esquemas)
alter function f_norm(text) set search_path = pg_catalog, public;
alter function set_updated_at() set search_path = pg_catalog, public;
alter function track_price_change() set search_path = pg_catalog, public;

-- A função do trigger de contactos não deve ser invocável diretamente (ex.: API REST /rpc).
-- Os triggers continuam a executá-la normalmente.
revoke execute on function log_lead_created() from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function log_lead_created() from %I', r);
    end if;
  end loop;
end
$$;
