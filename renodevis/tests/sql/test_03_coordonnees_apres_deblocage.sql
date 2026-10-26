-- Aucune coordonnée avant déblocage payé ; déblocage = 1 crédit = 35 € TTC.
begin;
\ir _helpers.sql
\ir _fixtures.sql

select rdtest.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
do $$
begin
  perform rdtest.throws('select * from public.request_contacts', '42501', 'table des coordonnées illisible');
  perform rdtest.throws($q$select public.rd_get_contact('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000')$q$, 'not_unlocked', 'pas de contact avant déblocage');
  perform rdtest.throws($q$select public.rd_unlock('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000')$q$, 'insufficient_credits', 'déblocage refusé sans crédit');
  -- Aucune colonne de la table demandes ne contient de PII
  perform rdtest.ok(not exists (select 1 from information_schema.column_privileges
     where table_name = 'requests' and grantee = 'authenticated'
       and column_name in ('first_name', 'phone_e164', 'email', 'phone_hash')), 'aucune colonne PII exposée');
end $$;
reset role;

-- L'admin crédite A de 2 crédits (admin sans TOTP refusé)
select rdtest.as_user('00000000-0000-0000-0000-0000000000ad', 'aal1');
set local role authenticated;
select rdtest.throws($q$select public.rd_admin_credit('a0000000-0000-0000-0000-000000000000', 2, 'topup', 'virement 1')$q$, 'forbidden', 'admin sans TOTP refusé');
reset role;
select rdtest.as_user('00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select public.rd_admin_credit('a0000000-0000-0000-0000-000000000000', 2, 'topup', 'virement 1');
reset role;

select rdtest.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
do $$
declare j jsonb;
begin
  j := public.rd_unlock('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000');
  perform rdtest.ok(j->'contact'->>'phone' = '+32470000001', 'contact rendu après déblocage');
  perform rdtest.ok((select sum(delta) from public.credit_ledger) = 1, 'un crédit débité');
  perform rdtest.ok((select price_cents = 3500 and vat_included from public.unlocks), 'prix 35 € TTC enregistré');
  perform rdtest.ok((select unlock_count from public.requests where ref = 'RD-TESTA001') = 1, '« 1 entreprise sur 3 a déjà débloqué »');
  -- Idempotent
  j := public.rd_unlock('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000');
  perform rdtest.ok((j->>'already')::boolean, 'second déblocage = déjà débloqué');
  perform rdtest.ok((select sum(delta) from public.credit_ledger) = 1, 'pas de double débit');
  perform rdtest.ok(public.rd_get_contact('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000')->>'email' = 'alice@exemple.be', 'contact relisible ensuite');
  -- Toujours rien chez B
  perform rdtest.throws($q$select public.rd_get_contact('bbbbbbbb-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000')$q$, 'not_unlocked', 'toujours rien chez B');
end $$;
reset role;

-- B ne voit pas les déblocages ni le grand livre de A
select rdtest.as_user('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select rdtest.ok((select count(*) from public.unlocks) = 0, 'B ne voit pas les déblocages de A');
select rdtest.ok((select count(*) from public.credit_ledger) = 0, 'B ne voit pas les crédits de A');
reset role;
rollback;
