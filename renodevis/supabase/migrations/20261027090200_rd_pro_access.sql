-- =============================================================================
-- RénoDevis — accès entreprises et admin (socle de la phase 2)
--
-- Règles :
--   * Une entreprise ne voit QUE les demandes qui lui sont attribuées, et
--     seulement si elle est « validée » ET que la session est en double
--     authentification (aal2 = TOTP vérifié).
--   * Les coordonnées ne sortent que par rd_unlock / rd_get_contact, après
--     débit d'un crédit.
--   * Les opérations admin passent par des fonctions qui vérifient rd_is_admin().
-- =============================================================================

create or replace function public.rd_is_mfa()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
$$;

-- Entreprises VALIDÉES de l'utilisateur connecté (session aal2 obligatoire)
create or replace function public.rd_my_company_ids()
returns setof uuid
language sql stable
security definer
set search_path = ''
as $$
  select cu.company_id
    from public.company_users cu
    join public.companies c on c.id = cu.company_id
   where cu.user_id = auth.uid()
     and c.status = 'validated'
     and public.rd_is_mfa()
$$;

-- Entreprises de l'utilisateur, quel que soit leur statut (pour afficher
-- « en attente de validation »)
create or replace function public.rd_my_company_ids_any()
returns setof uuid
language sql stable
security definer
set search_path = ''
as $$
  select cu.company_id
    from public.company_users cu
   where cu.user_id = auth.uid()
     and public.rd_is_mfa()
$$;

create or replace function public.rd_is_admin()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select public.rd_is_mfa()
     and exists (select 1 from public.admins where user_id = auth.uid())
$$;

create or replace function public.rd_company_balance(p_company_id uuid)
returns integer
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer from public.credit_ledger where company_id = p_company_id
$$;

-- --- Policies de LECTURE (aucune écriture directe : tout passe par fonctions) --
create policy companies_select_own on public.companies
  for select to authenticated
  using (id in (select public.rd_my_company_ids_any()));

create policy company_profiles_select_own on public.company_profiles
  for select to authenticated
  using (company_id in (select public.rd_my_company_ids_any()));

create policy assignments_select_own on public.assignments
  for select to authenticated
  using (company_id in (select public.rd_my_company_ids()));

create policy requests_select_assigned on public.requests
  for select to authenticated
  using (exists (
    select 1 from public.assignments a
     where a.request_id = requests.id
       and a.company_id in (select public.rd_my_company_ids())
  ));

create policy unlocks_select_own on public.unlocks
  for select to authenticated
  using (company_id in (select public.rd_my_company_ids()));

create policy credit_ledger_select_own on public.credit_ledger
  for select to authenticated
  using (company_id in (select public.rd_my_company_ids()));

create policy reports_select_own on public.reports
  for select to authenticated
  using (company_id in (select public.rd_my_company_ids()));

grant select on public.companies, public.company_profiles, public.assignments,
                public.unlocks, public.credit_ledger, public.reports
   to authenticated;

-- Demandes : uniquement les colonnes de l'aperçu anonyme (ni session, ni UTM)
grant select (id, ref, trade, project_type, budget, delay, detail, postal_code,
              commune, status, unlock_count, validated_at, expires_at)
   on public.requests to authenticated;

-- request_contacts, consent_logs, otp_attempts, rate_events, tracking_events,
-- rd_settings, admins, audit_log : AUCUNE policy, AUCUN droit.

-- -----------------------------------------------------------------------------
-- Coordonnées : uniquement si CETTE entreprise a débloqué CETTE demande.
-- -----------------------------------------------------------------------------
create or replace function public.rd_contact_json(p_request_id uuid)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('first_name', first_name, 'phone', phone_e164, 'email', email)
    from public.request_contacts where request_id = p_request_id
$$;

create or replace function public.rd_get_contact(p_request_id uuid, p_company_id uuid)
returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if p_company_id is null or p_company_id not in (select public.rd_my_company_ids()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.unlocks
                  where request_id = p_request_id and company_id = p_company_id) then
    raise exception 'not_unlocked' using errcode = '42501';
  end if;
  return public.rd_contact_json(p_request_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Déblocage : débite 1 crédit, enregistre le prix (35 € TTC) et rend le contact.
-- Idempotent : un second appel par la même entreprise ne re-débite pas.
-- -----------------------------------------------------------------------------
create or replace function public.rd_unlock(p_request_id uuid, p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          public.requests;
  v_max      integer := public.rd_setting_int('max_companies_per_request');
  v_unlock   uuid;
  v_new      integer;
begin
  if p_company_id is null or p_company_id not in (select public.rd_my_company_ids()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into r from public.requests where id = p_request_id for update;
  if not found or not exists (select 1 from public.assignments
                               where request_id = p_request_id and company_id = p_company_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (select 1 from public.unlocks where request_id = r.id and company_id = p_company_id) then
    return jsonb_build_object('ok', true, 'already', true, 'contact', public.rd_contact_json(r.id));
  end if;

  if r.status <> 'validated' or r.expires_at <= now() or r.unlock_count >= v_max then
    raise exception 'request_closed' using errcode = 'P0001';
  end if;

  perform 1 from public.companies where id = p_company_id for update;
  if public.rd_company_balance(p_company_id) < 1 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into public.unlocks (request_id, request_ref, company_id, price_cents, vat_included, payment_ref, unlocked_by)
  values (
    r.id, r.ref, p_company_id,
    public.rd_setting_int('unlock_price_cents'),
    (select (value #>> '{}')::boolean from public.rd_settings where key = 'unlock_price_vat_included'),
    'credit', auth.uid()
  )
  returning id into v_unlock;

  insert into public.credit_ledger (company_id, delta, reason, reference, unlock_id, created_by)
  values (p_company_id, -1, 'unlock', r.ref, v_unlock, auth.uid());

  v_new := r.unlock_count + 1;
  update public.requests
     set unlock_count = v_new,
         status    = case when v_new >= v_max then 'closed' else status end,
         closed_at = case when v_new >= v_max then now() else closed_at end
   where id = r.id;

  insert into public.audit_log (actor_type, actor_id, action, entity, entity_id, details)
  values ('company', auth.uid(), 'unlock', 'request', r.id::text,
          jsonb_build_object('company_id', p_company_id, 'unlock_id', v_unlock));

  return jsonb_build_object('ok', true, 'already', false, 'contact', public.rd_contact_json(r.id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Signalement (faux numéro / injoignable). Revue manuelle par l'admin.
-- Règle validée : 1 crédit rendu si le particulier reste injoignable après
-- 3 appels horodatés (date + heure de chaque appel).
-- -----------------------------------------------------------------------------
create or replace function public.rd_report(
  p_unlock_id uuid,
  p_reason text,
  p_call_attempts timestamptz[],
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  u        public.unlocks;
  v_calls  timestamptz[];
  v_id     uuid;
  i        integer;
begin
  select * into u from public.unlocks where id = p_unlock_id;
  if not found or u.company_id not in (select public.rd_my_company_ids()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if now() > u.unlocked_at + make_interval(days => public.rd_setting_int('report_window_days')) then
    raise exception 'report_window_closed' using errcode = 'P0001';
  end if;
  if p_reason not in ('faux_numero', 'injoignable') then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct t order by t), '{}') into v_calls from unnest(p_call_attempts) t;

  if exists (select 1 from unnest(v_calls) t where t < u.unlocked_at or t > now()) then
    raise exception 'invalid_call_times' using errcode = 'P0001';
  end if;

  if p_reason = 'injoignable' then
    if cardinality(v_calls) < 3 then
      raise exception 'three_calls_required' using errcode = 'P0001';
    end if;
    -- [HYPOTHÈSE à confirmer] au moins 1 h entre deux appels successifs
    for i in 2 .. cardinality(v_calls) loop
      if v_calls[i] - v_calls[i - 1] < interval '1 hour' then
        raise exception 'calls_too_close' using errcode = 'P0001';
      end if;
    end loop;
  elsif cardinality(v_calls) < 1 then
    raise exception 'one_call_required' using errcode = 'P0001';
  end if;

  insert into public.reports (unlock_id, company_id, reason, call_attempts, comment)
  values (u.id, u.company_id, p_reason, v_calls, left(p_comment, 1000))
  returning id into v_id;

  insert into public.audit_log (actor_type, actor_id, action, entity, entity_id)
  values ('company', auth.uid(), 'report_created', 'report', v_id::text);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin
-- -----------------------------------------------------------------------------
create or replace function public.rd_admin_set_company_status(p_company_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.rd_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.companies
     set status = p_status,
         validated_at = case when p_status = 'validated' then now() else validated_at end,
         validated_by = case when p_status = 'validated' then auth.uid() else validated_by end
   where id = p_company_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_type, actor_id, action, entity, entity_id, details)
  values ('admin', auth.uid(), 'company_status', 'company', p_company_id::text,
          jsonb_build_object('status', p_status, 'note', p_note));
end;
$$;

create or replace function public.rd_admin_credit(p_company_id uuid, p_delta integer, p_reason text, p_reference text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_id bigint;
begin
  if not public.rd_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason not in ('topup', 'adjust') then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;
  insert into public.credit_ledger (company_id, delta, reason, reference, created_by)
  values (p_company_id, p_delta, p_reason, p_reference, auth.uid())
  returning id into v_id;
  insert into public.audit_log (actor_type, actor_id, action, entity, entity_id, details)
  values ('admin', auth.uid(), 'credit', 'company', p_company_id::text,
          jsonb_build_object('delta', p_delta, 'reason', p_reason, 'reference', p_reference));
  return v_id;
end;
$$;

create or replace function public.rd_admin_resolve_report(p_report_id uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare rp public.reports;
begin
  if not public.rd_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into rp from public.reports where id = p_report_id for update;
  if not found or rp.status <> 'open' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  update public.reports
     set status = case when p_accept then 'accepted' else 'rejected' end,
         resolved_at = now(), resolved_by = auth.uid(), resolution_note = p_note
   where id = rp.id;
  if p_accept then
    insert into public.credit_ledger (company_id, delta, reason, reference, unlock_id, created_by)
    values (rp.company_id, 1, 'refund', 'report:' || rp.id, rp.unlock_id, auth.uid());
  end if;
  insert into public.audit_log (actor_type, actor_id, action, entity, entity_id, details)
  values ('admin', auth.uid(), 'report_resolved', 'report', rp.id::text,
          jsonb_build_object('accepted', p_accept, 'note', p_note));
end;
$$;
