-- Zone géographique par province + localité obligatoire.
begin;
\ir _helpers.sql
\ir _fixtures.sql

select rdtest.ok(public.rd_province('1000') = 'BRU', '1000 Bruxelles');
select rdtest.ok(public.rd_province('1348') = 'WBR', '1348 Louvain-la-Neuve : Brabant wallon');
select rdtest.ok(public.rd_province('3000') = 'VBR', '3000 Leuven : Brabant flamand');
select rdtest.ok(public.rd_province('6000') = 'WHT', '6000 Charleroi : Hainaut');
select rdtest.ok(public.rd_province('6700') = 'WLX', '6700 Arlon : Luxembourg');
select rdtest.ok(public.rd_province('7000') = 'WHT', '7000 Mons : Hainaut');
select rdtest.ok(public.rd_province('9000') = 'VOV', '9000 Gand : Flandre orientale');
select rdtest.ok(public.rd_province('0999') is null, 'code invalide');

-- Entreprise H : Hainaut uniquement (par province)
insert into public.companies (id, name, bce_number, email_pro, status) values
  ('e0000000-0000-0000-0000-00000000000a', 'Hainaut', '0300000001', 'h@t.be', 'validated'),
  ('e0000000-0000-0000-0000-00000000000b', 'Sans zone', '0300000002', 'z@t.be', 'validated');
insert into public.company_profiles (company_id, trades, zone_provinces) values
  ('e0000000-0000-0000-0000-00000000000a', '{chassis}', '{WHT}');

-- Profil sans aucune zone refusé
select rdtest.throws($q$insert into public.company_profiles (company_id, trades) values ('e0000000-0000-0000-0000-00000000000b', '{chassis}')$q$,
                     'company_profiles_zone_required', 'une entreprise doit avoir une zone');
-- Province inconnue refusée
select rdtest.throws($q$update public.company_profiles set zone_provinces = '{XXX}' where company_id = 'e0000000-0000-0000-0000-00000000000a'$q$,
                     '23514', 'province inconnue refusée');

do $$
declare v uuid;
begin
  -- Mons (7000) : Hainaut => attribuée à H
  insert into public.requests (trade, project_type, budget, delay, postal_code, commune, status, validated_at, expires_at)
  values ('chassis', 'renovation', 'inconnu', 'asap', '7000', 'Mons', 'validated', now(), now() + interval '30 days') returning id into v;
  perform public.rd_assign_request(v);
  perform rdtest.ok(exists (select 1 from public.assignments where request_id = v and company_id = 'e0000000-0000-0000-0000-00000000000a'), 'Mons → entreprise du Hainaut');
  -- Namur (5000) : pas Hainaut
  insert into public.requests (trade, project_type, budget, delay, postal_code, commune, status, validated_at, expires_at)
  values ('chassis', 'renovation', 'inconnu', 'asap', '5000', 'Namur', 'validated', now(), now() + interval '30 days') returning id into v;
  perform public.rd_assign_request(v);
  perform rdtest.ok(not exists (select 1 from public.assignments where request_id = v and company_id = 'e0000000-0000-0000-0000-00000000000a'), 'Namur ↛ entreprise du Hainaut');
end $$;

-- Localité obligatoire
select rdtest.throws($q$insert into public.requests (trade, project_type, budget, delay, postal_code, commune) values ('chassis','renovation','inconnu','asap','6000','')$q$, '23514', 'commune vide refusée');
select rdtest.throws($q$insert into public.requests (trade, project_type, budget, delay, postal_code, commune) values ('chassis','renovation','inconnu','asap','6000','  ')$q$, '23514', 'commune faite d''espaces refusée');

-- Validation par l'admin : l'entreprise reçoit les demandes ouvertes de sa zone
insert into public.companies (id, name, bce_number, email_pro, status) values
  ('e0000000-0000-0000-0000-00000000000c', 'Namur en attente', '0300000003', 'n@t.be', 'pending');
insert into public.company_profiles (company_id, trades, zone_provinces) values ('e0000000-0000-0000-0000-00000000000c', '{chassis}', '{WNA}');
select rdtest.as_user('00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select public.rd_admin_set_company_status('e0000000-0000-0000-0000-00000000000c', 'validated');
reset role;
select rdtest.ok(exists (select 1 from public.assignments a join public.requests r on r.id = a.request_id
                         where a.company_id = 'e0000000-0000-0000-0000-00000000000c' and r.commune = 'Namur'),
                 'entreprise validée reçoit la demande ouverte de sa province');
rollback;
