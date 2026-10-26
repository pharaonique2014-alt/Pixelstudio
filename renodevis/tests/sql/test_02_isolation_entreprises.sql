-- L'entreprise A ne voit QUE ses demandes ; jamais celles de B.
begin;
\ir _helpers.sql
\ir _fixtures.sql

select rdtest.ok((select count(*) from public.assignments where company_id = 'a0000000-0000-0000-0000-000000000000') = 1, 'A doit avoir 1 attribution (Charleroi)');
select rdtest.ok((select count(*) from public.assignments where company_id = 'b0000000-0000-0000-0000-000000000000') = 1, 'B doit avoir 1 attribution (Mons)');
select rdtest.ok((select count(*) from public.assignments where company_id = 'c0000000-0000-0000-0000-000000000000') = 0, 'C (non validée) ne reçoit rien');

-- A, session aal2
select rdtest.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
do $$
begin
  perform rdtest.ok((select array_agg(ref) from public.requests) = '{RD-TESTA001}', 'A ne voit que RD-TESTA001');
  perform rdtest.ok(not exists (select 1 from public.requests where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 'A ne voit pas la demande de B');
  perform rdtest.ok((select count(*) from public.assignments where company_id <> 'a0000000-0000-0000-0000-000000000000') = 0, 'A ne voit pas les attributions de B');
  perform rdtest.ok((select array_agg(name) from public.companies) = '{"Châssis A"}', 'A ne voit que sa fiche entreprise');
  perform rdtest.ok((select count(*) from public.company_profiles) = 1, 'A ne voit que son profil');
  -- Colonnes marketing non exposées
  perform rdtest.throws('select utm from public.requests', '42501', 'A ne doit pas lire les UTM');
  perform rdtest.throws('select session_id from public.requests', '42501', 'A ne doit pas lire session_id');
  -- Actions sur la demande de B
  perform rdtest.throws($q$select public.rd_unlock('bbbbbbbb-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000')$q$, 'forbidden', 'A ne peut pas débloquer la demande de B');
  perform rdtest.throws($q$select public.rd_get_contact('bbbbbbbb-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000')$q$, 'not_unlocked', 'A ne peut pas lire le contact de B');
  -- Se faire passer pour B
  perform rdtest.throws($q$select public.rd_unlock('bbbbbbbb-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000')$q$, 'forbidden', 'A ne peut pas agir au nom de B');
  perform rdtest.throws($q$update public.companies set status = 'validated'$q$, '42501', 'A ne peut pas modifier les entreprises');
  perform rdtest.throws($q$insert into public.credit_ledger (company_id, delta, reason) values ('a0000000-0000-0000-0000-000000000000', 100, 'topup')$q$, '42501', 'A ne peut pas se créditer');
  perform rdtest.throws($q$select public.rd_admin_credit('a0000000-0000-0000-0000-000000000000', 100, 'topup', 'x')$q$, 'forbidden', 'A ne peut pas appeler une fonction admin');
end $$;
reset role;

-- A SANS double authentification (aal1) : ne voit rien
select rdtest.as_user('00000000-0000-0000-0000-00000000000a', 'aal1');
set local role authenticated;
do $$
begin
  perform rdtest.ok((select count(*) from public.requests) = 0, 'sans TOTP, A ne voit aucune demande');
  perform rdtest.ok((select count(*) from public.companies) = 0, 'sans TOTP, A ne voit pas sa fiche');
  perform rdtest.throws($q$select public.rd_unlock('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000')$q$, 'forbidden', 'sans TOTP, pas de déblocage');
end $$;
reset role;

-- C (en attente de validation) : voit sa fiche, aucune demande
select rdtest.as_user('00000000-0000-0000-0000-00000000000c');
set local role authenticated;
do $$
begin
  perform rdtest.ok((select array_agg(status) from public.companies) = '{pending}', 'C voit sa fiche « pending »');
  perform rdtest.ok((select count(*) from public.requests) = 0, 'C non validée ne voit aucune demande');
end $$;
reset role;
rollback;
