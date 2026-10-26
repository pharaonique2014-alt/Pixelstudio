-- Outils de test (inclus en tête de chaque test, dans une transaction annulée).
create schema rdtest;
create or replace function rdtest.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ÉCHEC : %', msg; end if;
end $$;

-- Exécute une requête et vérifie qu'elle échoue avec le message / code attendu.
create or replace function rdtest.throws(q text, expected text, msg text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'ÉCHEC (aucune erreur) : %', msg;
exception
  when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if expected is not null and sqlerrm not like '%' || expected || '%' and sqlstate <> expected then
      raise exception 'ÉCHEC : % — erreur inattendue : % (%)', msg, sqlerrm, sqlstate;
    end if;
end $$;

grant usage on schema rdtest to public;

-- Identité simulée (équivalent du JWT Supabase)
create or replace function rdtest.as_user(p_uid uuid, p_aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'aal', p_aal, 'role', 'authenticated')::text, true);
$$;

create or replace function rdtest.h(t text) returns text language sql immutable as $$
  select encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;
