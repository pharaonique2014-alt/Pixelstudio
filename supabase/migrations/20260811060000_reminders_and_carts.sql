-- Migrations appliquées sur le projet "Pixel print" (pgqoojmmovsoalruxomj) le
-- 2026-08-11. Reprises ici pour garder une trace versionnée du schéma.
--
-- 1) app_secrets  : secret partagé Postgres <-> Edge Function (jamais côté client)
-- 2) carts        : panier serveur, base de la relance à 24 h
-- 3) pg_cron      : job horaire qui déclenche l'action `cron` de mollie3

-- --- 1) Secrets internes ---------------------------------------------------------
-- RLS activée SANS AUCUNE POLICY : anon/authenticated ne peuvent rien lire ni
-- écrire ; seul service_role (qui contourne RLS) y accède.
create table if not exists public.app_secrets (
  k text primary key,
  v text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

insert into public.app_secrets (k, v)
values ('cron', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (k) do nothing;

-- --- 2) Panier serveur -----------------------------------------------------------
-- Contrairement à `orders`, aucun montant n'est engagé ici : le client écrit
-- directement sa propre ligne. Les prix sont de toute façon recalculés côté
-- serveur au moment de la relance comme de la commande.
create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  reminded_at timestamptz
);
alter table public.carts enable row level security;

drop policy if exists carts_select_own on public.carts;
create policy carts_select_own on public.carts
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists carts_insert_own on public.carts;
create policy carts_insert_own on public.carts
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists carts_update_own on public.carts;
create policy carts_update_own on public.carts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists carts_delete_own on public.carts;
create policy carts_delete_own on public.carts
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.carts to authenticated;

-- `updated_at` et `reminded_at` ne sont jamais pilotés par le client : le trigger
-- les recalcule. Sans lui, un client pouvait remettre reminded_at à NULL en boucle
-- et se faire relancer autant de fois qu'il le voulait. reminded_at n'est remis à
-- zéro que si le contenu du panier a réellement changé.
--
-- SECURITY INVOKER (défaut) est ESSENTIEL : en SECURITY DEFINER, `current_user`
-- vaut le propriétaire de la fonction, jamais le rôle appelant — la sortie
-- anticipée prévue pour le batch de relance ne se déclencherait jamais et le
-- reminded_at écrit par le cron serait aussitôt écrasé.
create or replace function public.carts_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.reminded_at := null;
  elsif new.items is distinct from old.items then
    new.reminded_at := null;
  else
    new.reminded_at := old.reminded_at;
  end if;
  return new;
end;
$$;

drop trigger if exists carts_touch_trg on public.carts;
create trigger carts_touch_trg
  before insert or update on public.carts
  for each row execute function public.carts_touch();

create index if not exists carts_pending_reminder_idx
  on public.carts (updated_at)
  where reminded_at is null;

-- --- 3) Planification ------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

-- Le secret est lu dans app_secrets au moment de l'appel : il n'apparaît pas dans
-- la définition du job, donc pas dans cron.job pour un lecteur de la base.
create or replace function public.run_reminders()
returns void
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  k text;
  base text;
begin
  select v into k from public.app_secrets where app_secrets.k = 'cron';
  if k is null then
    raise notice 'run_reminders: secret cron absent, rien à faire';
    return;
  end if;
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url' limit 1;
  if base is null then
    base := 'https://pgqoojmmovsoalruxomj.supabase.co';
  end if;
  perform net.http_post(
    url     := base || '/functions/v1/mollie3',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('action', 'cron', 'key', k),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.run_reminders() from public, anon, authenticated;

select cron.unschedule('pxl-reminders-hourly')
where exists (select 1 from cron.job where jobname = 'pxl-reminders-hourly');

select cron.schedule('pxl-reminders-hourly', '17 * * * *', $$select public.run_reminders();$$);
