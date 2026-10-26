-- Matching : métier + zone + budget + statut validé, 3 entreprises max, rotation.
begin;
\ir _helpers.sql

insert into public.companies (id, name, bce_number, email_pro, status) values
  ('d1000000-0000-0000-0000-000000000000', 'D1', '0200000001', 'd1@t.be', 'validated'),
  ('d2000000-0000-0000-0000-000000000000', 'D2', '0200000002', 'd2@t.be', 'validated'),
  ('d3000000-0000-0000-0000-000000000000', 'D3', '0200000003', 'd3@t.be', 'validated'),
  ('d4000000-0000-0000-0000-000000000000', 'D4', '0200000004', 'd4@t.be', 'validated'),
  ('e1000000-0000-0000-0000-000000000000', 'Toiture', '0200000005', 'e1@t.be', 'validated'),
  ('e2000000-0000-0000-0000-000000000000', 'Gros budget', '0200000006', 'e2@t.be', 'validated'),
  ('e3000000-0000-0000-0000-000000000000', 'Suspendue', '0200000007', 'e3@t.be', 'suspended');
insert into public.company_profiles (company_id, trades, zone_postal_codes, zone_prefixes, budget_min_eur, accept_unknown_budget) values
  ('d1000000-0000-0000-0000-000000000000', '{chassis}', '{}', '{5}', 0, true),
  ('d2000000-0000-0000-0000-000000000000', '{chassis}', '{}', '{5}', 0, true),
  ('d3000000-0000-0000-0000-000000000000', '{chassis}', '{5000}', '{}', 0, true),
  ('d4000000-0000-0000-0000-000000000000', '{chassis,isolation}', '{}', '{50}', 0, false),
  ('e1000000-0000-0000-0000-000000000000', '{toiture}', '{}', '{5}', 0, true),
  ('e2000000-0000-0000-0000-000000000000', '{chassis}', '{}', '{5}', 20000, true),
  ('e3000000-0000-0000-0000-000000000000', '{chassis}', '{}', '{5}', 0, true);

create temp table r (n int, id uuid);
grant all on r to public;

do $$
declare i int; v uuid; got int;
begin
  for i in 1..4 loop
    insert into public.requests (trade, project_type, budget, delay, postal_code, commune, status, validated_at, expires_at)
    values ('chassis', 'renovation', '5000_10000', 'asap', '5000', 'Namur', 'validated', now(), now() + interval '30 days')
    returning id into v;
    insert into r values (i, v);
    got := public.rd_assign_request(v);
    perform rdtest.ok(got = 3, format('demande %s : 3 entreprises attribuées (obtenu %s)', i, got));
    -- relancer le matching ne dépasse jamais 3
    perform rdtest.ok(public.rd_assign_request(v) = 0, 'jamais plus de 3');
  end loop;

  -- Seules D1..D4 sont éligibles (métier, zone, budget, statut)
  perform rdtest.ok(not exists (select 1 from public.assignments a
     where a.company_id::text like 'e%'), 'toiture / budget trop bas / suspendue exclues');

  -- Rotation : sur 4 demandes x 3 places = 12, chacune des 4 en reçoit 3
  perform rdtest.ok((select array_agg(c order by c) from (select count(*) c from public.assignments group by company_id) s) = '{3,3,3,3}',
                     'répartition équitable (3/3/3/3)');
end $$;

-- Budget inconnu : D4 (accept_unknown_budget = false) exclue
do $$
declare v uuid;
begin
  insert into public.requests (trade, project_type, budget, delay, postal_code, commune, status, validated_at, expires_at)
  values ('chassis', 'renovation', 'inconnu', 'asap', '5000', 'Namur', 'validated', now(), now() + interval '30 days')
  returning id into v;
  perform public.rd_assign_request(v);
  perform rdtest.ok(not exists (select 1 from public.assignments where request_id = v
                                 and company_id = 'd4000000-0000-0000-0000-000000000000'), 'budget inconnu : D4 exclue');
  -- Gros budget : E2 (min 20 000 €) éligible
  insert into public.requests (trade, project_type, budget, delay, postal_code, commune, status, validated_at, expires_at)
  values ('chassis', 'renovation', 'plus_20000', 'asap', '5100', 'Jambes', 'validated', now(), now() + interval '30 days')
  returning id into v;
  perform public.rd_assign_request(v);
  perform rdtest.ok(exists (select 1 from public.assignments where request_id = v
                             and company_id = 'e2000000-0000-0000-0000-000000000000'), 'plus de 20 000 € : E2 éligible');
  -- Demande non validée : aucune attribution
  insert into public.requests (trade, project_type, budget, delay, postal_code, commune)
  values ('chassis', 'renovation', 'plus_20000', 'asap', '5100', 'Jambes')
  returning id into v;
  perform rdtest.ok(public.rd_assign_request(v) = 0, 'demande non confirmée par SMS : jamais attribuée');
end $$;

-- 3 déblocages => demande clôturée ; « 1 sur 3 » visible
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2'),
                                   ('00000000-0000-0000-0000-0000000000d3'), ('00000000-0000-0000-0000-0000000000d4');
insert into public.company_users (user_id, company_id) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000d4', 'd4000000-0000-0000-0000-000000000000');
insert into public.credit_ledger (company_id, delta, reason)
  select id, 5, 'topup' from public.companies where name like 'D%';

do $$
declare v uuid := (select id from r where n = 1); a record; k int := 0;
begin
  for a in select company_id from public.assignments where request_id = v order by company_id loop
    perform rdtest.as_user(('00000000-0000-0000-0000-0000000000d' || substr(a.company_id::text, 2, 1))::uuid);
    set local role authenticated;
    perform public.rd_unlock(v, a.company_id);
    k := k + 1;
    perform rdtest.ok((select unlock_count from public.requests where id = v) = k, format('%s entreprise(s) sur 3 ont débloqué', k));
    reset role;
  end loop;
  perform rdtest.ok((select status from public.requests where id = v) = 'closed', 'clôturée après 3 déblocages');
end $$;

-- Demande expirée : déblocage refusé
do $$
declare v uuid := (select id from r where n = 2); c uuid;
begin
  update public.requests set expires_at = now() - interval '1 minute' where id = v;
  select company_id into c from public.assignments where request_id = v limit 1;
  perform rdtest.as_user(('00000000-0000-0000-0000-0000000000d' || substr(c::text, 2, 1))::uuid);
  set local role authenticated;
  perform rdtest.throws(format('select public.rd_unlock(%L, %L)', v, c), 'request_closed', 'demande expirée non débloquable');
  reset role;
end $$;
rollback;
