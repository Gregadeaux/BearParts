-- Per-user Onshape OAuth connection. Tokens are only ever read server-side;
-- RLS locks each row to its owner so no teammate can see another's tokens.

create table public.onshape_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  onshape_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onshape_accounts enable row level security;

create policy "users read own onshape account" on public.onshape_accounts
  for select to authenticated using (user_id = auth.uid());

create policy "users insert own onshape account" on public.onshape_accounts
  for insert to authenticated with check (user_id = auth.uid());

create policy "users update own onshape account" on public.onshape_accounts
  for update to authenticated using (user_id = auth.uid());

create policy "users delete own onshape account" on public.onshape_accounts
  for delete to authenticated using (user_id = auth.uid());
