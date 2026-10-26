-- =============================================================================
-- RénoDevis — schéma de base (phase 1, prépare la phase 2)
--
-- Projet Supabase DÉDIÉ (distinct de « Pixel print ») : aucune table du site
-- pxlstudio.be n'est touchée par ces migrations.
--
-- Principe de sécurité :
--   * RLS activée sur TOUTES les tables, et tous les droits retirés à anon /
--     authenticated. On ne rend ensuite que le strict nécessaire.
--   * anon (visiteur du site) n'a AUCUN accès direct : tout passe par la
--     fonction serveur `public-api` (service_role).
--   * Les coordonnées du particulier (request_contacts) n'ont AUCUNE policy :
--     elles ne sortent que via rd_get_contact(), après un déblocage payé.
-- =============================================================================

-- --- Paramètres internes (prix, durées…) — jamais exposés au navigateur -------
create table public.rd_settings (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.rd_settings (key, value) values
  ('unlock_price_cents', '3500'),       -- 35 € TTC par contact
  ('unlock_price_vat_included', 'true'),
  ('max_companies_per_request', '3'),
  ('request_ttl_days', '30'),           -- [30 jours, à confirmer]
  ('duplicate_window_days', '30'),
  ('report_window_days', '7'),
  ('retention_months', '12'),
  ('consent_log_retention_years', '5');

-- --- Référentiels -----------------------------------------------------------------
create table public.trades (
  code   text primary key check (code ~ '^[a-z_]{2,30}$'),
  label  text not null,
  active boolean not null default false
);

insert into public.trades (code, label, active) values
  ('chassis',   'Châssis',   true),
  ('isolation', 'Isolation', false),
  ('toiture',   'Toiture',   false),
  ('chauffage', 'Chauffage', false);

-- Texte EXACT de chaque consentement, versionné. Une version publiée ne se
-- modifie jamais : on en crée une nouvelle.
create table public.consent_texts (
  version    text primary key,
  purpose    text not null check (purpose in ('demande_devis')),
  body       text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index consent_texts_one_current on public.consent_texts (purpose) where is_current;

insert into public.consent_texts (version, purpose, body, is_current) values
  ('demande-devis-2026-10-v1', 'demande_devis',
   'J''accepte que mes coordonnées soient transmises à 3 entreprises au maximum pour recevoir un devis',
   true);

-- --- Demandes (partie ANONYME, visible des entreprises attribuées) --------------
create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  ref          text not null unique
               default ('RD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  trade        text not null references public.trades(code),
  project_type text not null check (project_type in ('renovation', 'nouvelle_construction', 'extension')),
  budget       text not null check (budget in ('moins_5000', '5000_10000', '10000_20000', 'plus_20000', 'inconnu')),
  delay        text not null check (delay in ('asap', '3_mois', '6_mois')),
  detail       jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  postal_code  text not null check (postal_code ~ '^[1-9][0-9]{3}$'),
  commune      text not null check (char_length(commune) between 1 and 80),
  status       text not null default 'pending_sms'
               check (status in ('pending_sms', 'validated', 'closed', 'expired')),
  unlock_count smallint not null default 0 check (unlock_count between 0 and 3),
  created_at   timestamptz not null default now(),
  validated_at timestamptz,
  expires_at   timestamptz,
  closed_at    timestamptz,
  -- Suivi marketing (jamais exposé aux entreprises)
  session_id   uuid,
  utm          jsonb not null default '{}'::jsonb check (jsonb_typeof(utm) = 'object')
);
create index requests_status_idx on public.requests (status, expires_at);

-- --- Coordonnées du particulier (PII) — table séparée, AUCUNE policy -----------
create table public.request_contacts (
  request_id uuid primary key references public.requests(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 60),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email      text not null check (char_length(email) between 3 and 254 and email like '%_@_%'),
  -- HMAC (poivre serveur) : doublons, limites et effacement sans relire le numéro
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index request_contacts_phone_hash_idx on public.request_contacts (phone_hash);

-- --- Journal de consentement ------------------------------------------------------
create table public.consent_logs (
  id              bigint generated always as identity primary key,
  request_id      uuid references public.requests(id) on delete set null,
  consent_version text not null references public.consent_texts(version),
  accepted_at     timestamptz not null default now(),
  ip_hash         text check (ip_hash ~ '^[0-9a-f]{64}$')
);

-- --- Codes SMS (une ligne par code envoyé) ----------------------------------------
create table public.otp_attempts (
  id          uuid primary key default gen_random_uuid(),
  purpose     text not null check (purpose in ('verify_request', 'erase')),
  request_id  uuid references public.requests(id) on delete cascade,
  phone_hash  text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  code_hash   text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts    smallint not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  ip_hash     text
);
create index otp_attempts_request_idx on public.otp_attempts (request_id, created_at desc);
create index otp_attempts_phone_idx on public.otp_attempts (phone_hash, created_at desc);

-- --- Limites de débit (IP, téléphone…) — clés hachées uniquement ------------------
create table public.rate_events (
  id         bigint generated always as identity primary key,
  bucket     text not null,
  key_hash   text not null,
  created_at timestamptz not null default now()
);
create index rate_events_lookup_idx on public.rate_events (bucket, key_hash, created_at desc);

-- --- Mesure d'audience interne (sans cookie, sans identifiant persistant) -------
create table public.tracking_events (
  id         bigint generated always as identity primary key,
  session_id uuid not null,
  event      text not null check (event in ('page_view', 'quiz_start', 'quiz_step', 'request_submitted', 'sms_validated')),
  step       smallint check (step between 1 and 7),
  trade      text,
  page       text check (char_length(page) <= 120),
  utm        jsonb not null default '{}'::jsonb check (jsonb_typeof(utm) = 'object'),
  request_id uuid references public.requests(id) on delete set null,
  created_at timestamptz not null default now()
);
create index tracking_events_created_idx on public.tracking_events (created_at);

-- =============================================================================
-- Espace entreprise (tables prêtes pour la phase 2)
-- =============================================================================
create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 2 and 120),
  -- Numéro BCE normalisé : 10 chiffres, sans « BE » ni points
  bce_number       text not null unique check (bce_number ~ '^[01][0-9]{9}$'),
  email_pro        text not null check (email_pro like '%_@_%'),
  status           text not null default 'pending'
                   check (status in ('pending', 'validated', 'suspended', 'rejected')),
  validated_at     timestamptz,
  validated_by     uuid,
  last_assigned_at timestamptz,   -- rotation équitable
  created_at       timestamptz not null default now()
);

create table public.company_users (
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table public.company_profiles (
  company_id            uuid primary key references public.companies(id) on delete cascade,
  trades                text[] not null default '{}',
  zone_postal_codes     text[] not null default '{}',   -- codes postaux exacts
  zone_prefixes         text[] not null default '{}',   -- ex. '60' = 6000-6099
  budget_min_eur        integer not null default 0 check (budget_min_eur >= 0),
  accept_unknown_budget boolean not null default true,
  updated_at            timestamptz not null default now()
);

create table public.cgv_versions (
  version    text primary key,
  body       text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index cgv_versions_one_current on public.cgv_versions (is_current) where is_current;

create table public.cgv_acceptances (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null,
  version     text not null references public.cgv_versions(version),
  accepted_at timestamptz not null default now(),
  ip_hash     text
);

create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (request_id, company_id)
);
create index assignments_company_idx on public.assignments (company_id, assigned_at desc);

-- Les déblocages sont des pièces comptables : on les garde même si la demande
-- est effacée (request_id passe à NULL).
create table public.unlocks (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid references public.requests(id) on delete set null,
  request_ref       text not null,
  company_id        uuid not null references public.companies(id),
  price_cents       integer not null check (price_cents >= 0),
  vat_included      boolean not null,
  payment_ref       text not null,   -- 'credit:<id>' aujourd'hui, Mollie en phase 3
  unlocked_by       uuid,
  unlocked_at       timestamptz not null default now(),
  unique (request_id, company_id)
);

create table public.credit_ledger (
  id         bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  delta      integer not null check (delta <> 0),
  reason     text not null check (reason in ('topup', 'unlock', 'refund', 'adjust')),
  reference  text,
  unlock_id  uuid references public.unlocks(id),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index credit_ledger_company_idx on public.credit_ledger (company_id);

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  unlock_id       uuid not null references public.unlocks(id),
  company_id      uuid not null references public.companies(id),
  reason          text not null check (reason in ('faux_numero', 'injoignable')),
  call_attempts   timestamptz[] not null default '{}',
  comment         text check (char_length(comment) <= 1000),
  status          text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid,
  resolution_note text
);
create unique index reports_one_active_per_unlock on public.reports (unlock_id) where status in ('open', 'accepted');

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_type  text not null check (actor_type in ('system', 'public', 'company', 'admin')),
  actor_id    uuid,
  action      text not null,
  entity      text,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb
);

-- =============================================================================
-- Verrouillage : RLS partout, aucun droit par défaut pour anon / authenticated.
-- (Supabase accorde par défaut ALL à anon/authenticated sur le schéma public.)
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'rd_settings', 'trades', 'consent_texts', 'requests', 'request_contacts',
    'consent_logs', 'otp_attempts', 'rate_events', 'tracking_events',
    'companies', 'company_users', 'company_profiles', 'cgv_versions',
    'cgv_acceptances', 'assignments', 'unlocks', 'credit_ledger', 'reports',
    'admins', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
