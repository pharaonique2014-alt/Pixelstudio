-- Signalement « injoignable » : 3 appels horodatés => 1 crédit rendu après revue.
begin;
\ir _helpers.sql
\ir _fixtures.sql

insert into public.credit_ledger (company_id, delta, reason) values ('a0000000-0000-0000-0000-000000000000', 1, 'topup');
select rdtest.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.rd_unlock('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000');
reset role;
-- On recule le déblocage de 3 jours pour pouvoir dater les appels
update public.unlocks set unlocked_at = now() - interval '3 days';

select rdtest.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
do $$
declare u uuid := (select id from public.unlocks); rid uuid;
begin
  perform rdtest.throws(format($q$select public.rd_report(%L, 'injoignable', array[now() - interval '2 days', now() - interval '1 day']::timestamptz[])$q$, u), 'three_calls_required', '2 appels insuffisants');
  perform rdtest.throws(format($q$select public.rd_report(%L, 'injoignable', array[now() - interval '2 days', now() - interval '2 days' + interval '10 minutes', now() - interval '1 day']::timestamptz[])$q$, u), 'calls_too_close', 'appels trop rapprochés');
  perform rdtest.throws(format($q$select public.rd_report(%L, 'injoignable', array[now() - interval '5 days', now() - interval '2 days', now() - interval '1 day']::timestamptz[])$q$, u), 'invalid_call_times', 'appel avant le déblocage refusé');
  perform rdtest.throws(format($q$select public.rd_report(%L, 'injoignable', array[now() - interval '2 days', now() - interval '1 day', now() + interval '1 day']::timestamptz[])$q$, u), 'invalid_call_times', 'appel dans le futur refusé');
  rid := public.rd_report(u, 'injoignable', array[now() - interval '2 days', now() - interval '1 day', now() - interval '2 hours']::timestamptz[], 'messagerie à chaque fois');
  perform rdtest.ok(rid is not null, 'signalement enregistré');
  perform rdtest.throws(format($q$select public.rd_report(%L, 'faux_numero', array[now() - interval '1 hour']::timestamptz[])$q$, u), '23505', 'un seul signalement actif par déblocage');
  perform rdtest.ok((select sum(delta) from public.credit_ledger) = 0, 'pas de remboursement automatique');
end $$;
reset role;

select id as unlock_id from public.unlocks \gset
select id as report_id from public.reports \gset

-- B ne peut pas signaler le déblocage de A
select rdtest.as_user('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select rdtest.throws(format($q$select public.rd_report(%L, 'faux_numero', array[now() - interval '1 hour']::timestamptz[])$q$, :'unlock_id'), 'forbidden', 'B ne signale pas pour A');
reset role;

-- Revue admin : accepté => +1 crédit
select rdtest.as_user('00000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select public.rd_admin_resolve_report(:'report_id', true, '3 appels vérifiés');
select rdtest.throws(format('select public.rd_admin_resolve_report(%L, true)', :'report_id'), 'not_open', 'pas de double remboursement');
reset role;
select rdtest.ok((select sum(delta) from public.credit_ledger where company_id = 'a0000000-0000-0000-0000-000000000000') = 1, 'crédit rendu');
select rdtest.ok(exists (select 1 from public.audit_log where action = 'report_resolved'), 'journal d''audit');

-- Délai de signalement dépassé (7 jours)
update public.reports set status = 'rejected';
update public.unlocks set unlocked_at = now() - interval '8 days';
select rdtest.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select rdtest.throws(format($q$select public.rd_report(%L, 'faux_numero', array[now() - interval '7 days']::timestamptz[])$q$, (select id from public.unlocks)), 'report_window_closed', 'signalement hors délai');
reset role;

-- Maintenance : expiration + purge des demandes non confirmées
insert into public.requests (id, trade, project_type, budget, delay, postal_code, commune, created_at)
values ('cccccccc-0000-0000-0000-000000000001', 'chassis', 'renovation', 'inconnu', 'asap', '4000', 'Liège', now() - interval '25 hours');
insert into public.request_contacts (request_id, first_name, phone_e164, email, phone_hash)
values ('cccccccc-0000-0000-0000-000000000001', 'Zoé', '+32470000009', 'z@e.be', rdtest.h('z'));
update public.requests set expires_at = now() - interval '1 minute' where ref = 'RD-TESTB001';
select public.rd_maintenance();
select rdtest.ok(not exists (select 1 from public.request_contacts where request_id = 'cccccccc-0000-0000-0000-000000000001'), 'demande non confirmée purgée après 24 h');
select rdtest.ok((select status from public.requests where ref = 'RD-TESTB001') = 'expired', 'demande expirée');
-- Les déblocages (pièces comptables) survivent à l'effacement d'une demande
delete from public.requests where ref = 'RD-TESTA001';
select rdtest.ok((select request_id is null and request_ref = 'RD-TESTA001' from public.unlocks), 'déblocage conservé, lien anonymisé');
rollback;
