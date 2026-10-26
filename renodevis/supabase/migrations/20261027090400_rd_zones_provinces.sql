-- =============================================================================
-- RénoDevis — zone géographique des entreprises par PROVINCE
--
-- Une entreprise coche les provinces où elle intervient (et, en option, des
-- codes postaux précis ou des débuts de code). La province d'une demande est
-- déduite de son code postal (plages officielles bpost, couverture 1000-9999).
-- Codes : BRU, WBR, WHT, WLG, WLX, WNA, VBR, VAN, VLI, VOV, VWV.
-- =============================================================================

create or replace function public.rd_province(p_postal_code text)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when p_postal_code !~ '^[1-9][0-9]{3}$' then null
    when p_postal_code::int between 1000 and 1299 then 'BRU'
    when p_postal_code::int between 1300 and 1499 then 'WBR'
    when p_postal_code::int between 1500 and 1999 then 'VBR'
    when p_postal_code::int between 2000 and 2999 then 'VAN'
    when p_postal_code::int between 3000 and 3499 then 'VBR'
    when p_postal_code::int between 3500 and 3999 then 'VLI'
    when p_postal_code::int between 4000 and 4999 then 'WLG'
    when p_postal_code::int between 5000 and 5999 then 'WNA'
    when p_postal_code::int between 6000 and 6599 then 'WHT'
    when p_postal_code::int between 6600 and 6999 then 'WLX'
    when p_postal_code::int between 7000 and 7999 then 'WHT'
    when p_postal_code::int between 8000 and 8999 then 'VWV'
    else 'VOV'
  end
$$;

alter table public.company_profiles
  add column zone_provinces text[] not null default '{}'
  check (zone_provinces <@ array['BRU','WBR','WHT','WLG','WLX','WNA','VBR','VAN','VLI','VOV','VWV']);

-- Une entreprise doit avoir au moins une zone (province ou code postal)
alter table public.company_profiles
  add constraint company_profiles_zone_required
  check (cardinality(zone_provinces) + cardinality(zone_postal_codes) + cardinality(zone_prefixes) > 0)
  not valid;  -- n'invalide pas d'éventuelles lignes existantes ; s'applique aux nouvelles écritures

-- La commune doit faire au moins 2 caractères (une demande sans localité ne
-- peut être attribuée à personne)
alter table public.requests
  add constraint requests_commune_min check (char_length(btrim(commune)) >= 2) not valid;

-- Matching : la province du code postal OU un code / début de code explicite
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
  v_prov     text;
  c          record;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.status <> 'validated' or r.expires_at <= now() then
    return 0;
  end if;
  v_prov := public.rd_province(r.postal_code);

  select count(*) into v_existing from public.assignments where request_id = r.id;

  for c in
    select co.id
      from public.companies co
      join public.company_profiles pr on pr.company_id = co.id
     where co.status = 'validated'
       and r.trade = any (pr.trades)
       and (
             v_prov = any (pr.zone_provinces)
          or r.postal_code = any (pr.zone_postal_codes)
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

-- Quand l'admin valide une entreprise, elle reçoit aussi les demandes ouvertes
-- de sa zone qui ont encore une place (3 maximum).
create or replace function public.rd_admin_set_company_status(p_company_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare d record;
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
  if p_status = 'validated' then
    for d in select id from public.requests where status = 'validated' and expires_at > now() order by validated_at loop
      perform public.rd_assign_request(d.id);
    end loop;
  end if;
  insert into public.audit_log (actor_type, actor_id, action, entity, entity_id, details)
  values ('admin', auth.uid(), 'company_status', 'company', p_company_id::text,
          jsonb_build_object('status', p_status, 'note', p_note));
end;
$$;

-- Droits : comme toutes les fonctions rd_*, rien pour anon / PUBLIC
revoke all on function public.rd_province(text) from public, anon, authenticated;
grant execute on function public.rd_province(text) to service_role;
revoke all on function public.rd_assign_request(uuid) from public, anon, authenticated;
grant execute on function public.rd_assign_request(uuid) to service_role;
revoke all on function public.rd_admin_set_company_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rd_admin_set_company_status(uuid, text, text) to service_role, authenticated;
