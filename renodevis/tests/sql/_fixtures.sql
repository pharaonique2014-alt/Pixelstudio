-- Jeu de données : 2 entreprises validées (A zone 60xx, B zone 70xx),
-- 1 entreprise en attente (C), 1 admin, 1 utilisateur sans entreprise (X).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.be'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.be'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.be'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.be'),
  ('00000000-0000-0000-0000-0000000000ff', 'x@test.be');

insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

insert into public.companies (id, name, bce_number, email_pro, status) values
  ('a0000000-0000-0000-0000-000000000000', 'Châssis A', '0100000001', 'a@test.be', 'validated'),
  ('b0000000-0000-0000-0000-000000000000', 'Châssis B', '0100000002', 'b@test.be', 'validated'),
  ('c0000000-0000-0000-0000-000000000000', 'Châssis C', '0100000003', 'c@test.be', 'pending');

insert into public.company_users (user_id, company_id) values
  ('00000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000000');

insert into public.company_profiles (company_id, trades, zone_prefixes) values
  ('a0000000-0000-0000-0000-000000000000', '{chassis}', '{60}'),
  ('b0000000-0000-0000-0000-000000000000', '{chassis}', '{70}'),
  ('c0000000-0000-0000-0000-000000000000', '{chassis}', '{60,70}');

-- Demande RA à Charleroi (6000), demande RB à Mons (7000), validées
insert into public.requests (id, ref, trade, project_type, budget, delay, detail, postal_code, commune, status, validated_at, expires_at, session_id, utm) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'RD-TESTA001', 'chassis', 'renovation', '5000_10000', 'asap', '{"quantite":"4_6"}', '6000', 'Charleroi', 'validated', now(), now() + interval '30 days', gen_random_uuid(), '{"utm_source":"meta"}'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'RD-TESTB001', 'chassis', 'extension',  'plus_20000', '3_mois', '{"quantite":"7_10"}', '7000', 'Mons', 'validated', now(), now() + interval '30 days', null, '{}');

insert into public.request_contacts (request_id, first_name, phone_e164, email, phone_hash) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Alice', '+32470000001', 'alice@exemple.be', encode(sha256('p1'), 'hex')),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Bruno', '+32470000002', 'bruno@exemple.be', encode(sha256('p2'), 'hex'));

select public.rd_assign_request('aaaaaaaa-0000-0000-0000-000000000001');
select public.rd_assign_request('bbbbbbbb-0000-0000-0000-000000000001');
