-- =============================================================================
-- RénoDevis — droits d'exécution, maintenance (expiration, purge) et statistiques
-- =============================================================================

-- --- Maintenance : à lancer chaque heure (pg_cron si disponible) ----------------
create or replace function public.rd_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
  v_pending integer;
  v_old     integer;
  v_months  integer := public.rd_setting_int('retention_months');
begin
  -- Demandes arrivées à échéance [30 jours, à confirmer]
  update public.requests set status = 'expired', closed_at = now()
   where status = 'validated' and expires_at <= now();
  get diagnostics v_expired = row_count;

  -- Demandes jamais confirmées par SMS : supprimées après 24 h (minimisation)
  update public.consent_logs set request_id = null, ip_hash = null
   where request_id in (select id from public.requests
                         where status = 'pending_sms' and created_at < now() - interval '24 hours');
  delete from public.requests where status = 'pending_sms' and created_at < now() - interval '24 hours';
  get diagnostics v_pending = row_count;

  -- Conservation : 12 mois après la dernière activité
  update public.consent_logs set request_id = null, ip_hash = null
   where request_id in (select id from public.requests
                         where coalesce(closed_at, expires_at, created_at) < now() - make_interval(months => v_months));
  delete from public.requests
   where coalesce(closed_at, expires_at, created_at) < now() - make_interval(months => v_months);
  get diagnostics v_old = row_count;

  delete from public.otp_attempts where expires_at < now() - interval '48 hours';
  delete from public.rate_events where created_at < now() - interval '48 hours';
  delete from public.tracking_events where created_at < now() - make_interval(months => v_months);
  delete from public.consent_logs
   where accepted_at < now() - make_interval(years => public.rd_setting_int('consent_log_retention_years'));

  insert into public.audit_log (actor_type, action, details)
  values ('system', 'maintenance',
          jsonb_build_object('expired', v_expired, 'pending_purged', v_pending, 'retention_purged', v_old));

  return jsonb_build_object('expired', v_expired, 'pending_purged', v_pending, 'retention_purged', v_old);
end;
$$;

-- --- Statistiques par campagne (coût par demande validée = dépense / validated) -
create or replace view public.rd_campaign_stats
with (security_invoker = true) as
select
  coalesce(utm ->> 'utm_source', '(direct)')   as utm_source,
  coalesce(utm ->> 'utm_campaign', '(aucune)') as utm_campaign,
  date_trunc('day', created_at)::date          as day,
  count(distinct session_id) filter (where event = 'page_view')          as visitors,
  count(distinct session_id) filter (where event = 'quiz_start')         as quiz_starts,
  count(*)                   filter (where event = 'request_submitted')  as submitted,
  count(*)                   filter (where event = 'sms_validated')      as validated
from public.tracking_events
group by 1, 2, 3;

revoke all on public.rd_campaign_stats from public, anon, authenticated;
grant select on public.rd_campaign_stats to service_role;

-- --- Droits d'exécution ---------------------------------------------------------
-- Par défaut, PostgreSQL (et Supabase) rendent toute fonction exécutable par
-- tous. On retire TOUT, puis on rend fonction par fonction.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'rd\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- Utilisées par les policies RLS (ne révèlent que les propres droits de l'appelant)
grant execute on function public.rd_is_mfa()              to authenticated;
grant execute on function public.rd_my_company_ids()      to authenticated;
grant execute on function public.rd_my_company_ids_any()  to authenticated;
grant execute on function public.rd_is_admin()            to authenticated;

-- Actions entreprise (contrôles internes : entreprise validée + aal2)
grant execute on function public.rd_unlock(uuid, uuid)                          to authenticated;
grant execute on function public.rd_get_contact(uuid, uuid)                     to authenticated;
grant execute on function public.rd_report(uuid, text, timestamptz[], text)     to authenticated;

-- Actions admin (contrôle interne : rd_is_admin())
grant execute on function public.rd_admin_set_company_status(uuid, text, text)  to authenticated;
grant execute on function public.rd_admin_credit(uuid, integer, text, text)     to authenticated;
grant execute on function public.rd_admin_resolve_report(uuid, boolean, text)   to authenticated;

-- --- Planification (uniquement si pg_cron est activé sur le projet) -------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('rd-maintenance', '17 * * * *', 'select public.rd_maintenance()');
  end if;
end $$;
