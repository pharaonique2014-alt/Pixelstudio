-- Un visiteur anonyme ne lit RIEN et ne peut exécuter AUCUNE fonction RénoDevis.
begin;
\ir _helpers.sql
\ir _fixtures.sql

set local role anon;
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
  loop
    perform rdtest.throws(format('select * from public.%I limit 1', t.relname),
                           '42501', 'anon ne doit pas lire ' || t.relname);
  end loop;
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    perform rdtest.throws(format('delete from public.%I', t.relname),
                           '42501', 'anon ne doit pas supprimer dans ' || t.relname);
  end loop;
end $$;
reset role;

-- Aucune fonction rd_* exécutable par anon (ni par PUBLIC)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'rd\_%'
  loop
    perform rdtest.ok(not has_function_privilege('anon', f.sig, 'execute'), 'anon peut exécuter ' || f.sig);
  end loop;
end $$;

-- Un utilisateur connecté SANS entreprise ne voit rien non plus
select rdtest.as_user('00000000-0000-0000-0000-0000000000ff');
set local role authenticated;
do $$
begin
  perform rdtest.ok((select count(*) from public.requests) = 0, 'X ne doit voir aucune demande');
  perform rdtest.ok((select count(*) from public.companies) = 0, 'X ne doit voir aucune entreprise');
  perform rdtest.ok((select count(*) from public.assignments) = 0, 'X ne doit voir aucune attribution');
  perform rdtest.throws('select * from public.request_contacts', '42501', 'X ne doit pas lire les coordonnées');
  perform rdtest.throws('select * from public.consent_logs', '42501', 'X ne doit pas lire les consentements');
  perform rdtest.throws('select * from public.tracking_events', '42501', 'X ne doit pas lire le tracking');
  perform rdtest.throws($q$select public.rd_api_submit('{}')$q$, '42501', 'X ne doit pas appeler l''API publique');
  perform rdtest.throws($q$select public.rd_maintenance()$q$, '42501', 'X ne doit pas lancer la maintenance');
  perform rdtest.throws($q$insert into public.requests (trade, project_type, budget, delay, postal_code, commune) values ('chassis','renovation','inconnu','asap','6000','Charleroi')$q$, '42501', 'X ne doit pas écrire de demande');
end $$;
reset role;
rollback;
