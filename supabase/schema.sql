-- Devis Viviworks : à coller dans Supabase > SQL Editor > Run
-- Ensuite : Authentication > Providers > Email
-- Pour un usage interne, tu peux désactiver « Confirm email ».

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.devis (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.fiches (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  marque text not null,
  nom text not null,
  taille bigint,
  path text not null,
  ajoute bigint
);

create index if not exists clients_user_idx on public.clients (user_id);
create index if not exists devis_user_idx on public.devis (user_id);
create index if not exists fiches_user_idx on public.fiches (user_id);

alter table public.settings enable row level security;
alter table public.clients enable row level security;
alter table public.devis enable row level security;
alter table public.fiches enable row level security;

drop policy if exists "settings_own" on public.settings;
create policy "settings_own" on public.settings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "clients_own" on public.clients;
create policy "clients_own" on public.clients
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "devis_own" on public.devis;
create policy "devis_own" on public.devis
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.settings to authenticated;
grant select, insert, update, delete on table public.clients to authenticated;
grant select, insert, update, delete on table public.devis to authenticated;
grant select, insert, update, delete on table public.fiches to authenticated;

drop policy if exists "fiches_own" on public.fiches;
create policy "fiches_own" on public.fiches
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('viviworks', 'viviworks', false)
on conflict (id) do nothing;

drop policy if exists "viviworks_read" on storage.objects;
create policy "viviworks_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'viviworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "viviworks_insert" on storage.objects;
create policy "viviworks_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'viviworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "viviworks_update" on storage.objects;
create policy "viviworks_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'viviworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'viviworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "viviworks_delete" on storage.objects;
create policy "viviworks_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'viviworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
