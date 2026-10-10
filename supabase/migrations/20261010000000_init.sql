-- ============================================================
-- Help_me — Schéma complet Supabase
-- À exécuter UNE FOIS dans Supabase > SQL Editor > New query
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Tables ----------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  phone text,
  priority int default 1,
  confirm_token uuid not null unique default gen_random_uuid(),
  confirmed boolean default false,
  telegram_chat_id bigint,
  push_subscription jsonb,
  linked_user_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','resolved','cancelled')),
  track_token uuid not null unique default gen_random_uuid(),
  message text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists alert_locations (
  id bigserial primary key,
  alert_id uuid not null references alerts(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy real,
  created_at timestamptz default now()
);

create table if not exists alert_messages (
  id bigserial primary key,
  alert_id uuid not null references alerts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel text not null check (channel in ('telegram','push')),
  telegram_message_id bigint,
  created_at timestamptz default now()
);

create table if not exists push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subscription jsonb not null,
  endpoint text generated always as (subscription->>'endpoint') stored unique,
  created_at timestamptz default now()
);

create table if not exists authorities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  webhook_url text,
  active boolean default false
);

create index if not exists alerts_user_created_idx on alerts (user_id, created_at desc);
create index if not exists alerts_status_idx on alerts (status);
create index if not exists alert_locations_alert_idx on alert_locations (alert_id, created_at desc);
create index if not exists contacts_user_idx on contacts (user_id);
create index if not exists contacts_linked_idx on contacts (linked_user_id);

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table contacts enable row level security;
alter table alerts enable row level security;
alter table alert_locations enable row level security;
alter table alert_messages enable row level security;
alter table push_devices enable row level security;
alter table authorities enable row level security;  -- aucune policy : accessible uniquement via service_role

-- Propriétaire
create policy "own profile" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "own contacts" on contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own alerts" on alerts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own locations" on alert_locations for all
  using (exists (select 1 from alerts a where a.id = alert_id and a.user_id = auth.uid()))
  with check (exists (select 1 from alerts a where a.id = alert_id and a.user_id = auth.uid()));

create policy "own messages" on alert_messages for select
  using (exists (select 1 from alerts a where a.id = alert_id and a.user_id = auth.uid()));

create policy "own devices" on push_devices for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Gardiens (proches ayant un compte et confirmés)
create policy "guardian sees own link" on contacts for select
  using (linked_user_id = auth.uid());

create policy "guardians read alerts" on alerts for select using (
  exists (select 1 from contacts c
          where c.user_id = alerts.user_id
            and c.linked_user_id = auth.uid()
            and c.confirmed)
);

create policy "guardians read locations" on alert_locations for select using (
  exists (select 1 from alerts a join contacts c on c.user_id = a.user_id
          where a.id = alert_locations.alert_id
            and c.linked_user_id = auth.uid()
            and c.confirmed)
);

create policy "guardians read protected profile" on profiles for select using (
  exists (select 1 from contacts c
          where c.user_id = profiles.id
            and c.linked_user_id = auth.uid()
            and c.confirmed)
);

-- ---------- Création automatique du profil ----------
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Temps réel (respecte la RLS) ----------
alter publication supabase_realtime add table alerts;
alter publication supabase_realtime add table alert_locations;
