-- =============================================================================
-- RénoDevis — fonctions du parcours particulier
--
-- Appelées UNIQUEMENT par la fonction serveur `public-api` (service_role).
-- Le navigateur n'y a jamais accès directement : anon n'a aucun droit.
--
-- Le serveur transmet des valeurs DÉJÀ validées et hachées (HMAC + poivre) :
-- ip_hash, phone_hash, code_hash. Le code SMS en clair ne touche jamais la base.
--
-- Les erreurs « métier » sont renvoyées en jsonb ({ok:false,error}) et non
-- levées : une exception annulerait aussi l'enregistrement des limites de débit.
-- =============================================================================

create or replace function public.rd_setting_int(p_key text)
returns integer
language sql stable
security definer
set search_path = ''
as $$
  select (value #>> '{}')::integer from public.rd_settings where key = p_key
$$;

create or replace function public.rd_err(p_code text)
returns jsonb
language sql immutable
set search_path = ''
as $$ select jsonb_build_object('ok', false, 'error', p_code) $$;

-- Limite de débit : max p_max événements par fenêtre glissante. Enregistre
-- l'événement si la limite n'est pas atteinte.
create or replace function public.rd_rate_hit(p_bucket text, p_key text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key is null or p_key = '' then
    return true;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key, 0));
  select count(*) into v_count
    from public.rate_events
   where bucket = p_bucket and key_hash = p_key and created_at > now() - p_window;
  if v_count >= p_max then
    return false;
  end if;
  insert into public.rate_events (bucket, key_hash) values (p_bucket, p_key);
  return true;
end;
$$;

-- Plancher (en €) de chaque tranche de budget, pour le budget minimum des entreprises.
create or replace function public.rd_budget_floor(p_budget text)
returns integer
language sql immutable
set search_path = ''
as $$
  select case p_budget
    when 'moins_5000'  then 0
    when '5000_10000'  then 5000
    when '10000_20000' then 10000
    when 'plus_20000'  then 20000
    else null
  end
$$;

-- Doublon : même téléphone + même métier, demande déjà validée sur la fenêtre.
create or replace function public.rd_is_duplicate(p_phone_hash text, p_trade text, p_exclude uuid default null)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.requests r
      join public.request_contacts c on c.request_id = r.id
     where c.phone_hash = p_phone_hash
       and r.trade = p_trade
       and r.status in ('validated', 'closed')
       and r.validated_at > now() - make_interval(days => public.rd_setting_int('duplicate_window_days'))
       and (p_exclude is null or r.id <> p_exclude)
  )
$$;

-- -----------------------------------------------------------------------------
-- Matching : jusqu'à 3 entreprises validées, métier + zone + budget, rotation
-- équitable (celle qui a reçu une demande il y a le plus longtemps passe d'abord).
-- -----------------------------------------------------------------------------
create or replace function public.rd_assign_request(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          public.requests;
  v_max      integer := public.rd_setting_int('max_companies_per_request');
  v_existing integer;
  v_added    integer := 0;
  c          record;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.status <> 'validated' or r.expires_at <= now() then
    return 0;
  end if;

  select count(*) into v_existing from public.assignments where request_id = r.id;

  for c in
    select co.id
      from public.companies co
      join public.company_profiles pr on pr.company_id = co.id
     where co.status = 'validated'
       and r.trade = any (pr.trades)
       and (
             r.postal_code = any (pr.zone_postal_codes)
          or exists (select 1 from unnest(pr.zone_prefixes) z where z <> '' and r.postal_code like z || '%')
       )
       and case
             when r.budget = 'inconnu' then pr.accept_unknown_budget
             else public.rd_budget_floor(r.budget) >= pr.budget_min_eur
           end
       and not exists (
             select 1 from public.assignments a where a.request_id = r.id and a.company_id = co.id
       )
     order by co.last_assigned_at asc nulls first, random()
     limit greatest(v_max - v_existing, 0)
     for update of co
  loop
    insert into public.assignments (request_id, company_id) values (r.id, c.id);
    update public.companies set last_assigned_at = clock_timestamp() where id = c.id;
    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1) Envoi du formulaire : crée la demande « en attente SMS » + premier code.
-- -----------------------------------------------------------------------------
create or replace function public.rd_api_submit(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip      text := p->>'ip_hash';
  v_phone   text := p->>'phone_hash';
  v_trade   text := p->>'trade';
  v_version text;
  v_id      uuid;
  v_ref     text;
begin
  if not public.rd_rate_hit('submit_ip', v_ip, 5, interval '1 hour') then
    return public.rd_err('rate_limited');
  end if;
  select version into v_version
    from public.consent_texts where purpose = 'demande_devis' and is_current;
  if v_version is null or v_version is distinct from p->>'consent_version' then
    return public.rd_err('consent_outdated');
  end if;

  if not exists (select 1 from public.trades where code = v_trade and active) then
    return public.rd_err('invalid_input');
  end if;

  if public.rd_is_duplicate(v_phone, v_trade) then
    return public.rd_err('duplicate');
  end if;

  if not public.rd_rate_hit('submit_phone', v_phone, 3, interval '24 hours') then
    return public.rd_err('rate_limited');
  end if;
  if not public.rd_rate_hit('sms_phone', v_phone, 5, interval '24 hours') then
    return public.rd_err('rate_limited');
  end if;

  begin
    insert into public.requests (trade, project_type, budget, delay, detail, postal_code, commune, session_id, utm)
    values (
      v_trade, p->>'project_type', p->>'budget', p->>'delay',
      coalesce(p->'detail', '{}'::jsonb), p->>'postal_code', p->>'commune',
      nullif(p->>'session_id', '')::uuid, coalesce(p->'utm', '{}'::jsonb)
    )
    returning id, ref into v_id, v_ref;

    insert into public.request_contacts (request_id, first_name, phone_e164, email, phone_hash)
    values (v_id, p->>'first_name', p->>'phone_e164', p->>'email', v_phone);

    insert into public.consent_logs (request_id, consent_version, ip_hash)
    values (v_id, v_version, v_ip);

    insert into public.otp_attempts (purpose, request_id, phone_hash, code_hash, expires_at, ip_hash)
    values ('verify_request', v_id, v_phone, p->>'code_hash', now() + interval '10 minutes', v_ip);
  exception
    when check_violation or not_null_violation or invalid_text_representation
      or foreign_key_violation or string_data_right_truncation then
      return public.rd_err('invalid_input');
  end;

  if p ? 'session_id' and nullif(p->>'session_id', '') is not null then
    insert into public.tracking_events (session_id, event, trade, utm, request_id)
    values ((p->>'session_id')::uuid, 'request_submitted', v_trade, coalesce(p->'utm', '{}'::jsonb), v_id);
  end if;

  insert into public.audit_log (actor_type, action, entity, entity_id)
  values ('public', 'request_created', 'request', v_id::text);

  return jsonb_build_object('ok', true, 'request_id', v_id, 'ref', v_ref);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Renvoi du code (60 s minimum entre deux envois, 3 codes max par demande)
-- -----------------------------------------------------------------------------
create or replace function public.rd_api_resend(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_status text;
  v_phone  text;
  v_e164   text;
begin
  begin
    v_id := (p->>'request_id')::uuid;
  exception when invalid_text_representation then
    return public.rd_err('not_found');
  end;

  if not public.rd_rate_hit('resend_ip', p->>'ip_hash', 10, interval '1 hour') then
    return public.rd_err('rate_limited');
  end if;

  select r.status, c.phone_hash, c.phone_e164 into v_status, v_phone, v_e164
    from public.requests r join public.request_contacts c on c.request_id = r.id
   where r.id = v_id
     for update of r;
  if not found or v_status <> 'pending_sms' then
    return public.rd_err('not_found');
  end if;

  if exists (select 1 from public.otp_attempts
              where request_id = v_id and created_at > now() - interval '60 seconds') then
    return public.rd_err('too_soon');
  end if;
  if (select count(*) from public.otp_attempts where request_id = v_id) >= 3 then
    return public.rd_err('rate_limited');
  end if;
  if not public.rd_rate_hit('sms_phone', v_phone, 5, interval '24 hours') then
    return public.rd_err('rate_limited');
  end if;

  update public.otp_attempts set expires_at = now()
   where request_id = v_id and consumed_at is null and expires_at > now();

  insert into public.otp_attempts (purpose, request_id, phone_hash, code_hash, expires_at, ip_hash)
  values ('verify_request', v_id, v_phone, p->>'code_hash', now() + interval '10 minutes', p->>'ip_hash');

  return jsonb_build_object('ok', true, 'phone_e164', v_e164);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Vérification du code : valide la demande et lance le matching.
-- -----------------------------------------------------------------------------
create or replace function public.rd_api_verify(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid;
  r          public.requests;
  o          public.otp_attempts;
  v_phone    text;
  v_assigned integer;
begin
  begin
    v_id := (p->>'request_id')::uuid;
  exception when invalid_text_representation then
    return public.rd_err('invalid_code');
  end;

  if not public.rd_rate_hit('verify_ip', p->>'ip_hash', 30, interval '1 hour') then
    return public.rd_err('rate_limited');
  end if;

  select * into r from public.requests where id = v_id for update;
  if not found then
    return public.rd_err('invalid_code');
  end if;
  if r.status <> 'pending_sms' then
    return jsonb_build_object('ok', true, 'already', true, 'ref', r.ref);
  end if;

  select * into o
    from public.otp_attempts
   where request_id = v_id and purpose = 'verify_request' and consumed_at is null
   order by created_at desc
   limit 1
     for update;
  if not found or o.expires_at <= now() then
    return public.rd_err('expired');
  end if;
  if o.attempts >= 5 then
    return public.rd_err('locked');
  end if;
  if o.code_hash is distinct from p->>'code_hash' then
    update public.otp_attempts set attempts = attempts + 1 where id = o.id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code', 'remaining', greatest(4 - o.attempts, 0));
  end if;

  update public.otp_attempts set consumed_at = now() where id = o.id;

  -- Une autre demande identique a pu être validée entre-temps : on supprime
  -- celle-ci plutôt que de la conserver inutilement.
  select phone_hash into v_phone from public.request_contacts where request_id = v_id;
  if public.rd_is_duplicate(v_phone, r.trade, v_id) then
    delete from public.requests where id = v_id;
    return public.rd_err('duplicate');
  end if;

  update public.requests
     set status = 'validated',
         validated_at = now(),
         expires_at = now() + make_interval(days => public.rd_setting_int('request_ttl_days'))
   where id = v_id;

  v_assigned := public.rd_assign_request(v_id);

  if r.session_id is not null then
    insert into public.tracking_events (session_id, event, trade, utm, request_id)
    values (r.session_id, 'sms_validated', r.trade, r.utm, v_id);
  end if;

  insert into public.audit_log (actor_type, action, entity, entity_id, details)
  values ('public', 'request_validated', 'request', v_id::text, jsonb_build_object('assigned', v_assigned));

  return jsonb_build_object(
    'ok', true,
    'ref', r.ref,
    'assigned', v_assigned,
    'summary', jsonb_build_object(
      'trade', r.trade, 'project_type', r.project_type, 'budget', r.budget,
      'delay', r.delay, 'detail', r.detail, 'postal_code', r.postal_code,
      'commune', r.commune, 'utm', r.utm
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Droit à l'effacement : code SMS puis suppression effective.
-- La réponse ne révèle pas si le numéro est connu (send=false n'est pas
-- transmis au navigateur par la fonction serveur).
-- -----------------------------------------------------------------------------
create or replace function public.rd_api_erase_start(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := p->>'phone_hash';
begin
  if not public.rd_rate_hit('erase_ip', p->>'ip_hash', 5, interval '1 hour') then
    return public.rd_err('rate_limited');
  end if;
  if not exists (select 1 from public.request_contacts where phone_hash = v_phone) then
    return jsonb_build_object('ok', true, 'send', false);
  end if;
  if exists (select 1 from public.otp_attempts
              where phone_hash = v_phone and purpose = 'erase'
                and created_at > now() - interval '60 seconds') then
    return public.rd_err('too_soon');
  end if;
  if not public.rd_rate_hit('sms_phone', v_phone, 5, interval '24 hours') then
    return public.rd_err('rate_limited');
  end if;

  update public.otp_attempts set expires_at = now()
   where phone_hash = v_phone and purpose = 'erase' and consumed_at is null and expires_at > now();

  insert into public.otp_attempts (purpose, phone_hash, code_hash, expires_at, ip_hash)
  values ('erase', v_phone, p->>'code_hash', now() + interval '10 minutes', p->>'ip_hash');

  return jsonb_build_object('ok', true, 'send', true);
end;
$$;

create or replace function public.rd_api_erase_confirm(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := p->>'phone_hash';
  o       public.otp_attempts;
  v_ids   uuid[];
begin
  if not public.rd_rate_hit('erase_verify_ip', p->>'ip_hash', 20, interval '1 hour') then
    return public.rd_err('rate_limited');
  end if;

  select * into o
    from public.otp_attempts
   where phone_hash = v_phone and purpose = 'erase' and consumed_at is null
   order by created_at desc
   limit 1
     for update;
  if not found or o.expires_at <= now() then
    return public.rd_err('expired');
  end if;
  if o.attempts >= 5 then
    return public.rd_err('locked');
  end if;
  if o.code_hash is distinct from p->>'code_hash' then
    update public.otp_attempts set attempts = attempts + 1 where id = o.id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code', 'remaining', greatest(4 - o.attempts, 0));
  end if;

  select coalesce(array_agg(request_id), '{}') into v_ids
    from public.request_contacts where phone_hash = v_phone;

  -- Preuve de consentement conservée sous forme ANONYME (version + date).
  -- [DÉCISION JURIDIQUE] : conserver ou non cette trace après effacement.
  update public.consent_logs set request_id = null, ip_hash = null where request_id = any (v_ids);

  delete from public.requests where id = any (v_ids);   -- cascade : contacts, codes, attributions
  delete from public.otp_attempts where phone_hash = v_phone;
  delete from public.rate_events where key_hash = v_phone;

  insert into public.audit_log (actor_type, action, entity, details)
  values ('public', 'erasure', 'request', jsonb_build_object('requests_deleted', cardinality(v_ids)));

  return jsonb_build_object('ok', true, 'erased', cardinality(v_ids));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) Mesure d'audience (page vue, début du quiz, étapes). Les événements
--    « demande envoyée » et « SMS validé » sont enregistrés côté serveur.
-- -----------------------------------------------------------------------------
create or replace function public.rd_api_track(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.rd_rate_hit('track_ip', p->>'ip_hash', 300, interval '1 hour') then
    return public.rd_err('rate_limited');
  end if;
  if p->>'event' not in ('page_view', 'quiz_start', 'quiz_step') then
    return public.rd_err('invalid_input');
  end if;
  begin
    insert into public.tracking_events (session_id, event, step, trade, page, utm)
    values (
      (p->>'session_id')::uuid, p->>'event', nullif(p->>'step', '')::smallint,
      p->>'trade', left(p->>'page', 120), coalesce(p->'utm', '{}'::jsonb)
    );
  exception
    when check_violation or not_null_violation or invalid_text_representation
      or numeric_value_out_of_range then
      return public.rd_err('invalid_input');
  end;
  return jsonb_build_object('ok', true);
end;
$$;
