-- Données de l'espace artisan Biltov, enregistrées en ligne.
-- Une ligne par collection (clients, jobs, docs…) et par compte, comme le cache local de l'appareil.
-- La clé publiable est visible dans le site : toute la protection repose sur les règles RLS ci-dessous.

create table if not exists public.account_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.account_data enable row level security;

drop policy if exists "account_data: lecture par le titulaire" on public.account_data;
create policy "account_data: lecture par le titulaire" on public.account_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "account_data: création par le titulaire" on public.account_data;
create policy "account_data: création par le titulaire" on public.account_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "account_data: modification par le titulaire" on public.account_data;
create policy "account_data: modification par le titulaire" on public.account_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "account_data: suppression par le titulaire" on public.account_data;
create policy "account_data: suppression par le titulaire" on public.account_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Fichiers (photos de chantier, tickets, plans, signatures…) : bucket privé, un dossier par compte
-- (« <user_id>/photo/<id> »). Chaque compte ne voit que son dossier.
insert into storage.buckets (id, name, public)
values ('biltov', 'biltov', false)
on conflict (id) do nothing;

drop policy if exists "biltov: lecture de son dossier" on storage.objects;
create policy "biltov: lecture de son dossier" on storage.objects
  for select to authenticated
  using (bucket_id = 'biltov' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "biltov: dépôt dans son dossier" on storage.objects;
create policy "biltov: dépôt dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'biltov' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "biltov: remplacement dans son dossier" on storage.objects;
create policy "biltov: remplacement dans son dossier" on storage.objects
  for update to authenticated
  using (bucket_id = 'biltov' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'biltov' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "biltov: suppression dans son dossier" on storage.objects;
create policy "biltov: suppression dans son dossier" on storage.objects
  for delete to authenticated
  using (bucket_id = 'biltov' and (storage.foldername(name))[1] = (select auth.uid())::text);
